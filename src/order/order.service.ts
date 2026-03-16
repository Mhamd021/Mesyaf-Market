import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create_order.dto';
import { Order, OrderStatus, OrderType } from '@prisma/client';
import { DelivererAssignmentService } from 'src/deliverer/deliverer-assignment.service';
import { VendorGateway } from 'src/vendor/vendor.gateway';
import { CustomerGateway } from 'src/users/customer.gateway';
import { EventLogService } from 'src/common/events/event-log.service';
import { EVENTS } from 'src/common/events/events.constants';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class OrderService 
{

  
    
  
    private CITY_TYPE = process.env.CITY_TYPE || 'MEDIUM';
    private CITY_RULES = 
    {
    SMALL: {
      MAX_VENDOR_DIST: 120,      
      MAX_DELAY_THRESHOLD: 7,     
      WINDOW_MIN: 3,
    },
    MEDIUM: {
      MAX_VENDOR_DIST: 60,
      MAX_DELAY_THRESHOLD: 5,
      WINDOW_MIN: 4,
    },
    LARGE: {
      MAX_VENDOR_DIST: 20,
      MAX_DELAY_THRESHOLD: 3,
      WINDOW_MIN: 3,
    }
  };

  private FOOD_MAX_BATCH = 3;
  private GROCERY_MAX_BATCH = 5;
  private calcDistanceKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLng = (b.lng - a.lng) * (Math.PI / 180);

  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(h));
}
private estimateDelay(order, batchOrders, speedKmPerHour = 30) 
{
  const speedKmPerMin = speedKmPerHour / 60;

  const soloDistance = this.calcDistanceKm(
    { lat: order.vendorLat, lng: order.vendorLng },
    { lat: order.customerLat, lng: order.customerLng }
  );
  const soloTime = soloDistance / speedKmPerMin;

  let routeTime = 0;
  let currentPoint = { lat: order.vendorLat, lng: order.vendorLng };

  for (const o of batchOrders) {
    const dist = this.calcDistanceKm(currentPoint, { lat: o.customerLat, lng: o.customerLng });
    routeTime += dist / speedKmPerMin;
    currentPoint = { lat: o.customerLat, lng: o.customerLng };
  }

  const delay = routeTime - soloTime;


  return delay;     
}
    constructor(private readonly prisma: PrismaService,
      private readonly delivererAssignment: DelivererAssignmentService,
      private readonly vendorGateway:VendorGateway,
      private readonly costumerGateway:CustomerGateway,
      private readonly eventLogService: EventLogService,
      private readonly logger: AppLogger,
    )
    {
          this.logger.setContext(OrderService.name);

    }
    async createOrder(dto: CreateOrderDto , vendorId: number , costumerId: number,)
    {
      try {
        const vendor = await this.prisma.vendorProfile.findUnique({ where: { id: vendorId}, select:{ isActive:true,isVerified:true, latitude: true, longitude: true } });
      if (!vendor) throw new NotFoundException('Vendor profile not found');
          if (!vendor.isActive || !vendor.isVerified) 
          {
            throw new ForbiddenException('Vendor profile is inactive or not verified');
          }

      const order = await this.prisma.order.create({
        data: 
        {
          vendorId: vendorId,
          customerId: costumerId,
          customerAddress: dto.customerAddress,
          customerLat: dto.customerLat,
          customerLng: dto.customerLng,
          vendorLat:  vendor!.latitude,
          vendorLng:  vendor!.longitude,
          estimatedPrepTime: dto.estimatedPrepTime ?? null,
          deliveryFee: dto.deliveryFee ?? null,
          orderItems: { create: dto.items.map(it => ({ productId: it.productId, quantity: it.quantity, price: it.price })) },
          status:  OrderStatus.PENDING_VENDOR_CONFIRMATION,
          
      }
    });
    
    
    
  await this.eventLogService.recordEvent({
      entityType: 'ORDER',
        entityId: order.id,
        eventType: EVENTS.ORDER.CREATED,
        payload: {
          orderId: order.id,
          status: EVENTS.ORDER.CREATED,
        },
    });

    this.vendorGateway.sendNewOrder(order.vendorId, order);

    return order;
      } catch (e) {
        this.logger.error('createOrderFailed',{
          error: e.message,
          stack: e.stack
        } as any);
        throw e;
      }
      
    }

  


    async vendorMarkReady(orderId: number,userId:number) 
  {
    try
    {
      const vendor = await this.prisma.vendorProfile.findUnique({
      where: {userId:userId}
    });
    
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: { product: { include: { category: true } } }
      }
    }
  });

  if (!order) throw new NotFoundException('Order not found');
  if(!vendor || vendor.id != order.vendorId)
    {
      throw new NotFoundException('Unauthorized');
    }

  const hasFood = order.orderItems.some(
    (item) => item.product.category.name.toLowerCase() === 'food'
  );

  const orderType = hasFood ? OrderType.FOOD : OrderType.GROCERY;

  const updatedOrder = await this.prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.READY_FOR_DELIVERY,
      orderType,
      readyAt: new Date(),
    },
    include: { orderItems: true }
  });

 

  await this.handleReadyOrder(updatedOrder);
  
 await this.eventLogService.recordEvent({
      entityType: 'ORDER',
        entityId: order.id,
        eventType: EVENTS.ORDER.READY,
        payload: {
          orderId: order.id,
          status: EVENTS.ORDER.READY,
        },
    });

      this.costumerGateway.sendOrderReady(order.customerId, order.id);

      


  return updatedOrder;
    }
    catch(e)
    {
      this.logger.error('VendorMarkOrderReadyFailed',{
        error:e.message,
        stack:e.stack
      });
      throw e;
    }
}

private async handleReadyOrder(order: Order) 
{
  const rules = this.CITY_RULES[this.CITY_TYPE];

  let batch = await this.getOpenBatch();

  if (!batch) {
    batch = await this.createNewBatch(order);
    return;
  }
  const eligible = await this.checkBatchEligibility(order, batch, rules);

  if (!eligible) {
    await this.closeBatch(batch.id);
    await this.createNewBatch(order);
    return;
  }
  await this.addOrderToBatch(order, batch.id);

  const updatedBatch = await this.getBatchWithOrders(batch.id);

  if (this.shouldCloseBatch(updatedBatch, rules)) {
    await this.closeBatch(batch.id);
  }
}


private async checkBatchEligibility(order, batch, rules) 
{
  const batchOrders = batch.orders;

  const max = order.orderType === 'FOOD'
    ? this.FOOD_MAX_BATCH
    : this.GROCERY_MAX_BATCH;

  if (batchOrders.length >= max) return false;

  
  const vendorA = { lat: order.vendorLat, lng: order.vendorLng };

  const vendorB = {
    lat: batchOrders[0].vendorLat,
    lng: batchOrders[0].vendorLng,
  };

  const dist = this.calcDistanceKm(vendorA, vendorB) * 1000;
  
  if (dist > rules.MAX_VENDOR_DIST) return false;

  const etaDelay = this.estimateDelay(order, batchOrders);

  if (etaDelay > rules.MAX_DELAY_THRESHOLD) return false;

  

  return true;
}

private shouldCloseBatch(batch, rules) {
  const now = Date.now();
  const createdAt = new Date(batch.createdAt).getTime();
  const ageMin = (now - createdAt) / 60000;

  if (ageMin >= rules.WINDOW_MIN) {
    
    return true;
  }

  const orders = batch.orders;

  if (orders.length === 0) return false;

  const hasFood = orders.some(o => o.orderType === 'FOOD');

  const max = hasFood ? this.FOOD_MAX_BATCH : this.GROCERY_MAX_BATCH;

  if (orders.length >= max) {
    this.logger.debug('Closing batch: max size reached');
    return true;
  }

  return false;
}

private async closeBatch(batchId: number) {
  
  this.logger.log(`Closing batch ${batchId} and assigning deliverer`);

  const result =  await this.prisma.deliveryBatch.update({
    where: { id: batchId ,status:'PENDING'},
    data: {
      status: 'IN_PROGRESS',
    },
  });

  if (!result) {
  this.logger.debug('BatchAlreadyClosed', { batchId });
  return;
}

  this.logger.log('BatchIsClosed',
    {
      batchId:batchId,
    });

  await this.delivererAssignment.assignDelivererToBatch(batchId);

}

private async getOpenBatch()  {
  return this.prisma.deliveryBatch.findFirst({
    where: { status: 'PENDING' },
    include: { orders: true },
  });
}

private async createNewBatch(order: Order) {
  return this.prisma.deliveryBatch.create({
    data: {
      status: 'PENDING',
      orders: {
        connect: { id: order.id },
      },
    },
    include: { orders: true },
  });
}

private async addOrderToBatch(order: Order, batchId: number) {
  await this.prisma.deliveryBatch.update({
    where: { id: batchId },
    data: {
      orders: {
        connect: { id: order.id },
      },
    },
  });
}
private async getBatchWithOrders(batchId: number) {
  return this.prisma.deliveryBatch.findUnique({
    where: { id: batchId },
    include: { orders: true },
  });
}







    
  }
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { JobStatus, Order, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create_order.dto';
import { VendorGateway } from '../vendor/vendor.gateway';
import { CustomerGateway } from '../users/customer.gateway';
import { EventLogService } from '../common/events/event-log.service';
import { AppLogger } from '../common/logger/app-logger.service';
import { EVENTS } from '../common/events/events.constants';
import { QUEUES, JOBS } from '../common/constants/queues';

type Point = { lat: number; lng: number };

type CityRules = {
  MAX_VENDOR_DIST: number; 
  MAX_DELAY_THRESHOLD: number; 
  WINDOW_MIN: number; 
};

type BatchOutcome = { batchId: number; created: boolean; close: boolean };

@Injectable()
export class OrderService {
  private CITY_TYPE = process.env.CITY_TYPE || 'MEDIUM';

  private CITY_RULES: Record<string, CityRules> = {
    SMALL: { MAX_VENDOR_DIST: 120, MAX_DELAY_THRESHOLD: 7, WINDOW_MIN: 3 },
    MEDIUM: { MAX_VENDOR_DIST: 60, MAX_DELAY_THRESHOLD: 5, WINDOW_MIN: 4 },
    LARGE: { MAX_VENDOR_DIST: 20, MAX_DELAY_THRESHOLD: 3, WINDOW_MIN: 3 },
  };

  private ALLOW_MULTI_VENDOR = process.env.ALLOW_MULTI_VENDOR_BATCHING === 'true';

  private FOOD_MAX_BATCH = 3;
  private GROCERY_MAX_BATCH = 5;

  private BATCH_LOCK_KEY = 4242;

  private READYABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING_VENDOR_CONFIRMATION,
    OrderStatus.VENDOR_ACCEPTED,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorGateway: VendorGateway,
    private readonly costumerGateway: CustomerGateway,
    private readonly eventLogService: EventLogService,
    private readonly logger: AppLogger,
    @InjectQueue(QUEUES.DELIVERER_ASSIGNMENT)
    private assignmentQueue: Queue,
    @InjectQueue(QUEUES.BATCH_TIMEOUT)
    private batchTimeoutQueue: Queue,
  ) {}

  private get rules(): CityRules {
    return this.CITY_RULES[this.CITY_TYPE] ?? this.CITY_RULES.MEDIUM;
  }


  private calcDistanceKm(a: Point, b: Point) {
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

  private estimateDelay(order: Order, batchOrders: Order[], speedKmPerHour = 30) {
    if (
      order.vendorLat == null ||
      order.vendorLng == null ||
      order.customerLat == null ||
      order.customerLng == null
    ) {
      return 0;
    }

    const speedKmPerMin = speedKmPerHour / 60;
    const vendorPoint: Point = { lat: order.vendorLat, lng: order.vendorLng };
    const customerPoint: Point = { lat: order.customerLat, lng: order.customerLng };

    const soloDistance = this.calcDistanceKm(vendorPoint, customerPoint);
    const soloTime = soloDistance / speedKmPerMin;

    let routeTime = 0;
    let currentPoint: Point = vendorPoint;

    for (const o of batchOrders) {
      if (o.customerLat == null || o.customerLng == null) continue;

      const stopPoint: Point = { lat: o.customerLat, lng: o.customerLng };
      const dist = this.calcDistanceKm(currentPoint, stopPoint);
      routeTime += dist / speedKmPerMin;
      currentPoint = stopPoint;
    }

    routeTime += this.calcDistanceKm(currentPoint, customerPoint) / speedKmPerMin;

    return routeTime - soloTime;
  }


  async createOrder(dto: CreateOrderDto, vendorId: number, costumerId: number) {
    try {
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { id: vendorId },
        select: { isActive: true, isVerified: true, latitude: true, longitude: true },
      });
      if (!vendor) throw new NotFoundException('Vendor profile not found');
      if (!vendor.isActive || !vendor.isVerified) {
        throw new ForbiddenException('Vendor profile is inactive or not verified');
      }

      const order = await this.prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            vendorId,
            customerId: costumerId,
            customerAddress: dto.customerAddress,
            customerLat: dto.customerLat,
            customerLng: dto.customerLng,
            vendorLat: vendor.latitude,
            vendorLng: vendor.longitude,
            estimatedPrepTime: dto.estimatedPrepTime ?? null,
            deliveryFee: dto.deliveryFee ?? null,
            orderItems: {
              create: dto.items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                price: it.price,
              })),
            },
            status: OrderStatus.PENDING_VENDOR_CONFIRMATION,
          },
        });

        await this.eventLogService.recordEvent(
          {
            entityType: 'ORDER',
            entityId: newOrder.id,
            eventType: EVENTS.ORDER.CREATED,
            payload: {
              orderId: newOrder.id,
              status: OrderStatus.PENDING_VENDOR_CONFIRMATION,
            },
          },
          tx,
        );
        return newOrder;
      });

      this.vendorGateway.sendNewOrder(order.vendorId, order);
      return order;
    } catch (error) {
      this.logger.error('CreateOrderFailed', { vendorId, error });
      throw error;
    }
  }


  async vendorMarkReady(orderId: number, userId: number) {
    try {
      const vendor = await this.prisma.vendorProfile.findUnique({ where: { userId } });

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: { include: { product: { include: { category: true } } } },
        },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (!vendor || vendor.id !== order.vendorId) {
        throw new ForbiddenException('This order does not belong to your shop');
      }

      const hasFood = order.orderItems.some(
        (item) => item.product.category.name.toLowerCase() === 'food',
      );
      const orderType = hasFood ? OrderType.FOOD : OrderType.GROCERY;
      const rules = this.rules;


      const { readyOrder, batching } = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: orderId, status: { in: this.READYABLE_STATUSES } },
          data: {
            status: OrderStatus.READY_FOR_DELIVERY,
            orderType,
            readyAt: new Date(),
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException('Order was already marked ready or cannot be marked ready');
        }

        const readyOrder = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { orderItems: true },
        });

        const batching = await this.assignToBatch(readyOrder, rules, tx);

        await this.eventLogService.recordEvent(
          {
            entityType: 'ORDER',
            entityId: orderId,
            eventType: EVENTS.ORDER.READY,
            payload: { orderId, status: OrderStatus.READY_FOR_DELIVERY },
          },
          tx,
        );

        return { readyOrder, batching };
      });

      try {
        await this.afterBatching(batching, rules);
      } catch (error) {
        this.logger.error('PostCommitBatchingStepFailed', { batchId: batching.batchId, error });
      }

      this.costumerGateway.sendOrderReady(order.customerId, order.id);
      return readyOrder;
    } catch (error) {
      this.logger.error('VendorMarkOrderReadyFailed', { orderId, error });
      throw error;
    }
  }


  private async assignToBatch(
    order: Order,
    rules: CityRules,
    tx: Prisma.TransactionClient,
  ): Promise<BatchOutcome> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${this.BATCH_LOCK_KEY}::bigint)`;

    const openBatches = await tx.deliveryBatch.findMany({
      where: { status: JobStatus.PENDING },
      include: { orders: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const batch of openBatches) {
      if (!this.checkBatchEligibility(order, batch.orders, rules)) continue;

      await tx.deliveryBatch.update({
        where: { id: batch.id },
        data: { orders: { connect: { id: order.id } } },
      });

      const withNewOrder = { createdAt: batch.createdAt, orders: [...batch.orders, order] };
      return {
        batchId: batch.id,
        created: false,
        close: this.shouldCloseBatch(withNewOrder, rules),
      };
    }

    // No open batch fits. Open a new one and leave the others to close on their own
    // (size limit or timeout) instead of dispatching them half-full.
    const created = await tx.deliveryBatch.create({
      data: { status: JobStatus.PENDING, orders: { connect: { id: order.id } } },
    });
    return { batchId: created.id, created: true, close: false };
  }

  private async afterBatching(outcome: BatchOutcome, rules: CityRules) {
    if (outcome.created) await this.scheduleBatchTimeout(outcome.batchId, rules);
    if (outcome.close) await this.closeBatch(outcome.batchId);
  }

  private async scheduleBatchTimeout(batchId: number, rules: CityRules) {
    await this.batchTimeoutQueue.add(
      JOBS.CLOSE_BATCH_TIMEOUT,
      { batchId },
      {
        delay: rules.WINDOW_MIN * 60 * 1000,
        jobId: `batch-timeout-${batchId}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private checkBatchEligibility(order: Order, batchOrders: Order[], rules: CityRules): boolean {
    if (batchOrders.length === 0) return true;

    if (!this.ALLOW_MULTI_VENDOR && batchOrders.some((o) => o.vendorId !== order.vendorId)) {
      return false;
    }

    const max = order.orderType === OrderType.FOOD ? this.FOOD_MAX_BATCH : this.GROCERY_MAX_BATCH;
    if (batchOrders.length >= max) return false;

    const vendorA = { lat: order.vendorLat!, lng: order.vendorLng! };
    const vendorB = { lat: batchOrders[0].vendorLat!, lng: batchOrders[0].vendorLng! };

    const distMetres = this.calcDistanceKm(vendorA, vendorB) * 1000;
    if (distMetres > rules.MAX_VENDOR_DIST) return false;

    const etaDelay = this.estimateDelay(order, batchOrders);
    if (etaDelay > rules.MAX_DELAY_THRESHOLD) return false;

    return true;
  }

  private shouldCloseBatch(
    batch: { createdAt: Date; orders: Order[] },
    rules: CityRules,
  ): boolean {
    const ageMin = (Date.now() - new Date(batch.createdAt).getTime()) / 60000;
    if (ageMin >= rules.WINDOW_MIN) return true;

    if (batch.orders.length === 0) return false;

    const hasFood = batch.orders.some((o) => o.orderType === OrderType.FOOD);
    const max = hasFood ? this.FOOD_MAX_BATCH : this.GROCERY_MAX_BATCH;

    if (batch.orders.length >= max) {
      this.logger.debug('ClosingBatchMaxSizeReached');
      return true;
    }
    return false;
  }

  private async closeBatch(batchId: number) {
    this.logger.log('ClosingBatch', { batchId });

    const result = await this.prisma.deliveryBatch.updateMany({
      where: { id: batchId, status: JobStatus.PENDING },
      data: { status: JobStatus.IN_PROGRESS },
    });

    if (result.count === 0) {
      this.logger.debug('BatchAlreadyClosed', { batchId });
      return;
    }

    await this.assignmentQueue.add(
      JOBS.ASSIGN_DELIVERER,
      { batchId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('AssignmentJobQueued', { batchId });
  }

  @Cron('*/1 * * * *')
  async closeExpiredBatches() {

    const cutoff = new Date(Date.now() - (this.rules.WINDOW_MIN + 1) * 60 * 1000);

    const expired = await this.prisma.deliveryBatch.findMany({
      where: { status: JobStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true },
    });

    for (const batch of expired) {
      try {
        this.logger.warn('ExpiredBatchRecovered', { batchId: batch.id });
        await this.closeBatch(batch.id);
      } catch (error) {
        this.logger.error('ExpiredBatchRecoveryFailed', { batchId: batch.id, error });
      }
    }
  }

  async forceCloseBatchFromTimeout(batchId: number) {
    this.logger.log('BatchTimeoutFired', { batchId });
    await this.closeBatch(batchId);
  }
}
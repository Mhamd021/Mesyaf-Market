import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DelivererProfile, JobStatus, OrderStatus } from '@prisma/client';
import { DelivererGateway } from './deliverer.gateway';
import { CustomerGateway } from '../users/customer.gateway';
import { AppLogger } from '../common/logger/app-logger.service';
import { EventLogService } from '../common/events/event-log.service';
import { EVENTS } from '../common/events/events.constants';



@Injectable()
export class DelivererAssignmentService {

  


  constructor(private readonly prisma: PrismaService,private readonly delivererGateway: DelivererGateway,
    private readonly costumerGateway:CustomerGateway,private readonly eventLogService:EventLogService,
    private readonly logger: AppLogger,

  ) {
            this.logger.setContext(DelivererAssignmentService.name);

   }

  private calcDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private findClosestDeliverer(
    deliverers: DelivererProfile[],
    pickupLat: number,
    pickupLng: number,
  ): DelivererProfile | null {
    let closest: DelivererProfile | null = null;
    let minDistance = Infinity;

    for (const d of deliverers) {
      if (d.currentLat == null || d.currentLng == null) continue;

      const dist = this.calcDistanceKm(
        pickupLat,
        pickupLng,
        d.currentLat,
        d.currentLng,
      );

      if (dist < minDistance) {
        minDistance = dist;
        closest = d;
      }
    }

    return closest;
  }



  async assignDelivererToBatch(batchId: number) {
  try
  {
    const batch = await this.prisma.deliveryBatch.findUnique({
    where: { id: batchId },
    include: { orders: true },
  });

  if (!batch || batch.orders.length === 0) {
  this.logger.warn('BatchEmptyOrNotFound',
    
    { batchId } as any);
  return;
}

if (batch.delivererId) {
  this.logger.debug('BatchAlreadyAssigned', { batchId } as any);
  return;
}


  const pickupLat = batch.orders[0].vendorLat;
  const pickupLng = batch.orders[0].vendorLng;

  if (pickupLat == null || pickupLng == null) {
  this.logger.warn('BatchMissingVendorCoordinates', { batchId });
  return;
}

  const availableDeliverers = await this.prisma.delivererProfile.findMany({
    where: { availability: true, activeJobId: null },
  });
  
  if (!availableDeliverers.length) {
  this.logger.warn('NoAvailableDeliverers', { batchId });
  return;
}


  const deliverer = this.findClosestDeliverer(
    availableDeliverers,
    pickupLat,
    pickupLng,
  );
  
  if (!deliverer) {
  this.logger.warn('NoClosestDelivererFound', { batchId });
  return;
}


  
  const job = await this.prisma.$transaction(async (tx) => {
    //  create job
    const job = await tx.deliveryJob.upsert({
      where: {
        batchId,
      },
      create:
      {
        delivererId: deliverer.id,
        batchId:batchId,
        status: JobStatus.ASSIGNED,
        totalOrders: batch.orders.length,
      },
      update: {
        delivererId: deliverer.id,
        status: JobStatus.ASSIGNED,
        totalOrders: batch.orders.length,
        assignedAt: new Date(),
        startedAt: null,
        completedAt: null,
      }
    });

    // update batch
   const updatedBatch = await tx.deliveryBatch.updateMany({
      where: { id: batchId ,delivererId: null,status: JobStatus.IN_PROGRESS},
      data: { delivererId: deliverer.id },
    });
    if(updatedBatch.count ===0) throw new ConflictException()
      
   
    

    //  update deliverer
    await tx.delivererProfile.update({
      where: { id: deliverer.id },
      data: {
        availability: false,
        activeJobId: job.id,
      },
    });

    //  update orders
    await tx.order.updateMany({
      where: { deliveryBatchId: batchId },
      data: {
        delivererId: deliverer.id,
        deliveryJobId: job.id,
        status: OrderStatus.WAITING_FOR_DELIVERER,
      },
    });

    //  create dropoffs
    await tx.deliveryDropOff.deleteMany({
      where: { jobId: job.id },
    });

    const dropOffsData = batch.orders.map((order, index) => ({
      jobId: job.id,
      orderId: order.id,
      sequence: index,
      dropoffLat: order.customerLat,
      dropoffLng: order.customerLng,
    }));

    await tx.deliveryDropOff.createMany({
      data: dropOffsData,
    });

    return job;
  });

  

  await this.eventLogService.recordEvent({
    entityType: 'JOB',
    entityId: job.id,
    eventType: EVENTS.JOB.ASSIGNED,
    payload: {
      jobId: job.id,
      status: EVENTS.JOB.ASSIGNED,
    },
  });
  
  this.delivererGateway.sendJobAssigned(deliverer.id, {
    jobId: job.id,
    batchId,
    totalOrders: batch.orders.length,
  });

  for (const order of batch.orders) {
    this.costumerGateway.sendDelivererAssigned(
      order.customerId,
      job.id,
      deliverer.id,
    );
  }
 
  }
  catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error('AssignDelivererToBatchFailed', {
      batchId,
      error: message,
      stack,
    } as any);

    throw error;
  }
}





}



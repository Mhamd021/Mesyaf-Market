import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { DelivererProfile, JobStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DelivererGateway } from './deliverer.gateway';
import { CustomerGateway } from '../users/customer.gateway';
import { AppLogger } from '../common/logger/app-logger.service';
import { EventLogService } from '../common/events/event-log.service';
import { EVENTS } from '../common/events/events.constants';
import { DelivererLocationService } from './deliverer-location-service';

export class NoDelivererAvailableError extends Error {
  constructor(public readonly batchId: number) {
    super(`No available deliverers for batch ${batchId}`);
  }
}

@Injectable()
export class DelivererAssignmentService {
  private readonly PRESENCE_WINDOW_MS = 2 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivererGateway: DelivererGateway,
    private readonly costumerGateway: CustomerGateway,
    private readonly eventLogService: EventLogService,
    private readonly logger: AppLogger,
    private readonly locationService: DelivererLocationService,
  ) {}

  private calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

      const dist = this.calcDistanceKm(pickupLat, pickupLng, d.currentLat, d.currentLng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = d;
      }
    }
    return closest;
  }

  async assignDelivererToBatch(batchId: number) {
    try {
      const batch = await this.prisma.deliveryBatch.findUnique({
        where: { id: batchId },
        include: { orders: { orderBy: { readyAt: 'asc' } } },
      });

      if (!batch || batch.orders.length === 0) {
        this.logger.warn('BatchEmptyOrNotFound', { batchId });
        return;
      }

      if (batch.delivererId) {
        this.logger.debug('BatchAlreadyAssigned', { batchId });
        return;
      }

      const pickupLat = batch.orders[0].vendorLat;
      const pickupLng = batch.orders[0].vendorLng;

      if (pickupLat == null || pickupLng == null) {
        this.logger.warn('BatchMissingVendorCoordinates', { batchId });
        return;
      }

      const availableDeliverers = await this.prisma.delivererProfile.findMany({
        where: {
          availability: true,
          activeJobId: null,
          user: {
            isOnline: true,
            lastSeenAt: { gt: new Date(Date.now() - this.PRESENCE_WINDOW_MS) },
          },
        },
      });

      if (!availableDeliverers.length) {
        throw new NoDelivererAvailableError(batchId);
      }

      const fresh = await this.locationService.getMany(availableDeliverers.map((d) => d.id));
      const withLocation = availableDeliverers.map((d) => {
        const f = fresh.get(d.id);
        return f ? { ...d, currentLat: f.lat, currentLng: f.lng } : d;
      });

      const deliverer =
        this.findClosestDeliverer(withLocation, pickupLat, pickupLng) ?? withLocation[0];

      const job = await this.prisma.$transaction(async (tx) => {
        const job = await tx.deliveryJob.upsert({
          where: { batchId },
          create: {
            delivererId: deliverer.id,
            batchId,
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
          },
        });

        const updatedBatch = await tx.deliveryBatch.updateMany({
          where: { id: batchId, delivererId: null, status: JobStatus.IN_PROGRESS },
          data: { delivererId: deliverer.id },
        });
        if (updatedBatch.count === 0) throw new ConflictException('Batch already claimed');

        const updatedDeliverer = await tx.delivererProfile.updateMany({
          where: { id: deliverer.id, availability: true, activeJobId: null },
          data: { availability: false, activeJobId: job.id },
        });
        if (updatedDeliverer.count === 0) throw new ConflictException('Deliverer no longer available');

        await tx.order.updateMany({
          where: { deliveryBatchId: batchId },
          data: {
            delivererId: deliverer.id,
            deliveryJobId: job.id,
            status: OrderStatus.WAITING_FOR_DELIVERER,
          },
        });

        await tx.deliveryDropOff.deleteMany({ where: { jobId: job.id } });
        await tx.deliveryDropOff.createMany({
          data: batch.orders.map((order, index) => ({
            jobId: job.id,
            orderId: order.id,
            sequence: index,
            dropoffLat: order.customerLat,
            dropoffLng: order.customerLng,
          })),
        });

        await this.eventLogService.recordEvent(
          {
            entityType: 'JOB',
            entityId: job.id,
            eventType: EVENTS.JOB.ASSIGNED,
            payload: { jobId: job.id, status: JobStatus.ASSIGNED },
          },
          tx,
        );

        return job;
      });

  
      try {
        this.delivererGateway.sendJobAssigned(deliverer.id, {
          jobId: job.id,
          batchId,
          totalOrders: batch.orders.length,
        });

        for (const order of batch.orders) {
          this.costumerGateway.sendDelivererAssigned(order.customerId, job.id, deliverer.id);
        }
      } catch (error) {
        this.logger.error('AssignmentNotificationFailed', { batchId, jobId: job.id, error });
      }

      this.logger.log('DelivererAssigned', { batchId, delivererId: deliverer.id, jobId: job.id });
    } catch (error: unknown) {
      if (error instanceof NoDelivererAvailableError) {
        this.logger.warn('NoAvailableDeliverers', { batchId });
        throw error; 
      }
      if (error instanceof HttpException) {
        this.logger.warn('AssignmentConflict', { batchId, reason: error.message });
        throw error;
      }
      this.logger.error('AssignDelivererToBatchFailed', { batchId, error });
      throw error;
    }
  }
}
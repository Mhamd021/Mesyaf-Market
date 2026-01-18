import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DelivererProfile, JobStatus, OrderStatus } from '@prisma/client';
import { DelivererGateway } from './deliverer.gateway';


@Injectable()
export class DelivererAssignmentService {

  private readonly logger = new Logger(DelivererAssignmentService.name);

  constructor(private readonly prisma: PrismaService,private readonly delivererGateway: DelivererGateway) { }

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
    this.logger.log(`Assigning deliverer to batch ${batchId}`);
    const batch = await this.prisma.deliveryBatch.findUnique({
      where: { id: batchId },
      include: { orders: true },
    });
    if (!batch || batch.orders.length === 0) {
      this.logger.warn(`Batch ${batchId} not found or empty`);
      return;
    }
    const pickupLat = batch.orders[0].vendorLat;
    const pickupLng = batch.orders[0].vendorLng;

   if (pickupLat == null || pickupLng == null)
 {
      this.logger.warn(`Batch ${batchId} has no pickup location`);
      return;
    }
    if (batch.delivererId) {
      this.logger.warn(`Batch ${batchId} already assigned`);
      return;
    }
    const availableDeliverers = await this.prisma.delivererProfile.findMany({
      where: {
        availability: true,
        activeJobId: null,
      },
    });
    if (availableDeliverers.length === 0) {
      this.logger.log('No available deliverers right now');
      return;
    }

    const deliverer = this.findClosestDeliverer(
      availableDeliverers,
      pickupLat,
      pickupLng,
    );

    if (!deliverer) {
      this.logger.warn('No deliverer with valid location found');
      return;
    }

    const job = await this.prisma.deliveryJob.create({
      data: {
        delivererId: deliverer.id,
        status: JobStatus.PENDING,
        totalOrders: batch.orders.length,
      },
    });
    
    this.delivererGateway.sendJobAssigned(deliverer.id, {
      jobId: job.id,
      batchId: batch.id,
      totalOrders: batch.orders.length,
    });

    await this.prisma.deliveryBatch.update({
      where: { id: batchId },
      data: {
        delivererId: deliverer.id,
      },
    });

    await this.prisma.delivererProfile.update({
      where: { id: deliverer.id },
      data: {
        availability: false,
        activeJobId: job.id,
      },
    });

    await this.prisma.order.updateMany({
      where: { deliveryBatchId: batchId },
      data: {
        delivererId: deliverer.id,
        deliveryJobId: job.id,
        status: OrderStatus.WAITING_FOR_DELIVERER,
      },
    });

    const dropOffsData = batch.orders.map((order, index) => ({
      jobId: job.id,
      orderId: order.id,
      sequence: index,
      dropoffLat: order.customerLat,
      dropoffLng: order.customerLng,
    }));

    await this.prisma.deliveryDropOff.createMany({
      data: dropOffsData,
    });





  }


}


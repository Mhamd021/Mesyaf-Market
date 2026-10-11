import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobStatus, OrderStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogService } from '../common/events/event-log.service';
import { EVENTS } from '../common/events/events.constants';
import { JOBS, QUEUES } from '../common/constants/queues';
import { AppLogger } from '../common/logger/app-logger.service';
import { DelivererLocationService } from './deliverer-location-service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DelivererJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogService: EventLogService,
    private readonly locationService: DelivererLocationService,
    private readonly logger: AppLogger,
    @InjectQueue(QUEUES.DELIVERER_ASSIGNMENT)
    private assignmentQueue: Queue,
  ) {}


  async startJob(jobId: number, delivererId: number) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const started = await tx.deliveryJob.updateMany({
          where: { id: jobId, delivererId, status: JobStatus.ASSIGNED },
          data: { status: JobStatus.IN_PROGRESS, startedAt: new Date() },
        });

        if (started.count === 0) {
          const job = await tx.deliveryJob.findUnique({
            where: { id: jobId },
            select: { delivererId: true },
          });
          if (!job) throw new NotFoundException('Job not found');
          if (job.delivererId !== delivererId) throw new ForbiddenException('Not your job');
          throw new ConflictException('Job already started or not in a startable state');
        }

        await tx.order.updateMany({
          where: { deliveryJobId: jobId },
          data: { status: OrderStatus.IN_PROGRESS },
        });

        await this.eventLogService.recordEvent(
          {
            entityType: 'JOB',
            entityId: jobId,
            eventType: EVENTS.JOB.STARTED,
            payload: { jobId, status: JobStatus.IN_PROGRESS },
          },
          tx,
        );
      });

      return { success: true };
    } catch (error) {
      this.logFailure('StartJobFailed', { jobId, delivererId }, error);
      throw error;
    }
  }


  async completeDropOff(jobId: number, dropOffId: number, delivererId: number) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
     
        await tx.$queryRaw`SELECT id FROM "DeliveryJob" WHERE id = ${jobId} FOR UPDATE`;

        const job = await tx.deliveryJob.findUnique({
          where: { id: jobId },
          select: { delivererId: true, status: true, batchId: true },
        });
        if (!job) throw new NotFoundException('Job not found');
        if (job.delivererId !== delivererId) throw new ForbiddenException('Not your job');
        if (job.status !== JobStatus.IN_PROGRESS) throw new BadRequestException('Job not in progress');

       
        const claimed = await tx.deliveryDropOff.updateMany({
          where: { id: dropOffId, jobId, status: { not: JobStatus.COMPLETED } },
          data: { status: JobStatus.COMPLETED, completedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new ConflictException('Drop-off already completed or not part of this job');
        }

        const dropOff = await tx.deliveryDropOff.findUniqueOrThrow({
          where: { id: dropOffId },
          select: { orderId: true },
        });

        const orderDone = await tx.order.updateMany({
          where: { id: dropOff.orderId, status: { not: OrderStatus.COMPLETED } },
          data: { status: OrderStatus.COMPLETED, deliveredAt: new Date() },
        });

        if (orderDone.count === 1) {
          await this.eventLogService.recordEvent(
            {
              entityType: 'ORDER',
              entityId: dropOff.orderId,
              eventType: EVENTS.ORDER.COMPLETED,
              payload: { orderId: dropOff.orderId, status: OrderStatus.COMPLETED },
            },
            tx,
          );
        }

        const remaining = await tx.deliveryDropOff.count({
          where: { jobId, status: { not: JobStatus.COMPLETED } },
        });

        const jobCompleted = remaining === 0;
        if (jobCompleted) await this.finishJob(tx, jobId, delivererId, job.batchId);

        return { jobCompleted };
      });

      if (result.jobCompleted) await this.afterJobCompleted(delivererId);

      return { success: true, jobCompleted: result.jobCompleted };
    } catch (error) {
      this.logFailure('CompleteDropOffFailed', { jobId, dropOffId, delivererId }, error);
      throw error;
    }
  }


  async completeJob(jobId: number, delivererId: number) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "DeliveryJob" WHERE id = ${jobId} FOR UPDATE`;

        const job = await tx.deliveryJob.findUnique({
          where: { id: jobId },
          select: { delivererId: true, status: true, batchId: true },
        });
        if (!job) throw new NotFoundException('Job not found');
        if (job.delivererId !== delivererId) throw new ForbiddenException('Not your job');
        if (job.status !== JobStatus.IN_PROGRESS) throw new BadRequestException('Job not in progress');

        await this.finishJob(tx, jobId, delivererId, job.batchId);
      });

      await this.afterJobCompleted(delivererId);
      return { success: true };
    } catch (error) {
      this.logFailure('CompleteJobFailed', { jobId, delivererId }, error);
      throw error;
    }
  }

  private async finishJob(tx: Tx, jobId: number, delivererId: number, batchId: number | null) {
    const done = await tx.deliveryJob.updateMany({
      where: { id: jobId, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    });
    if (done.count === 0) throw new ConflictException('Job already completed');

    if (batchId != null) {
      await tx.deliveryBatch.update({
        where: { id: batchId },
        data: { status: JobStatus.COMPLETED },
      });
    }

    await tx.delivererProfile.update({
      where: { id: delivererId },
      data: { availability: true, activeJobId: null },
    });

    await tx.order.updateMany({
      where: { deliveryJobId: jobId, status: { not: OrderStatus.COMPLETED } },
      data: { status: OrderStatus.COMPLETED, deliveredAt: new Date() },
    });

    await this.eventLogService.recordEvent(
      {
        entityType: 'JOB',
        entityId: jobId,
        eventType: EVENTS.JOB.COMPLETED,
        payload: { jobId, status: JobStatus.COMPLETED },
      },
      tx,
    );
  }

  private async afterJobCompleted(delivererId: number) {
    try {
      await this.locationService.flushToDb(delivererId);
    } catch (error) {
      this.logger.error('LocationFlushAfterJobFailed', { delivererId, error });
    }

    try {
      const stuckBatch = await this.prisma.deliveryBatch.findFirst({
        where: { status: JobStatus.IN_PROGRESS, delivererId: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (stuckBatch) {
        await this.assignmentQueue.add(
          JOBS.ASSIGN_DELIVERER,
          { batchId: stuckBatch.id },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log('StuckBatchRequeuedAfterCompletion', { batchId: stuckBatch.id });
      }
    } catch (error) {
      this.logger.error('RequeueStuckBatchFailed', { error });
    }
  }


  async getDelivererJobs(userId: number, jobStatus?: JobStatus) {
    const deliverer = await this.prisma.delivererProfile.findUnique({ where: { userId } });
    if (!deliverer) throw new NotFoundException('Deliverer profile not found');

    const where: Prisma.DeliveryJobWhereInput = { delivererId: deliverer.id };
    if (jobStatus) where.status = jobStatus;

    return this.prisma.deliveryJob.findMany({
      where,
      include: {
        orders: {
          include: {
            orderItems: { include: { product: true } },
            customer: true,
            vendor: true,
          },
        },
        stops: true,
      },
    });
  }

  async getDelivererByUserId(userId: number) {
    const deliverer = await this.prisma.delivererProfile.findUnique({ where: { userId } });
    if (!deliverer) throw new NotFoundException('Deliverer profile not found');
    return deliverer;
  }

  async validateLiveTracking(jobId: number, delivererId: number): Promise<boolean> {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      select: { delivererId: true, status: true },
    });

    if (!job) return false;
    if (job.delivererId !== delivererId) return false;
    if (job.status !== JobStatus.IN_PROGRESS) return false;
    return true;
  }

  private logFailure(message: string, meta: Record<string, unknown>, error: unknown) {
    if (error instanceof HttpException) {
      this.logger.warn(message, { ...meta, reason: error.message });
    } else {
      this.logger.error(message, { ...meta, error });
    }
  }
}
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseService } from '../common/services/response.service';
import { JobStatus, OrderStatus } from '@prisma/client';
import { EventLogService } from 'src/common/events/event-log.service';
import { EVENTS } from 'src/common/events/events.constants';

@Injectable()
export class DelivererJobService {


    constructor(private readonly prisma: PrismaService,private readonly response: ResponseService,private readonly eventLogService:EventLogService) {}

async startJob(jobId: number, delivererId: number) 
  {
  const job = await this.prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: {  orders: true },
  });

  if (!job) throw new NotFoundException('Job not found');

  if (job.delivererId !== delivererId)
    throw new ForbiddenException('Not your job');

  if (job.status !== JobStatus.ASSIGNED)
    throw new BadRequestException('Job not ready to start');

  await this.prisma.deliveryJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  });

  await this.prisma.order.updateMany({
    where: { deliveryJobId: jobId },
    data: {
      status: OrderStatus.IN_PROGRESS,
    },
  });

  await this.eventLogService.recordEvent({
    entityType: 'JOB',
    entityId: jobId,
    eventType: EVENTS.JOB.STARTED,
    payload: {
      jobId,
      status: EVENTS.JOB.STARTED,
    },
  });

  return { success: true };
}

async getDelivererJobs(userId: number, jobStatus?: JobStatus) 
 {
  const deliverer = await this.prisma.delivererProfile.findUnique({
    where: { userId },
  });

  if (!deliverer) {
    throw new NotFoundException('Deliverer profile not found');
  }
  const whereClause: any = { delivererId: deliverer.id };
  if (jobStatus) {
    whereClause.status = jobStatus;
  }

  return this.prisma.deliveryJob.findMany({
    where: whereClause,
    include: {
      orders: {
        include: {
          orderItems: {
            include: { product: true },
          },
          customer: true,
          vendor: true,
        },
      },
      stops: true,
    },
  });
}
async completeJob(jobId: number, delivererId: number) 
{
  const job = await this.prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: { deliverer: true },
  });

  if (!job) throw new NotFoundException('Job not found');

  if (job.delivererId !== delivererId)
    throw new ForbiddenException('Not your job');

  if (job.status !== JobStatus.IN_PROGRESS)
    throw new BadRequestException('Job not in progress');

  await this.prisma.deliveryJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  await this.prisma.delivererProfile.update({
    where: { id: job.delivererId },
    data: {
      availability: true,
      activeJobId: null,
    },
  });

  await this.prisma.order.updateMany({
  where: { deliveryJobId: jobId },
  data: {
    status: OrderStatus.COMPLETED,
    deliveredAt: new Date(),
  },
});

  

  await this.eventLogService.recordEvent({
  entityType: 'JOB',
  entityId: jobId,
  eventType: EVENTS.JOB.COMPLETED,
  payload: {
    jobId,
    status: EVENTS.JOB.COMPLETED,
  },
});

  return { success: true };
}

async completeDropOff(jobId: number, dropOffId: number, delivererId: number) {
  const job = await this.prisma.deliveryJob.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new NotFoundException('Job not found');
  if (job.delivererId !== delivererId)
    throw new ForbiddenException('Not your job');
  if (job.status !== JobStatus.IN_PROGRESS)
    throw new BadRequestException('Job not in progress');

const dropOff =  await this.prisma.deliveryDropOff.update({
    where: { id: dropOffId },
    data: {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  await this.prisma.order.update({
  where: { id: dropOff.orderId },
  data: {
    status: OrderStatus.COMPLETED,
    deliveredAt: new Date(),
  },
});

await this.eventLogService.recordEvent({
      entityType: 'ORDER',
      entityId: dropOff.orderId,
      eventType : EVENTS.ORDER.COMPLETED,
      payload : 
      {
        orderId: dropOff.orderId,
        status : EVENTS.ORDER.COMPLETED
      }
});

  const remainingStops = await this.prisma.deliveryDropOff.findMany({
    where: {
      jobId,
      status: { not: JobStatus.COMPLETED },
    },
  });

  if (remainingStops.length === 0) {
    await this.completeJob(jobId, delivererId);
    return { success: true, jobCompleted: true };
  }

  return { success: true, jobCompleted: false };
}


//deliverer and job gateway service functions:

async getDelivererByUserId(userId: number) {
  const deliverer = await this.prisma.delivererProfile.findUnique({
    where: { userId },
  });

  if (!deliverer) {
    throw new Error('Deliverer profile not found');
  }

  return deliverer;
}

async validateLiveTracking( jobId: number, delivererId: number,): Promise<boolean> 
{
  const job = await this.prisma.deliveryJob.findUnique({
    where: { id: jobId },
    select: {
      delivererId: true,
      status: true,
    },
  });

  if (!job) return false;

  if (job.delivererId !== delivererId) return false;

  if (job.status !== 'IN_PROGRESS') return false;

  return true;
}

}
import { Injectable, Logger } from "@nestjs/common";
import { JobStatus, OrderStatus } from "@prisma/client"
import { EventLogService } from "src/common/events/event-log.service";
import { PrismaService } from "src/prisma/prisma.service";
import { Cron } from '@nestjs/schedule';
import { AppLogger } from "src/common/logger/app-logger.service";


@Injectable()
export class DelivererRecoveryService {


    @Cron('*/1 * * * *')
  async checkDeliverers() {
    await this.checkStaleDeliverers();
    this.logger.log('Running deliverer recovery check');

  }

  constructor(
    private prisma: PrismaService,
    private eventLog: EventLogService,
    private logger: AppLogger,
  ) {
    this.logger.setContext(DelivererRecoveryService.name);
  }
      DELIVERER_GRACE_MS = 2 * 60 * 1000;

  async checkStaleDeliverers() {
    const cutoff = new Date(Date.now() - this.DELIVERER_GRACE_MS);

    const deliverers = await this.prisma.delivererProfile.findMany({
      where: {
        activeJobId: { not: null },
        user: {
          lastSeenAt: { lt: cutoff },
        },
      },
      include: {
        activeJob: true,
      },
    });

    for (const deliverer of deliverers) {
      await this.handleDeliverer(deliverer);
    }
  }
async handleDeliverer(deliverer: any) {
  const job = deliverer.activeJob;
  if (!job)
    {
      this.logger.warn('Job not found for deliverer');
      return;
    }

  if (job.status === JobStatus.ASSIGNED) {
    await this.recoverUnstartedJob(deliverer, job);
  }

  if (job.status === JobStatus.IN_PROGRESS) {
    await this.escalateStartedJob(deliverer, job);
  }
}
async recoverUnstartedJob(deliverer: any, job: any) {
  await this.prisma.$transaction(async tx => {
    await tx.delivererProfile.update({
      where: { id: deliverer.id },
      data: {
        activeJobId: null,
        availability: true,
      },
    });

    await tx.deliveryJob.update({
      where: { id: job.id , status:JobStatus.ASSIGNED },
      data: {
        status: JobStatus.PENDING,
        delivererId: null,
      },
    });

    await tx.order.updateMany({
      where: { deliveryJobId: job.id },
      data: {
        status: OrderStatus.WAITING_FOR_DELIVERER,
        deliveryJobId: null,
        delivererId: null,
      },
    });
  });

  await this.eventLog.recordEvent({
    entityType: 'JOB',
    entityId: job.id,
    eventType: 'JOB.RECOVERED',
    payload: {
      reason: 'DELIVERER_TIMEOUT_BEFORE_START',
    },
  });
}
async escalateStartedJob(deliverer: any, job: any) {
  await this.eventLog.recordEvent({
    entityType: 'JOB',
    entityId: job.id,
    eventType: 'JOB.ESCALATED',
    payload: {
      reason: 'DELIVERER_OFFLINE_DURING_DELIVERY',
    },
  });

  // لاحقًا:
  // - notify admin
  // - notify customer
  // - manual intervention
}
}



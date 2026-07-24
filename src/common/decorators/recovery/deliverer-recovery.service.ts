import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { JobStatus, OrderStatus } from "@prisma/client";
import { DelivererAssignmentService } from "../../../deliverer/deliverer-assignment.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { CustomerGateway } from "../../../users/customer.gateway";
import { EventLogService } from "../../events/event-log.service";
import { EVENTS } from "../../events/events.constants";
import { AppLogger } from "../../logger/app-logger.service";

@Injectable()
export class DelivererRecoveryService {
  DELIVERER_GRACE_MS = 2 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private eventLog: EventLogService,
    private delivererAssignment: DelivererAssignmentService,
    private customerGateway: CustomerGateway,
    private logger: AppLogger,
  ) {
    this.logger.setContext(DelivererRecoveryService.name);
  }

  @Cron("*/1 * * * *")
  async checkDeliverers() {
    await this.checkStaleDeliverers();
    this.logger.log("Running deliverer recovery check");
  }

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
        user: {
          select: {
            lastSeenAt: true,
          },
        },
        activeJob: {
          include: {
            orders: {
              select: {
                id: true,
                customerId: true,
                status: true,
              },
            },
          },
        },
      },
    });

    for (const deliverer of deliverers) {
      await this.handleDeliverer(deliverer);
    }
  }

  async handleDeliverer(deliverer: any) {
    const job = deliverer.activeJob;
    if (!job) {
      this.logger.warn("Job not found for deliverer");
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
    await this.prisma.$transaction(async (tx) => {
      await tx.delivererProfile.update({
        where: { id: deliverer.id },
        data: {
          activeJobId: null,
          availability: true,
        },
      });

      await tx.deliveryJob.update({
        where: { id: job.id, status: JobStatus.ASSIGNED },
        data: {
          status: JobStatus.PENDING,
          delivererId: null,
        },
      });

      await tx.deliveryBatch.update({
        where: { id: job.batchId },
        data: {
          delivererId: null,
          status: JobStatus.IN_PROGRESS,
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
      entityType: "JOB",
      entityId: job.id,
      eventType: EVENTS.JOB.RECOVERED,
      payload: {
        reason: "DELIVERER_TIMEOUT_BEFORE_START",
      },
    });

    await this.delivererAssignment.assignDelivererToBatch(job.batchId);
  }

  async escalateStartedJob(deliverer: any, job: any) {
    const lastSeenAt = deliverer.user?.lastSeenAt;
    if (
      lastSeenAt &&
      (await this.prisma.eventLog.findFirst({
        where: {
          entityType: "JOB",
          entityId: job.id,
          eventType: EVENTS.JOB.ESCALATED,
          createdAt: {
            gt: lastSeenAt,
          },
        },
      }))
    ) {
      this.logger.debug("JobAlreadyEscalatedForCurrentOfflineWindow", {
        jobId: job.id,
      });
      return;
    }

    await this.eventLog.recordEvent({
      entityType: "JOB",
      entityId: job.id,
      eventType: EVENTS.JOB.ESCALATED,
      payload: {
        reason: "DELIVERER_OFFLINE_DURING_DELIVERY",
      },
    });

    for (const order of job.orders ?? []) {
      await this.eventLog.recordEvent({
        entityType: "ORDER",
        entityId: order.id,
        eventType: EVENTS.ORDER.DELIVERY_ISSUE,
        payload: {
          orderId: order.id,
          jobId: job.id,
          reason: "DELIVERER_OFFLINE_DURING_DELIVERY",
          currentStatus: order.status ?? OrderStatus.IN_PROGRESS,
        },
      });

      this.customerGateway.sendDeliveryIssue(order.customerId, job.id, order.id);
    }

    this.logger.warn("StartedJobEscalatedForManualIntervention", {
      jobId: job.id,
      delivererId: deliverer.id,
      affectedOrders: (job.orders ?? []).length,
    });
  }
}

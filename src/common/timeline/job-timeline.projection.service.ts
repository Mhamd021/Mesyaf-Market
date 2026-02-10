import {  Injectable } from "@nestjs/common";
import { EventLog, Prisma } from "@prisma/client";
import { EVENTS } from "src/common/events/events.constants";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class JobTimelineProjectionService {
  constructor(private prisma: PrismaService) {}

  async project(event: EventLog) {
    if (event.entityType !== 'JOB') return;

    const existing = await this.prisma.orderTimeline.findFirst({ 
      where:
      {
        orderId: event.entityId,
        eventType: event.eventType,
        occurredAt: event.createdAt,
      }
    });
    if (existing) return; 

    await this.prisma.jobTimeline.create({
      data: {
        jobId: event.entityId,
        eventType: event.eventType,
        payload: event.payload ?? Prisma.JsonNull,
        occurredAt: event.createdAt,
        message: this.buildMessage(event),
      },
    });
  }

  private buildMessage(event: EventLog): string {
    switch (event.eventType) {
      case EVENTS.JOB.ASSIGNED:
        return 'Job assigned to deliverer';
      case EVENTS.JOB.STARTED:
        return 'Delivery started';
      case EVENTS.JOB.COMPLETED:
        return 'Delivery completed';
      default:
        return event.eventType;
    }
  }

  
}



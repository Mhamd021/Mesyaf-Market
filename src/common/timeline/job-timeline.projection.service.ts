import {  Injectable, Logger } from "@nestjs/common";
import { EventLog, Prisma } from "@prisma/client";
import { EVENTS } from "src/common/events/events.constants";
import { PrismaService } from "src/prisma/prisma.service";
import { AppLogger } from "../logger/app-logger.service";

@Injectable()
export class JobTimelineProjectionService {

  

  constructor(private prisma: PrismaService,private readonly logger:AppLogger) {
    this.logger.setContext(JobTimelineProjectionService.name);
  }

  async project(event: EventLog) {
    if (event.entityType !== 'JOB')
      {
        this.logger.warn('This is not a Job event');
        return;
      }

    const existing = await this.prisma.jobTimeline.findFirst({ 
      where:
      {
        jobId: event.entityId,
        eventType: event.eventType,
        occurredAt: event.createdAt,
      }
    });
    if (existing)
      {
        this.logger.warn('event already projected');
        return;
      } 

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



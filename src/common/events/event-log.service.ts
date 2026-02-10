import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventEntityType } from '@prisma/client';
import { OrderTimelineProjectionService } from '../timeline/order-timeline.projection.service';
import { JobTimelineProjectionService } from '../timeline/job-timeline.projection.service';

@Injectable()
export class EventLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderTimelineProjection: OrderTimelineProjectionService,
    private readonly jobTimelineProjection: JobTimelineProjectionService,
  ) {}

  async recordEvent(params: {
    entityType: EventEntityType;
    entityId: number;
    eventType: string;
    payload: any;
  }) {
    const event = await this.prisma.eventLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        eventType: params.eventType,
        payload: params.payload,
      },
    });
    
    switch (event.entityType) 
    {
    case EventEntityType.ORDER:
      await this.orderTimelineProjection.project(event);
      break;

    case EventEntityType.JOB:
      await this.jobTimelineProjection.project(event);
      break;
  }

    return event;
  }

  async getEventsSince(params: {
    entityType: EventEntityType;
    entityIds: number[];
    since: Date;
  }) {
    return this.prisma.eventLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: { in: params.entityIds },
        createdAt: { gt: params.since },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

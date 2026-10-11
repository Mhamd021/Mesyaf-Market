import { Injectable } from '@nestjs/common';
import { EventEntityType, Prisma } from '@prisma/client';
import { OrderTimelineProjectionService } from '../timeline/order-timeline.projection.service';
import { JobTimelineProjectionService } from '../timeline/job-timeline.projection.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  },
tx?: Prisma.TransactionClient,
) {
    const client = tx ?? this.prisma;
    const event = await client.eventLog.create({
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
      await this.orderTimelineProjection.project(event, tx);
      break;

    case EventEntityType.JOB:
              await this.jobTimelineProjection.project(event, tx);

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

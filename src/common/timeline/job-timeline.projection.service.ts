import { Injectable } from '@nestjs/common';
import { EventLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../logger/app-logger.service';
import { EVENTS } from '../events/events.constants';

@Injectable()
export class JobTimelineProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async project(event: EventLog, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    if (event.entityType !== 'JOB') {
      this.logger.warn('NotAJobEvent', { eventId: event.id });
      return;
    }

    const result = await client.jobTimeline.createMany({
      data: [
        {
          sourceEventId: event.id,
          jobId: event.entityId,
          eventType: event.eventType,
          payload: event.payload ?? Prisma.JsonNull,
          occurredAt: event.createdAt,
          message: this.buildMessage(event),
        },
      ],
      skipDuplicates: true,
    });

    if (result.count === 0) {
      this.logger.debug('EventAlreadyProjected', { eventId: event.id });
    }
  }

  private buildMessage(event: EventLog): string {
    switch (event.eventType) {
      case EVENTS.JOB.ASSIGNED:
        return 'Job assigned to deliverer';
      case EVENTS.JOB.STARTED:
        return 'Delivery started';
      case EVENTS.JOB.COMPLETED:
        return 'Delivery completed';
      case EVENTS.JOB.RECOVERED:
        return 'Delivery assignment recovered after deliverer timeout';
      case EVENTS.JOB.ESCALATED:
        return 'Delivery issue escalated for manual intervention';
      default:
        return event.eventType;
    }
  }
}
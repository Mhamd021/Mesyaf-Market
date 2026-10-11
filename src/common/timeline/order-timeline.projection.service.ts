import { Injectable } from "@nestjs/common";
import { EventLog, OrderStatus, Prisma } from "@prisma/client";
import { AppLogger } from "../logger/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EVENTS } from "../events/events.constants";

@Injectable()
export class OrderTimelineProjectionService {
  

  constructor(private prisma: PrismaService,private readonly logger:AppLogger) {
  }

  async project(event: EventLog,tx?: Prisma.TransactionClient) {
      const client = tx ?? this.prisma;

    if (event.entityType !== 'ORDER') {
    this.logger.warn('NotAnOrderEvent', { eventId: event.id });
    return;
  }

    const raw = (event.payload as { status?: unknown } | null)?.status;
  const status = Object.values(OrderStatus).includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : null;
  if (raw !== undefined && status === null) {
    this.logger.warn('InvalidOrderStatusInEvent', { eventId: event.id, raw });
  }

  const result = await client.orderTimeline.createMany({
    data: [
      {
        sourceEventId: event.id,
        orderId: event.entityId,
        eventType: event.eventType,
        status,
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
      case EVENTS.ORDER.CREATED:
        return 'Order placed';
      case EVENTS.ORDER.ACCEPTED:
        return 'Vendor accepted the order';
      case EVENTS.ORDER.REJECTED:
        return 'Vendor rejected the order';
      case EVENTS.ORDER.READY:
        return 'Order is ready for delivery';
      case EVENTS.ORDER.COMPLETED:
        return 'Order delivered';
      case EVENTS.ORDER.CANCELLED:
        return 'Order cancelled';
      case EVENTS.ORDER.DELIVERY_ISSUE:
        return 'Delivery issue detected and escalated';
      default:
        return event.eventType;
    }
  }


  
}


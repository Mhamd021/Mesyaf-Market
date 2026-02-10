import { Injectable } from "@nestjs/common";
import { EventLog, Prisma } from "@prisma/client";
import { EVENTS } from "src/common/events/events.constants";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class OrderTimelineProjectionService {
  constructor(private prisma: PrismaService) {}

  async project(event: EventLog) {
    if (event.entityType !== 'ORDER') return;

    const existing = await this.prisma.orderTimeline.findFirst({ 
      where:
      {
        orderId: event.entityId,
        eventType: event.eventType,
        occurredAt: event.createdAt,
      }
    });
    if (existing) return; 

    await this.prisma.orderTimeline.create({
      data: {
        orderId: event.entityId,
        eventType: event.eventType,
        status: (event.payload as any)?.status ?? null,
       payload: event.payload ?? Prisma.JsonNull,
        occurredAt: event.createdAt,
        message: this.buildMessage(event),
      },
    });
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
      default:
        return event.eventType;
    }
  }


  
}


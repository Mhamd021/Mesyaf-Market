import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class OrderTimelineQueryService {
  constructor(private prisma: PrismaService) {}


  async getOrderTimeline(orderId: number, user: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true, vendorId: true },
    });

    if (!order) throw new NotFoundException();

    const allowed =
      user.role === Role.ADMIN ||
      (user.role === Role.CUSTOMER && user.id === order.customerId) ||
      (user.role === Role.VENDOR && user.vendorId === order.vendorId);

    if (!allowed) throw new ForbiddenException();

    return {
      orderId,
      timeline: await this.prisma.orderTimeline.findMany({
        where: { orderId },
        orderBy: { occurredAt: 'asc' },
      }),
    };
  }
}


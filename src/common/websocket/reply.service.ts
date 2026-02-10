import { Injectable } from '@nestjs/common';
import { EventLogService } from '../events/event-log.service';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class ReplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  replayForCustomer(customerId: number) {
    return this.replayCustomerEvents(customerId);
  }

  replayForVendor(vendorId: number) {
    return this.replayVendorEvents(vendorId);
  }

  replayForDeliverer(delivererId: number) {
    return this.replayDelivererEvents(delivererId);
  }

  private async replayCustomerEvents(customerId: number) {
  const user = await this.prisma.user.findUnique({
    where: { id: customerId },
    select: { lastSeenAt: true },
  });
  if (!user?.lastSeenAt) return [];

  const orders = await this.prisma.order.findMany({
    where: {
      customerId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    select: { id: true },
  });

  if (!orders.length) return [];

  return this.eventLog.getEventsSince({
    entityType: 'ORDER',
    entityIds: orders.map(o => o.id),
    since: user.lastSeenAt,
  });
}


  private async replayVendorEvents(vendorId: number) {
  const vendor = await this.prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { user: { select: { lastSeenAt: true } } },
  });
  if (!vendor?.user.lastSeenAt) return [];

  const orders = await this.prisma.order.findMany({
    where: {
      vendorId,
      status: { not: 'COMPLETED' },
    },
    select: { id: true },
  });

  return this.eventLog.getEventsSince({
    entityType: 'ORDER',
    entityIds: orders.map(o => o.id),
    since: vendor.user.lastSeenAt,
  });
}


  private async replayDelivererEvents(delivererId: number) {
  const deliverer = await this.prisma.delivererProfile.findUnique({
    where: { id: delivererId },
    select: {
      user: { select: { lastSeenAt: true } },
      activeJobId: true,
    },
  });

  if (!deliverer?.activeJobId || !deliverer.user.lastSeenAt) {
    return [];
  }

  return this.eventLog.getEventsSince({
    entityType: 'JOB',
    entityIds: [deliverer.activeJobId],
    since: deliverer.user.lastSeenAt,
  });
}


}


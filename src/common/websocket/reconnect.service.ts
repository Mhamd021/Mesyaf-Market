import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReconnectEnvelope } from './reconnect.types';
import { JobStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class ReconnectService {
  constructor(private readonly prisma: PrismaService) { }

  async getCustomerContext(
    customerId: number,
  ): Promise<
    ReconnectEnvelope<{
      orderId: number;
      status: OrderStatus;
      jobId: number | null;
    }>
  > {
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        customerId,
        status: {
          in: [
            'VENDOR_ACCEPTED',
            'READY_FOR_DELIVERY',
            'WAITING_FOR_DELIVERER',
            'IN_PROGRESS',
          ],
        },
      },
    });

    return {
      
      snapshotAt: new Date(),
      data: activeOrder
        ? {
          orderId: activeOrder.id,
          status: activeOrder.status,
          jobId: activeOrder.deliveryJobId ?? null,
        }
        : null,
    };
  }

  async getDelivererContext(
    delivererId: number,
  ): Promise<
    ReconnectEnvelope<{
      jobId: number;
      status: JobStatus;
      stops: {
        id: number;
        status: string;
        lat: number | null;
        lng: number | null;
      }[];
    }>
  > {
    const activeJob = await this.prisma.deliveryJob.findFirst({
      where: {
        delivererId,
        status: {
          in: ['IN_PROGRESS'],
        },
      },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    return {
      
      snapshotAt: new Date(),
      data: activeJob
        ? {
          jobId: activeJob.id,
          status: activeJob.status,
          stops: activeJob.stops.map(stop => ({
            id: stop.id,
            status: stop.status,
            lat: stop.dropoffLat,
            lng: stop.dropoffLng,
          })),
        }
        : null,
    };
  }

  async getVendorContext(
    vendorId: number,
  ): Promise<
    ReconnectEnvelope<
      {
        orderId: number;
        status: OrderStatus;
        createdAt: Date;
        items: {
          productId: number;
          name: string;
          quantity: number;
        }[];
      }[]
    >
  > {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        vendorId,
        status: {
          in: [
            'PENDING_VENDOR_CONFIRMATION',
            'VENDOR_ACCEPTED',
            'READY_FOR_DELIVERY',
          ],
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      snapshotAt: new Date(),
      data:
        activeOrders.length > 0
          ? activeOrders.map(order => ({
            orderId: order.id,
            status: order.status,
            createdAt: order.createdAt,
            items: order.orderItems.map(item => ({
              productId: item.productId,
              name: item.product.name,
              quantity: item.quantity,
            })),
          }))
          : null,
    };
  }
}

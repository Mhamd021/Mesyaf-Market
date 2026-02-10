import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class DeliveryJobSubscriptionService {
  constructor(private prisma: PrismaService) {}

  async subscribeCustomerToJob(customerId: number, jobId: number) 
  {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      include: {
        orders: {
          select: { customerId: true },
        },
      },
    });

    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }
    
    const isOwner = job.orders.some(
      (order) => order.customerId === customerId,
    );

    if (!isOwner) {
      throw new Error('UNAUTHORIZED_JOB');
    }
    return job;
  }
}

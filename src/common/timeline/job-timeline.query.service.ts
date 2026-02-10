import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {  Role } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class JobTimelineQueryService {
  constructor(private prisma: PrismaService) {}


async getJobTimeline(jobId: number, user: any) {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      select: { delivererId: true },
    });

    if (!job) throw new NotFoundException();

    if (
      user.role !== Role.ADMIN &&
      user.delivererId !== job.delivererId
    ) {
      throw new ForbiddenException();
    }

    return {
      jobId,
      timeline: await this.prisma.jobTimeline.findMany({
        where: { jobId },
        orderBy: { occurredAt: 'asc' },
      }),
    };
  }
  
  }




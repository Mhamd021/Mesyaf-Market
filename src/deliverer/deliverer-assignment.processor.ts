import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DelivererAssignmentService } from './deliverer-assignment.service';
import { QUEUES } from '../common/constants/queues';


@Processor(QUEUES.DELIVERER_ASSIGNMENT)
export class DelivererAssignmentProcessor extends WorkerHost {
  private readonly logger = new Logger(DelivererAssignmentProcessor.name);

  constructor(
    private readonly assignmentService: DelivererAssignmentService,
  ) {
      super();
  }

  async process(job: Job<{ batchId: number }>): Promise<void> {
    const { batchId } = job.data;

    this.logger.log(`Processing assignment job`, {
      jobId: job.id,
      batchId,
      attempt: job.attemptsMade + 1,
    });

    await this.assignmentService.assignDelivererToBatch(batchId);

    this.logger.log(`Assignment job completed`, { jobId: job.id, batchId });
  }
}
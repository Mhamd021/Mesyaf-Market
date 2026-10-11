// batch-timeout.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderService } from './order.service';
import { JOBS, QUEUES } from '../common/constants/queues';
import { App } from 'supertest/types';
import { AppLogger } from '../common/logger/app-logger.service';

@Processor(QUEUES.BATCH_TIMEOUT)
export class BatchTimeoutProcessor extends WorkerHost {
  

  constructor(private readonly orderService: OrderService,
    private readonly logger:AppLogger
  ) {
    super();
  }

  async process(job: Job<{ batchId: number }>) {
    if (job.name !== JOBS.CLOSE_BATCH_TIMEOUT) return;
    this.logger.log(`Timeout fired for batch ${job.data.batchId}`);
    await this.orderService.forceCloseBatchFromTimeout(job.data.batchId);
  }
}
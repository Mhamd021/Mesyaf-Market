// src/test-queue.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS } from './common/constants/queues';

async function testQueue() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const queue = app.get<Queue>(getQueueToken(QUEUES.DELIVERER_ASSIGNMENT));
  
  const job = await queue.add(
    JOBS.ASSIGN_DELIVERER,
    { batchId: 2 },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
  
  console.log(`Job added successfully: ${job.id}`);
  console.log('Check your logs for processor output...');
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const jobState = await job.getState();
  console.log(`Job state: ${jobState}`);
  
  await app.close();
}

testQueue().catch(console.error);
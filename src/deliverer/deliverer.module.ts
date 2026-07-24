import { Module } from '@nestjs/common';
import { DelivererController } from './deliverer.controller';
import { DelivererService } from './deliverer.service';
import { CommonModule } from '../common/common.module';
import { DelivererAssignmentService } from './deliverer-assignment.service';
import { DelivererGateway } from './deliverer.gateway';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../common/events/events.module';
import { LoggerModule } from '../common/logger/app-logger.module';
import { WebsocketModule } from '../common/websocket/websocket.module';
import { UsersModule } from '../users/users.module';
import { DelivererJobService } from './deliverer-job.service';
import { QUEUES } from '../common/constants/queues';
import { BullModule } from '@nestjs/bullmq';
import { DelivererAssignmentProcessor } from './deliverer-assignment.processor';



@Module({
   imports: [CommonModule,AuthModule,WebsocketModule,UsersModule,EventsModule,LoggerModule,

    BullModule.registerQueue({
      name: QUEUES.DELIVERER_ASSIGNMENT,
    }),
   ],
  controllers: [DelivererController],
  providers: [DelivererService, DelivererAssignmentService,DelivererGateway,DelivererJobService,DelivererAssignmentProcessor],
  exports: [
    DelivererAssignmentService,
  ],
})
export class DelivererModule {}

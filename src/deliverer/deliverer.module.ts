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
import { DelivererAssignmentProcessor } from './deliverer-assignment.processor';
import { DelivererLocationService } from './deliverer-location-service';



@Module({
   imports: [CommonModule,AuthModule,WebsocketModule,UsersModule,EventsModule,LoggerModule,

  
   ],
  controllers: [DelivererController],
  providers: [DelivererService, DelivererAssignmentService,DelivererGateway,DelivererJobService,DelivererAssignmentProcessor,DelivererLocationService],
  exports: [
    DelivererAssignmentService,
    DelivererLocationService
  ],
})
export class DelivererModule {}

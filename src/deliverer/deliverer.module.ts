import { Module } from '@nestjs/common';
import { DelivererController } from './deliverer.controller';
import { DelivererService } from './deliverer.service';
import { CommonModule } from '../common/common.module';
import { DelivererAssignmentService } from './deliverer-assignment.service';
import { DelivererGateway } from './deliverer.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { DelivererJobService } from './deliverer-job.service';
import { WebsocketModule } from 'src/common/websocket/websocket.module';
import { UsersModule } from 'src/users/users.module';
import { EventsModule } from 'src/common/events/events.module';
import { LoggerModule } from 'src/common/logger/app-logger.module';

@Module({
   imports: [CommonModule,AuthModule,WebsocketModule,UsersModule,EventsModule,LoggerModule],
  controllers: [DelivererController],
  providers: [DelivererService, DelivererAssignmentService,DelivererGateway,DelivererJobService],
  exports: [
    DelivererAssignmentService,
  ],
})
export class DelivererModule {}

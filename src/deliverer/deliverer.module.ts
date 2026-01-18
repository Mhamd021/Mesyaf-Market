import { Module } from '@nestjs/common';
import { DelivererController } from './deliverer.controller';
import { DelivererService } from './deliverer.service';
import { CommonModule } from '../common/common.module';
import { DelivererAssignmentService } from './deliverer-assignment.service';
import { DelivererGateway } from './deliverer.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { DelivererJobService } from './deliverer-job.service';

@Module({
   imports: [CommonModule,AuthModule],
  controllers: [DelivererController],
  providers: [DelivererService, DelivererAssignmentService,DelivererGateway,DelivererJobService],
  exports: [
    DelivererAssignmentService,
  ],
})
export class DelivererModule {}

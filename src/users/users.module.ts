import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from 'src/common/common.module';
import { CustomerGateway } from './customer.gateway';
import { DeliveryJobSubscriptionService } from './delivery-job-subscription.service';


@Module({
  imports: [PrismaModule,CommonModule],
  controllers: [UsersController],
  providers: [UsersService,CustomerGateway,DeliveryJobSubscriptionService],
  exports: [UsersService,CustomerGateway], 
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerGateway } from './customer.gateway';
import { DeliveryJobSubscriptionService } from './delivery-job-subscription.service';
import { JwtModule } from '@nestjs/jwt';
import { CommonModule } from '../common/common.module';
import { LoggerModule } from '../common/logger/app-logger.module';
import { WebsocketModule } from '../common/websocket/websocket.module';



@Module({
  imports: [PrismaModule,CommonModule,JwtModule,WebsocketModule,LoggerModule],
  controllers: [UsersController],
  providers: [UsersService,CustomerGateway,DeliveryJobSubscriptionService],
  exports: [UsersService,CustomerGateway], 
})
export class UsersModule {}

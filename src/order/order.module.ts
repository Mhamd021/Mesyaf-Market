import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { EventsModule } from '../common/events/events.module';
import { LoggerModule } from '../common/logger/app-logger.module';
import { DelivererModule } from '../deliverer/deliverer.module';
import { UsersModule } from '../users/users.module';
import { VendorModule } from '../vendor/vendor.module';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';



@Module({
  controllers: [OrderController],
  providers: [OrderService],
  imports: [DelivererModule,EventsModule,VendorModule,UsersModule,LoggerModule,
    BullModule.registerQueue({
      name: QUEUES.DELIVERER_ASSIGNMENT,
    }),
  ],
})
export class OrderModule {}

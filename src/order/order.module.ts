import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { EventsModule } from '../common/events/events.module';
import { LoggerModule } from '../common/logger/app-logger.module';
import { DelivererModule } from '../deliverer/deliverer.module';
import { UsersModule } from '../users/users.module';
import { VendorModule } from '../vendor/vendor.module';
import { BatchTimeoutProcessor } from './batch-timeout-processor';





@Module({
  controllers: [OrderController],
  providers: [OrderService, BatchTimeoutProcessor],
  imports: [DelivererModule,EventsModule,VendorModule,UsersModule,LoggerModule,
    
  ],
})
export class OrderModule {}

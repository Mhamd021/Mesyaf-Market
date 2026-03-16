import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { DelivererModule } from 'src/deliverer/deliverer.module';
import { EventsModule } from 'src/common/events/events.module';
import { VendorModule } from 'src/vendor/vendor.module';
import { UsersModule } from 'src/users/users.module';
import { LoggerModule } from 'src/common/logger/app-logger.module';

@Module({
  controllers: [OrderController],
  providers: [OrderService],
  imports: [DelivererModule,EventsModule,VendorModule,UsersModule,LoggerModule],
})
export class OrderModule {}

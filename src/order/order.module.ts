import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { DelivererModule } from 'src/deliverer/deliverer.module';

@Module({
  controllers: [OrderController],
  providers: [OrderService],
  imports: [DelivererModule],
})
export class OrderModule {}

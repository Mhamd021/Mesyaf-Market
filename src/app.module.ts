import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VendorModule } from './vendor/vendor.module';
import { ProductModule } from './product/product.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { OrderModule } from './order/order.module';
import { DelivererModule } from './deliverer/deliverer.module';

@Module({
  imports: [UsersModule, AuthModule, VendorModule, ProductModule, CommonModule, AdminModule, OrderModule, DelivererModule],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}

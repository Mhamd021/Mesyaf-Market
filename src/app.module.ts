import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VendorModule } from './vendor/vendor.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [UsersModule, AuthModule, VendorModule, ProductModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

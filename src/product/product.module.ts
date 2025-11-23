import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [ProductService],
  controllers: [ProductController]
})
export class ProductModule {}

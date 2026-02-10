import { Module } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { CommonModule } from '../common/common.module';
import { VendorGateway } from './vendor.gateway';

@Module({
  imports: [CommonModule],
  controllers: [VendorController],
  providers: [VendorService, VendorGateway],
  exports: [VendorGateway],
})
export class VendorModule {}


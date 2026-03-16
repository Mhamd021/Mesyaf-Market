import { Module } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { CommonModule } from '../common/common.module';
import { VendorGateway } from './vendor.gateway';
import { WebsocketModule } from 'src/common/websocket/websocket.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { EventsModule } from 'src/common/events/events.module';
import { LoggerModule } from 'src/common/logger/app-logger.module';

@Module({
  imports: [CommonModule,WebsocketModule,JwtModule,UsersModule,EventsModule,LoggerModule],
  controllers: [VendorController],
  providers: [VendorService, VendorGateway],
  exports: [VendorGateway],
})
export class VendorModule {}


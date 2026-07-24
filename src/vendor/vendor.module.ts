import { Module } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { CommonModule } from '../common/common.module';
import { VendorGateway } from './vendor.gateway';
import { JwtModule } from '@nestjs/jwt';
import { EventsModule } from '../common/events/events.module';
import { LoggerModule } from '../common/logger/app-logger.module';
import { WebsocketModule } from '../common/websocket/websocket.module';
import { UsersModule } from '../users/users.module';


@Module({
  imports: [CommonModule,WebsocketModule,JwtModule,UsersModule,EventsModule,LoggerModule],
  controllers: [VendorController],
  providers: [VendorService, VendorGateway],
  exports: [VendorGateway],
})
export class VendorModule {}


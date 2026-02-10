import { Module } from '@nestjs/common';
import { ResponseService } from './services/response.service';
import { ReconnectService } from './websocket/reconnect.service';

@Module({
  providers: [ResponseService,ReconnectService],
  exports: [ResponseService,ReconnectService], 
})
export class CommonModule {}

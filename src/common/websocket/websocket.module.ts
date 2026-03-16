import { Module } from '@nestjs/common';
import { ReconnectService } from './reconnect.service';
import { ReplayService } from './reply.service';
import { SessionService } from './session.service';
import { EventsModule } from '../events/events.module';
import { LoggerModule } from '../logger/app-logger.module';
import { GlobalWsExceptionFilter } from '../filters/ws-exception.filter';


@Module({
    imports:[EventsModule,LoggerModule],
    providers:[ReconnectService,ReplayService,SessionService,GlobalWsExceptionFilter],
    exports:[ReconnectService,ReplayService,SessionService,GlobalWsExceptionFilter]

}) 
export class WebsocketModule {}

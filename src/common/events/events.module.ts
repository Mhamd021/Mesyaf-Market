import { Module } from '@nestjs/common';
import { EventLogService } from './event-log.service';
import { TimeLineModule } from '../timeline/timeline.module';
import { LoggerModule } from '../logger/app-logger.module';


@Module({
    imports: [TimeLineModule,LoggerModule],
 providers:[EventLogService],
 exports:[EventLogService]
})
export class EventsModule {}

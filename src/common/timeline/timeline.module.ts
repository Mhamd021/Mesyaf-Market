import { Module } from '@nestjs/common';
import { JobTimelineProjectionService } from './job-timeline.projection.service';
import { OrderTimelineProjectionService } from './order-timeline.projection.service';
import { JobTimelineQueryService } from './job-timeline.query.service';
import { LoggerModule } from '../logger/app-logger.module';


@Module({
  imports: [ LoggerModule ],
  providers: [JobTimelineProjectionService,OrderTimelineProjectionService,JobTimelineQueryService],
  exports: [JobTimelineProjectionService,OrderTimelineProjectionService], 
})
export class TimeLineModule {}

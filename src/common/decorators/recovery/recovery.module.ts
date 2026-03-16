import { Module } from "@nestjs/common";
import { DelivererRecoveryService } from "./deliverer-recovery.service";
import { EventsModule } from "src/common/events/events.module";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "src/common/logger/app-logger.module";

@Module({
  imports: [EventsModule,ScheduleModule,LoggerModule],
  providers: [DelivererRecoveryService],
})
export class RecoveryModule {}
  
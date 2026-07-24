import { Module } from "@nestjs/common";
import { DelivererRecoveryService } from "./deliverer-recovery.service";
import { ScheduleModule } from "@nestjs/schedule";
import { DelivererModule } from "../../../deliverer/deliverer.module";
import { UsersModule } from "../../../users/users.module";
import { EventsModule } from "../../events/events.module";
import { LoggerModule } from "../../logger/app-logger.module";

@Module({
  imports: [
    EventsModule,
    ScheduleModule,
    LoggerModule,
    UsersModule,
    DelivererModule,
  ],
  providers: [DelivererRecoveryService],
})
export class RecoveryModule {}
  

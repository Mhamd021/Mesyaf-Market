import { Module } from "@nestjs/common";
import { DelivererRecoveryService } from "./deliverer-recovery.service";

@Module({
  providers: [DelivererRecoveryService],
})
export class RecoveryModule {}

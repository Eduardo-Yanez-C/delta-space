import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FvCalculationController } from "./fv-calculation.controller";
import { FvCalculationService } from "./fv-calculation.service";

@Module({
  imports: [AuthModule],
  controllers: [FvCalculationController],
  providers: [FvCalculationService],
  exports: [FvCalculationService],
})
export class FvCalculationModule {}

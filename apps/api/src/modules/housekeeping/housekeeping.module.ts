import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { HousekeepingController } from "./housekeeping.controller";
import { HousekeepingService } from "./housekeeping.service";

@Module({
  imports: [PrismaModule, AuditModule, MaintenanceModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}

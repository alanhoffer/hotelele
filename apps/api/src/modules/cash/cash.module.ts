import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CashController } from "./cash.controller";
import { CashService } from "./cash.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}

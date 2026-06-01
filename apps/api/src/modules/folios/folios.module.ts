import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CashModule } from "../cash/cash.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FoliosController } from "./folios.controller";
import { FoliosService } from "./folios.service";

@Module({
  imports: [PrismaModule, AuditModule, CashModule],
  controllers: [FoliosController],
  providers: [FoliosService],
  exports: [FoliosService],
})
export class FoliosModule {}

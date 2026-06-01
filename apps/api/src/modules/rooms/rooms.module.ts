import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [AuditModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}

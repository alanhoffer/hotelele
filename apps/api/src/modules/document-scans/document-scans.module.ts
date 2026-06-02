import { Module } from "@nestjs/common";
import { DocumentScansController } from "./document-scans.controller";
import { DocumentScansService } from "./document-scans.service";

@Module({
  controllers: [DocumentScansController],
  providers: [DocumentScansService],
})
export class DocumentScansModule {}

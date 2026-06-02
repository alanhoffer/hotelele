import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { DocumentScansService, type DocumentScanResultInput } from "./document-scans.service";

@Controller("document-scans")
@RequirePermissions(permissions.reservationUpdate)
export class DocumentScansController {
  constructor(private readonly documentScans: DocumentScansService) {}

  @Post("requests")
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      reservationId: string;
      reservationCode?: string;
      occupantIndex: number;
      occupantLabel?: string;
    },
  ) {
    return this.documentScans.createRequest(request.user, body);
  }

  @Get("requests/active")
  getActiveRequest(@Req() request: AuthenticatedRequest) {
    return this.documentScans.getActiveRequest(request.user);
  }

  @Get("requests/:id")
  getRequest(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.documentScans.getRequest(request.user, id);
  }

  @Post("requests/:id/result")
  submitResult(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: DocumentScanResultInput) {
    return this.documentScans.submitResult(request.user, id, body);
  }

  @Post("requests/:id/consume")
  consumeRequest(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.documentScans.consumeRequest(request.user, id);
  }
}

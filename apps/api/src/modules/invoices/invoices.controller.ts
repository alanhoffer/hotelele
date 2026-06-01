import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@RequirePermissions(permissions.invoiceView)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.invoices.list(request.user.hotelId);
  }

  @Post("from-folio/:folioId")
  @RequirePermissions(permissions.invoiceCreate)
  createFromFolio(
    @Req() request: AuthenticatedRequest,
    @Param("folioId") folioId: string,
    @Body() body: unknown,
  ) {
    return this.invoices.createFromFolio(request, folioId, body);
  }

  @Post(":id/pending-afip")
  @RequirePermissions(permissions.invoiceCreate)
  markPendingAfip(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.invoices.markPendingAfip(request, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(permissions.invoiceCreate)
  cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.invoices.cancel(request, id, body);
  }
}

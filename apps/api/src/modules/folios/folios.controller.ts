import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { FoliosService } from "./folios.service";

@Controller("folios")
@RequirePermissions(permissions.folioView)
export class FoliosController {
  constructor(private readonly folios: FoliosService) {}

  @Get("unpaid")
  listUnpaid(@Req() request: AuthenticatedRequest) {
    return this.folios.listUnpaid(request.user.hotelId);
  }

  @Get("by-room/:roomId/active")
  getActiveByRoom(@Req() request: AuthenticatedRequest, @Param("roomId") roomId: string) {
    return this.folios.getActiveByRoom(request.user.hotelId, roomId);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.folios.get(request.user.hotelId, id);
  }

  @Post(":id/charges")
  @RequirePermissions(permissions.folioChargeCreate)
  addCharge(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.folios.addCharge(request, id, body);
  }

  @Post(":id/charges/:chargeId/void")
  @RequirePermissions(permissions.folioChargeVoid)
  voidCharge(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("chargeId") chargeId: string,
    @Body() body: unknown,
  ) {
    return this.folios.voidCharge(request, id, chargeId, body);
  }

  @Post(":id/payments")
  @RequirePermissions(permissions.folioPaymentCreate)
  addPayment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.folios.addPayment(request, id, body);
  }

  @Post(":id/payments/:paymentId/void")
  @RequirePermissions(permissions.folioPaymentVoid)
  voidPayment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown,
  ) {
    return this.folios.voidPayment(request, id, paymentId, body);
  }
}

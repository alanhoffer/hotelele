import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { CashService } from "./cash.service";

@Controller("cash-sessions")
@RequirePermissions(permissions.cashView)
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.cash.list(request.user.hotelId);
  }

  @Get("current")
  current(@Req() request: AuthenticatedRequest) {
    return this.cash.current(request);
  }

  @Post("open")
  @RequirePermissions(permissions.cashManage)
  open(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.cash.open(request, body);
  }

  @Post(":id/movements")
  @RequirePermissions(permissions.cashManage)
  addMovement(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.cash.addMovement(request, id, body);
  }

  @Post(":id/close")
  @RequirePermissions(permissions.cashManage)
  close(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.cash.close(request, id, body);
  }
}

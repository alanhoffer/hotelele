import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { MaintenanceService } from "./maintenance.service";

@Controller("maintenance")
@RequirePermissions(permissions.maintenanceView)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get("tickets")
  list(@Req() request: AuthenticatedRequest, @Query("status") status?: string) {
    return this.maintenance.list(request.user.hotelId, status);
  }

  @Post("tickets")
  @RequirePermissions(permissions.maintenanceUpdate)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.maintenance.create(request, body);
  }

  @Post("tickets/:id/start")
  @RequirePermissions(permissions.maintenanceUpdate)
  start(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.maintenance.start(request, id);
  }

  @Post("tickets/:id/resolve")
  @RequirePermissions(permissions.maintenanceUpdate)
  resolve(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.maintenance.resolve(request, id);
  }

  @Post("tickets/:id/cancel")
  @RequirePermissions(permissions.maintenanceUpdate)
  cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.maintenance.cancel(request, id, body);
  }
}

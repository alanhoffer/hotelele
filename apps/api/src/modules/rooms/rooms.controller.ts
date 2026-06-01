import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@RequirePermissions(permissions.roomView)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.rooms.list(request.user.hotelId);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.rooms.get(request.user.hotelId, id);
  }

  @Patch(":id/status")
  @RequirePermissions(permissions.roomUpdateStatus)
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      commercialStatus?: string;
      cleaningStatus?: string;
      maintenanceStatus?: string;
      reason?: string;
    },
  ) {
    return this.rooms.updateStatus(request, id, body);
  }
}

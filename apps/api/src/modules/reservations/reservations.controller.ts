import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { ReservationsService } from "./reservations.service";

@Controller("reservations")
@RequirePermissions(permissions.reservationView)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("status") status?: string) {
    return this.reservations.list(request.user.hotelId, status);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.get(request.user.hotelId, id);
  }

  @Post()
  @RequirePermissions(permissions.reservationCreate)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.reservations.create(request, body);
  }

  @Patch(":id")
  @RequirePermissions(permissions.reservationUpdate)
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.reservations.update(request, id, body);
  }

  @Post(":id/confirm")
  @RequirePermissions(permissions.reservationUpdate)
  confirm(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.confirm(request, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(permissions.reservationUpdate)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.reservations.cancel(request, id, body?.reason);
  }

  @Post(":id/check-in")
  @RequirePermissions(permissions.reservationCheckIn)
  checkIn(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.checkIn(request, id);
  }

  @Put(":id/occupants")
  @RequirePermissions(permissions.reservationUpdate)
  replaceOccupants(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.reservations.replaceOccupants(request, id, body);
  }

  @Post(":id/check-out")
  @RequirePermissions(permissions.reservationCheckOut)
  checkOut(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.checkOut(request, id);
  }

  @Post(":id/transfer-room")
  @RequirePermissions(permissions.reservationTransfer)
  transferRoom(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.reservations.transferRoom(request, id, body);
  }
}

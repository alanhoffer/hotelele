import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { HousekeepingService } from "./housekeeping.service";

@Controller("housekeeping")
@RequirePermissions(permissions.housekeepingView)
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest) {
    return this.housekeeping.summary(request.user.hotelId, request.user.id);
  }

  @Get("tasks")
  list(
    @Req() request: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("floor") floor?: string,
    @Query("assignedTo") assignedTo?: string,
    @Query("priority") priority?: string,
    @Query("q") q?: string,
  ) {
    return this.housekeeping.list(request, { status, floor, assignedTo, priority, q });
  }

  @Post("tasks")
  @RequirePermissions(permissions.housekeepingUpdate)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.housekeeping.create(request, body);
  }

  @Post("tasks/:id/start")
  @RequirePermissions(permissions.housekeepingUpdate)
  start(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.housekeeping.start(request, id);
  }

  @Post("tasks/:id/finish")
  @RequirePermissions(permissions.housekeepingUpdate)
  finish(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.housekeeping.finish(request, id);
  }

  @Post("tasks/:id/pause")
  @RequirePermissions(permissions.housekeepingUpdate)
  pause(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.pause(request, id, body);
  }

  @Post("tasks/:id/resume")
  @RequirePermissions(permissions.housekeepingUpdate)
  resume(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.housekeeping.resume(request, id);
  }

  @Post("tasks/:id/approve")
  @RequirePermissions(permissions.housekeepingUpdate)
  approve(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.housekeeping.approve(request, id);
  }

  @Post("tasks/:id/reject")
  @RequirePermissions(permissions.housekeepingUpdate)
  reject(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.reject(request, id, body);
  }

  @Post("tasks/:id/notes")
  @RequirePermissions(permissions.housekeepingUpdate)
  notes(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.updateNotes(request, id, body);
  }

  @Post("tasks/:id/checklist")
  @RequirePermissions(permissions.housekeepingUpdate)
  checklist(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.updateChecklist(request, id, body);
  }

  @Post("tasks/:id/supplies")
  @RequirePermissions(permissions.housekeepingUpdate)
  supplies(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.updateSupplies(request, id, body);
  }

  @Post("tasks/:id/issues")
  @RequirePermissions(permissions.housekeepingUpdate)
  issues(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.reportIssue(request, id, body);
  }

  @Post("tasks/:id/lost-found")
  @RequirePermissions(permissions.housekeepingUpdate)
  lostFound(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.updateLostFound(request, id, body);
  }

  @Post("tasks/:id/room-status")
  @RequirePermissions(permissions.housekeepingUpdate)
  roomStatus(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.updateRoomCleaningStatus(request, id, body);
  }

  @Post("tasks/:id/cancel")
  @RequirePermissions(permissions.housekeepingUpdate)
  cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.housekeeping.cancel(request, id, body);
  }
}

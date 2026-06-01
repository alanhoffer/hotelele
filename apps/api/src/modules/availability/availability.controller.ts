import { Controller, Get, Query, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { AvailabilityService } from "./availability.service";

@Controller("availability")
@RequirePermissions(permissions.availabilityView)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.availability.get(request.user.hotelId, from, to);
  }
}

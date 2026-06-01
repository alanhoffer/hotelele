import { Controller, Get, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users")
@RequirePermissions(permissions.userView)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.prisma.user.findMany({
      where: { hotelId: request.user.hotelId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        role: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }
}

import { Controller, Get, Query, Req } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("audit")
@RequirePermissions(permissions.auditView)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("limit") limit?: string) {
    return this.prisma.auditLog.findMany({
      where: { hotelId: request.user.hotelId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit ?? 50), 100),
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}

import { Controller, Get, Req } from "@nestjs/common";
import type { CommercialStatus, CleaningStatus, MaintenanceStatus } from "@hotel-pms/shared";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("dashboard")
@RequirePermissions(permissions.roomView)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary(@Req() request: AuthenticatedRequest) {
    const hotelId = request.user.hotelId;
    const [
      totalRooms,
      commercial,
      cleaning,
      maintenance,
      recentAudit,
    ] = await Promise.all([
      this.prisma.room.count({ where: { hotelId, active: true } }),
      this.prisma.room.groupBy({
        by: ["commercialStatus"],
        where: { hotelId, active: true },
        _count: { _all: true },
      }),
      this.prisma.room.groupBy({
        by: ["cleaningStatus"],
        where: { hotelId, active: true },
        _count: { _all: true },
      }),
      this.prisma.room.groupBy({
        by: ["maintenanceStatus"],
        where: { hotelId, active: true },
        _count: { _all: true },
      }),
      this.prisma.auditLog.findMany({
        where: { hotelId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      totalRooms,
      commercial: countMap<CommercialStatus>(commercial, "commercialStatus"),
      cleaning: countMap<CleaningStatus>(cleaning, "cleaningStatus"),
      maintenance: countMap<MaintenanceStatus>(maintenance, "maintenanceStatus"),
      recentAudit,
    };
  }
}

function countMap<T extends string>(
  rows: Array<Record<string, unknown> & { _count: { _all: number } }>,
  key: string,
) {
  return rows.reduce<Record<T, number>>((acc, row) => {
    acc[row[key] as T] = row._count._all;
    return acc;
  }, {} as Record<T, number>);
}

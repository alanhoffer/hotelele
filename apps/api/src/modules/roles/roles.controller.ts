import { Controller, Get } from "@nestjs/common";
import { permissions } from "@hotel-pms/shared";
import { RequirePermissions } from "../auth/auth.decorators";
import { PrismaService } from "../prisma/prisma.service";

@Controller("roles")
@RequirePermissions(permissions.roleView)
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
  }
}

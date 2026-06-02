import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuditModule } from "./audit/audit.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AvailabilityModule } from "./availability/availability.module";
import { CashModule } from "./cash/cash.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DocumentScansModule } from "./document-scans/document-scans.module";
import { FoliosModule } from "./folios/folios.module";
import { HealthModule } from "./health/health.module";
import { HousekeepingModule } from "./housekeeping/housekeeping.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { PrismaService } from "./prisma/prisma.service";
import { RolesModule } from "./roles/roles.module";
import { RoomsModule } from "./rooms/rooms.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    DocumentScansModule,
    AvailabilityModule,
    HousekeepingModule,
    MaintenanceModule,
    CashModule,
    InvoicesModule,
    ReservationsModule,
    FoliosModule,
    RoomsModule,
    RolesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, prisma: PrismaService) => new AuthGuard(reflector, prisma),
      inject: [Reflector, PrismaService],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new PermissionsGuard(reflector),
      inject: [Reflector],
    },
  ],
})
export class AppModule {}

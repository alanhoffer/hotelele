import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  cleaningStatuses,
  commercialStatuses,
  maintenanceStatuses,
} from "@hotel-pms/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(hotelId: string) {
    return this.prisma.room.findMany({
      where: { hotelId, active: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      include: { roomType: true },
    });
  }

  async get(hotelId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, hotelId },
      include: { roomType: true },
    });
    if (!room) throw new NotFoundException("Habitacion no encontrada.");
    return room;
  }

  async updateStatus(
    request: AuthenticatedRequest,
    id: string,
    body: {
      commercialStatus?: string;
      cleaningStatus?: string;
      maintenanceStatus?: string;
      reason?: string;
    },
  ) {
    const before = await this.get(request.user.hotelId, id);
    const data: Record<string, string> = {};
    const activeStay = await this.prisma.stay.findFirst({
      where: { hotelId: request.user.hotelId, roomId: id, status: "in_house" },
      include: { reservation: true },
    });

    if (body.commercialStatus) {
      assertIncludes(commercialStatuses, body.commercialStatus, "estado comercial");
      if (body.commercialStatus === "occupied") {
        throw new ConflictException("La ocupacion se controla con check-in.");
      }
      if (activeStay) {
        throw new ConflictException(
          `La habitacion tiene alojada la reserva ${activeStay.reservation.code}. Primero hacer check-out.`,
        );
      }
      data.commercialStatus = body.commercialStatus;
    }
    if (body.cleaningStatus) {
      assertIncludes(cleaningStatuses, body.cleaningStatus, "estado de limpieza");
      data.cleaningStatus = body.cleaningStatus;
    }
    if (body.maintenanceStatus) {
      assertIncludes(maintenanceStatuses, body.maintenanceStatus, "estado de mantenimiento");
      data.maintenanceStatus = body.maintenanceStatus;
    }
    if (data.maintenanceStatus === "out_of_service" && !activeStay) {
      data.commercialStatus = "out_of_service";
    }
    if (
      data.maintenanceStatus === "ok" &&
      before.commercialStatus === "out_of_service" &&
      !body.commercialStatus &&
      !activeStay
    ) {
      data.commercialStatus = "available";
    }
    if (
      data.commercialStatus === "out_of_service" &&
      !body.maintenanceStatus &&
      before.maintenanceStatus === "ok"
    ) {
      data.maintenanceStatus = "out_of_service";
    }
    const nextMaintenanceStatus = data.maintenanceStatus ?? before.maintenanceStatus;
    if (data.commercialStatus === "available" && nextMaintenanceStatus === "out_of_service") {
      throw new ConflictException("Primero cerrar el mantenimiento para volver a vender la habitacion.");
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException("No hay estados para actualizar.");
    }

    const after = await this.prisma.room.update({
      where: { id },
      data,
      include: { roomType: true },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "room.status_updated",
      entity: "Room",
      entityId: id,
      before: statusSnapshot(before),
      after: statusSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }
}

function assertIncludes(values: readonly string[], value: string, label: string) {
  if (!values.includes(value)) {
    throw new BadRequestException(`Valor invalido para ${label}.`);
  }
}

function statusSnapshot(room: {
  number: string;
  commercialStatus: string;
  cleaningStatus: string;
  maintenanceStatus: string;
}) {
  return {
    number: room.number,
    commercialStatus: room.commercialStatus,
    cleaningStatus: room.cleaningStatus,
    maintenanceStatus: room.maintenanceStatus,
  };
}

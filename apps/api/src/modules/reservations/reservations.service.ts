import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { paymentMethods, reservationStatuses } from "@hotel-pms/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const blockingStatuses = ["confirmed", "assigned", "in_house"] as const;

const guestSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  documentType: z.string().trim().optional().nullable(),
  documentNumber: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const createReservationSchema = z.object({
  guest: guestSchema,
  roomTypeId: z.string().uuid(),
  assignedRoomId: z.string().uuid().optional().nullable(),
  checkInDate: z.string().trim().min(1),
  checkOutDate: z.string().trim().min(1),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  source: z.string().trim().default("direct"),
  currency: z.string().trim().default("ARS"),
  nightlyRate: z.coerce.number().nonnegative().optional().nullable(),
  totalAmount: z.coerce.number().nonnegative().optional().nullable(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  depositPaid: z.coerce.boolean().default(false),
  depositMethod: z.enum(paymentMethods).optional().nullable(),
  depositReference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const updateReservationSchema = createReservationSchema
  .omit({ guest: true })
  .partial()
  .extend({
    guest: guestSchema.partial().optional(),
  });

const transferRoomSchema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().trim().default("Cambio de habitacion"),
});

const occupantSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  documentType: z.string().trim().optional().nullable(),
  documentNumber: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
  ageCategory: z.enum(["adult", "child"]).default("adult"),
  primary: z.coerce.boolean().default(false),
});

const roomingListSchema = z.object({
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0),
  occupants: z.array(occupantSchema).min(1),
});

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(hotelId: string, status?: string) {
    if (status && !reservationStatuses.includes(status as never)) {
      throw new BadRequestException("Estado de reserva invalido.");
    }

    return this.prisma.reservation.findMany({
      where: {
        hotelId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: [{ checkInDate: "asc" }, { code: "asc" }],
      include: reservationInclude,
    });
  }

  async get(hotelId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { hotelId, id },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException("Reserva no encontrada.");
    return reservation;
  }

  async create(request: AuthenticatedRequest, rawBody: unknown) {
    const body = createReservationSchema.parse(rawBody);
    const dates = parseStayDates(body.checkInDate, body.checkOutDate);

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: body.roomTypeId, hotelId: request.user.hotelId, active: true },
    });
    if (!roomType) throw new BadRequestException("Tipo de habitacion invalido.");

    if (body.assignedRoomId) {
      await this.assertRoomCanBeAssigned(
        request.user.hotelId,
        body.assignedRoomId,
        body.roomTypeId,
        dates.checkInDate,
        dates.checkOutDate,
      );
    }

    const deposit = buildDepositData(body);
    const code = await this.nextReservationCode(request.user.hotelId, dates.checkInDate);
    const guest = await this.prisma.guest.create({
      data: {
        hotelId: request.user.hotelId,
        firstName: body.guest.firstName,
        lastName: body.guest.lastName,
        documentType: body.guest.documentType ?? undefined,
        documentNumber: body.guest.documentNumber ?? undefined,
        email: body.guest.email ?? undefined,
        phone: body.guest.phone ?? undefined,
        nationality: body.guest.nationality ?? undefined,
        notes: body.guest.notes ?? undefined,
      },
    });
    const reservation = await this.prisma.reservation.create({
      data: {
        hotelId: request.user.hotelId,
        guestId: guest.id,
        roomTypeId: body.roomTypeId,
        assignedRoomId: body.assignedRoomId ?? undefined,
        code,
        status: body.assignedRoomId ? "assigned" : "pending",
        source: body.source,
        checkInDate: dates.checkInDate,
        checkOutDate: dates.checkOutDate,
        adults: body.adults,
        children: body.children,
        currency: body.currency,
        nightlyRate: body.nightlyRate ?? undefined,
        totalAmount: body.totalAmount ?? undefined,
        ...deposit,
        notes: body.notes ?? undefined,
      },
      include: reservationInclude,
    });
    await this.prisma.reservationOccupant.create({
      data: {
        hotelId: request.user.hotelId,
        reservationId: reservation.id,
        firstName: body.guest.firstName,
        lastName: body.guest.lastName,
        documentType: body.guest.documentType ?? undefined,
        documentNumber: body.guest.documentNumber ?? undefined,
        phone: body.guest.phone ?? undefined,
        nationality: body.guest.nationality ?? undefined,
        ageCategory: "adult",
        primary: true,
      },
    });
    const reservationWithOccupants = await this.get(request.user.hotelId, reservation.id);

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.created",
      entity: "Reservation",
      entityId: reservation.id,
      after: reservationSnapshot(reservationWithOccupants),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return reservationWithOccupants;
  }

  async update(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const before = await this.get(request.user.hotelId, id);
    if (["in_house", "completed", "cancelled", "no_show"].includes(before.status)) {
      throw new ConflictException("Esta reserva ya no se puede modificar desde este flujo.");
    }

    const body = updateReservationSchema.parse(rawBody);
    const checkInDate = body.checkInDate
      ? parseDate(body.checkInDate, "fecha de llegada")
      : before.checkInDate;
    const checkOutDate = body.checkOutDate
      ? parseDate(body.checkOutDate, "fecha de salida")
      : before.checkOutDate;
    assertDateRange(checkInDate, checkOutDate);

    const roomTypeId = body.roomTypeId ?? before.roomTypeId;
    const assignedRoomId =
      body.assignedRoomId === null ? null : body.assignedRoomId ?? before.assignedRoomId;

    if (body.roomTypeId) {
      const roomType = await this.prisma.roomType.findFirst({
        where: { id: body.roomTypeId, hotelId: request.user.hotelId, active: true },
      });
      if (!roomType) throw new BadRequestException("Tipo de habitacion invalido.");
    }

    if (assignedRoomId) {
      await this.assertRoomCanBeAssigned(
        request.user.hotelId,
        assignedRoomId,
        roomTypeId,
        checkInDate,
        checkOutDate,
        id,
      );
    }

    if (body.guest) {
      await this.prisma.guest.update({
        where: { id: before.guestId },
        data: {
          firstName: body.guest.firstName,
          lastName: body.guest.lastName,
          documentType: body.guest.documentType,
          documentNumber: body.guest.documentNumber,
          email: body.guest.email,
          phone: body.guest.phone,
          nationality: body.guest.nationality,
          notes: body.guest.notes,
        },
      });
    }

    const deposit = buildDepositData(body, {
      depositAmount: before.depositAmount,
      depositPaid: before.depositPaid,
      depositMethod: before.depositMethod,
      depositReference: before.depositReference,
    });
    const after = await this.prisma.reservation.update({
      where: { id },
      data: {
        roomTypeId,
        assignedRoomId,
        status: assignedRoomId && before.status === "pending" ? "assigned" : before.status,
        checkInDate,
        checkOutDate,
        adults: body.adults,
        children: body.children,
        source: body.source,
        currency: body.currency,
        nightlyRate: body.nightlyRate ?? undefined,
        totalAmount: body.totalAmount ?? undefined,
        ...deposit,
        notes: body.notes ?? undefined,
      },
      include: reservationInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.updated",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async confirm(request: AuthenticatedRequest, id: string) {
    const before = await this.get(request.user.hotelId, id);
    if (!["pending", "assigned"].includes(before.status)) {
      throw new ConflictException("Solo se pueden confirmar reservas pendientes o asignadas.");
    }

    const after = await this.prisma.reservation.update({
      where: { id },
      data: { status: before.assignedRoomId ? "assigned" : "confirmed" },
      include: reservationInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.confirmed",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async cancel(request: AuthenticatedRequest, id: string, reason?: string) {
    const before = await this.get(request.user.hotelId, id);
    if (["in_house", "completed"].includes(before.status)) {
      throw new ConflictException("No se puede cancelar una reserva alojada o finalizada.");
    }

    const after = await this.prisma.reservation.update({
      where: { id },
      data: { status: "cancelled" },
      include: reservationInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.cancelled",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async replaceOccupants(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const before = await this.get(request.user.hotelId, id);
    if (["completed", "cancelled", "no_show"].includes(before.status)) {
      throw new ConflictException("Esta reserva ya no permite modificar huespedes.");
    }

    const body = roomingListSchema.parse(rawBody);
    const requiredTotal = body.adults + body.children;
    if (body.occupants.length !== requiredTotal) {
      throw new BadRequestException(
        `La rooming list debe tener ${requiredTotal} persona(s), segun adultos y menores.`,
      );
    }

    const adults = body.occupants.filter((occupant) => occupant.ageCategory === "adult").length;
    const children = body.occupants.filter((occupant) => occupant.ageCategory === "child").length;
    if (adults !== body.adults || children !== body.children) {
      throw new BadRequestException("La cantidad de adultos y menores no coincide con la rooming list.");
    }

    const primaryIndex = body.occupants.findIndex((occupant) => occupant.primary);
    const normalizedOccupants = body.occupants.map((occupant, index) => ({
      ...occupant,
      primary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
    }));
    const primaryOccupant = normalizedOccupants.find((occupant) => occupant.primary) ?? normalizedOccupants[0];

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.reservationOccupant.deleteMany({
        where: { hotelId: request.user.hotelId, reservationId: id },
      });
      await tx.reservationOccupant.createMany({
        data: normalizedOccupants.map((occupant) => ({
          hotelId: request.user.hotelId,
          reservationId: id,
          firstName: occupant.firstName,
          lastName: occupant.lastName,
          documentType: occupant.documentType ?? null,
          documentNumber: occupant.documentNumber ?? null,
          phone: occupant.phone ?? null,
          nationality: occupant.nationality ?? null,
          ageCategory: occupant.ageCategory,
          primary: occupant.primary,
        })),
      });
      await tx.guest.update({
        where: { id: before.guestId },
        data: {
          firstName: primaryOccupant.firstName,
          lastName: primaryOccupant.lastName,
          documentType: primaryOccupant.documentType ?? null,
          documentNumber: primaryOccupant.documentNumber ?? null,
          phone: primaryOccupant.phone ?? null,
          nationality: primaryOccupant.nationality ?? null,
        },
      });
      return tx.reservation.update({
        where: { id },
        data: {
          adults: body.adults,
          children: body.children,
        },
        include: reservationInclude,
      });
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.rooming_list_updated",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async checkIn(request: AuthenticatedRequest, id: string) {
    const before = await this.get(request.user.hotelId, id);
    if (!["confirmed", "assigned"].includes(before.status)) {
      throw new ConflictException("La reserva debe estar confirmada o asignada para hacer check-in.");
    }
    if (!before.assignedRoomId) {
      throw new BadRequestException("La reserva necesita una habitacion asignada.");
    }
    this.assertRoomingListReady(before);

    await this.assertRoomCanBeAssigned(
      request.user.hotelId,
      before.assignedRoomId,
      before.roomTypeId,
      before.checkInDate,
      before.checkOutDate,
      id,
    );
    await this.assertRoomReadyForCheckIn(request.user.hotelId, before.assignedRoomId);

    const after = await this.prisma.$transaction(async (tx) => {
      const stay = await tx.stay.create({
        data: {
          hotelId: request.user.hotelId,
          reservationId: id,
          roomId: before.assignedRoomId!,
          status: "in_house",
        },
      });
      const folio = await tx.folio.create({
        data: {
          hotelId: request.user.hotelId,
          reservationId: id,
          stayId: stay.id,
          roomId: before.assignedRoomId!,
          currency: before.currency,
        },
      });
      const totalAmount = decimalToNumber(before.totalAmount);
      if (totalAmount > 0) {
        await tx.charge.create({
          data: {
            hotelId: request.user.hotelId,
            folioId: folio.id,
            kind: "lodging",
            description: `Alojamiento ${before.code}`,
            quantity: 1,
            unitAmount: totalAmount,
            totalAmount,
          },
        });
      }
      const depositAmount = decimalToNumber(before.depositAmount);
      if (depositAmount > 0 && before.depositPaid) {
        await tx.payment.create({
          data: {
            hotelId: request.user.hotelId,
            folioId: folio.id,
            method: before.depositMethod ?? "cash",
            currency: before.currency,
            amount: depositAmount,
            reference: before.depositReference ?? "Sena registrada en reserva",
          },
        });
      }
      await tx.room.update({
        where: { id: before.assignedRoomId! },
        data: { commercialStatus: "occupied", cleaningStatus: "clean" },
      });
      return tx.reservation.update({
        where: { id },
        data: { status: "in_house" },
        include: reservationInclude,
      });
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.check_in",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async checkOut(request: AuthenticatedRequest, id: string) {
    const before = await this.get(request.user.hotelId, id);
    if (before.status !== "in_house" || !before.stay || before.stay.status !== "in_house") {
      throw new ConflictException("La reserva debe estar alojada para hacer check-out.");
    }

    const folio = await this.prisma.folio.findFirst({
      where: { hotelId: request.user.hotelId, reservationId: id, status: "open" },
      include: {
        charges: { where: { voidedAt: null } },
        payments: { where: { voidedAt: null } },
      },
    });
    if (folio) {
      const balance = calculateFolioBalance(folio);
      if (balance > 0.009) {
        throw new ConflictException(`La cuenta tiene saldo pendiente de ${balance.toFixed(2)}.`);
      }
    }
    const roomBeforeCheckOut = await this.prisma.room.findFirst({
      where: { hotelId: request.user.hotelId, id: before.stay.roomId },
    });
    const nextCommercialStatus =
      roomBeforeCheckOut?.maintenanceStatus === "out_of_service" ? "out_of_service" : "available";

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.stay.update({
        where: { id: before.stay!.id },
        data: { status: "checked_out", checkedOutAt: new Date() },
      });
      if (folio) {
        await tx.folio.update({
          where: { id: folio.id },
          data: { status: "closed", closedAt: new Date() },
        });
      }
      await tx.room.update({
        where: { id: before.stay!.roomId },
        data: { commercialStatus: nextCommercialStatus, cleaningStatus: "dirty" },
      });
      await tx.housekeepingTask.create({
        data: {
          hotelId: request.user.hotelId,
          roomId: before.stay!.roomId,
          source: "check_out",
          notes: `Salida de reserva ${before.code}`,
        },
      });
      return tx.reservation.update({
        where: { id },
        data: { status: "completed" },
        include: reservationInclude,
      });
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.check_out",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async transferRoom(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = transferRoomSchema.parse(rawBody);
    const before = await this.get(request.user.hotelId, id);
    if (!["pending", "confirmed", "assigned", "in_house"].includes(before.status)) {
      throw new ConflictException("Esta reserva no se puede mover de habitacion.");
    }
    if ((before.stay?.roomId ?? before.assignedRoomId) === body.roomId) {
      throw new BadRequestException("La reserva ya esta en esa habitacion.");
    }

    await this.assertRoomCanBeAssigned(
      request.user.hotelId,
      body.roomId,
      before.roomTypeId,
      before.checkInDate,
      before.checkOutDate,
      id,
    );

    if (before.status !== "in_house") {
      const after = await this.prisma.reservation.update({
        where: { id },
        data: {
          assignedRoomId: body.roomId,
          status: before.status === "pending" || before.status === "confirmed" ? "assigned" : before.status,
        },
        include: reservationInclude,
      });

      await this.audit.record({
        hotelId: request.user.hotelId,
        userId: request.user.id,
        action: "reservation.room_assigned",
        entity: "Reservation",
        entityId: id,
        before: reservationSnapshot(before),
        after: reservationSnapshot(after),
        reason: body.reason,
        ipAddress: request.ip,
        userAgent: request.headers?.["user-agent"],
      });

      return after;
    }

    if (!before.stay || before.stay.status !== "in_house") {
      throw new ConflictException("La estadia alojada no esta activa.");
    }
    await this.assertRoomReadyForCheckIn(request.user.hotelId, body.roomId);

    const oldRoom = await this.prisma.room.findFirst({
      where: { hotelId: request.user.hotelId, id: before.stay.roomId },
    });
    const oldCommercialStatus =
      oldRoom?.maintenanceStatus === "out_of_service" ? "out_of_service" : "available";

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.stay!.roomId },
        data: { commercialStatus: oldCommercialStatus, cleaningStatus: "dirty" },
      });
      await tx.housekeepingTask.create({
        data: {
          hotelId: request.user.hotelId,
          roomId: before.stay!.roomId,
          source: "room_transfer",
          notes: `Cambio de habitacion de reserva ${before.code}`,
        },
      });
      await tx.room.update({
        where: { id: body.roomId },
        data: { commercialStatus: "occupied", cleaningStatus: "clean" },
      });
      await tx.stay.update({
        where: { id: before.stay!.id },
        data: { roomId: body.roomId },
      });
      await tx.folio.updateMany({
        where: { hotelId: request.user.hotelId, reservationId: id, status: "open" },
        data: { roomId: body.roomId },
      });
      return tx.reservation.update({
        where: { id },
        data: { assignedRoomId: body.roomId },
        include: reservationInclude,
      });
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "reservation.room_transferred",
      entity: "Reservation",
      entityId: id,
      before: reservationSnapshot(before),
      after: reservationSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  private async nextReservationCode(hotelId: string, checkInDate: Date) {
    const ymd = checkInDate.toISOString().slice(0, 10).replaceAll("-", "");
    const count = await this.prisma.reservation.count({
      where: {
        hotelId,
        code: { startsWith: `R-${ymd}-` },
      },
    });
    return `R-${ymd}-${String(count + 1).padStart(4, "0")}`;
  }

  private async assertRoomCanBeAssigned(
    hotelId: string,
    roomId: string,
    roomTypeId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeReservationId?: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, active: true },
    });
    if (!room) throw new BadRequestException("Habitacion invalida.");
    if (room.roomTypeId !== roomTypeId) {
      throw new BadRequestException("La habitacion no pertenece al tipo seleccionado.");
    }
    if (room.commercialStatus === "blocked" || room.commercialStatus === "out_of_service") {
      throw new ConflictException("La habitacion no esta disponible comercialmente.");
    }
    if (room.maintenanceStatus === "out_of_service") {
      throw new ConflictException("La habitacion esta fuera de servicio por mantenimiento.");
    }

    const overlapping = await this.prisma.reservation.findFirst({
      where: {
        hotelId,
        assignedRoomId: roomId,
        status: { in: [...blockingStatuses] },
        checkInDate: { lt: checkOutDate },
        checkOutDate: { gt: checkInDate },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });
    if (overlapping) {
      throw new ConflictException(`Habitacion ocupada por la reserva ${overlapping.code}.`);
    }
  }

  private async assertRoomReadyForCheckIn(hotelId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId, active: true },
    });
    if (!room) throw new BadRequestException("Habitacion invalida.");
    if (room.commercialStatus !== "available") {
      throw new ConflictException("La habitacion no esta disponible para check-in.");
    }
    if (room.cleaningStatus !== "clean") {
      throw new ConflictException("La habitacion debe estar limpia para hacer check-in.");
    }
    if (room.maintenanceStatus !== "ok") {
      throw new ConflictException("La habitacion tiene mantenimiento pendiente.");
    }
  }

  private assertRoomingListReady(reservation: {
    adults: number;
    children: number;
    occupants?: {
      firstName: string;
      lastName: string;
      ageCategory: string;
    }[];
  }) {
    const occupants = reservation.occupants ?? [];
    const requiredTotal = reservation.adults + reservation.children;
    if (occupants.length !== requiredTotal) {
      throw new ConflictException(
        `Faltan datos de huespedes: la reserva requiere ${requiredTotal} persona(s) y tiene ${occupants.length}.`,
      );
    }

    const adults = occupants.filter((occupant) => occupant.ageCategory === "adult").length;
    const children = occupants.filter((occupant) => occupant.ageCategory === "child").length;
    if (adults !== reservation.adults || children !== reservation.children) {
      throw new ConflictException("La rooming list no coincide con adultos y menores de la reserva.");
    }

    const incomplete = occupants.find(
      (occupant) => !occupant.firstName.trim() || !occupant.lastName.trim(),
    );
    if (incomplete) {
      throw new ConflictException("Todos los huespedes deben tener nombre y apellido antes del check-in.");
    }
  }
}

const reservationInclude = {
  guest: true,
  roomType: true,
  assignedRoom: {
    include: {
      roomType: true,
    },
  },
  stay: true,
  occupants: {
    orderBy: [{ primary: "desc" as const }, { createdAt: "asc" as const }],
  },
  folio: {
    include: {
      charges: {
        where: { voidedAt: null },
        orderBy: { postedAt: "asc" as const },
      },
      payments: {
        where: { voidedAt: null },
        orderBy: { paidAt: "asc" as const },
      },
      invoices: {
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
};

function parseStayDates(rawCheckIn: string, rawCheckOut: string) {
  const checkInDate = parseDate(rawCheckIn, "fecha de llegada");
  const checkOutDate = parseDate(rawCheckOut, "fecha de salida");
  assertDateRange(checkInDate, checkOutDate);
  return { checkInDate, checkOutDate };
}

function parseDate(value: string, label: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Valor invalido para ${label}.`);
  }
  return date;
}

function assertDateRange(checkInDate: Date, checkOutDate: Date) {
  if (checkOutDate <= checkInDate) {
    throw new BadRequestException("La salida debe ser posterior a la llegada.");
  }
}

type DepositInput = {
  depositAmount?: number | null;
  depositPaid?: boolean;
  depositMethod?: (typeof paymentMethods)[number] | null;
  depositReference?: string | null;
};

type CurrentDeposit = {
  depositAmount?: unknown;
  depositPaid?: boolean;
  depositMethod?: (typeof paymentMethods)[number] | null;
  depositReference?: string | null;
};

function buildDepositData(input: DepositInput, current?: CurrentDeposit) {
  const createMode = !current;
  const hasDepositAmount = Object.prototype.hasOwnProperty.call(input, "depositAmount");
  const hasDepositPaid = Object.prototype.hasOwnProperty.call(input, "depositPaid");
  const hasDepositMethod = Object.prototype.hasOwnProperty.call(input, "depositMethod");
  const hasDepositReference = Object.prototype.hasOwnProperty.call(input, "depositReference");

  const effectiveAmount = hasDepositAmount ? input.depositAmount : current?.depositAmount;
  const effectivePaid = hasDepositPaid ? Boolean(input.depositPaid) : current?.depositPaid ?? false;

  if (effectivePaid && decimalToNumber(effectiveAmount) <= 0) {
    throw new BadRequestException("Para marcar una sena como pagada, indica el monto cobrado.");
  }

  const data: {
    depositAmount?: number | null;
    depositPaid?: boolean;
    depositMethod?: (typeof paymentMethods)[number] | null;
    depositReference?: string | null;
  } = {};

  if (createMode || hasDepositAmount) {
    data.depositAmount = input.depositAmount ?? (createMode ? undefined : null);
  }
  if (createMode || hasDepositPaid) {
    data.depositPaid = effectivePaid;
  }
  if (createMode || hasDepositPaid || hasDepositAmount || hasDepositMethod) {
    data.depositMethod = effectivePaid ? input.depositMethod ?? current?.depositMethod ?? "cash" : null;
  }
  if (createMode || hasDepositPaid || hasDepositAmount || hasDepositReference) {
    data.depositReference = effectivePaid ? input.depositReference ?? current?.depositReference ?? null : null;
  }

  return data;
}

function reservationSnapshot(reservation: {
  code: string;
  status: string;
  checkInDate: Date;
  checkOutDate: Date;
  depositAmount?: unknown;
  depositPaid?: boolean;
  assignedRoom?: { number: string } | null;
  guest?: { firstName: string; lastName: string } | null;
}) {
  return {
    code: reservation.code,
    status: reservation.status,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    depositAmount: decimalToNumber(reservation.depositAmount),
    depositPaid: reservation.depositPaid,
    room: reservation.assignedRoom?.number,
    guest: reservation.guest
      ? `${reservation.guest.lastName}, ${reservation.guest.firstName}`
      : undefined,
  };
}

function calculateFolioBalance(folio: {
  charges: { totalAmount: unknown }[];
  payments: { amount: unknown }[];
}) {
  const charges = folio.charges.reduce((sum, charge) => sum + decimalToNumber(charge.totalAmount), 0);
  const payments = folio.payments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);
  return charges - payments;
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

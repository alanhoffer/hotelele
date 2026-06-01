import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { maintenancePriorities, maintenanceTicketStatuses } from "@hotel-pms/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const createTicketSchema = z.object({
  roomId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  priority: z.enum(maintenancePriorities).default("medium"),
  assignedToId: z.string().uuid().optional().nullable(),
  outOfService: z.coerce.boolean().default(false),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(1).default("Anulacion de ticket"),
});

const activeTicketStatuses = ["pending", "in_progress"] as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(hotelId: string, status?: string) {
    if (status && !maintenanceTicketStatuses.includes(status as never)) {
      throw new BadRequestException("Estado de mantenimiento invalido.");
    }

    return this.prisma.maintenanceTicket.findMany({
      where: {
        hotelId,
        ...(status ? { status: status as never } : { status: { in: [...activeTicketStatuses] } }),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: { room: { include: { roomType: true } }, assignedTo: true },
    });
  }

  async create(request: AuthenticatedRequest, rawBody: unknown) {
    const body = createTicketSchema.parse(rawBody);
    if (body.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { hotelId: request.user.hotelId, id: body.roomId, active: true },
      });
      if (!room) throw new NotFoundException("Habitacion no encontrada.");
    }

    const shouldBlockRoom = body.outOfService || body.priority === "urgent";
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceTicket.create({
        data: {
          hotelId: request.user.hotelId,
          roomId: body.roomId ?? undefined,
          assignedToId: body.assignedToId ?? undefined,
          title: body.title,
          description: body.description ?? undefined,
          priority: body.priority,
          outOfService: shouldBlockRoom,
        },
        include: { room: { include: { roomType: true } }, assignedTo: true },
      });

      if (body.roomId) {
        await tx.room.update({
          where: { id: body.roomId },
          data: shouldBlockRoom
            ? { maintenanceStatus: "out_of_service", commercialStatus: "out_of_service" }
            : { maintenanceStatus: "pending" },
        });
      }
      return created;
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "maintenance.ticket_created",
      entity: "MaintenanceTicket",
      entityId: ticket.id,
      after: ticketSnapshot(ticket),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return ticket;
  }

  async start(request: AuthenticatedRequest, id: string) {
    const before = await this.findTicket(request.user.hotelId, id);
    if (before.status !== "pending") {
      throw new ConflictException("Solo se puede iniciar un ticket pendiente.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      if (before.roomId && before.room?.maintenanceStatus !== "out_of_service") {
        await tx.room.update({
          where: { id: before.roomId },
          data: { maintenanceStatus: "in_progress" },
        });
      }
      return tx.maintenanceTicket.update({
        where: { id },
        data: {
          status: "in_progress",
          assignedToId: before.assignedToId ?? request.user.id,
          startedAt: new Date(),
        },
        include: { room: { include: { roomType: true } }, assignedTo: true },
      });
    });

    await this.recordTransition(request, before, after, "maintenance.ticket_started");
    return after;
  }

  async resolve(request: AuthenticatedRequest, id: string) {
    const before = await this.findTicket(request.user.hotelId, id);
    if (!["pending", "in_progress"].includes(before.status)) {
      throw new ConflictException("El ticket ya esta cerrado.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceTicket.update({
        where: { id },
        data: { status: "resolved", resolvedAt: new Date() },
        include: { room: { include: { roomType: true } }, assignedTo: true },
      });

      if (before.roomId) {
        const activeOther = await tx.maintenanceTicket.findFirst({
          where: {
            hotelId: request.user.hotelId,
            roomId: before.roomId,
            id: { not: id },
            status: { in: [...activeTicketStatuses] },
          },
        });
        if (!activeOther) {
          const activeStay = await tx.stay.findFirst({
            where: { hotelId: request.user.hotelId, roomId: before.roomId, status: "in_house" },
          });
          await tx.room.update({
            where: { id: before.roomId },
            data: {
              maintenanceStatus: "ok",
              commercialStatus: activeStay ? "occupied" : "available",
            },
          });
        }
      }
      return updated;
    });

    await this.recordTransition(request, before, after, "maintenance.ticket_resolved");
    return after;
  }

  async cancel(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = cancelSchema.parse(rawBody ?? {});
    const before = await this.findTicket(request.user.hotelId, id);
    if (["resolved", "cancelled"].includes(before.status)) {
      throw new ConflictException("El ticket ya esta cerrado.");
    }

    const after = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date() },
      include: { room: { include: { roomType: true } }, assignedTo: true },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "maintenance.ticket_cancelled",
      entity: "MaintenanceTicket",
      entityId: id,
      before: ticketSnapshot(before),
      after: ticketSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });
    return after;
  }

  private async findTicket(hotelId: string, id: string) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { hotelId, id },
      include: { room: { include: { roomType: true } }, assignedTo: true },
    });
    if (!ticket) throw new NotFoundException("Ticket no encontrado.");
    return ticket;
  }

  private async recordTransition(
    request: AuthenticatedRequest,
    before: unknown,
    after: unknown,
    action: string,
  ) {
    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action,
      entity: "MaintenanceTicket",
      entityId: (after as { id: string }).id,
      before: ticketSnapshot(before),
      after: ticketSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });
  }
}

function ticketSnapshot(ticket: unknown) {
  const row = ticket as {
    id: string;
    title: string;
    status: string;
    priority: string;
    outOfService: boolean;
    room?: { number: string; maintenanceStatus?: string } | null;
    assignedTo?: { name: string } | null;
  };
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    outOfService: row.outOfService,
    room: row.room?.number,
    assignedTo: row.assignedTo?.name,
  };
}

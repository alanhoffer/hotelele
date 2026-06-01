import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  cleaningStatuses,
  housekeepingPriorities,
  housekeepingTaskStatuses,
  maintenancePriorities,
} from "@hotel-pms/shared";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { PrismaService } from "../prisma/prisma.service";

const createTaskSchema = z.object({
  roomId: z.string().uuid(),
  assignedToId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  source: z.string().trim().default("manual"),
  priority: z.enum(housekeepingPriorities).default("normal"),
  checklistJson: z.record(z.boolean()).optional(),
  suppliesJson: z.record(z.unknown()).optional(),
});

const listFilterSchema = z.object({
  status: z.string().optional(),
  floor: z.string().trim().optional(),
  assignedTo: z.enum(["me", "all"]).optional(),
  priority: z.string().optional(),
  q: z.string().trim().optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(1).default("Anulacion de tarea"),
});

const pauseSchema = z.object({
  reason: z.string().trim().min(1).default("Pausa operativa"),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1).default("Requiere repaso"),
});

const notesSchema = z.object({
  notes: z.string().trim().max(1200).optional().nullable(),
});

const checklistSchema = z.object({
  checklist: z.record(z.boolean()).default({}),
});

const suppliesSchema = z.object({
  supplies: z.record(z.unknown()).default({}),
});

const issueSchema = z.object({
  title: z.string().trim().min(1).default("Incidencia reportada por housekeeping"),
  description: z.string().trim().min(1),
  priority: z.enum(maintenancePriorities).default("medium"),
  outOfService: z.coerce.boolean().default(false),
});

const lostFoundSchema = z.object({
  notes: z.string().trim().max(1200).optional().nullable(),
});

const roomStatusSchema = z.object({
  cleaningStatus: z.enum(cleaningStatuses),
  reason: z.string().trim().optional().nullable(),
});

const activeTaskStatuses = ["pending", "in_progress", "inspection"] as const;

const taskInclude = {
  room: { include: { roomType: true } },
  assignedTo: true,
} satisfies Prisma.HousekeepingTaskInclude;

type TaskWithRelations = Prisma.HousekeepingTaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async summary(hotelId: string, userId: string) {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [activeTasks, readyToSell, completedToday] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where: { hotelId, status: { in: [...activeTaskStatuses] } },
        include: taskInclude,
      }),
      this.prisma.room.count({
        where: {
          hotelId,
          active: true,
          commercialStatus: "available",
          cleaningStatus: "clean",
          maintenanceStatus: "ok",
        },
      }),
      this.prisma.housekeepingTask.count({
        where: {
          hotelId,
          status: "completed",
          inspectedAt: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    return {
      active: activeTasks.length,
      assignedToMe: activeTasks.filter((task) => task.assignedToId === userId).length,
      pending: activeTasks.filter((task) => task.status === "pending").length,
      inProgress: activeTasks.filter((task) => task.status === "in_progress").length,
      inspection: activeTasks.filter((task) => task.status === "inspection").length,
      readyToSell,
      completedToday,
      urgent: activeTasks.filter((task) => task.priority === "urgent").length,
      arrivalToday: activeTasks.filter((task) => task.priority === "arrival_today").length,
      departureToday: activeTasks.filter((task) => task.source === "check_out" && isToday(task.createdAt)).length,
      overdue: activeTasks.filter((task) => isOverdue(task.createdAt)).length,
      generatedAt: new Date(),
    };
  }

  list(
    request: AuthenticatedRequest,
    rawFilters: {
      status?: string;
      floor?: string;
      assignedTo?: string;
      priority?: string;
      q?: string;
    },
  ) {
    const filters = listFilterSchema.parse(rawFilters);
    if (filters.status && !housekeepingTaskStatuses.includes(filters.status as never)) {
      throw new BadRequestException("Estado de housekeeping invalido.");
    }
    if (filters.priority && !housekeepingPriorities.includes(filters.priority as never)) {
      throw new BadRequestException("Prioridad de housekeeping invalida.");
    }

    const where: Prisma.HousekeepingTaskWhereInput = {
      hotelId: request.user.hotelId,
      ...(filters.status ? { status: filters.status as never } : { status: { in: [...activeTaskStatuses] } }),
      ...(filters.priority ? { priority: filters.priority as never } : {}),
      ...(filters.assignedTo === "me" ? { assignedToId: request.user.id } : {}),
    };

    if (filters.floor) {
      where.room = { floor: filters.floor };
    }

    if (filters.q) {
      const q = filters.q;
      where.OR = [
        { notes: { contains: q, mode: "insensitive" } },
        { source: { contains: q, mode: "insensitive" } },
        { issueNotes: { contains: q, mode: "insensitive" } },
        { lostFoundNotes: { contains: q, mode: "insensitive" } },
        { room: { number: { contains: q, mode: "insensitive" } } },
        { room: { block: { contains: q, mode: "insensitive" } } },
        { assignedTo: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    return this.prisma.housekeepingTask.findMany({
      where,
      orderBy: [{ priority: "desc" }, { status: "asc" }, { createdAt: "asc" }],
      include: taskInclude,
    });
  }

  async create(request: AuthenticatedRequest, rawBody: unknown) {
    const body = createTaskSchema.parse(rawBody);
    const room = await this.prisma.room.findFirst({
      where: { hotelId: request.user.hotelId, id: body.roomId, active: true },
    });
    if (!room) throw new NotFoundException("Habitacion no encontrada.");

    const existing = await this.prisma.housekeepingTask.findFirst({
      where: {
        hotelId: request.user.hotelId,
        roomId: body.roomId,
        status: { in: [...activeTaskStatuses] },
      },
    });
    if (existing) throw new ConflictException("La habitacion ya tiene una tarea activa.");

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.housekeepingTask.create({
        data: {
          hotelId: request.user.hotelId,
          roomId: body.roomId,
          assignedToId: body.assignedToId ?? undefined,
          notes: body.notes ?? undefined,
          source: body.source,
          priority: body.priority,
          checklistJson: body.checklistJson as Prisma.InputJsonValue | undefined,
          suppliesJson: body.suppliesJson as Prisma.InputJsonValue | undefined,
        },
        include: taskInclude,
      });
      if (room.cleaningStatus === "clean") {
        await tx.room.update({
          where: { id: body.roomId },
          data: { cleaningStatus: "dirty" },
        });
      }
      return created;
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "housekeeping.task_created",
      entity: "HousekeepingTask",
      entityId: task.id,
      after: taskSnapshot(task),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return task;
  }

  async createDepartureTask(
    hotelId: string,
    roomId: string,
    source = "check_out",
    notes = "Salida de huesped",
  ) {
    const existing = await this.prisma.housekeepingTask.findFirst({
      where: { hotelId, roomId, status: { in: [...activeTaskStatuses] } },
    });
    if (existing) return existing;
    return this.prisma.housekeepingTask.create({
      data: { hotelId, roomId, source, notes },
    });
  }

  async start(request: AuthenticatedRequest, id: string) {
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "pending") {
      throw new ConflictException("Solo se puede iniciar una tarea pendiente.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.roomId },
        data: { cleaningStatus: "cleaning" },
      });
      return tx.housekeepingTask.update({
        where: { id },
        data: {
          status: "in_progress",
          assignedToId: before.assignedToId ?? request.user.id,
          startedAt: new Date(),
          pausedAt: null,
        },
        include: taskInclude,
      });
    });

    await this.recordTransition(request, before, after, "housekeeping.task_started");
    return after;
  }

  async pause(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = pauseSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "in_progress") {
      throw new ConflictException("Solo se puede pausar una tarea en limpieza.");
    }
    if (before.pausedAt) {
      throw new ConflictException("La tarea ya esta pausada.");
    }

    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { pausedAt: new Date(), pauseReason: body.reason },
      include: taskInclude,
    });

    await this.recordTransition(request, before, after, "housekeeping.task_paused");
    return after;
  }

  async resume(request: AuthenticatedRequest, id: string) {
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "in_progress" || !before.pausedAt) {
      throw new ConflictException("Solo se puede reanudar una tarea pausada.");
    }

    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { pausedAt: null },
      include: taskInclude,
    });

    await this.recordTransition(request, before, after, "housekeeping.task_resumed");
    return after;
  }

  async finish(request: AuthenticatedRequest, id: string) {
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "in_progress") {
      throw new ConflictException("Solo se puede terminar una tarea en limpieza.");
    }
    if (before.pausedAt) {
      throw new ConflictException("Primero reanudar la tarea pausada.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.roomId },
        data: { cleaningStatus: "inspection" },
      });
      return tx.housekeepingTask.update({
        where: { id },
        data: { status: "inspection", finishedAt: new Date() },
        include: taskInclude,
      });
    });

    await this.recordTransition(request, before, after, "housekeeping.task_finished");
    return after;
  }

  async approve(request: AuthenticatedRequest, id: string) {
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "inspection") {
      throw new ConflictException("Solo se puede aprobar una tarea en inspeccion.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.roomId },
        data: { cleaningStatus: "clean" },
      });
      return tx.housekeepingTask.update({
        where: { id },
        data: { status: "completed", inspectedAt: new Date() },
        include: taskInclude,
      });
    });

    await this.recordTransition(request, before, after, "housekeeping.task_approved");
    return after;
  }

  async reject(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = rejectSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    if (before.status !== "inspection") {
      throw new ConflictException("Solo se puede rechazar una tarea en inspeccion.");
    }

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.roomId },
        data: { cleaningStatus: "cleaning" },
      });
      return tx.housekeepingTask.update({
        where: { id },
        data: {
          status: "in_progress",
          rejectedAt: new Date(),
          rejectionReason: body.reason,
          finishedAt: null,
          pausedAt: null,
        },
        include: taskInclude,
      });
    });

    await this.recordTransition(request, before, after, "housekeeping.task_rejected");
    return after;
  }

  async updateNotes(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = notesSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { notes: body.notes ?? null },
      include: taskInclude,
    });
    await this.recordTransition(request, before, after, "housekeeping.task_notes_updated");
    return after;
  }

  async updateChecklist(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = checklistSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { checklistJson: body.checklist as Prisma.InputJsonValue },
      include: taskInclude,
    });
    await this.recordTransition(request, before, after, "housekeeping.task_checklist_updated");
    return after;
  }

  async updateSupplies(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = suppliesSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { suppliesJson: body.supplies as Prisma.InputJsonValue },
      include: taskInclude,
    });
    await this.recordTransition(request, before, after, "housekeeping.task_supplies_updated");
    return after;
  }

  async reportIssue(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = issueSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const issueNotes = `${body.title}: ${body.description}`;
    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { issueNotes },
      include: taskInclude,
    });

    const ticket = await this.maintenance.create(request, {
      roomId: before.roomId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      outOfService: body.outOfService,
    });

    await this.recordTransition(request, before, after, "housekeeping.task_issue_reported");
    return { task: after, ticket };
  }

  async updateLostFound(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = lostFoundSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { lostFoundNotes: body.notes ?? null },
      include: taskInclude,
    });
    await this.recordTransition(request, before, after, "housekeeping.task_lost_found_updated");
    return after;
  }

  async updateRoomCleaningStatus(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = roomStatusSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    const taskData = taskDataForCleaningStatus(body.cleaningStatus);

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: before.roomId },
        data: { cleaningStatus: body.cleaningStatus },
      });
      return tx.housekeepingTask.update({
        where: { id },
        data: taskData,
        include: taskInclude,
      });
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "housekeeping.room_cleaning_status_updated",
      entity: "HousekeepingTask",
      entityId: id,
      before: taskSnapshot(before),
      after: taskSnapshot(after),
      reason: body.reason ?? undefined,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });
    return after;
  }

  async cancel(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = cancelSchema.parse(rawBody ?? {});
    const before = await this.findTask(request.user.hotelId, id);
    if (["completed", "cancelled"].includes(before.status)) {
      throw new ConflictException("La tarea ya esta cerrada.");
    }

    const after = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date() },
      include: taskInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "housekeeping.task_cancelled",
      entity: "HousekeepingTask",
      entityId: id,
      before: taskSnapshot(before),
      after: taskSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });
    return after;
  }

  private async findTask(hotelId: string, id: string) {
    const task = await this.prisma.housekeepingTask.findFirst({
      where: { hotelId, id },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException("Tarea no encontrada.");
    return task;
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
      entity: "HousekeepingTask",
      entityId: (after as { id: string }).id,
      before: taskSnapshot(before),
      after: taskSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });
  }
}

function taskDataForCleaningStatus(cleaningStatus: string): Prisma.HousekeepingTaskUpdateInput {
  if (cleaningStatus === "dirty") {
    return {
      status: "pending",
      startedAt: null,
      pausedAt: null,
      finishedAt: null,
      inspectedAt: null,
      rejectedAt: null,
    };
  }
  if (cleaningStatus === "cleaning") {
    return {
      status: "in_progress",
      startedAt: new Date(),
      pausedAt: null,
      finishedAt: null,
      inspectedAt: null,
    };
  }
  if (cleaningStatus === "inspection") {
    return {
      status: "inspection",
      pausedAt: null,
      finishedAt: new Date(),
      inspectedAt: null,
    };
  }
  return {
    status: "completed",
    pausedAt: null,
    inspectedAt: new Date(),
  };
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isToday(value: Date) {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return value >= today && value < tomorrow;
}

function isOverdue(value: Date) {
  return Date.now() - value.getTime() > 6 * 60 * 60 * 1000;
}

function taskSnapshot(task: unknown) {
  const row = task as Partial<TaskWithRelations>;
  return {
    id: row.id,
    status: row.status,
    priority: row.priority,
    source: row.source,
    room: row.room?.number,
    cleaningStatus: row.room?.cleaningStatus,
    assignedTo: row.assignedTo?.name,
    pausedAt: row.pausedAt,
    rejectedAt: row.rejectedAt,
  };
}

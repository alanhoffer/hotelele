import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { cashMovementKinds, paymentMethods } from "@hotel-pms/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const openSchema = z.object({
  openingAmount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().optional().nullable(),
});

const movementSchema = z.object({
  kind: z.enum(cashMovementKinds).default("adjustment"),
  method: z.enum(paymentMethods).default("cash"),
  amount: z.coerce.number(),
  description: z.string().trim().min(1),
});

const closeSchema = z.object({
  countedCash: z.coerce.number().nonnegative(),
  notes: z.string().trim().optional().nullable(),
});

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(hotelId: string) {
    const sessions = await this.prisma.cashSession.findMany({
      where: { hotelId },
      orderBy: { openedAt: "desc" },
      take: 30,
      include: sessionInclude,
    });
    return sessions.map(serializeSession);
  }

  async current(request: AuthenticatedRequest) {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        hotelId: request.user.hotelId,
        openedById: request.user.id,
        status: "open",
      },
      orderBy: { openedAt: "desc" },
      include: sessionInclude,
    });
    return { session: session ? serializeSession(session) : null };
  }

  async findOpenForPayment(request: AuthenticatedRequest) {
    const session = await this.prisma.cashSession.findFirst({
      where: { hotelId: request.user.hotelId, openedById: request.user.id, status: "open" },
      orderBy: { openedAt: "desc" },
    });
    if (!session && request.user.roleCode !== "admin") {
      throw new ConflictException("Tenes que abrir caja antes de registrar pagos.");
    }
    return session;
  }

  async open(request: AuthenticatedRequest, rawBody: unknown) {
    const body = openSchema.parse(rawBody ?? {});
    const existing = await this.prisma.cashSession.findFirst({
      where: { hotelId: request.user.hotelId, openedById: request.user.id, status: "open" },
    });
    if (existing) throw new ConflictException("Ya tenes una caja abierta.");

    const session = await this.prisma.cashSession.create({
      data: {
        hotelId: request.user.hotelId,
        openedById: request.user.id,
        openingAmount: body.openingAmount,
        notes: body.notes ?? undefined,
      },
      include: sessionInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "cash_session.opened",
      entity: "CashSession",
      entityId: session.id,
      after: sessionSnapshot(session),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeSession(session);
  }

  async addMovement(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = movementSchema.parse(rawBody);
    const session = await this.findOpenSession(request.user.hotelId, id);
    const movement = await this.prisma.cashMovement.create({
      data: {
        hotelId: request.user.hotelId,
        cashSessionId: session.id,
        kind: body.kind,
        method: body.method,
        amount: body.amount,
        description: body.description,
      },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "cash_session.movement_created",
      entity: "CashMovement",
      entityId: movement.id,
      after: movement,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeSession(await this.findSession(request.user.hotelId, id));
  }

  async close(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = closeSchema.parse(rawBody);
    const before = await this.findOpenSession(request.user.hotelId, id);
    const after = await this.prisma.cashSession.update({
      where: { id: before.id },
      data: {
        status: "closed",
        countedCash: body.countedCash,
        closedById: request.user.id,
        closedAt: new Date(),
        notes: body.notes ?? before.notes,
      },
      include: sessionInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "cash_session.closed",
      entity: "CashSession",
      entityId: id,
      before: sessionSnapshot(before),
      after: sessionSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeSession(after);
  }

  private async findSession(hotelId: string, id: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { hotelId, id },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException("Caja no encontrada.");
    return session;
  }

  private async findOpenSession(hotelId: string, id: string) {
    const session = await this.findSession(hotelId, id);
    if (session.status !== "open") throw new ConflictException("La caja ya esta cerrada.");
    return session;
  }
}

const sessionInclude = {
  openedBy: true,
  closedBy: true,
  payments: { where: { voidedAt: null }, include: { folio: { include: { reservation: true } } } },
  movements: { where: { voidedAt: null }, orderBy: { createdAt: "desc" } },
} as const;

type CashSessionPayload = {
  id: string;
  status: string;
  openingAmount: unknown;
  countedCash?: unknown;
  openedAt: Date;
  closedAt?: Date | null;
  notes?: string | null;
  openedBy: { name: string };
  closedBy?: { name: string } | null;
  payments: { method: string; amount: unknown }[];
  movements: { kind: string; method: string; amount: unknown; description: string }[];
};

function serializeSession(session: CashSessionPayload) {
  const openingAmount = decimalToNumber(session.openingAmount);
  const paymentsTotal = session.payments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);
  const expensesTotal = session.movements
    .filter((movement) => movement.kind === "expense")
    .reduce((sum, movement) => sum + decimalToNumber(movement.amount), 0);
  const adjustmentsTotal = session.movements
    .filter((movement) => movement.kind === "adjustment")
    .reduce((sum, movement) => sum + decimalToNumber(movement.amount), 0);
  const expectedCash = openingAmount + paymentsTotal - expensesTotal + adjustmentsTotal;
  const countedCash = decimalToNumber(session.countedCash);

  return {
    ...session,
    openingAmount,
    countedCash,
    totals: {
      payments: paymentsTotal,
      expenses: expensesTotal,
      adjustments: adjustmentsTotal,
      expectedCash,
      difference: session.status === "closed" ? countedCash - expectedCash : null,
    },
  };
}

function sessionSnapshot(session: unknown) {
  const row = session as {
    id: string;
    status: string;
    openingAmount: unknown;
    countedCash?: unknown;
    openedBy?: { name: string };
    closedBy?: { name: string } | null;
  };
  return {
    id: row.id,
    status: row.status,
    openingAmount: decimalToNumber(row.openingAmount),
    countedCash: decimalToNumber(row.countedCash),
    openedBy: row.openedBy?.name,
    closedBy: row.closedBy?.name,
  };
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

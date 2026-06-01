import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { chargeKinds, paymentMethods } from "@hotel-pms/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { CashService } from "../cash/cash.service";
import { PrismaService } from "../prisma/prisma.service";

const chargeSchema = z.object({
  kind: z.enum(chargeKinds).default("extra"),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  unitAmount: z.coerce.number().positive(),
});

const paymentSchema = z.object({
  method: z.enum(paymentMethods).default("cash"),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(1).default("ARS"),
  reference: z.string().trim().optional().nullable(),
});

const voidSchema = z.object({
  reason: z.string().trim().min(1).default("Anulacion desde tablero"),
});

@Injectable()
export class FoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cash: CashService,
  ) {}

  async getActiveByRoom(hotelId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({ where: { hotelId, id: roomId } });
    if (!room) throw new NotFoundException("Habitacion no encontrada.");

    const folio = await this.prisma.folio.findFirst({
      where: { hotelId, roomId, status: "open" },
      orderBy: { openedAt: "desc" },
      include: folioInclude,
    });

    return { folio: folio ? serializeFolio(folio) : null };
  }

  async get(hotelId: string, id: string) {
    const folio = await this.findFolio(hotelId, id);
    return serializeFolio(folio);
  }

  async listUnpaid(hotelId: string) {
    const folios = await this.prisma.folio.findMany({
      where: { hotelId },
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
      include: folioInclude,
    });

    return folios
      .map((folio) => serializeFolio(folio))
      .filter((folio) => folio.totals.balance > 0.009)
      .sort((first, second) => second.totals.balance - first.totals.balance);
  }

  async addCharge(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const folio = await this.findOpenFolio(request.user.hotelId, id);
    const body = chargeSchema.parse(rawBody);
    const totalAmount = body.quantity * body.unitAmount;

    const charge = await this.prisma.charge.create({
      data: {
        hotelId: request.user.hotelId,
        folioId: folio.id,
        kind: body.kind,
        description: body.description,
        quantity: body.quantity,
        unitAmount: body.unitAmount,
        totalAmount,
      },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "folio.charge_created",
      entity: "Charge",
      entityId: charge.id,
      after: {
        folioId: folio.id,
        reservationCode: folio.reservation.code,
        kind: charge.kind,
        description: charge.description,
        totalAmount,
      },
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeFolio(await this.findFolio(request.user.hotelId, id));
  }

  async voidCharge(
    request: AuthenticatedRequest,
    id: string,
    chargeId: string,
    rawBody: unknown,
  ) {
    const folio = await this.findOpenFolio(request.user.hotelId, id);
    const body = voidSchema.parse(rawBody ?? {});
    const charge = await this.prisma.charge.findFirst({
      where: { hotelId: request.user.hotelId, folioId: folio.id, id: chargeId },
    });
    if (!charge) throw new NotFoundException("Cargo no encontrado.");
    if (charge.voidedAt) throw new ConflictException("El cargo ya fue anulado.");

    const after = await this.prisma.charge.update({
      where: { id: charge.id },
      data: { voidedAt: new Date() },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "folio.charge_voided",
      entity: "Charge",
      entityId: charge.id,
      before: chargeSnapshot(charge),
      after: chargeSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeFolio(await this.findFolio(request.user.hotelId, id));
  }

  async addPayment(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const folio = await this.findOpenFolio(request.user.hotelId, id);
    const body = paymentSchema.parse(rawBody);
    const cashSession = await this.cash.findOpenForPayment(request);

    const payment = await this.prisma.payment.create({
      data: {
        hotelId: request.user.hotelId,
        folioId: folio.id,
        method: body.method,
        currency: body.currency,
        amount: body.amount,
        reference: body.reference ?? undefined,
        cashSessionId: cashSession?.id,
      },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "folio.payment_created",
      entity: "Payment",
      entityId: payment.id,
      after: {
        folioId: folio.id,
        reservationCode: folio.reservation.code,
        method: payment.method,
        amount: body.amount,
      },
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeFolio(await this.findFolio(request.user.hotelId, id));
  }

  async voidPayment(
    request: AuthenticatedRequest,
    id: string,
    paymentId: string,
    rawBody: unknown,
  ) {
    const folio = await this.findOpenFolio(request.user.hotelId, id);
    const body = voidSchema.parse(rawBody ?? {});
    const payment = await this.prisma.payment.findFirst({
      where: { hotelId: request.user.hotelId, folioId: folio.id, id: paymentId },
    });
    if (!payment) throw new NotFoundException("Pago no encontrado.");
    if (payment.voidedAt) throw new ConflictException("El pago ya fue anulado.");

    const after = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { voidedAt: new Date() },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "folio.payment_voided",
      entity: "Payment",
      entityId: payment.id,
      before: paymentSnapshot(payment),
      after: paymentSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return serializeFolio(await this.findFolio(request.user.hotelId, id));
  }

  private async findFolio(hotelId: string, id: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { hotelId, id },
      include: folioInclude,
    });
    if (!folio) throw new NotFoundException("Cuenta no encontrada.");
    return folio;
  }

  private async findOpenFolio(hotelId: string, id: string) {
    const folio = await this.findFolio(hotelId, id);
    if (folio.status !== "open") {
      throw new ConflictException("La cuenta ya esta cerrada.");
    }
    return folio;
  }
}

const folioInclude = {
  reservation: {
    include: {
      guest: true,
      roomType: true,
      assignedRoom: true,
    },
  },
  room: {
    include: { roomType: true },
  },
  charges: {
    where: { voidedAt: null },
    orderBy: { postedAt: "desc" },
  },
  payments: {
    where: { voidedAt: null },
    orderBy: { paidAt: "desc" },
  },
} as const;

type FolioPayload = {
  id: string;
  status: string;
  currency: string;
  openedAt: Date;
  closedAt: Date | null;
  reservation: {
    id: string;
    code: string;
    status: string;
    checkInDate: Date;
    checkOutDate: Date;
    guest: {
      firstName: string;
      lastName: string;
      phone?: string | null;
    };
    roomType: {
      id: string;
      code: string;
      name: string;
    };
    assignedRoom?: {
      id: string;
      number: string;
    } | null;
  };
  room: {
    id: string;
    number: string;
    floor?: string | null;
    roomType: {
      id: string;
      code: string;
      name: string;
    };
  };
  charges: {
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unitAmount: unknown;
    totalAmount: unknown;
    postedAt: Date;
  }[];
  payments: {
    id: string;
    method: string;
    currency: string;
    amount: unknown;
    reference?: string | null;
    paidAt: Date;
  }[];
};

function serializeFolio(folio: FolioPayload) {
  const charges = folio.charges.map((charge) => ({
    ...charge,
    unitAmount: decimalToNumber(charge.unitAmount),
    totalAmount: decimalToNumber(charge.totalAmount),
  }));
  const payments = folio.payments.map((payment) => ({
    ...payment,
    amount: decimalToNumber(payment.amount),
  }));
  const chargesTotal = charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
  const paymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    id: folio.id,
    status: folio.status,
    currency: folio.currency,
    openedAt: folio.openedAt,
    closedAt: folio.closedAt,
    reservation: folio.reservation,
    room: folio.room,
    charges,
    payments,
    totals: {
      charges: chargesTotal,
      payments: paymentsTotal,
      balance: chargesTotal - paymentsTotal,
    },
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
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) throw new BadRequestException("Importe invalido.");
  return numberValue;
}

function chargeSnapshot(charge: {
  kind: string;
  description: string;
  quantity: number;
  unitAmount: unknown;
  totalAmount: unknown;
  voidedAt?: Date | null;
}) {
  return {
    kind: charge.kind,
    description: charge.description,
    quantity: charge.quantity,
    unitAmount: decimalToNumber(charge.unitAmount),
    totalAmount: decimalToNumber(charge.totalAmount),
    voidedAt: charge.voidedAt,
  };
}

function paymentSnapshot(payment: {
  method: string;
  currency: string;
  amount: unknown;
  reference?: string | null;
  voidedAt?: Date | null;
}) {
  return {
    method: payment.method,
    currency: payment.currency,
    amount: decimalToNumber(payment.amount),
    reference: payment.reference,
    voidedAt: payment.voidedAt,
  };
}

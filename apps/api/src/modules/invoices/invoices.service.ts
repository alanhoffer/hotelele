import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { invoiceTypes } from "@hotel-pms/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const createInvoiceSchema = z.object({
  type: z.enum(invoiceTypes).default("invoice"),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(1).default("Anulacion de comprobante"),
});

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(hotelId: string) {
    return this.prisma.invoice.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        folio: {
          include: {
            reservation: { include: { guest: true, assignedRoom: true } },
          },
        },
      },
    });
  }

  async createFromFolio(request: AuthenticatedRequest, folioId: string, rawBody: unknown) {
    const body = createInvoiceSchema.parse(rawBody ?? {});
    const folio = await this.prisma.folio.findFirst({
      where: { hotelId: request.user.hotelId, id: folioId },
      include: {
        charges: { where: { voidedAt: null } },
        payments: { where: { voidedAt: null } },
        reservation: true,
      },
    });
    if (!folio) throw new NotFoundException("Cuenta no encontrada.");
    if (!folio.charges.length) throw new BadRequestException("No hay cargos para facturar.");

    const subtotal = folio.charges.reduce((sum, charge) => sum + decimalToNumber(charge.totalAmount), 0);
    const taxAmount = body.type === "internal_receipt" ? 0 : Math.round((subtotal * 0.21) / 1.21);
    const totalAmount = subtotal;

    const invoice = await this.prisma.invoice.create({
      data: {
        hotelId: request.user.hotelId,
        folioId,
        type: body.type,
        status: "draft",
        subtotal,
        taxAmount,
        totalAmount,
      },
      include: {
        folio: { include: { reservation: { include: { guest: true, assignedRoom: true } } } },
      },
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "invoice.created",
      entity: "Invoice",
      entityId: invoice.id,
      after: invoiceSnapshot(invoice),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return invoice;
  }

  async markPendingAfip(request: AuthenticatedRequest, id: string) {
    const before = await this.findInvoice(request.user.hotelId, id);
    if (before.status !== "draft" || before.type === "internal_receipt") {
      throw new ConflictException("Solo una factura borrador puede pasar a AFIP.");
    }

    const after = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: "pending_afip",
        issuedAt: new Date(),
        pointOfSale: "0001",
      },
      include: invoiceInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "invoice.pending_afip",
      entity: "Invoice",
      entityId: id,
      before: invoiceSnapshot(before),
      after: invoiceSnapshot(after),
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  async cancel(request: AuthenticatedRequest, id: string, rawBody: unknown) {
    const body = cancelSchema.parse(rawBody ?? {});
    const before = await this.findInvoice(request.user.hotelId, id);
    if (before.status === "cancelled") throw new ConflictException("El comprobante ya esta anulado.");
    if (before.status === "authorized") {
      throw new ConflictException("Un comprobante autorizado requiere nota de credito.");
    }

    const after = await this.prisma.invoice.update({
      where: { id },
      data: { status: "cancelled" },
      include: invoiceInclude,
    });

    await this.audit.record({
      hotelId: request.user.hotelId,
      userId: request.user.id,
      action: "invoice.cancelled",
      entity: "Invoice",
      entityId: id,
      before: invoiceSnapshot(before),
      after: invoiceSnapshot(after),
      reason: body.reason,
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    return after;
  }

  private async findInvoice(hotelId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { hotelId, id },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException("Comprobante no encontrado.");
    return invoice;
  }
}

const invoiceInclude = {
  folio: {
    include: {
      reservation: { include: { guest: true, assignedRoom: true } },
    },
  },
} as const;

function invoiceSnapshot(invoice: unknown) {
  const row = invoice as {
    id: string;
    type: string;
    status: string;
    totalAmount: unknown;
    folio?: { reservation?: { code: string } } | null;
  };
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    totalAmount: decimalToNumber(row.totalAmount),
    reservationCode: row.folio?.reservation?.code,
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

import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { RequestUser } from "../auth/auth.types";

type DocumentScanRequestInput = {
  reservationId: string;
  reservationCode?: string;
  occupantIndex: number;
  occupantLabel?: string;
};

export type DocumentScanParsed = {
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  gender?: string;
  birthDate?: string;
  issueDate?: string;
  cuil?: string;
};

export type DocumentScanResultInput = {
  parsed?: DocumentScanParsed;
  imageDataUrl?: string;
  note?: string;
};

type DocumentScanRequest = {
  id: string;
  hotelId: string;
  userId: string;
  reservationId: string;
  reservationCode?: string;
  occupantIndex: number;
  occupantLabel?: string;
  status: "waiting" | "received";
  createdAt: string;
  expiresAt: string;
  result?: {
    parsed: DocumentScanParsed;
    imageDataUrl?: string;
    note?: string;
    receivedAt: string;
  };
};

@Injectable()
export class DocumentScansService {
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly requests = new Map<string, DocumentScanRequest>();

  createRequest(user: RequestUser, input: DocumentScanRequestInput) {
    this.prune();

    const now = new Date();
    const request: DocumentScanRequest = {
      id: randomUUID(),
      hotelId: user.hotelId,
      userId: user.id,
      reservationId: input.reservationId,
      reservationCode: cleanText(input.reservationCode),
      occupantIndex: Number.isFinite(input.occupantIndex) ? input.occupantIndex : 0,
      occupantLabel: cleanText(input.occupantLabel),
      status: "waiting",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };

    for (const [id, current] of this.requests.entries()) {
      if (
        current.hotelId === user.hotelId &&
        current.userId === user.id &&
        current.reservationId === request.reservationId &&
        current.occupantIndex === request.occupantIndex &&
        current.status === "waiting"
      ) {
        this.requests.delete(id);
      }
    }

    this.requests.set(request.id, request);
    return this.serialize(request);
  }

  getActiveRequest(user: RequestUser) {
    this.prune();

    const rows = Array.from(this.requests.values())
      .filter((request) => request.hotelId === user.hotelId && request.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return rows[0] ? this.serialize(rows[0]) : null;
  }

  getRequest(user: RequestUser, id: string) {
    this.prune();
    return this.serialize(this.findForUser(user, id));
  }

  submitResult(user: RequestUser, id: string, input: DocumentScanResultInput) {
    this.prune();
    const request = this.findForUser(user, id);
    const parsed = normalizeParsed(input.parsed);
    const imageDataUrl = normalizeImageDataUrl(input.imageDataUrl);

    request.status = "received";
    request.result = {
      parsed,
      imageDataUrl,
      note: cleanText(input.note),
      receivedAt: new Date().toISOString(),
    };

    this.requests.set(request.id, request);
    return this.serialize(request);
  }

  consumeRequest(user: RequestUser, id: string) {
    this.prune();
    const request = this.findForUser(user, id);
    this.requests.delete(request.id);
    return { ok: true };
  }

  private findForUser(user: RequestUser, id: string) {
    const request = this.requests.get(id);
    if (!request || request.hotelId !== user.hotelId || request.userId !== user.id) {
      throw new NotFoundException("Pedido de escaneo inexistente o vencido.");
    }
    return request;
  }

  private prune() {
    const now = Date.now();
    for (const [id, request] of this.requests.entries()) {
      if (Date.parse(request.expiresAt) < now) {
        this.requests.delete(id);
      }
    }
  }

  private serialize(request: DocumentScanRequest) {
    return {
      id: request.id,
      reservationId: request.reservationId,
      reservationCode: request.reservationCode,
      occupantIndex: request.occupantIndex,
      occupantLabel: request.occupantLabel,
      status: request.status,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      result: request.result,
    };
  }
}

function normalizeParsed(parsed: DocumentScanResultInput["parsed"]): DocumentScanParsed {
  return {
    firstName: cleanText(parsed?.firstName),
    lastName: cleanText(parsed?.lastName),
    documentType: cleanText(parsed?.documentType),
    documentNumber: cleanText(parsed?.documentNumber),
    nationality: cleanText(parsed?.nationality),
    gender: cleanText(parsed?.gender),
    birthDate: cleanText(parsed?.birthDate),
    issueDate: cleanText(parsed?.issueDate),
    cuil: cleanText(parsed?.cuil),
  };
}

function normalizeImageDataUrl(value?: string) {
  if (!value?.startsWith("data:image/")) return undefined;
  if (value.length > 2_500_000) return undefined;
  return value;
}

function cleanText(value?: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 180) : undefined;
}

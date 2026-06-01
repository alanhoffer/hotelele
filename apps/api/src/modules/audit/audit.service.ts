import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type AuditRecord = {
  hotelId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(data: AuditRecord) {
    return this.prisma.auditLog.create({
      data: {
        hotelId: data.hotelId,
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        before: data.before === undefined ? undefined : JSON.parse(JSON.stringify(data.before)),
        after: data.after === undefined ? undefined : JSON.parse(JSON.stringify(data.after)),
        reason: data.reason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

import { Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, request: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { email: String(email || "").toLowerCase().trim() },
      include: {
        hotel: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const passwordOk = user ? await bcrypt.compare(password ?? "", user.passwordHash) : false;
    if (!user || !passwordOk || user.status !== "active") {
      await this.audit.record({
        action: "auth.login_failed",
        entity: "User",
        entityId: user?.id,
        after: { email },
        ipAddress: request.ip,
        userAgent: request.headers?.["user-agent"],
      });
      throw new UnauthorizedException("Usuario o contrasena incorrectos.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      hotelId: user.hotelId,
      userId: user.id,
      action: "auth.login_success",
      entity: "User",
      entityId: user.id,
      after: { email: user.email },
      ipAddress: request.ip,
      userAgent: request.headers?.["user-agent"],
    });

    const token = jwt.sign(
      { sub: user.id, hotelId: user.hotelId },
      process.env.JWT_SECRET ?? "dev-secret",
      { expiresIn: "12h" },
    );

    return {
      token,
      user: sanitizeUser(user),
      hotel: user.hotel,
      role: user.role,
      permissions: user.role.permissions.map(
        (row: { permission: { code: string } }) => row.permission.code,
      ),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        hotel: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    return {
      user: sanitizeUser(user),
      hotel: user.hotel,
      role: user.role,
      permissions: user.role.permissions.map(
        (row: { permission: { code: string } }) => row.permission.code,
      ),
    };
  }
}

function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

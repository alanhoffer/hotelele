import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "./auth.decorators";
import { PrismaService } from "../prisma/prisma.service";

type TokenPayload = {
  sub: string;
  hotelId: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Token requerido.");

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? "dev-secret") as TokenPayload;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!user || user.status !== "active") {
        throw new UnauthorizedException("Usuario inactivo o inexistente.");
      }

      request.user = {
        id: user.id,
        hotelId: user.hotelId,
        roleId: user.roleId,
        roleCode: user.role.code,
        permissions: user.role.permissions.map(
          (row: { permission: { code: string } }) => row.permission.code,
        ),
      };
      return true;
    } catch {
      throw new UnauthorizedException("Sesion invalida.");
    }
  }
}

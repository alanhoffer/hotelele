import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Public } from "./auth.decorators";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: { email: string; password: string }, @Req() request: AuthenticatedRequest) {
    return this.auth.login(body.email, body.password, request);
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id);
  }
}

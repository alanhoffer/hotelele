import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      ok: true,
      service: "hotel-pms-api",
      time: new Date().toISOString(),
    };
  }
}

import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto) {
    const email = typeof (dto as any)?.email === "string" ? (dto as any).email.trim().toLowerCase() : "";
    const password = typeof (dto as any)?.password === "string" ? (dto as any).password : "";
    if (!email || !password) {
      throw new BadRequestException("email y password son obligatorios");
    }
    return this.authService.login(email, password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: unknown) {
    return user;
  }
}

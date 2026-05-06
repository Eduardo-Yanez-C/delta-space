import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { QuoteAddOnsService } from "./quote-addons.service";

@Controller("quote-addons")
@UseGuards(JwtAuthGuard)
export class QuoteAddOnsController {
  constructor(private readonly quoteAddOnsService: QuoteAddOnsService) {}

  @Get()
  findAll() {
    return this.quoteAddOnsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.quoteAddOnsService.findOne(id);
  }
}

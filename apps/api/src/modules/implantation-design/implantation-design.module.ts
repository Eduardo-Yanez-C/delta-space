import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { FvStudyModule } from "../fv-study/fv-study.module";
import { ImplantationDesignController } from "./implantation-design.controller";
import { ImplantationScreenshotController } from "./implantation-screenshot.controller";
import { ImplantationDesignService } from "./implantation-design.service";

@Module({
  imports: [AuthModule, PrismaModule, FvStudyModule],
  controllers: [ImplantationDesignController, ImplantationScreenshotController],
  providers: [ImplantationDesignService],
  exports: [ImplantationDesignService],
})
export class ImplantationDesignModule {}

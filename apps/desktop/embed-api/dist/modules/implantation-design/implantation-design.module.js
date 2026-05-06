"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImplantationDesignModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../infra/prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const fv_study_module_1 = require("../fv-study/fv-study.module");
const implantation_design_controller_1 = require("./implantation-design.controller");
const implantation_screenshot_controller_1 = require("./implantation-screenshot.controller");
const implantation_design_service_1 = require("./implantation-design.service");
let ImplantationDesignModule = class ImplantationDesignModule {
};
exports.ImplantationDesignModule = ImplantationDesignModule;
exports.ImplantationDesignModule = ImplantationDesignModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, prisma_module_1.PrismaModule, fv_study_module_1.FvStudyModule],
        controllers: [implantation_design_controller_1.ImplantationDesignController, implantation_screenshot_controller_1.ImplantationScreenshotController],
        providers: [implantation_design_service_1.ImplantationDesignService],
        exports: [implantation_design_service_1.ImplantationDesignService],
    })
], ImplantationDesignModule);

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductModelsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const product_models_controller_1 = require("./product-models.controller");
const product_models_service_1 = require("./product-models.service");
let ProductModelsModule = class ProductModelsModule {
};
exports.ProductModelsModule = ProductModelsModule;
exports.ProductModelsModule = ProductModelsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [product_models_controller_1.ProductModelsController],
        providers: [product_models_service_1.ProductModelsService],
        exports: [product_models_service_1.ProductModelsService],
    })
], ProductModelsModule);

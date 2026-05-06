"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteMainItemsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../../auth/decorators/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const quote_main_items_service_1 = require("./quote-main-items.service");
const create_main_item_dto_1 = require("./dto/create-main-item.dto");
const create_line_dto_1 = require("./dto/create-line.dto");
const update_line_dto_1 = require("./dto/update-line.dto");
const update_main_item_dto_1 = require("./dto/update-main-item.dto");
let QuoteMainItemsController = class QuoteMainItemsController {
    constructor(mainItemsService) {
        this.mainItemsService = mainItemsService;
    }
    createMainItem(quoteId, versionId, dto, user) {
        return this.mainItemsService.createMainItem(quoteId, versionId, dto, user);
    }
    updateMainItem(quoteId, versionId, mainItemId, dto, user) {
        return this.mainItemsService.updateMainItem(quoteId, versionId, mainItemId, dto, user);
    }
    duplicateMainItem(quoteId, versionId, mainItemId, user) {
        return this.mainItemsService.duplicateMainItem(quoteId, versionId, mainItemId, user);
    }
    createLine(quoteId, versionId, mainItemId, dto, user) {
        return this.mainItemsService.createLine(quoteId, versionId, mainItemId, dto, user);
    }
    duplicateLine(quoteId, versionId, lineId, user) {
        return this.mainItemsService.duplicateLine(quoteId, versionId, lineId, user);
    }
    updateLine(quoteId, versionId, lineId, dto, user) {
        return this.mainItemsService.updateLine(quoteId, versionId, lineId, dto, user);
    }
    deleteLine(quoteId, versionId, lineId, user) {
        return this.mainItemsService.deleteLine(quoteId, versionId, lineId, user);
    }
};
exports.QuoteMainItemsController = QuoteMainItemsController;
__decorate([
    (0, common_1.Post)("main-items"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_main_item_dto_1.CreateMainItemDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "createMainItem", null);
__decorate([
    (0, common_1.Patch)("main-items/:mainItemId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("mainItemId")),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_main_item_dto_1.UpdateMainItemDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "updateMainItem", null);
__decorate([
    (0, common_1.Post)("main-items/:mainItemId/duplicate"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("mainItemId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "duplicateMainItem", null);
__decorate([
    (0, common_1.Post)("main-items/:mainItemId/lines"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("mainItemId")),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, create_line_dto_1.CreateLineDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "createLine", null);
__decorate([
    (0, common_1.Post)("lines/:lineId/duplicate"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("lineId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "duplicateLine", null);
__decorate([
    (0, common_1.Patch)("lines/:lineId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("lineId")),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_line_dto_1.UpdateLineDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "updateLine", null);
__decorate([
    (0, common_1.Delete)("lines/:lineId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("lineId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteMainItemsController.prototype, "deleteLine", null);
exports.QuoteMainItemsController = QuoteMainItemsController = __decorate([
    (0, common_1.Controller)("quotes/:quoteId/versions/:versionId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quote_main_items_service_1.QuoteMainItemsService])
], QuoteMainItemsController);

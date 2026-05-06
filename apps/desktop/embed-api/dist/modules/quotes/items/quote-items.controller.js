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
exports.QuoteItemsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../../auth/decorators/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const quote_items_service_1 = require("./quote-items.service");
const create_quote_item_dto_1 = require("./dto/create-quote-item.dto");
const update_quote_item_dto_1 = require("./dto/update-quote-item.dto");
let QuoteItemsController = class QuoteItemsController {
    constructor(itemsService) {
        this.itemsService = itemsService;
    }
    findAll(quoteId, versionId, user) {
        return this.itemsService.findAll(quoteId, versionId, user);
    }
    addItem(quoteId, versionId, dto, user) {
        return this.itemsService.addItem(quoteId, versionId, dto, user);
    }
    updateItem(quoteId, versionId, itemId, dto, user) {
        return this.itemsService.updateItem(quoteId, versionId, itemId, dto, user);
    }
    removeItem(quoteId, versionId, itemId, user) {
        return this.itemsService.removeItem(quoteId, versionId, itemId, user);
    }
};
exports.QuoteItemsController = QuoteItemsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteItemsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_quote_item_dto_1.CreateQuoteItemDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteItemsController.prototype, "addItem", null);
__decorate([
    (0, common_1.Patch)(":itemId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("itemId")),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_quote_item_dto_1.UpdateQuoteItemDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteItemsController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)(":itemId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("itemId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteItemsController.prototype, "removeItem", null);
exports.QuoteItemsController = QuoteItemsController = __decorate([
    (0, common_1.Controller)("quotes/:quoteId/versions/:versionId/items"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quote_items_service_1.QuoteItemsService])
], QuoteItemsController);

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
exports.QuoteTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const quote_templates_service_1 = require("./quote-templates.service");
const create_quote_from_template_dto_1 = require("./dto/create-quote-from-template.dto");
const create_quote_template_dto_1 = require("./dto/create-quote-template.dto");
const create_template_line_dto_1 = require("./dto/create-template-line.dto");
const update_quote_template_dto_1 = require("./dto/update-quote-template.dto");
const update_template_item_dto_1 = require("./dto/update-template-item.dto");
const update_template_line_dto_1 = require("./dto/update-template-line.dto");
let QuoteTemplatesController = class QuoteTemplatesController {
    constructor(quoteTemplatesService) {
        this.quoteTemplatesService = quoteTemplatesService;
    }
    findAll(quoteKind) {
        return this.quoteTemplatesService.findAll(quoteKind);
    }
    createTemplate(body) {
        return this.quoteTemplatesService.createTemplate(body);
    }
    findOne(id) {
        return this.quoteTemplatesService.findOne(id);
    }
    updateTemplate(id, body) {
        return this.quoteTemplatesService.updateTemplate(id, body);
    }
    createQuoteFromTemplate(id, body, user) {
        return this.quoteTemplatesService.createQuoteFromTemplate(id, body, user);
    }
    updateTemplateItem(templateId, itemId, body) {
        return this.quoteTemplatesService.updateTemplateItem(templateId, itemId, body);
    }
    createLine(templateId, itemId, body) {
        return this.quoteTemplatesService.createLine(templateId, itemId, body);
    }
    updateLine(templateId, lineId, body) {
        return this.quoteTemplatesService.updateLine(templateId, lineId, body);
    }
    deleteLine(templateId, lineId) {
        return this.quoteTemplatesService.deleteLine(templateId, lineId);
    }
};
exports.QuoteTemplatesController = QuoteTemplatesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("quoteKind")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_quote_template_dto_1.CreateQuoteTemplateDto]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_quote_template_dto_1.UpdateQuoteTemplateDto]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "updateTemplate", null);
__decorate([
    (0, common_1.Post)(":id/create-quote"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_quote_from_template_dto_1.CreateQuoteFromTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "createQuoteFromTemplate", null);
__decorate([
    (0, common_1.Patch)(":templateId/items/:itemId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("templateId")),
    __param(1, (0, common_1.Param)("itemId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_template_item_dto_1.UpdateTemplateItemDto]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "updateTemplateItem", null);
__decorate([
    (0, common_1.Post)(":templateId/items/:itemId/lines"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("templateId")),
    __param(1, (0, common_1.Param)("itemId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_template_line_dto_1.CreateTemplateLineDto]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "createLine", null);
__decorate([
    (0, common_1.Patch)(":templateId/lines/:lineId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("templateId")),
    __param(1, (0, common_1.Param)("lineId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_template_line_dto_1.UpdateTemplateLineDto]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "updateLine", null);
__decorate([
    (0, common_1.Delete)(":templateId/lines/:lineId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("templateId")),
    __param(1, (0, common_1.Param)("lineId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], QuoteTemplatesController.prototype, "deleteLine", null);
exports.QuoteTemplatesController = QuoteTemplatesController = __decorate([
    (0, common_1.Controller)("quote-templates"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quote_templates_service_1.QuoteTemplatesService])
], QuoteTemplatesController);

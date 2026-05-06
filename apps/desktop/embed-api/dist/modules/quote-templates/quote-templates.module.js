"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteTemplatesModule = void 0;
const common_1 = require("@nestjs/common");
const quote_templates_controller_1 = require("./quote-templates.controller");
const quote_templates_service_1 = require("./quote-templates.service");
const quotes_module_1 = require("../quotes/quotes.module");
let QuoteTemplatesModule = class QuoteTemplatesModule {
};
exports.QuoteTemplatesModule = QuoteTemplatesModule;
exports.QuoteTemplatesModule = QuoteTemplatesModule = __decorate([
    (0, common_1.Module)({
        imports: [quotes_module_1.QuotesModule],
        controllers: [quote_templates_controller_1.QuoteTemplatesController],
        providers: [quote_templates_service_1.QuoteTemplatesService],
        exports: [quote_templates_service_1.QuoteTemplatesService],
    })
], QuoteTemplatesModule);

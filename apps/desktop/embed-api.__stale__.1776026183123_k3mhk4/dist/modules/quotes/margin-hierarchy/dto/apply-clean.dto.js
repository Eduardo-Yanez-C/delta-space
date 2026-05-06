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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyCleanDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const margin_hierarchy_constants_1 = require("../margin-hierarchy.constants");
const SYSTEM_VALUES = [...margin_hierarchy_constants_1.MARGIN_SYSTEM_TYPES];
const MOUNT_VALUES = [...margin_hierarchy_constants_1.MARGIN_MOUNT_STRUCTURE_TYPES];
function toOptionalBoolean(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (value === true || value === "true")
        return true;
    if (value === false || value === "false")
        return false;
    return value;
}
class ApplyCleanDto {
}
exports.ApplyCleanDto = ApplyCleanDto;
__decorate([
    (0, class_validator_1.IsIn)(SYSTEM_VALUES, {
        message: `systemType debe ser uno de: ${SYSTEM_VALUES.join(", ")}`,
    }),
    __metadata("design:type", String)
], ApplyCleanDto.prototype, "systemType", void 0);
__decorate([
    (0, class_validator_1.IsIn)(MOUNT_VALUES, {
        message: `mountStructureType debe ser uno de: ${MOUNT_VALUES.join(", ")}`,
    }),
    __metadata("design:type", String)
], ApplyCleanDto.prototype, "mountStructureType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalBoolean(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyCleanDto.prototype, "replaceExisting", void 0);

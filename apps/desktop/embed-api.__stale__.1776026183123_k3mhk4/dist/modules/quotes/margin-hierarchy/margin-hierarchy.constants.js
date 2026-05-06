"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARGIN_MOUNT_STRUCTURE_TYPES = exports.MARGIN_SYSTEM_TYPES = void 0;
exports.isValidMarginHierarchySystemType = isValidMarginHierarchySystemType;
exports.isValidMarginHierarchyMountStructureType = isValidMarginHierarchyMountStructureType;
/**
 * Fuente de verdad backend para plantilla limpia MARGIN (apply-clean).
 * No compartir con web en esta etapa; el front replica valores literales solo en UI.
 */
exports.MARGIN_SYSTEM_TYPES = ["ON_GRID", "HYBRID", "OFF_GRID"];
exports.MARGIN_MOUNT_STRUCTURE_TYPES = ["STANDARD", "ANGULAR", "MIXTA"];
function isValidMarginHierarchySystemType(s) {
    return exports.MARGIN_SYSTEM_TYPES.includes(s);
}
function isValidMarginHierarchyMountStructureType(s) {
    return exports.MARGIN_MOUNT_STRUCTURE_TYPES.includes(s);
}

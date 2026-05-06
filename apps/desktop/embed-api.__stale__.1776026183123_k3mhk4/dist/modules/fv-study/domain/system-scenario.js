"use strict";
/**
 * Escenario energético derivado de systemType + flags de red (no persistir en BD).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemScenario = exports.SYSTEM_TYPE_HYBRID = exports.SYSTEM_TYPE_OFF_GRID = exports.SYSTEM_TYPE_ON_GRID = void 0;
exports.collectFvSystemConfigErrors = collectFvSystemConfigErrors;
exports.getSystemScenario = getSystemScenario;
exports.getSystemScenarioOrNull = getSystemScenarioOrNull;
exports.SYSTEM_TYPE_ON_GRID = "ON_GRID";
exports.SYSTEM_TYPE_OFF_GRID = "OFF_GRID";
exports.SYSTEM_TYPE_HYBRID = "HYBRID";
const KNOWN_SYSTEM_TYPES = [
    exports.SYSTEM_TYPE_ON_GRID,
    exports.SYSTEM_TYPE_OFF_GRID,
    exports.SYSTEM_TYPE_HYBRID,
];
function isFvSystemType(s) {
    return KNOWN_SYSTEM_TYPES.includes(s);
}
var SystemScenario;
(function (SystemScenario) {
    SystemScenario["OFFGRID_ISOLATED"] = "OFFGRID_ISOLATED";
    SystemScenario["OFFGRID_WITH_GRID_SUPPORT"] = "OFFGRID_WITH_GRID_SUPPORT";
    SystemScenario["HYBRID_WITH_EXPORT"] = "HYBRID_WITH_EXPORT";
    SystemScenario["HYBRID_NO_EXPORT"] = "HYBRID_NO_EXPORT";
    SystemScenario["ONGRID_WITH_EXPORT"] = "ONGRID_WITH_EXPORT";
    SystemScenario["ONGRID_NO_EXPORT"] = "ONGRID_NO_EXPORT";
})(SystemScenario || (exports.SystemScenario = SystemScenario = {}));
const EXPORT_WITHOUT_GRID = "No se puede inyectar a la red sin tener red disponible.";
const OFFGRID_NO_EXPORT = "Los sistemas off-grid no permiten inyección a la red.";
const ONGRID_NEEDS_GRID = "On-grid requiere red de distribución disponible.";
const HYBRID_NEEDS_GRID = "Los sistemas híbridos requieren red de distribución disponible.";
/**
 * Errores de negocio (sin normalizar combinaciones inválidas).
 */
function collectFvSystemConfigErrors(input) {
    const errors = [];
    if (!isFvSystemType(input.systemType)) {
        errors.push(`systemType debe ser ON_GRID, OFF_GRID o HYBRID; recibido: ${input.systemType}`);
        return errors;
    }
    if (input.gridExportEnabled && !input.utilityGridAvailable) {
        errors.push(EXPORT_WITHOUT_GRID);
    }
    if (input.systemType === exports.SYSTEM_TYPE_OFF_GRID && input.gridExportEnabled) {
        errors.push(OFFGRID_NO_EXPORT);
    }
    if (input.systemType === exports.SYSTEM_TYPE_ON_GRID && !input.utilityGridAvailable) {
        errors.push(ONGRID_NEEDS_GRID);
    }
    if (input.systemType === exports.SYSTEM_TYPE_HYBRID && !input.utilityGridAvailable) {
        errors.push(HYBRID_NEEDS_GRID);
    }
    return errors;
}
function mapSystemScenario(input) {
    if (input.systemType === exports.SYSTEM_TYPE_OFF_GRID) {
        return input.utilityGridAvailable
            ? SystemScenario.OFFGRID_WITH_GRID_SUPPORT
            : SystemScenario.OFFGRID_ISOLATED;
    }
    if (input.systemType === exports.SYSTEM_TYPE_HYBRID) {
        return input.gridExportEnabled ? SystemScenario.HYBRID_WITH_EXPORT : SystemScenario.HYBRID_NO_EXPORT;
    }
    return input.gridExportEnabled ? SystemScenario.ONGRID_WITH_EXPORT : SystemScenario.ONGRID_NO_EXPORT;
}
/**
 * Devuelve el escenario solo si la combinación es válida; en caso contrario lanza.
 */
function getSystemScenario(input) {
    const errs = collectFvSystemConfigErrors(input);
    if (errs.length > 0) {
        throw new Error(errs.join(" "));
    }
    return mapSystemScenario(input);
}
function getSystemScenarioOrNull(input) {
    if (collectFvSystemConfigErrors(input).length > 0) {
        return null;
    }
    return mapSystemScenario(input);
}

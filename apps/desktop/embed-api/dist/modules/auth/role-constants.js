"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATIONAL_WRITE_ROLES = exports.ELEVATED_USER_MANAGEMENT_ROLES = exports.ROLE_LECTURA = exports.ROLE_INGENIERIA = exports.ROLE_VENTAS_LEGACY = exports.ROLE_VENDEDOR_TECNICO = exports.ROLE_ADMIN = exports.ROLE_ADMIN_DEV = void 0;
exports.expandRolesForGuard = expandRolesForGuard;
exports.isAdminDev = isAdminDev;
exports.canManageElevatedUsers = canManageElevatedUsers;
exports.userRoleNamesHaveElevatedManagement = userRoleNamesHaveElevatedManagement;
exports.hasGlobalAdminPrivileges = hasGlobalAdminPrivileges;
exports.hasSalesLikePrivileges = hasSalesLikePrivileges;
exports.ROLE_ADMIN_DEV = "ADMIN_DEV";
exports.ROLE_ADMIN = "ADMIN";
exports.ROLE_VENDEDOR_TECNICO = "VENDEDOR_TECNICO";
exports.ROLE_VENTAS_LEGACY = "VENTAS";
exports.ROLE_INGENIERIA = "INGENIERIA";
exports.ROLE_LECTURA = "LECTURA";
exports.ELEVATED_USER_MANAGEMENT_ROLES = new Set([exports.ROLE_ADMIN_DEV, exports.ROLE_ADMIN]);
function expandRolesForGuard(roles) {
    const s = new Set(roles);
    if (s.has(exports.ROLE_ADMIN_DEV)) {
        s.add(exports.ROLE_ADMIN);
        s.add(exports.ROLE_VENTAS_LEGACY);
        s.add(exports.ROLE_VENDEDOR_TECNICO);
        s.add(exports.ROLE_INGENIERIA);
        s.add(exports.ROLE_LECTURA);
    }
    if (s.has(exports.ROLE_ADMIN)) {
        s.add(exports.ROLE_VENTAS_LEGACY);
        s.add(exports.ROLE_VENDEDOR_TECNICO);
        s.add(exports.ROLE_INGENIERIA);
        s.add(exports.ROLE_LECTURA);
    }
    if (s.has(exports.ROLE_VENDEDOR_TECNICO)) {
        s.add(exports.ROLE_VENTAS_LEGACY);
    }
    if (s.has(exports.ROLE_VENTAS_LEGACY)) {
        s.add(exports.ROLE_VENDEDOR_TECNICO);
    }
    return s;
}
function isAdminDev(roles) {
    return roles.includes(exports.ROLE_ADMIN_DEV);
}
function canManageElevatedUsers(roles) {
    return isAdminDev(roles);
}
function userRoleNamesHaveElevatedManagement(roleNames) {
    return roleNames.some((n) => exports.ELEVATED_USER_MANAGEMENT_ROLES.has(n));
}
function hasGlobalAdminPrivileges(roles) {
    return roles.includes(exports.ROLE_ADMIN_DEV) || roles.includes(exports.ROLE_ADMIN);
}
function hasSalesLikePrivileges(roles) {
    return (hasGlobalAdminPrivileges(roles) ||
        roles.includes(exports.ROLE_VENTAS_LEGACY) ||
        roles.includes(exports.ROLE_VENDEDOR_TECNICO));
}
exports.OPERATIONAL_WRITE_ROLES = [
    exports.ROLE_ADMIN_DEV,
    exports.ROLE_ADMIN,
    exports.ROLE_VENDEDOR_TECNICO,
    exports.ROLE_INGENIERIA,
    exports.ROLE_VENTAS_LEGACY,
];

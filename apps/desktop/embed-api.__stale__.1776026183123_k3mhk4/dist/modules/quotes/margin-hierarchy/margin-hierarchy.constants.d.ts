export declare const MARGIN_SYSTEM_TYPES: readonly ["ON_GRID", "HYBRID", "OFF_GRID"];
export type MarginHierarchySystemType = (typeof MARGIN_SYSTEM_TYPES)[number];
export declare const MARGIN_MOUNT_STRUCTURE_TYPES: readonly ["STANDARD", "ANGULAR", "MIXTA"];
export type MarginHierarchyMountStructureType = (typeof MARGIN_MOUNT_STRUCTURE_TYPES)[number];
export declare function isValidMarginHierarchySystemType(s: string): s is MarginHierarchySystemType;
export declare function isValidMarginHierarchyMountStructureType(s: string): s is MarginHierarchyMountStructureType;

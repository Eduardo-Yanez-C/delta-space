import type { MarginHierarchyMountStructureType, MarginHierarchySystemType } from "./margin-hierarchy.constants";
export type CleanTemplateLineDef = {
    sortOrder: number;
    productNameSnapshot: string;
    productDescriptionSnapshot?: string;
};
export type CleanTemplateBlockDef = {
    sortOrder: number;
    name: string;
    description?: string;
    lines: CleanTemplateLineDef[];
};
export declare function filterBlocksForApplyClean(systemType: MarginHierarchySystemType, mountStructureType: MarginHierarchyMountStructureType): CleanTemplateBlockDef[];

/**
 * Fuente de verdad backend para plantilla limpia MARGIN (apply-clean).
 * No compartir con web en esta etapa; el front replica valores literales solo en UI.
 */
export const MARGIN_SYSTEM_TYPES = ["ON_GRID", "HYBRID", "OFF_GRID"] as const;
export type MarginHierarchySystemType = (typeof MARGIN_SYSTEM_TYPES)[number];

export const MARGIN_MOUNT_STRUCTURE_TYPES = ["STANDARD", "ANGULAR", "MIXTA"] as const;
export type MarginHierarchyMountStructureType = (typeof MARGIN_MOUNT_STRUCTURE_TYPES)[number];

export function isValidMarginHierarchySystemType(s: string): s is MarginHierarchySystemType {
  return (MARGIN_SYSTEM_TYPES as readonly string[]).includes(s);
}

export function isValidMarginHierarchyMountStructureType(s: string): s is MarginHierarchyMountStructureType {
  return (MARGIN_MOUNT_STRUCTURE_TYPES as readonly string[]).includes(s);
}

export const INVENTORY_DESTINATION_KINDS = ["GENERAL", "SALES_LOCAL", "PROJECT", "QUOTE", "OTHER"] as const;
export type InventoryDestinationKind = (typeof INVENTORY_DESTINATION_KINDS)[number];

/** Misma convención que `InventoryService.transportOverview` (proyecto + pallet). */
export function transportCommercialGroupKey(
  projectId: string,
  palletId: string | null | undefined,
): string {
  const pid = projectId.trim();
  const pk = (palletId ?? "").trim() || "_sin_pallet";
  return `${pid}|${pk}`;
}

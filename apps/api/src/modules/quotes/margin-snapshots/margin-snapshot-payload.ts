export const MARGIN_SNAPSHOT_SCHEMA_VERSION = "1";

export function isMarginSnapshotPayloadV1(x: unknown): x is {
  schemaVersion: string;
  blocks: unknown[];
} {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (o.schemaVersion !== MARGIN_SNAPSHOT_SCHEMA_VERSION) return false;
  if (!Array.isArray(o.blocks)) return false;
  return true;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARGIN_SNAPSHOT_SCHEMA_VERSION = void 0;
exports.isMarginSnapshotPayloadV1 = isMarginSnapshotPayloadV1;
exports.MARGIN_SNAPSHOT_SCHEMA_VERSION = "1";
function isMarginSnapshotPayloadV1(x) {
    if (x === null || typeof x !== "object" || Array.isArray(x))
        return false;
    const o = x;
    if (o.schemaVersion !== exports.MARGIN_SNAPSHOT_SCHEMA_VERSION)
        return false;
    if (!Array.isArray(o.blocks))
        return false;
    return true;
}

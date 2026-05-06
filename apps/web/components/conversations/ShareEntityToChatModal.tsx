"use client";

import { ShareToChatModal } from "./ShareToChatModal";

type Props = {
  open: boolean;
  onClose: () => void;
  entityType:
    | "PRODUCT"
    | "SUPPLIER"
    | "CLIENT"
    | "FV_STUDY"
    | "QUOTE"
    | "QUOTE_TEMPLATE";
  title: string;
  snapshot: Record<string, unknown>;
  proposedImport: Record<string, unknown>;
  sourceEntityId?: string;
};

export function ShareEntityToChatModal({
  open,
  onClose,
  entityType,
  title,
  snapshot,
  proposedImport,
  sourceEntityId,
}: Props) {
  return (
    <ShareToChatModal
      open={open}
      onClose={onClose}
      entityType={entityType}
      title={title}
      snapshot={snapshot}
      proposedImport={proposedImport}
      sourceEntityId={sourceEntityId}
    />
  );
}

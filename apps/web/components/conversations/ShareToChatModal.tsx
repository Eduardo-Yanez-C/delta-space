"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createConversationApi,
  fetchConversationsDirectoryUsers,
  fetchConversationsList,
  generateEntityPdfForChat,
  postConversationFileMessage,
  postConversationMessage,
  type ConversationListItemDto,
} from "../../lib/api";
import { Modal } from "../ui/Modal";
import { AutocorrectTextarea } from "../input/AutocorrectTextarea";

type EntityType = "PRODUCT" | "SUPPLIER" | "CLIENT" | "FV_STUDY" | "QUOTE" | "QUOTE_TEMPLATE";

type Props = {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  title: string;
  snapshot: Record<string, unknown>;
  proposedImport: Record<string, unknown>;
  sourceEntityId?: string;
};

export function ShareToChatModal({
  open,
  onClose,
  entityType,
  title,
  snapshot,
  proposedImport,
  sourceEntityId,
}: Props) {
  const [destinationMode, setDestinationMode] = useState<"CONVERSATION" | "USER">("CONVERSATION");
  const [sendType, setSendType] = useState<"PDF" | "SYSTEM">("SYSTEM");
  const [conversations, setConversations] = useState<ConversationListItemDto[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchConversationsList(), fetchConversationsDirectoryUsers()])
      .then(([c, u]) => {
        setConversations(c.conversations);
        setUsers(u.users.map((x) => ({ id: x.id, name: x.name, email: x.email })));
        if (c.conversations[0]) setSelectedConversationId(c.conversations[0].id);
        if (u.users[0]) setSelectedUserId(u.users[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar destinos"))
      .finally(() => setLoading(false));
  }, [open]);

  const canSend = useMemo(() => {
    if (sending || loading) return false;
    return destinationMode === "CONVERSATION" ? Boolean(selectedConversationId) : Boolean(selectedUserId);
  }, [destinationMode, selectedConversationId, selectedUserId, sending, loading]);

  const resolveConversationId = async (): Promise<string> => {
    if (destinationMode === "CONVERSATION") return selectedConversationId;
    const created = await createConversationApi({
      type: "DIRECT",
      memberUserIds: [selectedUserId],
    });
    return created.id;
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const conversationId = await resolveConversationId();
      const noteText = note.trim();
      if (sendType === "PDF") {
        const blob = await generateEntityPdfForChat({ entityType, title, summary: snapshot });
        const safe = title.replace(/[^\w\-]+/g, "-").toLowerCase().slice(0, 80) || "entidad";
        await postConversationFileMessage(conversationId, {
          file: blob,
          fileName: `${safe}.pdf`,
          body: noteText || `${entityType} compartido en PDF: ${title}`,
        });
      } else {
        await postConversationMessage(conversationId, {
          body: noteText || `${entityType} compartido: ${title}`,
          sharedEntity: {
            entityType,
            snapshot,
            proposedImport,
            ...(sourceEntityId ? { sourceEntityId } : {}),
          },
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo compartir");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !sending && onClose()} title="Compartir" maxWidth="md">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tipo: {entityType}</p>
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Destino</span>
            <select
              className="input-field"
              value={destinationMode}
              onChange={(e) => setDestinationMode(e.target.value as "CONVERSATION" | "USER")}
              disabled={loading || sending}
            >
              <option value="CONVERSATION">Conversación</option>
              <option value="USER">Usuario directo</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Tipo de envío</span>
            <select
              className="input-field"
              value={sendType}
              onChange={(e) => setSendType(e.target.value as "PDF" | "SYSTEM")}
              disabled={loading || sending}
            >
              <option value="PDF">PDF (adjunto)</option>
              <option value="SYSTEM">Formato sistema</option>
            </select>
          </label>
        </div>
        {destinationMode === "CONVERSATION" ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Conversación</span>
            <select
              className="input-field"
              value={selectedConversationId}
              onChange={(e) => setSelectedConversationId(e.target.value)}
              disabled={loading || sending}
            >
              {conversations.length === 0 ? (
                <option value="">No hay conversaciones disponibles</option>
              ) : (
                conversations.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)
              )}
            </select>
          </label>
        ) : (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Usuario</span>
            <select
              className="input-field"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loading || sending}
            >
              {users.length === 0 ? (
                <option value="">No hay usuarios disponibles</option>
              ) : (
                users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)
              )}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Mensaje (opcional)</span>
          <AutocorrectTextarea
            className="input-field min-h-[84px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={sending}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={send} disabled={!canSend}>
            {sending ? "Compartiendo..." : "Compartir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

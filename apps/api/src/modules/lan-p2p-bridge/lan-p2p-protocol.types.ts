/**
 * Espejo TypeScript de `apps/lan-p2p/src/protocol.rs` (DirectEnvelope / PresenceGossip).
 * Mantener alineado al actualizar el daemon Rust.
 */

export type DirectEnvelope =
  | {
      op: "CHAT_MESSAGE";
      message_id: string;
      conversation_id: string;
      sender_installation_id: string;
      sender_user_id: string;
      body: string;
      created_at_unix_ms: number;
    }
  | {
      op: "CHAT_DELIVERED_ACK";
      message_id: string;
      conversation_id: string;
      receiver_installation_id: string;
      receiver_user_id?: string;
    }
  | {
      op: "CHAT_STORED_ACK";
      message_id: string;
      conversation_id: string;
      receiver_installation_id: string;
      receiver_user_id?: string;
    }
  | {
      op: "FILE_OFFER";
      transfer_id: string;
      conversation_id: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
      sha256_hex: string;
      chunk_size: number;
      total_chunks: number;
      sender_installation_id: string;
    }
  | {
      op: "FILE_ACCEPT";
      transfer_id: string;
      receiver_installation_id: string;
    }
  | {
      op: "FILE_REJECT";
      transfer_id: string;
      reason: string;
    }
  | {
      op: "FILE_CHUNK";
      transfer_id: string;
      chunk_index: number;
      offset: number;
      bytes: string;
    }
  | {
      op: "FILE_CHUNK_ACK";
      transfer_id: string;
      chunk_index: number;
    }
  | {
      op: "FILE_COMPLETE";
      transfer_id: string;
      sha256_verified: boolean;
    }
  | {
      op: "SYNC_CONVERSATION_SINCE";
      conversation_id: string;
      requester_user_id?: string;
      last_message_id?: string | null;
      last_created_at_unix_ms?: number | null;
    }
  | {
      op: "SYNC_MESSAGES_BATCH";
      conversation_id: string;
      last_created_unix_ms?: number | null;
      messages: Array<{
        message_id: string;
        conversation_id: string;
        sender_user_id: string;
        sender_installation_id: string;
        body: string;
        created_at_unix_ms: number;
      }>;
    }
  | {
      op: "ERROR";
      code: string;
      message: string;
    };

export type PresenceGossip =
  | {
      t: "hello";
      installation_id: string;
      peer_id: string;
      display_name: string;
      status: string;
    }
  | { t: "goodbye"; installation_id: string; peer_id: string }
  | {
      t: "typing";
      installation_id: string;
      conversation_id: string;
      active: boolean;
    };

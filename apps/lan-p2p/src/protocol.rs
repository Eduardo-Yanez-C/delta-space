//! Contrato de mensajes P2P (serialización JSON sobre request-response y gossipsub para presencia).
//! La aplicación Nest mapea `conversation_id` / `message_id` al modelo existente de Prisma.

use serde::{Deserialize, Serialize};

/// Username para suscripción gossipsub (presencia / typing / anuncios). No transporta mensajes críticos 1:1.
pub const PRESENCE_TOPIC: &str = "pvq/presence/v1";

/// Tipos libp2p request-response (mismo enum en ambos sentidos; discriminante `op`).
pub type RrRequest = DirectEnvelope;
pub type RrResponse = DirectEnvelope;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMessageItem {
    pub message_id: String,
    pub conversation_id: String,
    pub sender_user_id: String,
    pub sender_installation_id: String,
    pub body: String,
    pub created_at_unix_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DirectEnvelope {
    /// Entrega de texto (o metadatos mínimos); deduplicación por `message_id` en capas superiores.
    ChatMessage {
        message_id: String,
        conversation_id: String,
        sender_installation_id: String,
        sender_user_id: String,
        body: String,
        created_at_unix_ms: i64,
    },
    /// ACK de recepción (capa P2P; distinto del “leído” en UI).
    ChatDeliveredAck {
        message_id: String,
        conversation_id: String,
        receiver_installation_id: String,
        #[serde(default)]
        receiver_user_id: Option<String>,
    },
    /// ACK de persistencia local en el receptor.
    ChatStoredAck {
        message_id: String,
        conversation_id: String,
        receiver_installation_id: String,
        #[serde(default)]
        receiver_user_id: Option<String>,
    },
    /// Fase A — oferta de transferencia.
    FileOffer {
        transfer_id: String,
        conversation_id: String,
        file_name: String,
        mime_type: String,
        size_bytes: u64,
        sha256_hex: String,
        chunk_size: u32,
        total_chunks: u32,
        sender_installation_id: String,
    },
    FileAccept {
        transfer_id: String,
        receiver_installation_id: String,
    },
    FileReject {
        transfer_id: String,
        reason: String,
    },
    FileChunk {
        transfer_id: String,
        chunk_index: u32,
        offset: u64,
        #[serde(with = "serde_bytes_b64")]
        bytes: Vec<u8>,
    },
    FileChunkAck {
        transfer_id: String,
        chunk_index: u32,
    },
    FileComplete {
        transfer_id: String,
        sha256_verified: bool,
    },
    /// Resync: el peer pide mensajes desde un cursor por conversación.
    SyncConversationSince {
        conversation_id: String,
        /// Usuario local que solicita el gap (Nest valida membresía con `assertMember`).
        #[serde(default)]
        requester_user_id: String,
        last_message_id: Option<String>,
        last_created_at_unix_ms: Option<i64>,
    },
    /// Respuesta al sync: lote idempotente (ingesta por `message_id` en Nest).
    SyncMessagesBatch {
        conversation_id: String,
        #[serde(default)]
        last_created_unix_ms: Option<i64>,
        messages: Vec<SyncMessageItem>,
    },
    Error {
        code: String,
        message: String,
    },
}

mod serde_bytes_b64 {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        STANDARD
            .decode(s.trim())
            .map_err(serde::de::Error::custom)
    }
}

/// Evento de presencia vía gossipsub (firma gossipsub + validación estricta en comportamiento).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum PresenceGossip {
    Hello {
        installation_id: String,
        peer_id: String,
        display_name: String,
        status: String,
        #[serde(default)]
        user_id: Option<String>,
    },
    Goodbye {
        installation_id: String,
        peer_id: String,
    },
    Typing {
        installation_id: String,
        conversation_id: String,
        active: bool,
    },
}

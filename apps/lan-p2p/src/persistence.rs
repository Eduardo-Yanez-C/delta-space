//! Persistencia local: peers, colas, transferencias y cursores de sync.

use anyhow::Context;
use rusqlite::{params, Connection};

pub fn open_db(path: &std::path::Path) -> anyhow::Result<Connection> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).ok();
    }
    let conn = Connection::open(path).context("abrir sqlite P2P")?;
    init_schema(&conn)?;
    migrate_schema(&conn)?;
    Ok(conn)
}

fn migrate_schema(conn: &Connection) -> anyhow::Result<()> {
    let _ = conn.execute(
        "ALTER TABLE p2p_transfer ADD COLUMN bytes_received INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE p2p_transfer ADD COLUMN next_chunk_index INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE p2p_transfer ADD COLUMN sender_installation_id TEXT",
        [],
    );
    let _ = conn.execute("ALTER TABLE p2p_transfer ADD COLUMN target_peer_id TEXT", []);
    Ok(())
}

pub fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn upsert_peer_seen(
    conn: &Connection,
    peer_id: &str,
    last_address: Option<&str>,
) -> anyhow::Result<()> {
    let now = now_unix_ms();
    conn.execute(
        r#"INSERT INTO p2p_peer (peer_id, last_seen_unix_ms, last_address)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(peer_id) DO UPDATE SET
             last_seen_unix_ms = excluded.last_seen_unix_ms,
             last_address = COALESCE(excluded.last_address, p2p_peer.last_address)"#,
        params![peer_id, now, last_address],
    )?;
    Ok(())
}

pub fn list_peers_seen_since(conn: &Connection, within_ms: i64) -> anyhow::Result<Vec<String>> {
    let cutoff = now_unix_ms().saturating_sub(within_ms);
    let mut stmt = conn.prepare("SELECT peer_id FROM p2p_peer WHERE last_seen_unix_ms >= ?1")?;
    let rows = stmt.query_map([cutoff], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list_sync_conversation_ids(conn: &Connection) -> anyhow::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT conversation_id FROM p2p_sync_cursor")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn get_sync_cursor(
    conn: &Connection,
    conversation_id: &str,
) -> anyhow::Result<(Option<String>, Option<i64>)> {
    let mut stmt = conn.prepare(
        "SELECT last_message_id, last_created_unix_ms FROM p2p_sync_cursor WHERE conversation_id = ?1",
    )?;
    let mut rows = stmt.query([conversation_id])?;
    if let Some(row) = rows.next()? {
        let mid: Option<String> = row.get(0)?;
        let ms: Option<i64> = row.get(1)?;
        return Ok((mid, ms));
    }
    Ok((None, None))
}

pub fn upsert_sync_cursor_max(
    conn: &Connection,
    conversation_id: &str,
    last_message_id: &str,
    last_created_unix_ms: i64,
) -> anyhow::Result<()> {
    conn.execute(
        r#"INSERT INTO p2p_sync_cursor (conversation_id, last_message_id, last_created_unix_ms)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(conversation_id) DO UPDATE SET
             last_message_id = excluded.last_message_id,
             last_created_unix_ms = CASE
               WHEN excluded.last_created_unix_ms > COALESCE(p2p_sync_cursor.last_created_unix_ms, 0)
               THEN excluded.last_created_unix_ms
               ELSE p2p_sync_cursor.last_created_unix_ms
             END"#,
        params![conversation_id, last_message_id, last_created_unix_ms],
    )?;
    Ok(())
}

pub fn chunk_bit_set(mask: &[u8], i: u32) -> bool {
    let byte = (i / 8) as usize;
    let bit = i % 8;
    if byte >= mask.len() {
        return false;
    }
    mask[byte] & (1 << bit) != 0
}

pub fn set_chunk_bit(mask: &mut Vec<u8>, i: u32) {
    let byte = (i / 8) as usize;
    let bit = i % 8;
    while mask.len() <= byte {
        mask.push(0);
    }
    mask[byte] |= 1 << bit;
}

pub fn contiguous_prefix_chunks(mask: &[u8], total_chunks: u32) -> u32 {
    for i in 0..total_chunks {
        if !chunk_bit_set(mask, i) {
            return i;
        }
    }
    total_chunks
}

#[derive(Debug, Clone)]
pub struct P2pTransferRow {
    pub transfer_id: String,
    pub conversation_id: String,
    pub role: String,
    pub path: Option<String>,
    pub file_name: Option<String>,
    pub mime: Option<String>,
    pub size_bytes: i64,
    pub sha256_hex: String,
    pub chunk_size: i32,
    pub total_chunks: i32,
    pub confirmed_chunks_mask: Vec<u8>,
    pub bytes_received: i64,
    pub next_chunk_index: i32,
    pub state: String,
    pub sender_installation_id: Option<String>,
    pub target_peer_id: Option<String>,
}

pub fn get_transfer(conn: &Connection, transfer_id: &str) -> anyhow::Result<Option<P2pTransferRow>> {
    let mut stmt = conn.prepare(
        r#"SELECT transfer_id, conversation_id, role, path, file_name, mime, size_bytes, sha256_hex,
                  chunk_size, total_chunks, confirmed_chunks_mask, bytes_received, next_chunk_index, state,
                  sender_installation_id, target_peer_id
           FROM p2p_transfer WHERE transfer_id = ?1"#,
    )?;
    let mut rows = stmt.query([transfer_id])?;
    if let Some(row) = rows.next()? {
        let mask: Vec<u8> = row.get::<_, Option<Vec<u8>>>(10)?.unwrap_or_default();
        return Ok(Some(P2pTransferRow {
            transfer_id: row.get(0)?,
            conversation_id: row.get(1)?,
            role: row.get(2)?,
            path: row.get(3)?,
            file_name: row.get(4)?,
            mime: row.get(5)?,
            size_bytes: row.get(6)?,
            sha256_hex: row.get(7)?,
            chunk_size: row.get(8)?,
            total_chunks: row.get(9)?,
            confirmed_chunks_mask: mask,
            bytes_received: row.get::<_, i64>(11)?,
            next_chunk_index: row.get(12)?,
            state: row.get(13)?,
            sender_installation_id: row.get(14)?,
            target_peer_id: row.get(15)?,
        }));
    }
    Ok(None)
}

pub fn upsert_inbound_transfer(
    conn: &Connection,
    transfer_id: &str,
    conversation_id: &str,
    rel_path: &str,
    file_name: &str,
    mime: &str,
    size_bytes: i64,
    sha256_hex: &str,
    chunk_size: i32,
    total_chunks: i32,
) -> anyhow::Result<()> {
    conn.execute(
        r#"INSERT INTO p2p_transfer (
              transfer_id, conversation_id, role, path, file_name, mime, size_bytes, sha256_hex,
              chunk_size, total_chunks, confirmed_chunks_mask, bytes_received, next_chunk_index, state
            ) VALUES (?1, ?2, 'INBOUND', ?3, ?4, ?5, ?6, ?7, ?8, ?9, x'', 0, 0, 'TRANSFERRING')
            ON CONFLICT(transfer_id) DO UPDATE SET
              path = excluded.path,
              file_name = excluded.file_name,
              mime = excluded.mime,
              size_bytes = excluded.size_bytes,
              sha256_hex = excluded.sha256_hex,
              chunk_size = excluded.chunk_size,
              total_chunks = excluded.total_chunks,
              state = 'TRANSFERRING'"#,
        params![
            transfer_id,
            conversation_id,
            rel_path,
            file_name,
            mime,
            size_bytes,
            sha256_hex,
            chunk_size,
            total_chunks
        ],
    )?;
    Ok(())
}

pub fn update_transfer_chunk_progress(
    conn: &Connection,
    transfer_id: &str,
    mask: &[u8],
    bytes_received: i64,
) -> anyhow::Result<()> {
    conn.execute(
        "UPDATE p2p_transfer SET confirmed_chunks_mask = ?1, bytes_received = ?2 WHERE transfer_id = ?3",
        params![mask, bytes_received, transfer_id],
    )?;
    Ok(())
}

pub fn upsert_outbound_transfer(
    conn: &Connection,
    transfer_id: &str,
    conversation_id: &str,
    abs_path: &str,
    file_name: &str,
    mime: &str,
    size_bytes: i64,
    sha256_hex: &str,
    chunk_size: i32,
    total_chunks: i32,
    sender_installation_id: &str,
    target_peer_id: &str,
) -> anyhow::Result<()> {
    conn.execute(
        r#"INSERT INTO p2p_transfer (
              transfer_id, conversation_id, role, path, file_name, mime, size_bytes, sha256_hex,
              chunk_size, total_chunks, confirmed_chunks_mask, bytes_received, next_chunk_index, state, sender_installation_id, target_peer_id
            ) VALUES (?1, ?2, 'OUTBOUND', ?3, ?4, ?5, ?6, ?7, ?8, ?9, x'', 0, 0, 'OFFERED', ?10, ?11)
            ON CONFLICT(transfer_id) DO UPDATE SET
              path = excluded.path,
              file_name = excluded.file_name,
              mime = excluded.mime,
              size_bytes = excluded.size_bytes,
              sha256_hex = excluded.sha256_hex,
              chunk_size = excluded.chunk_size,
              total_chunks = excluded.total_chunks,
              sender_installation_id = excluded.sender_installation_id,
              target_peer_id = excluded.target_peer_id"#,
        params![
            transfer_id,
            conversation_id,
            abs_path,
            file_name,
            mime,
            size_bytes,
            sha256_hex,
            chunk_size,
            total_chunks,
            sender_installation_id,
            target_peer_id
        ],
    )?;
    Ok(())
}

pub fn set_transfer_state(conn: &Connection, transfer_id: &str, state: &str) -> anyhow::Result<()> {
    conn.execute(
        "UPDATE p2p_transfer SET state = ?1 WHERE transfer_id = ?2",
        params![state, transfer_id],
    )?;
    Ok(())
}

pub fn set_outbound_next_chunk(conn: &Connection, transfer_id: &str, next: i32) -> anyhow::Result<()> {
    conn.execute(
        "UPDATE p2p_transfer SET next_chunk_index = ?1 WHERE transfer_id = ?2",
        params![next, transfer_id],
    )?;
    Ok(())
}

pub fn list_outbound_resumable(conn: &Connection) -> anyhow::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT transfer_id FROM p2p_transfer WHERE role = 'OUTBOUND' AND state IN ('OFFERED', 'TRANSFERRING')",
    )?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list_outbound_for_peer(conn: &Connection, target_peer_id: &str) -> anyhow::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT transfer_id FROM p2p_transfer WHERE role = 'OUTBOUND' AND target_peer_id = ?1 AND state IN ('OFFERED', 'TRANSFERRING')",
    )?;
    let rows = stmt.query_map([target_peer_id], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn init_schema(conn: &Connection) -> anyhow::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS p2p_peer (
            peer_id TEXT PRIMARY KEY,
            last_seen_unix_ms INTEGER NOT NULL DEFAULT 0,
            last_address TEXT,
            display_name TEXT
        );
        CREATE TABLE IF NOT EXISTS p2p_pending_message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            target_peer_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_attempt_unix_ms INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_msg ON p2p_pending_message(message_id, target_peer_id);
        CREATE TABLE IF NOT EXISTS p2p_transfer (
            transfer_id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            path TEXT,
            file_name TEXT,
            mime TEXT,
            size_bytes INTEGER,
            sha256_hex TEXT,
            chunk_size INTEGER,
            total_chunks INTEGER,
            confirmed_chunks_mask BLOB,
            state TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS p2p_sync_cursor (
            conversation_id TEXT PRIMARY KEY,
            last_message_id TEXT,
            last_created_unix_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_pending_target ON p2p_pending_message(target_peer_id);
        "#,
    )
    .context("init schema")?;
    Ok(())
}

pub fn enqueue_pending(
    conn: &Connection,
    message_id: &str,
    conversation_id: &str,
    target_peer_id: &str,
    payload_json: &str,
) -> anyhow::Result<()> {
    conn.execute(
        r#"INSERT OR REPLACE INTO p2p_pending_message (message_id, conversation_id, target_peer_id, payload_json, attempts, last_attempt_unix_ms)
           VALUES (?1, ?2, ?3, ?4, 0, 0)"#,
        params![message_id, conversation_id, target_peer_id, payload_json],
    )?;
    Ok(())
}

pub fn delete_pending_for_peer_message(
    conn: &Connection,
    message_id: &str,
    target_peer_id: &str,
) -> anyhow::Result<()> {
    conn.execute(
        "DELETE FROM p2p_pending_message WHERE message_id = ?1 AND target_peer_id = ?2",
        params![message_id, target_peer_id],
    )?;
    Ok(())
}

pub fn list_pending_batch(conn: &Connection, limit: usize) -> anyhow::Result<Vec<(i64, String, String, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, message_id, conversation_id, target_peer_id, payload_json FROM p2p_pending_message ORDER BY id ASC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit as i64], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
        ))
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn bump_pending_attempt(conn: &Connection, id: i64) -> anyhow::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    conn.execute(
        "UPDATE p2p_pending_message SET attempts = attempts + 1, last_attempt_unix_ms = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

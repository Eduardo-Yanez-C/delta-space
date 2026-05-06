//! Daemon libp2p + HTTP hacia Nest (`/api/p2p/internal/*`).

mod codec;
mod identity;
mod persistence;
mod protocol;
mod transfer_store;

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::env;
use std::hash::{Hash, Hasher};
use std::iter;
use std::net::SocketAddr;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::StreamExt;
use libp2p::request_response::{self, Message as RrMessage, ProtocolSupport};
use libp2p::swarm::{NetworkBehaviour, SwarmEvent};
use libp2p::swarm::StreamProtocol;
use libp2p::{gossipsub, mdns, noise, tcp, yamux, PeerId};
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;
use serde_json::Value as JsonValue;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::protocol::{DirectEnvelope, PresenceGossip, SyncMessageItem, PRESENCE_TOPIC};

const DEFAULT_LISTEN_TCP: &str = "/ip4/0.0.0.0/tcp/0";

#[derive(Clone)]
struct IngressCfg {
    base_url: String,
    secret: String,
    installation_id: String,
}

impl IngressCfg {
    fn post(&self, path: &str, body: serde_json::Value) -> Result<(u16, Option<serde_json::Value>), String> {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let r = ureq::post(&url)
            .set("X-P2P-SECRET", &self.secret)
            .set("Content-Type", "application/json")
            .send_json(body);
        match r {
            Ok(resp) => {
                let status = resp.status();
                let v: Option<serde_json::Value> = resp.into_json().ok();
                Ok((status, v))
            }
            Err(e) => Err(e.to_string()),
        }
    }
}

#[derive(NetworkBehaviour)]
struct PvqBehaviour {
    mdns: mdns::tokio::Behaviour,
    gossipsub: gossipsub::Behaviour,
    rr: request_response::Behaviour<codec::PvqCodec>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
enum ControlCmd {
    SendRr { peer_id: String, envelope: DirectEnvelope },
    PublishPresence { event: PresenceGossip },
    Ping,
    GetPeerId,
    SetIdentity {
        user_id: String,
        installation_id: String,
        display_name: Option<String>,
    },
    SendFileFromPath {
        peer_id: String,
        transfer_id: String,
        conversation_id: String,
        file_name: String,
        mime_type: String,
        local_path: String,
        size_bytes: u64,
        sha256_hex: String,
        chunk_size: u32,
        total_chunks: u32,
        sender_installation_id: String,
    },
}

#[derive(Debug, Clone)]
enum OutboundPhase {
    OfferPending,
    Transferring,
    Done,
}

#[derive(Debug, Clone)]
struct OutboundTransfer {
    peer_id: PeerId,
    conversation_id: String,
    local_path: PathBuf,
    chunk_size: u32,
    total_chunks: u32,
    size_bytes: u64,
    file_name: String,
    mime_type: String,
    sha256_hex: String,
    sender_installation_id: String,
    phase: OutboundPhase,
    next_chunk: u32,
    waiting_ack: Option<u32>,
}

#[derive(Clone)]
struct LocalIdentity {
    user_id: String,
    installation_id: String,
    display_name: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let data_dir: PathBuf = env::var("P2P_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("p2p-data"));

    let key_path = data_dir.join("libp2p_key.protobuf");
    let keypair = identity::load_or_create_keypair(&key_path)?;
    let local_peer_id = keypair.public().to_peer_id();
    info!(%local_peer_id, "identidad libp2p lista");

    let db = Arc::new(Mutex::new(persistence::open_db(&data_dir.join("p2p-state.sqlite"))?));
    let outbound_files: Arc<Mutex<HashMap<String, OutboundTransfer>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let last_sync_peer: Arc<Mutex<HashMap<String, i64>>> = Arc::new(Mutex::new(HashMap::new()));

    let installation_id = env::var("PVQ_INSTALLATION_ID").unwrap_or_else(|_| {
        format!("local-{}", uuid::Uuid::new_v4().to_string().replace('-', ""))
    });
    let display_name = env::var("P2P_DISPLAY_NAME").unwrap_or_else(|_| {
        env::var("COMPUTERNAME")
            .or_else(|_| env::var("HOSTNAME"))
            .unwrap_or_else(|_| "peer".to_string())
    });

    let nest_base = env::var("P2P_NEST_INGRESS_URL").unwrap_or_else(|_| "http://127.0.0.1:4000".to_string());
    let ingress_secret = env::var("P2P_INGRESS_SECRET")
        .or_else(|_| env::var("LICENSE_HMAC_SECRET"))
        .unwrap_or_default()
        .trim()
        .chars()
        .take(32)
        .collect::<String>();
    if ingress_secret.len() < 8 {
        warn!("P2P_INGRESS_SECRET / LICENSE_HMAC_SECRET demasiado corto: ingress HTTP puede fallar");
    }
    let ingress = IngressCfg {
        base_url: nest_base,
        secret: ingress_secret,
        installation_id: installation_id.clone(),
    };

    let local_identity: Arc<Mutex<Option<LocalIdentity>>> = Arc::new(Mutex::new(None));

    let mut swarm = libp2p::SwarmBuilder::with_existing_identity(keypair)
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )?
        .with_behaviour(|key| {
            let message_id_fn = |message: &gossipsub::Message| {
                let mut s = DefaultHasher::new();
                message.data.hash(&mut s);
                gossipsub::MessageId::from(s.finish().to_string())
            };
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(10))
                .validation_mode(gossipsub::ValidationMode::Strict)
                .message_id_fn(message_id_fn)
                .build()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            let gs = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )?;
            let md =
                mdns::tokio::Behaviour::new(mdns::Config::default(), key.public().to_peer_id())?;
            let rr = request_response::Behaviour::with_codec(
                codec::PvqCodec::default(),
                iter::once((
                    StreamProtocol::new("/pvq/rr/1.0.0"),
                    ProtocolSupport::Full,
                )),
                request_response::Config::default(),
            );
            Ok(PvqBehaviour {
                mdns: md,
                gossipsub: gs,
                rr,
            })
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(120)))
        .build();

    let topic = gossipsub::IdentTopic::new(PRESENCE_TOPIC);
    swarm.behaviour_mut().gossipsub.subscribe(&topic)?;
    swarm.listen_on(DEFAULT_LISTEN_TCP.parse()?)?;

    fn publish_hello(
        swarm: &mut libp2p::Swarm<PvqBehaviour>,
        topic: &gossipsub::IdentTopic,
        installation_id: &str,
        local_peer_id: &PeerId,
        display_name: &str,
        li: &Arc<Mutex<Option<LocalIdentity>>>,
    ) {
        let uid = li.lock().ok().and_then(|g| g.as_ref().map(|x| x.user_id.clone()));
        let hello = PresenceGossip::Hello {
            installation_id: installation_id.to_string(),
            peer_id: local_peer_id.to_string(),
            display_name: display_name.to_string(),
            status: "online".to_string(),
            user_id: uid,
        };
        if let Ok(raw) = serde_json::to_vec(&hello) {
            let _ = swarm.behaviour_mut().gossipsub.publish(topic.clone(), raw);
        }
    }

    publish_hello(
        &mut swarm,
        &topic,
        &installation_id,
        &local_peer_id,
        &display_name,
        &local_identity,
    );

    let (cmd_tx, mut cmd_rx) = mpsc::channel::<ControlCmd>(128);

    let bind: SocketAddr = env::var("P2P_CONTROL_BIND")
        .unwrap_or_else(|_| "127.0.0.1:40777".to_string())
        .parse()?;
    let listener = TcpListener::bind(bind).await?;
    info!(addr = %listener.local_addr()?, "control TCP");

    let cmd_tx_bg = cmd_tx.clone();
    let local_identity_for_accept = local_identity.clone();
    let _accept_loop = tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((sock, addr)) => {
                    let tx = cmd_tx_bg.clone();
                    let lip = local_peer_id.to_string();
                    let li = local_identity_for_accept.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_control_client(sock, tx, lip, li).await {
                            warn!(?addr, "control: {e:#}");
                        }
                    });
                }
                Err(e) => error!("accept control: {e}"),
            }
        }
    });

    let mut tick = tokio::time::interval(Duration::from_secs(8));
    let mut hello_tick = tokio::time::interval(Duration::from_secs(20));
    let mut sync_tick = tokio::time::interval(Duration::from_secs(45));

    loop {
        tokio::select! {
            maybe = swarm.select_next_some() => {
                match maybe {
                    SwarmEvent::NewListenAddr { address, .. } => info!(%address, "escuchando"),
                    SwarmEvent::Behaviour(PvqBehaviourEvent::Mdns(mdns::Event::Discovered(list))) => {
                        for (peer, addr) in list {
                            swarm.behaviour_mut().gossipsub.add_explicit_peer(&peer);
                            swarm.add_peer_address(peer, addr.clone());
                            let dial = match addr.clone().with_p2p(peer) {
                                Ok(a) => a,
                                Err(orig) => orig,
                            };
                            if let Err(e) = swarm.dial(dial) {
                                warn!(%peer, "dial: {e}");
                            }
                        }
                    }
                    SwarmEvent::Behaviour(PvqBehaviourEvent::Mdns(mdns::Event::Expired(list))) => {
                        for (peer, _addr) in list {
                            swarm.behaviour_mut().gossipsub.remove_explicit_peer(&peer);
                        }
                    }
                    SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                        enqueue_sync_for_peer(
                            &mut swarm,
                            peer_id,
                            &db,
                            &local_identity,
                            &last_sync_peer,
                        );
                        resume_outbound_for_peer(
                            &mut swarm,
                            peer_id,
                            &db,
                            &cmd_tx,
                            &outbound_files,
                        );
                    }
                    SwarmEvent::Behaviour(PvqBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                        propagation_source: _src,
                        message: m,
                        ..
                    })) => {
                        if let Ok(v) = serde_json::from_slice::<PresenceGossip>(&m.data) {
                            if let PresenceGossip::Hello {
                                installation_id: inst,
                                peer_id: pid,
                                display_name: dn,
                                user_id,
                                ..
                            } = v
                            {
                                let body = json!({
                                    "peerId": pid,
                                    "installationId": inst,
                                    "displayName": dn,
                                    "userId": user_id.unwrap_or_default(),
                                });
                                let _ = ingress.post("/api/p2p/internal/presence", body);
                                let _ = {
                                    let g = db.lock().unwrap();
                                    persistence::upsert_peer_seen(&g, &pid, None)
                                };
                            }
                        }
                    }
                    SwarmEvent::Behaviour(PvqBehaviourEvent::Gossipsub(_)) => {}
                    SwarmEvent::Behaviour(PvqBehaviourEvent::Rr(event)) => {
                        match event {
                            request_response::Event::Message { peer, message } => {
                                handle_rr_message(
                                    &mut swarm,
                                    peer,
                                    message,
                                    &ingress,
                                    &installation_id,
                                    &data_dir,
                                    &db,
                                    &local_identity,
                                    &cmd_tx,
                                    &outbound_files,
                                );
                            }
                            ev => info!(?ev, "rr"),
                        }
                    }
                    _ => {}
                }
            }
            Some(cmd) = cmd_rx.recv() => {
                match cmd {
                    ControlCmd::SendRr { peer_id, envelope } => {
                        let Ok(pid) = PeerId::from_str(&peer_id) else {
                            warn!(peer_id, "peer_id invÃ¡lido");
                            continue;
                        };
                        swarm.behaviour_mut().rr.send_request(&pid, envelope);
                    }
                    ControlCmd::PublishPresence { event } => {
                        if let Ok(raw) = serde_json::to_vec(&event) {
                            let _ = swarm.behaviour_mut().gossipsub.publish(topic.clone(), raw);
                        }
                    }
                    ControlCmd::Ping => info!("pong"),
                    ControlCmd::SetIdentity { user_id, installation_id: inst, display_name: dn } => {
                        *local_identity.lock().unwrap() = Some(LocalIdentity {
                            user_id: user_id.clone(),
                            installation_id: inst,
                            display_name: dn.unwrap_or_else(|| display_name.clone()),
                        });
                        publish_hello(&mut swarm, &topic, &installation_id, &local_peer_id, &display_name, &local_identity);
                    }
                    ControlCmd::GetPeerId => {}
                    ControlCmd::SendFileFromPath {
                        peer_id,
                        transfer_id,
                        conversation_id,
                        file_name,
                        mime_type,
                        local_path,
                        size_bytes,
                        sha256_hex,
                        chunk_size,
                        total_chunks,
                        sender_installation_id,
                    } => {
                        let Ok(pid) = PeerId::from_str(&peer_id) else {
                            warn!(peer_id, "send_file peer_id invÃ¡lido");
                            continue;
                        };
                        if let Err(e) = {
                            let g = db.lock().unwrap();
                            persistence::upsert_outbound_transfer(
                                &g,
                                &transfer_id,
                                &conversation_id,
                                &local_path,
                                &file_name,
                                &mime_type,
                                size_bytes as i64,
                                &sha256_hex,
                                chunk_size as i32,
                                total_chunks as i32,
                                &sender_installation_id,
                                &peer_id,
                            )
                        } {
                            warn!("persist outbound transfer: {e:#}");
                            continue;
                        }
                        let st = OutboundTransfer {
                            peer_id: pid,
                            conversation_id: conversation_id.clone(),
                            local_path: PathBuf::from(&local_path),
                            chunk_size,
                            total_chunks,
                            size_bytes,
                            file_name: file_name.clone(),
                            mime_type: mime_type.clone(),
                            sha256_hex: sha256_hex.clone(),
                            sender_installation_id: sender_installation_id.clone(),
                            phase: OutboundPhase::OfferPending,
                            next_chunk: 0,
                            waiting_ack: None,
                        };
                        outbound_files
                            .lock()
                            .unwrap()
                            .insert(transfer_id.clone(), st);
                        let env = DirectEnvelope::FileOffer {
                            transfer_id: transfer_id.clone(),
                            conversation_id,
                            file_name,
                            mime_type,
                            size_bytes,
                            sha256_hex,
                            chunk_size,
                            total_chunks,
                            sender_installation_id,
                        };
                        swarm.behaviour_mut().rr.send_request(&pid, env);
                    }
                }
            }
            _ = tick.tick() => {
                let pending = {
                    let g = db.lock().unwrap();
                    persistence::list_pending_batch(&g, 20).unwrap_or_default()
                };
                for (_id, _mid, _conv, peer, payload_json) in pending {
                    if let Ok(env) = serde_json::from_str::<DirectEnvelope>(&payload_json) {
                        if let Ok(pid) = PeerId::from_str(&peer) {
                            swarm.behaviour_mut().rr.send_request(&pid, env);
                        }
                    }
                }
            }
            _ = hello_tick.tick() => {
                publish_hello(&mut swarm, &topic, &installation_id, &local_peer_id, &display_name, &local_identity);
            }
            _ = sync_tick.tick() => {
                let peers = {
                    let g = db.lock().unwrap();
                    persistence::list_peers_seen_since(&g, 120_000).unwrap_or_default()
                };
                for ps in peers {
                    if let Ok(pid) = PeerId::from_str(&ps) {
                        enqueue_sync_for_peer(
                            &mut swarm,
                            pid,
                            &db,
                            &local_identity,
                            &last_sync_peer,
                        );
                    }
                }
            }
        }
    }
}

fn nest_message_to_sync_item(m: &JsonValue) -> Option<SyncMessageItem> {
    let id = m.get("id").and_then(|x| x.as_str())?;
    let conversation_id = m
        .get("conversationId")
        .or_else(|| m.get("conversation_id"))
        .and_then(|x| x.as_str())?;
    let sender_user_id = m
        .get("authorId")
        .or_else(|| m.get("author_id"))
        .and_then(|x| x.as_str())?;
    let body = m.get("body").and_then(|x| x.as_str()).unwrap_or("");
    let created = m
        .get("created_at_unix_ms")
        .and_then(|x| x.as_i64())
        .or_else(|| m.get("createdAtUnixMs").and_then(|x| x.as_i64()))
        .unwrap_or(0);
    let inst = m
        .get("sender_installation_id")
        .and_then(|x| x.as_str())
        .unwrap_or("");
    Some(SyncMessageItem {
        message_id: id.to_string(),
        conversation_id: conversation_id.to_string(),
        sender_user_id: sender_user_id.to_string(),
        sender_installation_id: inst.to_string(),
        body: body.to_string(),
        created_at_unix_ms: created,
    })
}

fn enqueue_sync_for_peer(
    swarm: &mut libp2p::Swarm<PvqBehaviour>,
    peer_id: PeerId,
    db: &Arc<Mutex<Connection>>,
    local_identity: &Arc<Mutex<Option<LocalIdentity>>>,
    last_sync_peer: &Arc<Mutex<HashMap<String, i64>>>,
) {
    let uid = match local_identity
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|x| x.user_id.clone()))
    {
        Some(u) => u,
        None => return,
    };
    let now = persistence::now_unix_ms();
    {
        let mut m = last_sync_peer.lock().unwrap();
        if let Some(t) = m.get(&peer_id.to_string()) {
            if now - *t < 45_000 {
                return;
            }
        }
        m.insert(peer_id.to_string(), now);
    }
    let convs = {
        let g = db.lock().unwrap();
        persistence::list_sync_conversation_ids(&g).unwrap_or_default()
    };
    for conv in convs {
        let (last_mid, last_ms) = {
            let g = db.lock().unwrap();
            persistence::get_sync_cursor(&g, &conv).unwrap_or((None, None))
        };
        let req = DirectEnvelope::SyncConversationSince {
            conversation_id: conv,
            requester_user_id: uid.clone(),
            last_message_id: last_mid,
            last_created_at_unix_ms: last_ms,
        };
        swarm.behaviour_mut().rr.send_request(&peer_id, req);
    }
}

fn dispatch_outbound_send_chunk(
    cmd_tx: &mpsc::Sender<ControlCmd>,
    st: &OutboundTransfer,
    transfer_id: &str,
    chunk_index: u32,
) -> Result<(), ()> {
    let offset = (chunk_index as u64) * (st.chunk_size as u64);
    let len = if chunk_index + 1 >= st.total_chunks {
        (st.size_bytes.saturating_sub(offset)) as usize
    } else {
        st.chunk_size as usize
    };
    let bytes = transfer_store::read_file_slice(&st.local_path, offset, len).map_err(|_| ())?;
    let env = DirectEnvelope::FileChunk {
        transfer_id: transfer_id.to_string(),
        chunk_index,
        offset,
        bytes,
    };
    cmd_tx
        .try_send(ControlCmd::SendRr {
            peer_id: st.peer_id.to_string(),
            envelope: env,
        })
        .map_err(|_| ())
}

fn handle_outbound_file_accept(
    transfer_id: &str,
    outbound_files: &Arc<Mutex<HashMap<String, OutboundTransfer>>>,
    cmd_tx: &mpsc::Sender<ControlCmd>,
    db: &Arc<Mutex<Connection>>,
) {
    let st = {
        let mut map = outbound_files.lock().unwrap();
        let Some(st) = map.get_mut(transfer_id) else {
            return;
        };
        if !matches!(st.phase, OutboundPhase::OfferPending) {
            return;
        }
        st.phase = OutboundPhase::Transferring;
        st.clone()
    };
    let _ = {
        let g = db.lock().unwrap();
        persistence::set_transfer_state(&g, transfer_id, "TRANSFERRING")
    };
    if dispatch_outbound_send_chunk(cmd_tx, &st, transfer_id, st.next_chunk).is_ok() {
        outbound_files.lock().unwrap().get_mut(transfer_id).map(|s| {
            s.waiting_ack = Some(st.next_chunk);
        });
    }
}

fn handle_outbound_chunk_ack(
    transfer_id: &str,
    chunk_index: u32,
    outbound_files: &Arc<Mutex<HashMap<String, OutboundTransfer>>>,
    cmd_tx: &mpsc::Sender<ControlCmd>,
    db: &Arc<Mutex<Connection>>,
) {
    let mut map = outbound_files.lock().unwrap();
    let Some(st) = map.get_mut(transfer_id) else {
        return;
    };
    if st.waiting_ack != Some(chunk_index) {
        return;
    }
    st.waiting_ack = None;
    st.next_chunk = chunk_index + 1;
    let _ = {
        let g = db.lock().unwrap();
        persistence::set_outbound_next_chunk(&g, transfer_id, st.next_chunk as i32)
    };
    if st.next_chunk >= st.total_chunks {
        let env = DirectEnvelope::FileComplete {
            transfer_id: transfer_id.to_string(),
            sha256_verified: false,
        };
        let _ = cmd_tx.try_send(ControlCmd::SendRr {
            peer_id: st.peer_id.to_string(),
            envelope: env,
        });
        st.phase = OutboundPhase::Done;
        return;
    }
    let st_clone = st.clone();
    drop(map);
    if dispatch_outbound_send_chunk(cmd_tx, &st_clone, transfer_id, st_clone.next_chunk).is_ok() {
        outbound_files.lock().unwrap().get_mut(transfer_id).map(|s| {
            s.waiting_ack = Some(s.next_chunk);
        });
    }
}

fn resume_outbound_for_peer(
    swarm: &mut libp2p::Swarm<PvqBehaviour>,
    peer_id: PeerId,
    db: &Arc<Mutex<Connection>>,
    cmd_tx: &mpsc::Sender<ControlCmd>,
    outbound_files: &Arc<Mutex<HashMap<String, OutboundTransfer>>>,
) {
    let pid_str = peer_id.to_string();
    let tids = {
        let g = db.lock().unwrap();
        persistence::list_outbound_for_peer(&g, &pid_str).unwrap_or_default()
    };
    for tid in tids {
        let row = {
            let g = db.lock().unwrap();
            persistence::get_transfer(&g, &tid).ok().flatten()
        };
        let Some(row) = row else {
            continue;
        };
        let mime_type = row
            .mime
            .as_deref()
            .unwrap_or("application/octet-stream")
            .to_string();
        if row.state == "OFFERED" {
            let env = DirectEnvelope::FileOffer {
                transfer_id: tid.clone(),
                conversation_id: row.conversation_id.clone(),
                file_name: row.file_name.clone().unwrap_or_else(|| "file".into()),
                mime_type: mime_type.clone(),
                size_bytes: row.size_bytes.max(0) as u64,
                sha256_hex: row.sha256_hex.clone(),
                chunk_size: row.chunk_size.max(1) as u32,
                total_chunks: row.total_chunks.max(1) as u32,
                sender_installation_id: row.sender_installation_id.clone().unwrap_or_default(),
            };
            let st = OutboundTransfer {
                peer_id,
                conversation_id: row.conversation_id.clone(),
                local_path: PathBuf::from(row.path.clone().unwrap_or_default()),
                chunk_size: row.chunk_size.max(1) as u32,
                total_chunks: row.total_chunks.max(1) as u32,
                size_bytes: row.size_bytes.max(0) as u64,
                file_name: row.file_name.clone().unwrap_or_default(),
                mime_type,
                sha256_hex: row.sha256_hex.clone(),
                sender_installation_id: row.sender_installation_id.clone().unwrap_or_default(),
                phase: OutboundPhase::OfferPending,
                next_chunk: 0,
                waiting_ack: None,
            };
            outbound_files.lock().unwrap().insert(tid.clone(), st);
            swarm.behaviour_mut().rr.send_request(&peer_id, env);
        } else if row.state == "TRANSFERRING" {
            let st = OutboundTransfer {
                peer_id,
                conversation_id: row.conversation_id.clone(),
                local_path: PathBuf::from(row.path.clone().unwrap_or_default()),
                chunk_size: row.chunk_size.max(1) as u32,
                total_chunks: row.total_chunks.max(1) as u32,
                size_bytes: row.size_bytes.max(0) as u64,
                file_name: row.file_name.clone().unwrap_or_default(),
                mime_type: mime_type.clone(),
                sha256_hex: row.sha256_hex.clone(),
                sender_installation_id: row.sender_installation_id.clone().unwrap_or_default(),
                phase: OutboundPhase::Transferring,
                next_chunk: row.next_chunk_index.max(0) as u32,
                waiting_ack: None,
            };
            outbound_files.lock().unwrap().insert(tid.clone(), st.clone());
            if dispatch_outbound_send_chunk(cmd_tx, &st, &tid, st.next_chunk).is_ok() {
                outbound_files.lock().unwrap().get_mut(&tid).map(|s| {
                    s.waiting_ack = Some(st.next_chunk);
                });
            }
        }
    }
}

fn handle_rr_message(
    swarm: &mut libp2p::Swarm<PvqBehaviour>,
    peer: PeerId,
    message: request_response::Message<DirectEnvelope, DirectEnvelope>,
    ingress: &IngressCfg,
    installation_id: &str,
    data_dir: &PathBuf,
    db: &Arc<Mutex<Connection>>,
    _local_identity: &Arc<Mutex<Option<LocalIdentity>>>,
    cmd_tx: &mpsc::Sender<ControlCmd>,
    outbound_files: &Arc<Mutex<HashMap<String, OutboundTransfer>>>,
) {
    match message {
        RrMessage::Request { request, channel, .. } => {
            let resp = match request {
                DirectEnvelope::ChatMessage {
                    ref message_id,
                    ref conversation_id,
                    ref sender_user_id,
                    ref sender_installation_id,
                    ref body,
                    created_at_unix_ms,
                } => {
                    let body_json = json!({
                        "messageId": message_id,
                        "conversationId": conversation_id,
                        "senderUserId": sender_user_id,
                        "senderInstallationId": sender_installation_id,
                        "body": body,
                        "createdAtUnixMs": created_at_unix_ms,
                    });
                    let post = ingress.post("/api/p2p/internal/chat-message", body_json);
                    match post {
                        Ok((200, Some(v))) => {
                            let _ = {
                                let g = db.lock().unwrap();
                                persistence::upsert_sync_cursor_max(
                                    &g,
                                    conversation_id,
                                    message_id,
                                    created_at_unix_ms,
                                )
                            };
                            let recv = v["receiverUserId"].as_str().unwrap_or("").to_string();
                            DirectEnvelope::ChatDeliveredAck {
                                message_id: message_id.clone(),
                                conversation_id: conversation_id.clone(),
                                receiver_installation_id: installation_id.to_string(),
                                receiver_user_id: if recv.is_empty() {
                                    None
                                } else {
                                    Some(recv)
                                },
                            }
                        }
                        Ok((200, None)) => {
                            let _ = {
                                let g = db.lock().unwrap();
                                persistence::upsert_sync_cursor_max(
                                    &g,
                                    conversation_id,
                                    message_id,
                                    created_at_unix_ms,
                                )
                            };
                            DirectEnvelope::ChatDeliveredAck {
                                message_id: message_id.clone(),
                                conversation_id: conversation_id.clone(),
                                receiver_installation_id: installation_id.to_string(),
                                receiver_user_id: None,
                            }
                        }
                        Ok((c, _)) => DirectEnvelope::Error {
                            code: "NEST_HTTP".into(),
                            message: format!("status {c}"),
                        },
                        Err(e) => DirectEnvelope::Error {
                            code: "NEST_FAIL".into(),
                            message: e,
                        },
                    }
                }
                DirectEnvelope::ChatStoredAck {
                    ref message_id,
                    ref receiver_user_id,
                    ..
                } => {
                    let tu = receiver_user_id.clone().unwrap_or_default();
                    let _ = ingress.post(
                        "/api/p2p/internal/outbound-ack",
                        json!({
                            "kind": "STORED",
                            "messageId": message_id,
                            "targetUserId": tu,
                        }),
                    );
                    DirectEnvelope::Error {
                        code: "ACK".into(),
                        message: "ok".into(),
                    }
                }
                DirectEnvelope::SyncConversationSince {
                    conversation_id,
                    requester_user_id,
                    last_message_id,
                    last_created_at_unix_ms,
                } => {
                    if requester_user_id.trim().is_empty() {
                        DirectEnvelope::Error {
                            code: "SYNC".into(),
                            message: "requester_user_id requerido".into(),
                        }
                    } else {
                        let body = json!({
                            "conversationId": conversation_id,
                            "requesterUserId": requester_user_id,
                            "lastCreatedAtUnixMs": last_created_at_unix_ms,
                        });
                        match ingress.post("/api/p2p/internal/sync-since", body) {
                            Ok((200, Some(v))) => {
                                let mut items = Vec::new();
                                if let Some(arr) = v["messages"].as_array() {
                                    for m in arr {
                                        if let Some(it) = nest_message_to_sync_item(m) {
                                            items.push(it);
                                        }
                                    }
                                }
                                DirectEnvelope::SyncMessagesBatch {
                                    conversation_id,
                                    last_created_unix_ms: last_created_at_unix_ms,
                                    messages: items,
                                }
                            }
                            Ok((200, None)) => DirectEnvelope::SyncMessagesBatch {
                                conversation_id,
                                last_created_unix_ms: last_created_at_unix_ms,
                                messages: vec![],
                            },
                            _ => DirectEnvelope::SyncMessagesBatch {
                                conversation_id,
                                last_created_unix_ms: last_created_at_unix_ms,
                                messages: vec![],
                            },
                        }
                    }
                }
                DirectEnvelope::FileOffer {
                    ref transfer_id,
                    ref conversation_id,
                    ref file_name,
                    ref mime_type,
                    size_bytes,
                    ref sha256_hex,
                    chunk_size,
                    total_chunks,
                    ..
                } => {
                    let body = json!({
                        "transferId": transfer_id,
                        "conversationId": conversation_id,
                        "peerId": peer.to_string(),
                        "fileName": file_name,
                        "mimeType": mime_type,
                        "sizeBytes": size_bytes,
                        "sha256Hex": sha256_hex,
                        "chunkSize": chunk_size,
                        "totalChunks": total_chunks,
                        "direction": "INBOUND",
                    });
                    match ingress.post("/api/p2p/internal/file-offer", body) {
                        Ok((200, Some(v))) => {
                            if v["accept"].as_bool() == Some(true) {
                                let rel = transfer_store::incoming_file_rel(transfer_id);
                                let _ = {
                                    let g = db.lock().unwrap();
                                    persistence::upsert_inbound_transfer(
                                        &g,
                                        transfer_id,
                                        conversation_id,
                                        &rel,
                                        file_name,
                                        mime_type,
                                        size_bytes as i64,
                                        sha256_hex,
                                        chunk_size as i32,
                                        total_chunks as i32,
                                    )
                                };
                                DirectEnvelope::FileAccept {
                                    transfer_id: transfer_id.clone(),
                                    receiver_installation_id: installation_id.to_string(),
                                }
                            } else {
                                DirectEnvelope::FileReject {
                                    transfer_id: transfer_id.clone(),
                                    reason: "pending_or_rejected".into(),
                                }
                            }
                        }
                        Ok((200, None)) => DirectEnvelope::FileReject {
                            transfer_id: transfer_id.clone(),
                            reason: "nest_empty".into(),
                        },
                        _ => DirectEnvelope::FileReject {
                            transfer_id: transfer_id.clone(),
                            reason: "nest_error".into(),
                        },
                    }
                }
                DirectEnvelope::FileChunk {
                    ref transfer_id,
                    chunk_index,
                    offset,
                    ref bytes,
                } => {
                    let row = {
                        let g = db.lock().unwrap();
                        persistence::get_transfer(&g, transfer_id).ok().flatten()
                    };
                    match row {
                        None => DirectEnvelope::Error {
                            code: "FILE".into(),
                            message: "transfer desconocido".into(),
                        },
                        Some(row) if row.role != "INBOUND" => DirectEnvelope::Error {
                            code: "FILE".into(),
                            message: "rol invÃ¡lido".into(),
                        },
                        Some(mut row) => {
                            let tc = row.total_chunks.max(1) as u32;
                            if chunk_index >= tc {
                                DirectEnvelope::Error {
                                    code: "FILE".into(),
                                    message: "chunk_index fuera de rango".into(),
                                }
                            } else {
                                let mut mask = row.confirmed_chunks_mask.clone();
                                if persistence::chunk_bit_set(&mask, chunk_index) {
                                    DirectEnvelope::FileChunkAck {
                                        transfer_id: transfer_id.clone(),
                                        chunk_index,
                                    }
                                } else {
                                    let abs = transfer_store::incoming_file_abs(data_dir, transfer_id);
                                    match transfer_store::write_bytes_at(&abs, offset, bytes.as_slice())
                                    {
                                        Err(e) => DirectEnvelope::Error {
                                            code: "FILE_IO".into(),
                                            message: format!("{e}"),
                                        },
                                        Ok(()) => {
                                            persistence::set_chunk_bit(&mut mask, chunk_index);
                                            let new_bytes = row.bytes_received + bytes.len() as i64;
                                            let contiguous =
                                                persistence::contiguous_prefix_chunks(&mask, tc);
                                            let _ = {
                                                let g = db.lock().unwrap();
                                                persistence::update_transfer_chunk_progress(
                                                    &g,
                                                    transfer_id,
                                                    &mask,
                                                    new_bytes,
                                                )
                                            };
                                            let _ = ingress.post(
                                                "/api/p2p/internal/file-progress",
                                                json!({
                                                    "transferId": transfer_id,
                                                    "receivedBytes": new_bytes,
                                                    "state": "TRANSFERRING",
                                                    "chunkIndex": chunk_index,
                                                }),
                                            );
                                            info!(%transfer_id, chunk_index, contiguous, "chunk recibido");
                                            DirectEnvelope::FileChunkAck {
                                                transfer_id: transfer_id.clone(),
                                                chunk_index,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                DirectEnvelope::FileComplete { ref transfer_id, .. } => {
                    let row = {
                        let g = db.lock().unwrap();
                        persistence::get_transfer(&g, transfer_id).ok().flatten()
                    };
                    match row {
                        None => DirectEnvelope::Error {
                            code: "FILE".into(),
                            message: "transfer desconocido".into(),
                        },
                        Some(row) if row.role != "INBOUND" => DirectEnvelope::Error {
                            code: "FILE".into(),
                            message: "rol invÃ¡lido".into(),
                        },
                        Some(row) => {
                            let abs = transfer_store::incoming_file_abs(data_dir, transfer_id);
                            let tc = row.total_chunks.max(1) as u32;
                            let mask_ok = persistence::contiguous_prefix_chunks(
                                &row.confirmed_chunks_mask,
                                tc,
                            ) == tc;
                            let meta_len = fs::metadata(&abs).map(|m| m.len()).unwrap_or(0);
                            let size_ok = meta_len == row.size_bytes.max(0) as u64;
                            let hash_ok = match transfer_store::sha256_hex_file(&abs) {
                                Ok(h) => h.to_lowercase() == row.sha256_hex.trim().to_lowercase(),
                                Err(_) => false,
                            };
                            let ok = mask_ok && size_ok && hash_ok;
                            let rel = transfer_store::incoming_file_rel(transfer_id);
                            let _ = ingress.post(
                                "/api/p2p/internal/file-complete",
                                json!({
                                    "transferId": transfer_id,
                                    "sha256Verified": ok,
                                    "localPath": rel,
                                }),
                            );
                            if !ok {
                                let _ = transfer_store::remove_transfer_dir(data_dir, transfer_id);
                                let _ = {
                                    let g = db.lock().unwrap();
                                    persistence::set_transfer_state(&g, transfer_id, "FAILED")
                                };
                            } else {
                                let _ = {
                                    let g = db.lock().unwrap();
                                    persistence::set_transfer_state(&g, transfer_id, "COMPLETE")
                                };
                            }
                            DirectEnvelope::FileComplete {
                                transfer_id: transfer_id.clone(),
                                sha256_verified: ok,
                            }
                        }
                    }
                }
                _ => DirectEnvelope::Error {
                    code: "UNSUPPORTED".into(),
                    message: "RR inbound no implementado".into(),
                },
            };
            if let Err(_u) = swarm.behaviour_mut().rr.send_response(channel, resp) {
                warn!(%peer, "send_response");
            }
        }
        RrMessage::Response { response, .. } => {
            handle_rr_outbound_response(
                peer,
                response,
                ingress,
                data_dir,
                db,
                cmd_tx,
                outbound_files,
            );
        }
    }
}

fn handle_rr_outbound_response(
    peer: PeerId,
    response: DirectEnvelope,
    ingress: &IngressCfg,
    data_dir: &PathBuf,
    db: &Arc<Mutex<Connection>>,
    cmd_tx: &mpsc::Sender<ControlCmd>,
    outbound_files: &Arc<Mutex<HashMap<String, OutboundTransfer>>>,
) {
    match response {
        DirectEnvelope::ChatDeliveredAck {
            ref message_id,
            ref receiver_user_id,
            ..
        } => {
            let _ = ingress.post(
                "/api/p2p/internal/outbound-ack",
                json!({
                    "kind": "DELIVERED",
                    "messageId": message_id,
                    "targetUserId": receiver_user_id.clone().unwrap_or_default(),
                }),
            );
        }
        DirectEnvelope::SyncMessagesBatch { messages, .. } => {
            for it in messages {
                let body = json!({
                    "messageId": it.message_id,
                    "conversationId": it.conversation_id,
                    "senderUserId": it.sender_user_id,
                    "senderInstallationId": it.sender_installation_id,
                    "body": it.body,
                    "createdAtUnixMs": it.created_at_unix_ms,
                });
                if let Ok((200, _)) = ingress.post("/api/p2p/internal/chat-message", body) {
                    let _ = {
                        let g = db.lock().unwrap();
                        persistence::upsert_sync_cursor_max(
                            &g,
                            &it.conversation_id,
                            &it.message_id,
                            it.created_at_unix_ms,
                        )
                    };
                }
            }
        }
        DirectEnvelope::FileAccept { ref transfer_id, .. } => {
            handle_outbound_file_accept(transfer_id, outbound_files, cmd_tx, db);
        }
        DirectEnvelope::FileChunkAck {
            ref transfer_id,
            chunk_index,
        } => {
            handle_outbound_chunk_ack(transfer_id, chunk_index, outbound_files, cmd_tx, db);
        }
        DirectEnvelope::FileComplete {
            ref transfer_id,
            sha256_verified,
        } => {
            if sha256_verified {
                let _ = {
                    let g = db.lock().unwrap();
                    persistence::set_transfer_state(&g, transfer_id, "COMPLETE")
                };
                outbound_files.lock().unwrap().remove(transfer_id);
            } else {
                let _ = {
                    let g = db.lock().unwrap();
                    persistence::set_transfer_state(&g, transfer_id, "FAILED")
                };
                let _ = transfer_store::remove_transfer_dir(data_dir, transfer_id);
                outbound_files.lock().unwrap().remove(transfer_id);
            }
        }
        _ => {
            info!(%peer, ?response, "RR respuesta saliente");
        }
    }
}

async fn handle_control_client(
    mut sock: TcpStream,
    tx: mpsc::Sender<ControlCmd>,
    local_peer_id: String,
    local_identity: Arc<Mutex<Option<LocalIdentity>>>,
) -> anyhow::Result<()> {
    let (r, mut w) = sock.split();
    let mut lines = BufReader::new(r).lines();
    while let Some(line) = lines.next_line().await? {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(cmd) = serde_json::from_str::<ControlCmd>(line) {
            if matches!(cmd, ControlCmd::Ping) {
                w.write_all(b"{\"ok\":true,\"pong\":true}\n").await?;
                continue;
            }
            if matches!(cmd, ControlCmd::GetPeerId) {
                let j = json!({ "ok": true, "peer_id": local_peer_id });
                w.write_all(format!("{}\n", j).as_bytes()).await?;
                continue;
            }
            if let ControlCmd::SetIdentity {
                user_id,
                installation_id,
                display_name,
            } = &cmd
            {
                *local_identity.lock().unwrap() = Some(LocalIdentity {
                    user_id: user_id.clone(),
                    installation_id: installation_id.clone(),
                    display_name: display_name.clone().unwrap_or_default(),
                });
                if tx.send(cmd).await.is_err() {
                    break;
                }
                w.write_all(b"{\"ok\":true}\n").await?;
                continue;
            }
            if tx.send(cmd).await.is_err() {
                break;
            }
            w.write_all(b"{\"ok\":true}\n").await?;
        } else {
            w.write_all(b"{\"ok\":false,\"error\":\"json\"}\n").await?;
        }
    }
    Ok(())
}

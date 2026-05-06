//! Escritura en disco por transfer_id, hashing SHA-256 final y limpieza.

use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

pub fn transfer_dir(data_dir: &Path, transfer_id: &str) -> PathBuf {
    data_dir.join("transfers").join(transfer_id)
}

pub fn incoming_file_rel(transfer_id: &str) -> String {
    format!("transfers/{}/incoming.bin", transfer_id)
}

pub fn incoming_file_abs(data_dir: &Path, transfer_id: &str) -> PathBuf {
    transfer_dir(data_dir, transfer_id).join("incoming.bin")
}

pub fn write_bytes_at(path: &Path, offset: u64, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(p) = path.parent() {
        fs::create_dir_all(p)?;
    }
    let mut f = OpenOptions::new().create(true).write(true).open(path)?;
    f.seek(SeekFrom::Start(offset))?;
    f.write_all(bytes)?;
    f.sync_all()?;
    Ok(())
}

pub fn read_file_slice(path: &Path, offset: u64, len: usize) -> std::io::Result<Vec<u8>> {
    let mut f = std::fs::File::open(path)?;
    f.seek(SeekFrom::Start(offset))?;
    let mut buf = vec![0u8; len];
    f.read_exact(&mut buf)?;
    Ok(buf)
}

pub fn sha256_hex_file(path: &Path) -> anyhow::Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn remove_transfer_dir(data_dir: &Path, transfer_id: &str) -> anyhow::Result<()> {
    let p = transfer_dir(data_dir, transfer_id);
    if p.exists() {
        fs::remove_dir_all(&p)?;
    }
    Ok(())
}

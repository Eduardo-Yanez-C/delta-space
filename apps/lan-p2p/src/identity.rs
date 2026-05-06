use std::fs;
use std::path::Path;

use anyhow::Context;
use libp2p::identity::Keypair;

pub fn load_or_create_keypair(path: &Path) -> anyhow::Result<Keypair> {
    if path.exists() {
        let bytes = fs::read(path).with_context(|| format!("leer keypair {:?}", path))?;
        Keypair::from_protobuf_encoding(&bytes).context("decode keypair protobuf")
    } else {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).with_context(|| format!("crear dir {:?}", dir))?;
        }
        let kp = Keypair::generate_ed25519();
        let enc = kp
            .to_protobuf_encoding()
            .map_err(|e| anyhow::anyhow!("encode keypair protobuf: {:?}", e))?;
        fs::write(path, &enc).with_context(|| format!("escribir keypair {:?}", path))?;
        Ok(kp)
    }
}

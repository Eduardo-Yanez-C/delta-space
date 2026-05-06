use std::io::{Error, ErrorKind};
use std::pin::Pin;

use futures::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use futures::prelude::*;
use libp2p::request_response::Codec;
use libp2p::swarm::StreamProtocol;

use crate::protocol::{RrRequest, RrResponse};

/// Marco JSON: `u32` big-endian + payload. Evita cargar streams sin límite.
const DEFAULT_MAX_FRAME: u32 = 64 * 1024 * 1024;

#[derive(Clone, Debug)]
pub struct PvqCodec {
    max_frame_bytes: u32,
}

impl Default for PvqCodec {
    fn default() -> Self {
        Self {
            max_frame_bytes: DEFAULT_MAX_FRAME,
        }
    }
}

impl Codec for PvqCodec {
    type Protocol = StreamProtocol;
    type Request = RrRequest;
    type Response = RrResponse;

    fn read_request<'life0, 'life1, 'life2, 'async_trait, T>(
        &'life0 mut self,
        _protocol: &'life1 Self::Protocol,
        io: &'life2 mut T,
    ) -> Pin<Box<dyn Future<Output = Result<Self::Request, Error>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        T: AsyncRead + Unpin + Send + 'async_trait,
        Self: 'async_trait,
    {
        let max = self.max_frame_bytes;
        Box::pin(read_frame::<T, RrRequest>(io, max))
    }

    fn read_response<'life0, 'life1, 'life2, 'async_trait, T>(
        &'life0 mut self,
        _protocol: &'life1 Self::Protocol,
        io: &'life2 mut T,
    ) -> Pin<Box<dyn Future<Output = Result<Self::Response, Error>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        T: AsyncRead + Unpin + Send + 'async_trait,
        Self: 'async_trait,
    {
        let max = self.max_frame_bytes;
        Box::pin(read_frame::<T, RrResponse>(io, max))
    }

    fn write_request<'life0, 'life1, 'life2, 'async_trait, T>(
        &'life0 mut self,
        _protocol: &'life1 Self::Protocol,
        io: &'life2 mut T,
        req: Self::Request,
    ) -> Pin<Box<dyn Future<Output = Result<(), Error>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        T: AsyncWrite + Unpin + Send + 'async_trait,
        Self: 'async_trait,
    {
        let max = self.max_frame_bytes;
        Box::pin(async move { write_frame(io, req, max).await })
    }

    fn write_response<'life0, 'life1, 'life2, 'async_trait, T>(
        &'life0 mut self,
        _protocol: &'life1 Self::Protocol,
        io: &'life2 mut T,
        res: Self::Response,
    ) -> Pin<Box<dyn Future<Output = Result<(), Error>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        T: AsyncWrite + Unpin + Send + 'async_trait,
        Self: 'async_trait,
    {
        let max = self.max_frame_bytes;
        Box::pin(async move { write_frame(io, res, max).await })
    }
}

async fn read_frame<T: AsyncRead + Unpin, D: serde::de::DeserializeOwned>(
    io: &mut T,
    max: u32,
) -> Result<D, Error> {
    let mut hdr = [0u8; 4];
    io.read_exact(&mut hdr).await?;
    let n = u32::from_be_bytes(hdr);
    if n > max {
        return Err(Error::new(
            ErrorKind::InvalidData,
            format!("frame excede max ({n} > {max})"),
        ));
    }
    let mut buf = vec![0u8; n as usize];
    io.read_exact(&mut buf).await?;
    serde_json::from_slice(&buf).map_err(|e| Error::new(ErrorKind::InvalidData, e))
}

async fn write_frame<T: AsyncWrite + Unpin, S: serde::Serialize>(
    io: &mut T,
    msg: S,
    max: u32,
) -> Result<(), Error> {
    let buf = serde_json::to_vec(&msg).map_err(|e| Error::new(ErrorKind::InvalidData, e))?;
    let n: u32 = buf
        .len()
        .try_into()
        .map_err(|_| Error::new(ErrorKind::InvalidData, "payload demasiado grande"))?;
    if n > max {
        return Err(Error::new(ErrorKind::InvalidData, "frame supera máximo configurado"));
    }
    io.write_all(&n.to_be_bytes()).await?;
    io.write_all(&buf).await?;
    io.flush().await?;
    Ok(())
}

//! Layer 0 → chassis binding: publish bit-packed payloads and expose
//! generation-consistent snapshots for Arrow / DuckDB materialization.
//!
//! turbovec (https://github.com/RyanCodrai/turbovec) produces UINT4/UINT2
//! blocks. Until the crate is pinned, this module accepts pre-packed bytes
//! with an explicit header so dim/bit_width ride with the payload.

use crate::memory_plane::{SharedVectorMailbox, SLOT_CAP};

/// Fixed header prepended to every published slot payload.
/// Layout: [u16 dim][u8 bit_width][u8 reserved][bytes...]
pub const HEADER_LEN: usize = 4;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct PayloadHeader {
    pub dim: u16,
    pub bit_width: u8,
    pub _reserved: u8,
}

impl PayloadHeader {
    pub fn pack(self) -> [u8; HEADER_LEN] {
        let d = self.dim.to_le_bytes();
        [d[0], d[1], self.bit_width, self._reserved]
    }

    pub fn unpack(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < HEADER_LEN {
            return None;
        }
        Some(Self {
            dim: u16::from_le_bytes([bytes[0], bytes[1]]),
            bit_width: bytes[2],
            _reserved: bytes[3],
        })
    }
}

/// Publish a turbovec-style packed block into the mailbox (Law of Overwrite).
pub fn publish_packed_block(
    mailbox: &SharedVectorMailbox,
    gen: u64,
    dim: u16,
    bit_width: u8,
    codes: &[u8],
) -> Result<(), &'static str> {
    if bit_width < 2 || bit_width > 4 {
        return Err("bit_width must be 2..=4");
    }
    if HEADER_LEN + codes.len() > SLOT_CAP {
        return Err("payload exceeds SLOT_CAP");
    }
    let mut buf = Vec::with_capacity(HEADER_LEN + codes.len());
    buf.extend_from_slice(
        &PayloadHeader {
            dim,
            bit_width,
            _reserved: 0,
        }
        .pack(),
    );
    buf.extend_from_slice(codes);
    mailbox.publish_latest_generation(&buf, gen);
    Ok(())
}

/// Snapshot copy for safe handoff to JS/Arrow (seqlock-validated).
pub fn snapshot_for_ingest(
    mailbox: &SharedVectorMailbox,
    out: &mut Vec<u8>,
) -> Option<(u64, PayloadHeader)> {
    let gen = mailbox.acquire_snapshot_copy(out)?;
    let header = PayloadHeader::unpack(out)?;
    // Strip header so out holds codes only for DuckDB BLOB insert.
    let codes = out[HEADER_LEN..].to_vec();
    out.clear();
    out.extend_from_slice(&codes);
    Some((gen, header))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory_plane::SharedVectorMailbox;

    #[test]
    fn publish_snapshot_header_roundtrip() {
        let m = SharedVectorMailbox::new();
        m.init();
        let codes = vec![0xAB, 0xCD, 0xEF, 0x01];
        publish_packed_block(&m, 7, 768, 4, &codes).unwrap();
        let mut out = Vec::new();
        let (gen, h) = snapshot_for_ingest(&m, &mut out).unwrap();
        assert_eq!(gen, 7);
        assert_eq!(h.dim, 768);
        assert_eq!(h.bit_width, 4);
        assert_eq!(out, codes);
    }
}

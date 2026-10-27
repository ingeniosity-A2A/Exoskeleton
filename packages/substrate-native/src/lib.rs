//! Exoskeleton substrate-native: Layer 0 + ingest + C ABI bridge.

pub mod mailbox_ingest;
pub mod memory_plane;
pub mod napi_bridge;

pub use mailbox_ingest::{publish_packed_block, snapshot_for_ingest, PayloadHeader, HEADER_LEN};
pub use memory_plane::{SharedVectorMailbox, RING_LEN, SLOT_CAP};

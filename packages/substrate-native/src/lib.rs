//! Exoskeleton substrate-native: Layer 0 hardware channel + ingest binding.
//!
//! Memory model: `std::sync::atomic` (C++20-compatible).
//! https://doc.rust-lang.org/std/sync/atomic/

pub mod mailbox_ingest;
pub mod memory_plane;

pub use mailbox_ingest::{publish_packed_block, snapshot_for_ingest, PayloadHeader, HEADER_LEN};
pub use memory_plane::{SharedVectorMailbox, RING_LEN, SLOT_CAP};

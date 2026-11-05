//! Exoskeleton substrate-native: Layer 0 + ingest + C ABI bridge.

pub mod mailbox_ingest;
pub mod memory_plane;
pub mod packed_codes_ffi;
pub mod napi_bridge;

// Experimental research integration seams. These are not full reproductions
// of the cited neural-memory or distributed-convergence algorithms.
pub mod dfm_parametric;
pub mod superiorization;
pub mod consensus;
pub mod ota_computation;
pub mod tween_atom;
#[cfg(feature = "turbovec")]
pub mod turbovec_adapter;

pub use mailbox_ingest::{publish_packed_block, snapshot_for_ingest, PayloadHeader, HEADER_LEN};
pub use memory_plane::{SharedVectorMailbox, RING_LEN, SLOT_CAP};
pub use packed_codes_ffi::PackedCodeArena;

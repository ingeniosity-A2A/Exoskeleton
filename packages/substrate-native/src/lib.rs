//! Exoskeleton substrate-native: Layer 0 hardware channel.
//!
//! Memory model: `std::sync::atomic` (C++20-compatible).
//! See https://doc.rust-lang.org/std/sync/atomic/

pub mod memory_plane;

pub use memory_plane::{SharedVectorMailbox, RING_LEN, SLOT_CAP};

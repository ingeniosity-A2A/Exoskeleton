// Layer 0 — memory-model sound SharedVectorMailbox.
//
// R1: storage is owned by the mailbox and is never freed while it is borrowed.
// R2: payload bytes are AtomicU8; a seqlock detects mixed generations but is
//     NOT used to justify concurrent non-atomic reads/writes.
// R3: publishers are serialized in every build.
// R4: readers return a copied, generation-validated snapshot.
// Scope: threads in one process. Cross-process transport is a separate adapter.

use std::hint::spin_loop;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU64, AtomicUsize, Ordering};

pub const SLOT_CAP: usize = 4096;
pub const RING_LEN: usize = 8;
const MAX_READ_RETRY: usize = 16;
const EMPTY_SLOT: usize = usize::MAX;

#[repr(C, align(64))]
pub struct Slot {
    seq: AtomicU64,
    generation: AtomicU64,
    // Atomic bytes avoid the Rust data race that a conventional seqlock over
    // [u8; N] would create when a reader overlaps a writer.
    data: [AtomicU8; SLOT_CAP],
}

impl Slot {
    const fn new() -> Self {
        Self {
            seq: AtomicU64::new(0),
            generation: AtomicU64::new(0),
            data: [const { AtomicU8::new(0) }; SLOT_CAP],
        }
    }
}

pub struct SharedVectorMailbox {
    ring: [Slot; RING_LEN],
    active_index: AtomicUsize,
    publisher: AtomicBool,
}

impl Default for SharedVectorMailbox {
    fn default() -> Self { Self::new() }
}

impl SharedVectorMailbox {
    pub const fn new() -> Self {
        Self {
            ring: [const { Slot::new() }; RING_LEN],
            active_index: AtomicUsize::new(EMPTY_SLOT),
            publisher: AtomicBool::new(false),
        }
    }

    fn lock_publisher(&self) {
        while self.publisher.compare_exchange_weak(
            false, true, Ordering::Acquire, Ordering::Relaxed
        ).is_err() {
            spin_loop();
        }
    }

    /// Publish one immutable logical snapshot. Concurrent publishers are
    /// serialized in release and debug builds.
    pub fn publish_latest_generation(&self, payload: &[u8], generation: u64) {
        assert!(payload.len() <= SLOT_CAP - 4, "payload exceeds fixed slot");
        self.lock_publisher();

        let index = generation as usize % RING_LEN;
        let slot = &self.ring[index];
        let prior = slot.seq.load(Ordering::Relaxed) & !1;
        slot.seq.store(prior.wrapping_add(1), Ordering::Release);

        let len = payload.len() as u32;
        for (i, byte) in len.to_le_bytes().iter().enumerate() {
            slot.data[i].store(*byte, Ordering::Relaxed);
        }
        for (i, byte) in payload.iter().enumerate() {
            slot.data[i + 4].store(*byte, Ordering::Relaxed);
        }
        slot.generation.store(generation, Ordering::Relaxed);
        slot.seq.store(prior.wrapping_add(2), Ordering::Release);
        self.active_index.store(index, Ordering::Release);
        self.publisher.store(false, Ordering::Release);
    }

    /// Copy a stable snapshot. None means no publication or retry exhaustion.
    pub fn acquire_snapshot_copy(&self, out: &mut Vec<u8>) -> Option<u64> {
        for _ in 0..MAX_READ_RETRY {
            let index = self.active_index.load(Ordering::Acquire);
            if index == EMPTY_SLOT { return None; }
            if index >= RING_LEN { return None; }

            let slot = &self.ring[index];
            let before = slot.seq.load(Ordering::Acquire);
            if before & 1 != 0 { spin_loop(); continue; }

            let mut len_bytes = [0u8; 4];
            for (i, byte) in len_bytes.iter_mut().enumerate() {
                *byte = slot.data[i].load(Ordering::Relaxed);
            }
            let len = u32::from_le_bytes(len_bytes) as usize;
            if len > SLOT_CAP - 4 { continue; }

            let generation = slot.generation.load(Ordering::Relaxed);
            out.clear();
            out.reserve(len);
            for i in 0..len {
                out.push(slot.data[i + 4].load(Ordering::Relaxed));
            }

            let after = slot.seq.load(Ordering::Acquire);
            if before == after && after & 1 == 0
                && self.active_index.load(Ordering::Acquire) == index
            {
                return Some(generation);
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn publish_and_copy_roundtrip() {
        let mailbox = SharedVectorMailbox::new();
        let payload = b"turboquant-slot-payload";
        mailbox.publish_latest_generation(payload, 1);
        let mut out = Vec::new();
        assert_eq!(mailbox.acquire_snapshot_copy(&mut out), Some(1));
        assert_eq!(out, payload);
    }

    #[test]
    fn overwrite_advances_generation() {
        let mailbox = SharedVectorMailbox::new();
        mailbox.publish_latest_generation(b"a", 1);
        mailbox.publish_latest_generation(b"b", 2);
        let mut out = Vec::new();
        assert_eq!(mailbox.acquire_snapshot_copy(&mut out), Some(2));
        assert_eq!(out, b"b");
    }
}

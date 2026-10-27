// Layer 0 — memory-model correct SharedVectorMailbox
// Soundness rules:
//   R1: slots are NEVER freed — recycling by generation ring (kills UAF).
//   R2: (payload, generation) published through ONE word: the slot seqlock.
//   R3: single publisher thread (the ingestion worker). Enforced in debug.
//   R4: readers copy under a seqlock bracket; torn reads are detected, not trusted.
// Scope: threads of one process. Cross-process delivery = /dev/shm ring, not here.
//
// Memory model: std::sync::atomic follows the C++20 model (Rust std docs).
// Pattern: publisher Release store/fence; reader Relaxed load + Acquire fence.

use std::sync::atomic::{fence, AtomicPtr, AtomicU64, Ordering};

pub const SLOT_CAP: usize = 4096;
pub const RING_LEN: usize = 8; // power of two
const MAX_READ_RETRY: usize = 8;

#[repr(C, align(64))]
pub struct Slot {
    seq: AtomicU64,        // seqlock: odd = write in progress, even = published
    generation: AtomicU64, // lives WITH the payload — no torn (ptr, gen) pairs
    data: [u8; SLOT_CAP],  // layout: [u32 len][bytes...]
}

impl Slot {
    const fn new() -> Self {
        Self {
            seq: AtomicU64::new(0),
            generation: AtomicU64::new(0),
            data: [0; SLOT_CAP],
        }
    }
}

pub struct SharedVectorMailbox {
    ring: [Slot; RING_LEN],
    active: AtomicPtr<Slot>,
    debug_owner: AtomicU64,
}

impl SharedVectorMailbox {
    pub const fn new() -> Self {
        Self {
            ring: [
                Slot::new(),
                Slot::new(),
                Slot::new(),
                Slot::new(),
                Slot::new(),
                Slot::new(),
                Slot::new(),
                Slot::new(),
            ],
            active: AtomicPtr::new(std::ptr::null_mut()),
            debug_owner: AtomicU64::new(0),
        }
    }

    pub fn init(&self) {
        assert!(
            AtomicPtr::<u8>::is_lock_free() && AtomicU64::is_lock_free(),
            "Layer 0 requires lock-free pointer and u64 atomics on this target"
        );
    }

    /// Law of Overwrite, publication-correct: one seqlock write section,
    /// generation stored inside the slot, active pointer swapped last (Release).
    pub fn publish_latest_generation(&self, payload: &[u8], gen: u64) {
        debug_assert!(self.claim_debug_owner(), "R3 violated: concurrent publishers");

        assert!(payload.len() + 4 <= SLOT_CAP, "payload exceeds fixed slot");
        let slot = &self.ring[gen as usize % RING_LEN];

        let s = slot.seq.load(Ordering::Relaxed);
        slot.seq.store(s.wrapping_add(1), Ordering::Relaxed); // odd: writing
        fence(Ordering::Release);
        unsafe {
            let dst = slot.data.as_ptr() as *mut u8;
            (dst as *mut u32).write_unaligned(payload.len() as u32);
            std::ptr::copy_nonoverlapping(payload.as_ptr(), dst.add(4), payload.len());
        }
        slot.generation.store(gen, Ordering::Relaxed);
        slot.seq.store(s.wrapping_add(2), Ordering::Release); // even: published

        self.active
            .store(slot as *const Slot as *mut Slot, Ordering::Release);
    }

    /// Sound read path: copy under a validated seqlock bracket.
    pub fn acquire_snapshot_copy(&self, out: &mut Vec<u8>) -> Option<u64> {
        for _ in 0..MAX_READ_RETRY {
            let ptr = self.active.load(Ordering::Relaxed);
            if ptr.is_null() {
                return None;
            }
            fence(Ordering::Acquire);
            let slot = unsafe { &*ptr };

            let s1 = slot.seq.load(Ordering::Acquire);
            if s1 & 1 == 1 {
                continue; // writer in section
            }
            fence(Ordering::Acquire);
            let len = unsafe { (slot.data.as_ptr() as *const u32).read_unaligned() } as usize;
            if len + 4 > SLOT_CAP {
                continue;
            }
            let gen = slot.generation.load(Ordering::Relaxed);
            out.resize(len, 0);
            out.copy_from_slice(unsafe {
                std::slice::from_raw_parts(slot.data.as_ptr().add(4), len)
            });
            fence(Ordering::Acquire);
            let s2 = slot.seq.load(Ordering::Relaxed);
            if s1 == s2 {
                return Some(gen);
            }
        }
        None
    }

    /// Escape hatch for true zero-copy GPU binds.
    /// UNSOUND unless caller re-validates seq before use and after copy.
    ///
    /// # Safety
    /// Caller must re-read seq (Acquire) after consuming; equal+even or abort.
    pub unsafe fn acquire_active_raw(&self) -> Option<(*const u8, usize, u64)> {
        let ptr = self.active.load(Ordering::Relaxed);
        if ptr.is_null() {
            return None;
        }
        fence(Ordering::Acquire);
        let slot = &*ptr;
        let s1 = slot.seq.load(Ordering::Acquire);
        if s1 & 1 == 1 {
            return None;
        }
        fence(Ordering::Acquire);
        let len = (slot.data.as_ptr() as *const u32).read_unaligned() as usize;
        let gen = slot.generation.load(Ordering::Relaxed);
        Some((slot.data.as_ptr().add(4), len, gen))
    }

    #[cfg(debug_assertions)]
    fn claim_debug_owner(&self) -> bool {
        // ThreadId has no stable as_u64; use a process-local counter hash of Debug.
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        std::thread::current().id().hash(&mut h);
        let me = h.finish();
        self.debug_owner
            .compare_exchange(0, me, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
            || self.debug_owner.load(Ordering::Relaxed) == me
    }

    #[cfg(not(debug_assertions))]
    fn claim_debug_owner(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn publish_and_copy_roundtrip() {
        let m = SharedVectorMailbox::new();
        m.init();
        let payload = b"turboquant-slot-payload";
        m.publish_latest_generation(payload, 1);
        let mut out = Vec::new();
        let gen = m.acquire_snapshot_copy(&mut out).expect("snapshot");
        assert_eq!(gen, 1);
        assert_eq!(out, payload);
    }

    #[test]
    fn overwrite_advances_generation() {
        let m = SharedVectorMailbox::new();
        m.init();
        m.publish_latest_generation(b"a", 1);
        m.publish_latest_generation(b"b", 2);
        let mut out = Vec::new();
        let gen = m.acquire_snapshot_copy(&mut out).unwrap();
        assert_eq!(gen, 2);
        assert_eq!(out, b"b");
    }
}

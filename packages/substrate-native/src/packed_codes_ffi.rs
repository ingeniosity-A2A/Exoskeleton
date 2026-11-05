//! PackedCodeArena — aligned, single-allocation storage for packed vectors.
//! Query/GPU consumers may borrow a view only while the arena remains alive and
//! immutable. DuckDB persistence materializes its own bytes at the boundary.

use std::alloc::{alloc_zeroed, dealloc, Layout};
use std::ptr;
use std::sync::atomic::{AtomicU64, Ordering};

pub const MAGIC: u32 = 0x4156_4131;
pub const CACHE_ALIGN: usize = 64;
static GENERATION: AtomicU64 = AtomicU64::new(0);

#[repr(C, align(64))]
pub struct ArenaHeader {
    pub magic: u32,
    pub bit_width: u8,
    pub _pad: [u8; 3],
    pub dim: u32,
    pub block_bytes: u32,
    pub count: u32,
    pub _pad2: [u8; 4],
    pub generation: u64,
}

pub struct PackedCodeArena {
    ptr: *mut u8,
    layout: Layout,
    header: *mut ArenaHeader,
    capacity_blocks: u32,
}

impl PackedCodeArena {
    pub fn alloc(dim: u32, bit_width: u8, capacity_blocks: u32) -> Result<Self, &'static str> {
        if !(2..=4).contains(&bit_width) { return Err("bit_width must be 2..=4"); }
        if dim == 0 || dim % 8 != 0 { return Err("dim must be a positive multiple of 8"); }

        let raw = (dim as usize).checked_mul(bit_width as usize)
            .ok_or("dimension overflow")?.div_ceil(8);
        let block_bytes = raw.div_ceil(CACHE_ALIGN)
            .checked_mul(CACHE_ALIGN).ok_or("block size overflow")?;
        let blocks_bytes = block_bytes.checked_mul(capacity_blocks as usize)
            .ok_or("arena capacity overflow")?;
        let total = std::mem::size_of::<ArenaHeader>()
            .checked_add(blocks_bytes).ok_or("arena size overflow")?;
        let layout = Layout::from_size_align(total.max(CACHE_ALIGN), CACHE_ALIGN)
            .map_err(|_| "invalid arena layout")?;
        let ptr = unsafe { alloc_zeroed(layout) };
        if ptr.is_null() { return Err("arena allocation failed"); }

        let header = ptr.cast::<ArenaHeader>();
        unsafe {
            ptr::write(header, ArenaHeader {
                magic: MAGIC,
                bit_width,
                _pad: [0; 3],
                dim,
                block_bytes: u32::try_from(block_bytes).map_err(|_| "block too large")?,
                count: 0,
                _pad2: [0; 4],
                generation: 0,
            });
        }
        Ok(Self { ptr, layout, header, capacity_blocks })
    }

    pub fn push_packed(&mut self, packed: &[u8]) -> Option<u32> {
        let h = unsafe { &mut *self.header };
        if h.count >= self.capacity_blocks || packed.len() != h.block_bytes as usize {
            return None;
        }
        let offset = std::mem::size_of::<ArenaHeader>()
            .checked_add(h.count as usize * h.block_bytes as usize)?;
        unsafe { ptr::copy_nonoverlapping(packed.as_ptr(), self.ptr.add(offset), packed.len()); }
        let index = h.count;
        h.count += 1;
        Some(index)
    }

    pub fn publish(&mut self) -> u64 {
        let generation = GENERATION.fetch_add(1, Ordering::AcqRel).wrapping_add(1);
        unsafe { (*self.header).generation = generation; }
        generation
    }

    pub fn values_ptr(&self) -> *const u8 {
        unsafe { self.ptr.add(std::mem::size_of::<ArenaHeader>()) }
    }

    pub fn values_len(&self) -> usize {
        let h = unsafe { &*self.header };
        h.count as usize * h.block_bytes as usize
    }

    pub fn block_bytes(&self) -> usize {
        unsafe { (*self.header).block_bytes as usize }
    }

    pub fn as_arrow_fixedsizebinary(&self) -> (*const u8, i32, usize) {
        (self.values_ptr(), self.block_bytes() as i32,
         self.values_len() / self.block_bytes())
    }
}

impl Drop for PackedCodeArena {
    fn drop(&mut self) {
        unsafe { dealloc(self.ptr, self.layout); }
    }
}

/// # Safety
/// Returned pointers are valid only until ava_codes_free and must not be used
/// concurrently with mutation. The caller must pass valid, non-null pointers.
#[no_mangle]
pub extern "C" fn ava_codes_alloc(dim: u32, bit_width: u8, cap: u32) -> *mut PackedCodeArena {
    match PackedCodeArena::alloc(dim, bit_width, cap) {
        Ok(arena) => Box::into_raw(Box::new(arena)),
        Err(_) => ptr::null_mut(),
    }
}

#[no_mangle]
pub unsafe extern "C" fn ava_codes_push(
    arena: *mut PackedCodeArena, packed: *const u8, len: usize,
) -> i32 {
    if arena.is_null() || (packed.is_null() && len != 0) { return -1; }
    let Some(a) = arena.as_mut() else { return -1; };
    let slice = if len == 0 { &[] } else { std::slice::from_raw_parts(packed, len) };
    a.push_packed(slice).map(|i| i as i32).unwrap_or(-1)
}

#[no_mangle]
pub unsafe extern "C" fn ava_codes_publish(arena: *mut PackedCodeArena) -> u64 {
    arena.as_mut().map(PackedCodeArena::publish).unwrap_or(0)
}

#[no_mangle]
pub unsafe extern "C" fn ava_codes_view(
    arena: *const PackedCodeArena, out_data: *mut *const u8,
    out_item_bytes: *mut i32, out_count: *mut usize,
) -> bool {
    if arena.is_null() || out_data.is_null() || out_item_bytes.is_null() || out_count.is_null() {
        return false;
    }
    let Some(a) = arena.as_ref() else { return false; };
    let (data, item_bytes, count) = a.as_arrow_fixedsizebinary();
    *out_data = data;
    *out_item_bytes = item_bytes;
    *out_count = count;
    true
}

#[no_mangle]
pub unsafe extern "C" fn ava_codes_header(
    arena: *const PackedCodeArena, out_dim: *mut u32, out_bits: *mut u8,
) -> bool {
    if arena.is_null() || out_dim.is_null() || out_bits.is_null() { return false; }
    let Some(a) = arena.as_ref() else { return false; };
    *out_dim = (*a.header).dim;
    *out_bits = (*a.header).bit_width;
    true
}

#[no_mangle]
pub unsafe extern "C" fn ava_codes_free(arena: *mut PackedCodeArena) {
    if !arena.is_null() { drop(Box::from_raw(arena)); }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_start_on_cache_line_boundary() {
        let arena = PackedCodeArena::alloc(128, 4, 2).unwrap();
        assert_eq!((arena.values_ptr() as usize) % CACHE_ALIGN, 0);
    }

    #[test]
    fn push_and_publish() {
        let mut arena = PackedCodeArena::alloc(128, 4, 1).unwrap();
        let block = vec![7u8; arena.block_bytes()];
        assert_eq!(arena.push_packed(&block), Some(0));
        assert!(arena.push_packed(&block).is_none());
        assert!(arena.publish() > 0);
    }
}

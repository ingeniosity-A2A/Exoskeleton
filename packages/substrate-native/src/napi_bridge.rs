//! C ABI surface for JS/Wasm consumers.
//! Build with crate-type cdylib and bind via napi or wasm-bindgen as preferred.

use crate::mailbox_ingest::{snapshot_for_ingest, PayloadHeader};
use crate::memory_plane::SharedVectorMailbox;
use std::cell::RefCell;

thread_local! {
    static MAILBOX: RefCell<Option<SharedVectorMailbox>> = const { RefCell::new(None) };
    static SNAP_BUF: RefCell<Vec<u8>> = RefCell::new(Vec::new());
}

#[no_mangle]
pub extern "C" fn ava_mailbox_init() {
    MAILBOX.with(|m| {
        let box_ = SharedVectorMailbox::new();
        box_.init();
        *m.borrow_mut() = Some(box_);
    });
}

/// Snapshot latest generation into an internal buffer.
/// Returns generation as i64, or -1 on empty/torn.
/// Writes dim/bit_width into out_dim / out_bit_width; codes length into out_len.
/// Call ava_mailbox_copy_codes after a successful snapshot.
#[no_mangle]
pub unsafe extern "C" fn ava_mailbox_snapshot(
    out_dim: *mut u16,
    out_bit_width: *mut u8,
    out_len: *mut u32,
) -> i64 {
    MAILBOX.with(|m| {
        let guard = m.borrow();
        let Some(mb) = guard.as_ref() else {
            return -1;
        };
        SNAP_BUF.with(|buf| {
            let mut b = buf.borrow_mut();
            match snapshot_for_ingest(mb, &mut b) {
                Some((gen, header)) => {
                    if !out_dim.is_null() {
                        *out_dim = header.dim;
                    }
                    if !out_bit_width.is_null() {
                        *out_bit_width = header.bit_width;
                    }
                    if !out_len.is_null() {
                        *out_len = b.len() as u32;
                    }
                    gen as i64
                }
                None => -1,
            }
        })
    })
}

/// Copy codes from last successful snapshot into caller buffer.
/// Returns bytes copied, or -1 if buffer too small / no snapshot.
#[no_mangle]
pub unsafe extern "C" fn ava_mailbox_copy_codes(dst: *mut u8, dst_len: u32) -> i32 {
    if dst.is_null() {
        return -1;
    }
    SNAP_BUF.with(|buf| {
        let b = buf.borrow();
        if b.len() > dst_len as usize {
            return -1;
        }
        std::ptr::copy_nonoverlapping(b.as_ptr(), dst, b.len());
        b.len() as i32
    })
}

/// Publish packed block (header + codes) at generation gen.
#[no_mangle]
pub unsafe extern "C" fn ava_mailbox_publish(
    gen: u64,
    dim: u16,
    bit_width: u8,
    codes: *const u8,
    codes_len: u32,
) -> i32 {
    if codes.is_null() && codes_len > 0 {
        return -1;
    }
    let slice = std::slice::from_raw_parts(codes, codes_len as usize);
    MAILBOX.with(|m| {
        let guard = m.borrow();
        let Some(mb) = guard.as_ref() else {
            return -1;
        };
        match crate::mailbox_ingest::publish_packed_block(mb, gen, dim, bit_width, slice) {
            Ok(()) => 0,
            Err(_) => -1,
        }
    })
}

// silence unused import in non-test builds if header only used via path
#[allow(dead_code)]
fn _header_ty(_: PayloadHeader) {}

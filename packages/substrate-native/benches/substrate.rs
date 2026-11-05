use exoskeleton_substrate_native::{PackedCodeArena, SharedVectorMailbox};
use std::hint::black_box;
use std::time::{Duration, Instant};

fn report(name: &str, ops: u64, elapsed: Duration, bytes: u64) {
    let seconds = elapsed.as_secs_f64();
    let ops_s = ops as f64 / seconds.max(f64::MIN_POSITIVE);
    let mib_s = bytes as f64 / (1024.0 * 1024.0) / seconds.max(f64::MIN_POSITIVE);
    println!(
        "{{\"benchmark\":\"{}\",\"ops\":{},\"elapsed_ms\":{:.3},\"ops_per_sec\":{:.0},\"mib_per_sec\":{:.3}}}",
        name, ops, elapsed.as_secs_f64() * 1000.0, ops_s, mib_s
    );
}

fn main() {
    let iterations: u64 = std::env::var("KINETIC_BENCH_ITERS")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(100_000);
    let payload = vec![0x5au8; 1024];

    let mailbox = SharedVectorMailbox::new();
    let mut snapshot = Vec::with_capacity(payload.len());
    let start = Instant::now();
    for generation in 1..=iterations {
        mailbox.publish_latest_generation(black_box(&payload), generation);
        black_box(mailbox.acquire_snapshot_copy(&mut snapshot));
    }
    report(
        "mailbox_publish_snapshot_1k",
        iterations,
        start.elapsed(),
        iterations * payload.len() as u64 * 2,
    );

    let mut arena = PackedCodeArena::alloc(128, 4, iterations as u32)
        .expect("packed arena allocation");
    let block = vec![0x3cu8; arena.block_bytes()];
    let start = Instant::now();
    for _ in 0..iterations {
        black_box(arena.push_packed(black_box(&block)).expect("arena capacity"));
    }
    black_box(arena.publish());
    report(
        "packed_code_arena_append_4bit_128d",
        iterations,
        start.elapsed(),
        iterations * block.len() as u64,
    );
}

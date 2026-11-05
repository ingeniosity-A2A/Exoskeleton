use std::hint::black_box;
use std::time::Instant;
use turbovec::IdMapIndex;

const DIM: usize = 128;
const N: usize = 4096;
const NQ: usize = 32;
const K: usize = 10;
const REPEATS: usize = 20;

fn data() -> (Vec<f32>, Vec<u64>, Vec<f32>) {
    let mut seed = 0x9e37_79b9_u64;
    let mut next = || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        (((seed >> 32) as u32) as f32 / (u32::MAX as f32)) * 2.0 - 1.0
    };
    let mut vectors = Vec::with_capacity(N * DIM);
    for _ in 0..N * DIM { vectors.push(next()); }
    let ids = (0..N).map(|i| 10_000_000u64 + i as u64).collect();
    let mut queries = Vec::with_capacity(NQ * DIM);
    for _ in 0..NQ * DIM { queries.push(next()); }
    (vectors, ids, queries)
}

fn emit(name: &str, elapsed: f64, operations: usize, extra: &str) {
    println!(
        "{{\"benchmark\":\"{}\",\"elapsed_ms\":{:.3},\"operations\":{},\"ops_per_sec\":{:.2},\"{}\"}}",
        name, elapsed * 1000.0, operations, operations as f64 / elapsed.max(1e-12), extra
    );
}

fn exact_scan(vectors: &[f32], queries: &[f32]) {
    for q in queries.chunks_exact(DIM) {
        let mut scores: Vec<f32> = vectors.chunks_exact(DIM)
            .map(|v| v.iter().zip(q).map(|(a,b)| a*b).sum())
            .collect();
        scores.sort_by(|a,b| b.total_cmp(a));
        black_box(&scores[..K]);
    }
}

fn main() {
    let (vectors, ids, queries) = data();
    let start = Instant::now();
    for _ in 0..REPEATS { exact_scan(black_box(&vectors), black_box(&queries)); }
    let elapsed = start.elapsed().as_secs_f64();
    emit("float32_exact_full_scan", elapsed, REPEATS * NQ, "\\\"dim\\\":128,\\\"n\\\":4096,\\\"k\\\":10");

    for bits in [2usize, 3, 4] {
        let mut index = IdMapIndex::new(DIM, bits).expect("TurboVec index");
        let start_add = Instant::now();
        index.add_with_ids(&vectors, &ids).expect("TurboVec add");
        let add_elapsed = start_add.elapsed().as_secs_f64();
        index.prepare();

        let start_search = Instant::now();
        for _ in 0..REPEATS {
            let result = index.try_search(&queries, K).expect("TurboVec search");
            black_box(result);
        }
        let search_elapsed = start_search.elapsed().as_secs_f64();
        emit(
            &format!("turbovec_{}_bit_search", bits),
            search_elapsed, REPEATS * NQ,
            &format!("\\\"dim\\\":{},\\\"n\\\":{},\\\"k\\\":{},\\\"add_ms\\\":{:.3}", DIM, N, K, add_elapsed*1000.0),
        );

        let allowlist: Vec<u64> = ids.iter().step_by(2).copied().collect();
        let start_filtered = Instant::now();
        for _ in 0..REPEATS {
            let result = index.try_search_with_allowlist(&queries, K, Some(&allowlist))
                .expect("TurboVec allowlist search");
            black_box(result);
        }
        emit(
            &format!("turbovec_{}_bit_acl_allowlist_search", bits),
            start_filtered.elapsed().as_secs_f64(), REPEATS * NQ,
            &format!("\\\"dim\\\":{},\\\"n\\\":{},\\\"allowlist\\\":{},\\\"k\\\":{}", DIM, N, allowlist.len(), K),
        );
    }
}

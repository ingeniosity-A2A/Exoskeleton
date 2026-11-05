//! Optional adapter for RyanCodrai's TurboVec stable-ID quantized index.
//! Canonical atom identity remains outside the index; this projection is rebuildable.

use turbovec::{IdMapIndex, SearchError};

#[derive(Debug)]
pub struct TurboVecProjection {
    index: IdMapIndex,
    dim: usize,
    bit_width: usize,
}

impl TurboVecProjection {
    pub fn new(dim: usize, bit_width: usize) -> Result<Self, turbovec::ConstructError> {
        Ok(Self { index: IdMapIndex::new(dim, bit_width)?, dim, bit_width })
    }

    pub fn add_atoms(&mut self, vectors: &[f32], atom_ids: &[u64]) -> Result<(), turbovec::AddError> {
        self.index.add_with_ids(vectors, atom_ids)
    }

    /// The allowlist must be computed by the authoritative metadata/ACL layer.
    /// This adapter never derives authorization from vector similarity.
    pub fn search_authorized(
        &self,
        query_vectors: &[f32],
        k: usize,
        authorized_atom_ids: &[u64],
    ) -> Result<(Vec<f32>, Vec<u64>), SearchError> {
        self.index.search_with_allowlist(query_vectors, k, Some(authorized_atom_ids))
    }

    pub fn prepare(&self) { self.index.prepare(); }
    pub fn len(&self) -> usize { self.index.len() }
    pub fn is_empty(&self) -> bool { self.index.is_empty() }
    pub fn dim(&self) -> usize { self.dim }
    pub fn bit_width(&self) -> usize { self.bit_width }

    pub fn write(&self, path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
        self.index.write(path)
    }

    pub fn load(path: impl AsRef<std::path::Path>) -> std::io::Result<Self> {
        let index = IdMapIndex::load(path)?;
        let dim = index.dim_opt().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "TurboVec index has no committed dimension")
        })?;
        let bit_width = index.bit_width();
        Ok(Self { index, dim, bit_width })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_ids_and_authorized_allowlist_are_enforced() {
        let mut index = TurboVecProjection::new(8, 4).unwrap();
        let vectors = [
            1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
            0.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0,
            0.0,0.0,1.0,0.0,0.0,0.0,0.0,0.0,
        ];
        index.add_atoms(&vectors, &[101, 202, 303]).unwrap();
        index.prepare();
        let query = [1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0];
        let (scores, ids) = index.search_authorized(&query, 3, &[202, 303]).unwrap();
        let mut returned_ids = ids.clone();
        returned_ids.sort_unstable();
        assert_eq!(returned_ids, vec![202, 303]);
        assert_eq!(scores.len(), 2);
        assert_eq!(index.len(), 3);
    }

    #[test]
    fn durable_index_round_trip_preserves_external_ids() {
        let mut index = TurboVecProjection::new(8, 2).unwrap();
        let vectors = [
            1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
            0.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0,
        ];
        index.add_atoms(&vectors, &[9001, 9002]).unwrap();
        let path = std::env::temp_dir().join(format!(
            "ava007-turbovec-{}-{}.tvim", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        index.write(&path).unwrap();
        let loaded = TurboVecProjection::load(&path).unwrap();
        let query = [0.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0];
        let (_, ids) = loaded.search_authorized(&query, 1, &[9001, 9002]).unwrap();
        assert_eq!(ids, vec![9002]);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn unknown_or_empty_allowlists_fail_closed() {
        let index = TurboVecProjection::new(8, 4).unwrap();
        let query = [1.0; 8];
        assert!(index.search_authorized(&query, 3, &[]).is_err());
    }
}

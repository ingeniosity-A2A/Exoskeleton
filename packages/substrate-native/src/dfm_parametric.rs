//! DFM promotion metadata seam; not the learned DFM neural architecture.
//! The causal predictor, projector and gated cross-attention require a trained
//! model adapter. This module only validates and arbitrates substrate chunks.

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct DfmChunk {
    pub chunk_id: String,
    pub embedding: Vec<f32>,
    pub context_chain: Vec<String>,
    pub eval_score: f64,
    pub generation: u64,
}
#[derive(Debug, Clone, PartialEq)]
pub enum Mem0Op { Add, Update { supersedes: String } }
#[derive(Debug, Clone, PartialEq)]
pub enum PromotionDecision {
    Promote { operation: Mem0Op, reason: String },
    Reject { reason: String },
}
#[derive(Debug, Clone, PartialEq)]
pub enum DfmError { EmptyId, EmptyEmbedding, NonFiniteEmbedding, InvalidScore }

pub struct DfmPromotionRegistry {
    promoted: HashMap<String, DfmChunk>,
    min_eval_score: f64,
    min_chain_depth: usize,
    update_similarity: f64,
}
impl Default for DfmPromotionRegistry {
    fn default() -> Self { Self::new(0.70, 2, 0.85) }
}
impl DfmPromotionRegistry {
    pub fn new(min_eval_score: f64, min_chain_depth: usize, update_similarity: f64) -> Self {
        Self { promoted: HashMap::new(), min_eval_score, min_chain_depth, update_similarity }
    }
    pub fn evaluate(&self, c: &DfmChunk) -> Result<PromotionDecision, DfmError> {
        validate(c)?;
        if c.eval_score < self.min_eval_score {
            return Ok(PromotionDecision::Reject { reason: "eval score below admission threshold".into() });
        }
        if c.context_chain.len() < self.min_chain_depth {
            return Ok(PromotionDecision::Reject { reason: "insufficient causal context depth".into() });
        }
        let mut closest: Option<(&DfmChunk, f64)> = None;
        for old in self.promoted.values() {
            if old.embedding.len() != c.embedding.len() { continue; }
            let sim = cosine(&old.embedding, &c.embedding);
            if closest.map_or(true, |(_, best)| sim > best) { closest = Some((old, sim)); }
        }
        if let Some((old, sim)) = closest {
            if sim >= self.update_similarity {
                if c.eval_score > old.eval_score {
                    return Ok(PromotionDecision::Promote {
                        operation: Mem0Op::Update { supersedes: old.chunk_id.clone() },
                        reason: "stronger evidence supersedes similar promoted chunk".into(),
                    });
                }
                return Ok(PromotionDecision::Reject { reason: "similar chunk has no stronger evidence".into() });
            }
        }
        Ok(PromotionDecision::Promote { operation: Mem0Op::Add, reason: "admission checks passed".into() })
    }
    // Persist the accepted event to the authoritative ledger before treating it as durable.
    pub fn apply(&mut self, c: DfmChunk, d: PromotionDecision) -> bool {
        match d {
            PromotionDecision::Promote { operation: Mem0Op::Add, .. } => {
                self.promoted.insert(c.chunk_id.clone(), c); true
            }
            PromotionDecision::Promote { operation: Mem0Op::Update { supersedes }, .. } => {
                self.promoted.remove(&supersedes);
                self.promoted.insert(c.chunk_id.clone(), c); true
            }
            PromotionDecision::Reject { .. } => false,
        }
    }
    pub fn get(&self, id: &str) -> Option<&DfmChunk> { self.promoted.get(id) }
    pub fn len(&self) -> usize { self.promoted.len() }
}
fn validate(c: &DfmChunk) -> Result<(), DfmError> {
    if c.chunk_id.trim().is_empty() { return Err(DfmError::EmptyId); }
    if c.embedding.is_empty() { return Err(DfmError::EmptyEmbedding); }
    if !c.embedding.iter().all(|v| v.is_finite()) { return Err(DfmError::NonFiniteEmbedding); }
    if !c.eval_score.is_finite() || !(0.0..=1.0).contains(&c.eval_score) { return Err(DfmError::InvalidScore); }
    Ok(())
}
fn cosine(a: &[f32], b: &[f32]) -> f64 {
    let dot: f64 = a.iter().zip(b).map(|(x,y)| (*x as f64)*(*y as f64)).sum();
    let aa: f64 = a.iter().map(|x| (*x as f64).powi(2)).sum();
    let bb: f64 = b.iter().map(|x| (*x as f64).powi(2)).sum();
    if aa == 0.0 || bb == 0.0 { 0.0 } else { dot / (aa.sqrt()*bb.sqrt()) }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn c(id:&str, score:f64, depth:usize, e:Vec<f32>)->DfmChunk {
        DfmChunk { chunk_id:id.into(), embedding:e, context_chain:(0..depth).map(|i|format!("t{i}")).collect(), eval_score:score, generation:1 }
    }
    #[test] fn rejects_low_score_and_shallow_chain() {
        let r=DfmPromotionRegistry::default();
        assert!(matches!(r.evaluate(&c("a",0.5,3,vec![1.0])),Ok(PromotionDecision::Reject{..})));
        assert!(matches!(r.evaluate(&c("b",0.9,1,vec![1.0])),Ok(PromotionDecision::Reject{..})));
    }
    #[test] fn updates_only_with_stronger_similar_evidence() {
        let mut r=DfmPromotionRegistry::default(); let a=c("a",0.8,2,vec![1.0,0.0]);
        let d=r.evaluate(&a).unwrap(); assert!(r.apply(a,d));
        let b=c("b",0.95,3,vec![0.99,0.01]); let d=r.evaluate(&b).unwrap();
        assert!(matches!(d,PromotionDecision::Promote{operation:Mem0Op::Update{..},..}));
        assert!(r.apply(b,d)); assert!(r.get("a").is_none()); assert!(r.get("b").is_some());
    }
    #[test] fn rejects_invalid_numeric_data() {
        let r=DfmPromotionRegistry::default();
        assert_eq!(r.evaluate(&c("x",1.2,2,vec![1.0])),Err(DfmError::InvalidScore));
        assert_eq!(r.evaluate(&c("y",0.9,2,vec![f32::NAN])),Err(DfmError::NonFiniteEmbedding));
    }
}

//! TweenAtom is the typed, provenance-carrying state-transition unit.
//! It transports intent and temporal state through Exoskeleton. It is not an
//! authorization principal, source-of-truth ledger, or command executor.
//! AVA-007 remains the only authority that accepts observations and authorizes
//! actions. Runtime adapters must verify AVA-007 receipts before recording an
//! accepted authority state here.

use std::fmt;

pub const TWEENATOM_SCHEMA_VERSION: u16 = 1;
pub const COMPACT_INTENT_TOKEN_TARGET: u16 = 53;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct TweenAtomId(pub [u8; 16]);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthorityState { Pending, Accepted, Rejected }

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExecutionState { NotStarted, Running, Succeeded, Failed, Compensated }

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompactIntent {
    pub tokenizer_id: String,
    pub token_count: u16,
    /// Compact intent representation; never contains credentials or secrets.
    pub encoded: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemporalTransition {
    pub start_unix_micros: i64,
    pub end_unix_micros: i64,
    pub easing_id: String,
    pub transition_law_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayloadReference {
    pub uri: String,
    pub sha256_hex: String,
    pub media_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TweenAtom {
    pub schema_version: u16,
    pub id: TweenAtomId,
    pub stream_id: TweenAtomId,
    pub generation: u64,
    pub predecessor: Option<TweenAtomId>,
    pub successor: Option<TweenAtomId>,
    pub capability_id: String,
    pub intent_kind: String,
    pub compact_intent: Option<CompactIntent>,
    pub temporal: TemporalTransition,
    pub payload: PayloadReference,
    pub source_refs: Vec<String>,
    pub policy_version: String,
    pub authority_state: AuthorityState,
    pub authority_receipt_ref: Option<String>,
    pub execution_state: ExecutionState,
    pub execution_receipt_ref: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TweenAtomError {
    UnsupportedSchema(u16),
    EmptyField(&'static str),
    InvalidSha256,
    InvalidTemporalRange,
    InvalidCompactIntentTokenCount(u16),
    MissingAuthorityReceipt,
    ExecutionBeforeAcceptance,
    MissingExecutionReceipt,
    GenerationOverflow,
}

impl fmt::Display for TweenAtomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "{self:?}") }
}
impl std::error::Error for TweenAtomError {}

impl TweenAtom {
    pub fn validate(&self) -> Result<(), TweenAtomError> {
        if self.schema_version != TWEENATOM_SCHEMA_VERSION {
            return Err(TweenAtomError::UnsupportedSchema(self.schema_version));
        }
        for (field, value) in [
            ("capability_id", self.capability_id.as_str()),
            ("intent_kind", self.intent_kind.as_str()),
            ("easing_id", self.temporal.easing_id.as_str()),
            ("transition_law_id", self.temporal.transition_law_id.as_str()),
            ("payload.uri", self.payload.uri.as_str()),
            ("payload.media_type", self.payload.media_type.as_str()),
            ("policy_version", self.policy_version.as_str()),
        ] {
            if value.trim().is_empty() { return Err(TweenAtomError::EmptyField(field)); }
        }
        if self.temporal.end_unix_micros < self.temporal.start_unix_micros {
            return Err(TweenAtomError::InvalidTemporalRange);
        }
        if self.payload.sha256_hex.len() != 64
            || !self.payload.sha256_hex.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(TweenAtomError::InvalidSha256);
        }
        if let Some(intent) = &self.compact_intent {
            if intent.tokenizer_id.trim().is_empty() || intent.encoded.trim().is_empty() {
                return Err(TweenAtomError::EmptyField("compact_intent"));
            }
            if intent.token_count != COMPACT_INTENT_TOKEN_TARGET {
                return Err(TweenAtomError::InvalidCompactIntentTokenCount(intent.token_count));
            }
        }
        if self.authority_state != AuthorityState::Pending
            && self.authority_receipt_ref.as_deref().unwrap_or("").trim().is_empty() {
            return Err(TweenAtomError::MissingAuthorityReceipt);
        }
        if self.execution_state != ExecutionState::NotStarted
            && self.authority_state != AuthorityState::Accepted {
            return Err(TweenAtomError::ExecutionBeforeAcceptance);
        }
        if self.execution_state == ExecutionState::Succeeded
            && self.execution_receipt_ref.as_deref().unwrap_or("").trim().is_empty() {
            return Err(TweenAtomError::MissingExecutionReceipt);
        }
        Ok(())
    }

    /// Advance a version only after the caller has durably recorded a new state.
    /// This method does not write the ledger or authorize a state transition.
    pub fn next_generation(&self) -> Result<u64, TweenAtomError> {
        self.generation.checked_add(1).ok_or(TweenAtomError::GenerationOverflow)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn atom() -> TweenAtom {
        TweenAtom {
            schema_version: TWEENATOM_SCHEMA_VERSION,
            id: TweenAtomId([1; 16]),
            stream_id: TweenAtomId([2; 16]),
            generation: 1,
            predecessor: None,
            successor: None,
            capability_id: "memory.ingest".into(),
            intent_kind: "observation.proposal".into(),
            compact_intent: Some(CompactIntent {
                tokenizer_id: "ava007-intent-tokenizer@sha256:fixture".into(),
                token_count: COMPACT_INTENT_TOKEN_TARGET,
                encoded: "[AGENT:AVA007][INTENT:INGEST][MODE:PROPOSE]".into(),
            }),
            temporal: TemporalTransition {
                start_unix_micros: 100, end_unix_micros: 200,
                easing_id: "linear".into(), transition_law_id: "gsap.transition.v1".into(),
            },
            payload: PayloadReference {
                uri: "duckdb://source/atom/fixture-1".into(),
                sha256_hex: "a".repeat(64), media_type: "application/json".into(),
            },
            source_refs: vec!["source:fixture-1".into()],
            policy_version: "policy:fixture-v1".into(),
            authority_state: AuthorityState::Pending,
            authority_receipt_ref: None,
            execution_state: ExecutionState::NotStarted,
            execution_receipt_ref: None,
        }
    }

    #[test]
    fn valid_pending_atom_preserves_53_token_intent_and_provenance() {
        let a = atom();
        assert_eq!(a.validate(), Ok(()));
        assert_eq!(a.compact_intent.as_ref().unwrap().token_count, 53);
        assert_eq!(a.source_refs.len(), 1);
    }
    #[test]
    fn accepted_atom_requires_authority_receipt() {
        let mut a = atom(); a.authority_state = AuthorityState::Accepted;
        assert_eq!(a.validate(), Err(TweenAtomError::MissingAuthorityReceipt));
    }
    #[test]
    fn execution_cannot_start_before_ava007_acceptance() {
        let mut a = atom(); a.execution_state = ExecutionState::Running;
        assert_eq!(a.validate(), Err(TweenAtomError::ExecutionBeforeAcceptance));
    }
    #[test]
    fn successful_execution_requires_receipt() {
        let mut a = atom();
        a.authority_state = AuthorityState::Accepted;
        a.authority_receipt_ref = Some("ava007-receipt:1".into());
        a.execution_state = ExecutionState::Succeeded;
        assert_eq!(a.validate(), Err(TweenAtomError::MissingExecutionReceipt));
    }
    #[test]
    fn rejects_invalid_digest_and_temporal_range() {
        let mut a = atom(); a.payload.sha256_hex = "not-a-digest".into();
        assert_eq!(a.validate(), Err(TweenAtomError::InvalidSha256));
        let mut a = atom(); a.temporal.end_unix_micros = 99;
        assert_eq!(a.validate(), Err(TweenAtomError::InvalidTemporalRange));
    }
    #[test]
    fn generation_is_monotonic_and_overflow_checked() {
        let mut a = atom();
        assert_eq!(a.next_generation(), Ok(2));
        a.generation = u64::MAX;
        assert_eq!(a.next_generation(), Err(TweenAtomError::GenerationOverflow));
    }
}

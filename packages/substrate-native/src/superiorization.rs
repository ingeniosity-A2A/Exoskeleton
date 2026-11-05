//! Feasibility-preserving objective candidate filter.
//! This is not a reproduction of the convergence proof in arXiv:2401.18030.

#[derive(Debug, Clone, PartialEq)]
pub enum PolicyAction { Hold, Reallocate { prb_count:u32 }, Handover { target_cell:u32 }, Drop { ue_id:u32 } }
#[derive(Debug, Clone, PartialEq)]
pub struct FeasiblePolicy { pub action:PolicyAction, pub objective:f64, pub safety_margin:f64, pub generation:u64 }

pub fn superiorize(base:&FeasiblePolicy, candidates:&[FeasiblePolicy], min_margin_fraction:f64)->FeasiblePolicy {
    if !base.objective.is_finite() || !base.safety_margin.is_finite() || base.safety_margin<=0.0
        || !min_margin_fraction.is_finite() || !(0.0..=1.0).contains(&min_margin_fraction) {
        return base.clone();
    }
    let required=base.safety_margin*min_margin_fraction;
    let mut best=base.clone();
    for c in candidates {
        if c.objective.is_finite() && c.safety_margin.is_finite() && c.safety_margin>0.0
            && c.safety_margin>=required && c.objective>best.objective && c.generation>=base.generation {
            best=c.clone();
        }
    }
    best
}
#[cfg(test)] mod tests {
    use super::*;
    fn p(o:f64,m:f64,g:u64)->FeasiblePolicy { FeasiblePolicy{action:PolicyAction::Hold,objective:o,safety_margin:m,generation:g} }
    #[test] fn accepts_better_safe_candidate(){assert_eq!(superiorize(&p(2.0,1.0,1),&[p(2.5,0.9,1)],0.8).objective,2.5);}
    #[test] fn rejects_unsafe_stale_and_low_margin(){let b=p(2.0,1.0,2);let c=[p(3.0,-0.1,2),p(2.8,0.3,2),p(2.7,0.9,1)];assert_eq!(superiorize(&b,&c,0.8),b);}
}

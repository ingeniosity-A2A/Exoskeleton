//! Transport-independent weighted-neighbor update prototype.
//! No quasi-Fejer convergence guarantee is claimed. A production algorithm
//! must encode graph assumptions, mixing weights, clocks, loss model and proof conditions.

#[derive(Debug,Clone,PartialEq)]
pub struct NodeEstimate { pub node_id:String, pub state_vector:Vec<f64>, pub confidence:f64, pub generation:u64, pub timestamp_ms:u64 }
#[derive(Debug,Clone,PartialEq)]
pub struct ConsensusStep { pub estimate:Vec<f64>, pub delta_norm:f64, pub accepted_neighbors:usize }
#[derive(Debug,Clone,PartialEq)]
pub enum ConsensusError { EmptyLocalState, InvalidLocal, DimensionMismatch, NoUsableNeighbors }

pub fn weighted_neighbor_step(local:&NodeEstimate, peers:&[NodeEstimate])->Result<ConsensusStep,ConsensusError>{
    if local.state_vector.is_empty(){return Err(ConsensusError::EmptyLocalState);}
    if !valid(local){return Err(ConsensusError::InvalidLocal);}
    let mut sums:Vec<f64>=local.state_vector.iter().map(|v|v*local.confidence).collect();
    let mut total=local.confidence; let mut accepted=0;
    for p in peers {
        if !valid(p){continue;}
        if p.state_vector.len()!=local.state_vector.len(){return Err(ConsensusError::DimensionMismatch);}
        if p.generation<local.generation{continue;}
        for (s,v) in sums.iter_mut().zip(&p.state_vector){*s+=v*p.confidence;}
        total+=p.confidence; accepted+=1;
    }
    if accepted==0{return Err(ConsensusError::NoUsableNeighbors);}
    let estimate:Vec<f64>=sums.into_iter().map(|v|v/total).collect();
    let delta_norm=local.state_vector.iter().zip(&estimate).map(|(a,b)|(a-b).powi(2)).sum::<f64>().sqrt();
    Ok(ConsensusStep{estimate,delta_norm,accepted_neighbors:accepted})
}
fn valid(n:&NodeEstimate)->bool{n.confidence.is_finite()&&n.confidence>0.0&&n.state_vector.iter().all(|v|v.is_finite())}
#[cfg(test)] mod tests {
    use super::*;
    fn n(id:&str,x:Vec<f64>,w:f64,g:u64)->NodeEstimate{NodeEstimate{node_id:id.into(),state_vector:x,confidence:w,generation:g,timestamp_ms:0}}
    #[test] fn computes_weighted_neighbor_step(){let r=weighted_neighbor_step(&n("a",vec![1.0],1.0,1),&[n("b",vec![5.0],3.0,1)]).unwrap();assert_eq!(r.estimate,vec![4.0]);}
    #[test] fn rejects_dimension_mismatch_and_stale_only_peers(){let a=n("a",vec![1.0],1.0,2);assert_eq!(weighted_neighbor_step(&a,&[n("b",vec![1.0,2.0],1.0,2)]),Err(ConsensusError::DimensionMismatch));assert_eq!(weighted_neighbor_step(&a,&[n("old",vec![2.0],1.0,1)]),Err(ConsensusError::NoUsableNeighbors));}
}

//! Digital packet aggregation helper, NOT physical over-the-air computation.
//! OTA-C requires a shared wireless channel, analog modulation/synchronization,
//! channel estimation, power control and an error model; Rustunnel packet sums
//! do not implement those physical-layer mechanisms.

#[derive(Debug,Clone,PartialEq)]
pub struct Contribution { pub node_id:String, pub measurement:Vec<f64>, pub weight:f64, pub generation:u64 }
#[derive(Debug,Clone,PartialEq)]
pub struct Aggregate { pub weighted_mean:Vec<f64>, pub min_value:Vec<f64>, pub max_value:Vec<f64>, pub node_count:usize, pub generation:u64 }
#[derive(Debug,Clone,PartialEq)]
pub enum AggregateError { EmptyInput, EmptyMeasurement, DimensionMismatch, InvalidValue }

pub fn aggregate_received_packets(items:&[Contribution])->Result<Aggregate,AggregateError>{
    let first=items.first().ok_or(AggregateError::EmptyInput)?;
    let dim=first.measurement.len(); if dim==0{return Err(AggregateError::EmptyMeasurement);}
    let mut sum=vec![0.0;dim]; let mut min=vec![f64::INFINITY;dim]; let mut max=vec![f64::NEG_INFINITY;dim];
    let mut total=0.0; let mut generation=first.generation;
    for item in items {
        if item.measurement.len()!=dim{return Err(AggregateError::DimensionMismatch);}
        if !item.weight.is_finite()||item.weight<=0.0||!item.measurement.iter().all(|v|v.is_finite()){return Err(AggregateError::InvalidValue);}
        total+=item.weight; generation=generation.max(item.generation);
        for i in 0..dim {sum[i]+=item.measurement[i]*item.weight;min[i]=min[i].min(item.measurement[i]);max[i]=max[i].max(item.measurement[i]);}
    }
    if !total.is_finite()||total<=0.0{return Err(AggregateError::InvalidValue);}
    Ok(Aggregate{weighted_mean:sum.into_iter().map(|v|v/total).collect(),min_value:min,max_value:max,node_count:items.len(),generation})
}
#[cfg(test)] mod tests {
    use super::*;
    fn c(id:&str,v:Vec<f64>,w:f64)->Contribution{Contribution{node_id:id.into(),measurement:v,weight:w,generation:1}}
    #[test] fn aggregates_mean_min_max(){let a=aggregate_received_packets(&[c("a",vec![1.0,2.0],1.0),c("b",vec![3.0,4.0],1.0)]).unwrap();assert_eq!(a.weighted_mean,vec![2.0,3.0]);assert_eq!(a.min_value,vec![1.0,2.0]);assert_eq!(a.max_value,vec![3.0,4.0]);}
    #[test] fn rejects_bad_input(){assert_eq!(aggregate_received_packets(&[c("a",vec![1.0],0.0)]),Err(AggregateError::InvalidValue));assert_eq!(aggregate_received_packets(&[c("a",vec![1.0],1.0),c("b",vec![1.0,2.0],1.0)]),Err(AggregateError::DimensionMismatch));}
}

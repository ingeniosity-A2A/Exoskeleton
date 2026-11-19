import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const runner = new URL("../scripts/benchmark-gate.mjs", import.meta.url).pathname;
const base = {schemaVersion:"1.0.0",benchmarkId:"unit-smoke",domain:"code",repository:"ingeniosity-A2A/Exoskeleton",commit:"abcdef1234567",timestamp:"2026-10-24T00:00:00.000Z",environment:{os:"linux",architecture:"x64"},status:"PASS",metrics:[{name:"latency",value:110,unit:"ms",baseline:100,lowerIsBetter:true,maxRegressionPercent:15}],checks:[{name:"correctness",status:"PASS"}],artifacts:[]};
function run(r,args=["gate"]) {
 const d=mkdtempSync(join(tmpdir(),"ava007-bench-")), f=join(d,"result.json");
 try { writeFileSync(f,JSON.stringify(r)); return spawnSync(process.execPath,[runner,...args,f],{encoding:"utf8"}); }
 finally { rmSync(d,{recursive:true,force:true}); }
}
test("accepts valid result within regression budget",()=>{const r=run(base);assert.equal(r.status,0,r.stderr);});
test("fails on correctness failure",()=>{const r=run({...base,checks:[{name:"correctness",status:"FAIL"}]});assert.notEqual(r.status,0);assert.match(r.stderr,/correctness.*FAIL/);});
test("fails when metric exceeds regression budget",()=>{const r=run({...base,metrics:[{...base.metrics[0],value:130}]});assert.notEqual(r.status,0);assert.match(r.stderr,/regressed/);});
test("rejects malformed evidence",()=>{const r=run({...base,commit:"x"},["validate"]);assert.notEqual(r.status,0);assert.match(r.stderr,/commit/);});
test("higher-is-better metric detects downward regression",()=>{const r=run({...base,metrics:[{name:"recall",value:.8,baseline:.9,unit:"ratio",lowerIsBetter:false,maxRegressionPercent:5}]});assert.notEqual(r.status,0);assert.match(r.stderr,/regressed/);});

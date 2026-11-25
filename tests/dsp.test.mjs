import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {Engine,nalr,compGain,direction} from '../dist/dsp.js';
const h=JSON.parse(fs.readFileSync('dist/assets/kemar-horizontal.json'));const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} versus ${b}`);
function engine(p={},hrir=false){const e=new Engine();e.configure({snr:60,volume:0,...p});if(hrir)e.setHRIR(h);return e;}
function run(e,x,n=x.length){const l=new Float32Array(n),r=new Float32Array(n);e.master=1;e.process(l,r,x);return[l,r];}
test('normal audiogram produces zero NAL-R gains',()=>assert.deepEqual(nalr([0,0,0,0,0,0]),[0,0,0,0,0,0]));
test('sloping NAL-R targets follow published coefficients',()=>{const g=nalr([10,15,25,40,55,60]);[0,.65,12.75,15.4,19.05,20.6].forEach((v,i)=>close(g[i],v));});
test('severe-loss branch is continuous at 180 dB sum',()=>{close(nalr([60,60,60,60,60,60])[2],28.6);close(nalr([60,61,60,60,60,60])[2],28.716);});
test('compressor gives 2:1 steady-state slope above knee',()=>close(10+compGain(75,55,2)-compGain(65,55,2),5));
test('ratio one has zero compression',()=>close(compGain(90,55,1),0));
test('oracle direction has specified front/back values',()=>{close(direction(0),1);close(direction(180),.15);});
test('unity overlapping filter bank reconstructs signal',()=>{const x=Float32Array.from({length:2000},(_,i)=>.05*Math.sin(i*.11));const [a]=run(engine(),x);const [b]=run(engine({mode:'D',left:[0,0,0,0,0,0],right:[0,0,0,0,0,0],ratio:1}),x);for(let i=0;i<x.length;i++)close(a[i],b[i]);});
test('loss illustration attenuates flat threshold by 35 dB',()=>{const x=Float32Array.from({length:2000},(_,i)=>.05*Math.sin(i*.11));const [a]=run(engine(),x);const [b]=run(engine({mode:'B',left:[35,35,35,35,35,35],right:[35,35,35,35,35,35]}),x);for(let i=0;i<x.length;i++)close(b[i],a[i]*10**(-35/20));});
test('five ms delay shifts an impulse by 221 samples at 44.1 kHz',()=>{const x=new Float32Array(600);x[0]=.1;const [a]=run(engine({mode:'D',ratio:1,left:[0,0,0,0,0,0],right:[0,0,0,0,0,0],delay:5}),x);close(a[221],.1);close(a[0],0);});
test('output ceiling remains finite under large input',()=>{const [a,b]=run(engine({mode:'D'}),new Float32Array(5000).fill(100));assert.ok([...a,...b].every(v=>Number.isFinite(v)&&Math.abs(v)<=.890001));});
test('measured HRIR schema has 37 two-ear 128-tap responses',()=>{assert.equal(h.sample_rate,44100);assert.equal(h.responses.length,37);for(const r of h.responses){assert.equal(r.left.length,128);assert.equal(r.right.length,128);}});
test('measured impulse reproduces reference taps exactly',()=>{const x=new Float32Array(256);x[0]=.1;const [l,r]=run(engine({target:90},true),x);for(let i=0;i<128;i++){close(l[i],h.responses[18].left[i]*.1);close(r[i],h.responses[18].right[i]*.1);}});
test('positive azimuth reaches right ear earlier',()=>{const f=h.responses[18];const peak=a=>a.indexOf(Math.max(...a.map(Math.abs)));const peakabs=a=>a.map(Math.abs).indexOf(Math.max(...a.map(Math.abs)));assert.ok(peakabs(f.right)<peakabs(f.left));});
test('negative azimuth swaps measured ears',()=>{const x=new Float32Array(256);x[0]=.1;const [a,b]=run(engine({target:90},true),x);const [c,d]=run(engine({target:-90},true),x);for(let i=0;i<128;i++){close(a[i],d[i]);close(b[i],c[i]);}});
test('streaming chunk boundaries preserve output and state',()=>{const x=Float32Array.from({length:2048},(_,i)=>.03*Math.sin(i*.2));const a=engine({mode:'D'},true),b=engine({mode:'D'},true);a.master=b.master=1;const [all]=run(a,x);const joined=new Float32Array(x.length);for(let i=0;i<x.length;i+=128){const l=new Float32Array(128),r=new Float32Array(128);b.process(l,r,x.subarray(i,i+128));joined.set(l,i);}for(let i=0;i<x.length;i++)close(all[i],joined[i]);});

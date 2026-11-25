import test from 'node:test';import assert from 'node:assert/strict';
import {Localizer,wrap} from '../dist/localization.js';import {N,steering} from '../dist/array-dsp.js';
function estimate(angle,channels=4,sector=180){const l=new Localizer();l.configure({channels,sector,anchor:0});const re=Array.from({length:4},()=>new Float64Array(N)),im=Array.from({length:4},()=>new Float64Array(N));for(let k=1;k<N/2;k++){let d=steering(angle,k);for(let m=0;m<4;m++){re[m][k]=d[m][0];im[m][k]=d[m][1];}}for(let i=0;i<160;i++)l.process(re,im);return l;}
test('four-microphone SRP localizes synthetic phase vectors across front and rear',()=>{for(let angle of [-150,-60,-20,0,45,130])assert.equal(estimate(angle).direction,angle);});
test('two microphones have front/back ambiguity, exposed as low contrast',()=>{let l=estimate(30,2);assert.ok([30,150].includes(l.direction));assert.ok(l.confidence<1e-10);assert.equal(estimate(30,2,90).direction,30);});
test('silence does not fabricate a DOA',()=>{let l=new Localizer(),x=Array.from({length:4},()=>new Float64Array(N));for(let i=0;i<100;i++)l.process(x,x);assert.equal(l.direction,null);assert.equal(l.valid,false);});
test('DOA state persists across frames and reset clears old target',()=>{let l=estimate(-35);assert.ok(l.updates>1);l.reset();assert.equal(l.direction,null);assert.equal(l.updates,0);assert.equal(wrap(350),-10);});

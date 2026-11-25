import test from 'node:test';import assert from 'node:assert/strict';
let Processor;
globalThis.sampleRate=44100;
globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={onmessage:null,postMessage:(message)=>this.messages.push(message)};}};
globalThis.registerProcessor=(name,cls)=>{assert.equal(name,'hearing-processor');Processor=cls;};
await import('../dist/processor.js');
test('worklet receives sources/config and produces real telemetry',()=>{const p=new Processor();p.port.onmessage({data:{type:'source',index:0,value:new Float32Array(44100).fill(.05)}});p.port.onmessage({data:{type:'config',value:{snr:60}}});for(let i=0;i<64;i++)assert.equal(p.process([],[[new Float32Array(128),new Float32Array(128)]]),true);assert.ok(p.messages.some(x=>x.type==='meter'&&x.left>0&&x.right>0));});
test('worklet records exactly ten seconds of stereo PCM',()=>{const p=new Processor();p.port.onmessage({data:{type:'record'}});for(let i=0;i<3446;i++)p.process([],[[new Float32Array(128),new Float32Array(128)]]);const r=p.messages.find(x=>x.type==='record');assert.ok(r);assert.equal(r.channels.length,2);assert.equal(r.channels[0].length,441000);assert.equal(r.channels[1].length,441000);assert.equal(p.record,null);});
test('worklet reports unsupported HRIR sample rate',()=>{const p=new Processor();p.port.onmessage({data:{type:'hrir',value:{sample_rate:48000}}});assert.ok(p.messages.some(x=>x.type==='error'));});

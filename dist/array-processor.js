import {ArrayEngine} from './array-engine.js';
import {Neural} from './neural.js';
class ArrayProcessor extends AudioWorkletProcessor {
 constructor(){super();this.engine=new ArrayEngine();this.ready=false;this.port.onmessage=({data:d})=>{try{if(d.type==='config')this.engine.configure(d.value);if(d.type==='source')this.engine.scene.sources[d.index]=d.value;if(d.type==='calibrate'){this.engine.beam.calibrate();this.engine.localizer.reset();}if(d.type==='stats')this.port.postMessage({type:'stats',value:this.engine.report()});}catch(e){this.port.postMessage({type:'error',message:e.message});}};if(sampleRate!==48000){this.port.postMessage({type:'error',message:'This experiment requires a 48 kHz AudioContext.'});return;}Neural.create().then(n=>{this.engine.neural=n;this.ready=true;this.port.postMessage({type:'ready'});}).catch(e=>this.port.postMessage({type:'error',message:e.message}));}
 process(inputs,outputs){if(!this.ready)return true;let out=outputs[0];this.engine.process(out[0],out[1]);return true;}
}
registerProcessor('array-processor',ArrayProcessor);

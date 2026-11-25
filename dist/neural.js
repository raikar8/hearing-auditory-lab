import create from './vendor/rnnoise-sync.js';
export class Neural {
 constructor(module){this.module=module;this.states=[module._rnnoise_create(0),module._rnnoise_create(0)];this.ptr=[module._malloc(480*4),module._malloc(480*4)];this.input=[new Float32Array(480),new Float32Array(480)];this.output=[new Float32Array(480),new Float32Array(480)];this.p=0;this.vad=[0,0];}
 static async create(){const m=create();await m.ready;return new Neural(m);}
 reset(){this.p=0;for(let e=0;e<2;e++){this.module._rnnoise_init(this.states[e],0);this.input[e].fill(0);this.output[e].fill(0);}}
 process(channels){const m=this.module;for(let i=0;i<channels[0].length;i++){for(let e=0;e<2;e++){this.input[e][this.p]=channels[e][i]*32768;channels[e][i]=this.output[e][this.p];}if(++this.p===480){for(let e=0;e<2;e++){m.HEAPF32.set(this.input[e],this.ptr[e]/4);this.vad[e]=m._rnnoise_process_frame(this.states[e],this.ptr[e],this.ptr[e]);this.output[e].set(m.HEAPF32.subarray(this.ptr[e]/4,this.ptr[e]/4+480));for(let n=0;n<480;n++)this.output[e][n]/=32768;}this.p=0;}}}
 dispose(){for(let e=0;e<2;e++){this.module._rnnoise_destroy(this.states[e]);this.module._free(this.ptr[e]);}}
}

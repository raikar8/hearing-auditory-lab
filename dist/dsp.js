// Educational reference DSP. See methodology.html and Skills.md for scope.
import {toFullCircle,lookup} from './hrtf.js';
import {feedbackPath,ReceiverHistory,NLMSCanceller,PEMWhitener,FrequencyShifter,RECEIVER_LIMIT,magnitudeBoundMSG} from './feedback.js';
export const FREQ=[250,500,1000,2000,4000,6000];
export const PROFILES={normal:[0,0,0,0,0,0],sloping:[10,15,25,40,55,60],flat:[35,35,35,35,35,35]};
export function nalr(h){if(Math.max(...h)<=0)return h.map(()=>0);const s=h[1]+h[2]+h[3],a=s<=180?.05*s:9+.116*(s-180);return h.map((v,i)=>Math.max(0,a+.31*v+[-17,-8,1,-1,-2,-2][i]));}
export function compGain(level,knee,ratio){return Math.max(0,level-knee)*(1/ratio-1);}
export function direction(angle){return .15+.85*(1+Math.cos(angle*Math.PI/180))/2;}
const db=x=>10**(x/20), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class Engine{
 constructor(fs=44100){this.fs=fs;this.p={mode:'A',left:[...PROFILES.sloping],right:[...PROFILES.sloping],target:0,masker:90,head:0,snr:5,noise:'noise',directional:false,ratio:2,attack:10,release:150,knee:55,delay:0,direct:0,volume:-24,feedback:false,feedbackGain:-25,feedbackVariant:'nominal',afc:false,afcMode:'pem',afcStep:.004,freqShift:0};this.pos=0;this.seed=1234567;this.noise=0;this.sources=[];this.hrir=null;this.rings=[new Float64Array(128),new Float64Array(128)];this.ri=0;this.filters=Array.from({length:4},()=>new Float64Array(128));this.nextFilters=Array.from({length:4},()=>new Float64Array(128));this.filterFade=0;this.lp=[new Float64Array(5),new Float64Array(5)];this.env=[new Float64Array(6),new Float64Array(6)];this.alpha=[354,707,1414,2828,4899].map(f=>1-Math.exp(-2*Math.PI*f/fs));this.delayRing=[new Float64Array(Math.ceil(fs*.02)+1),new Float64Array(Math.ceil(fs*.02)+1)];this.di=0;this.master=db(this.p.volume);this.gains=[nalr(this.p.left),nalr(this.p.right)];this.fbPath=feedbackPath(fs,{gainDb:this.p.feedbackGain,variant:this.p.feedbackVariant});this.rx=[new ReceiverHistory(),new ReceiverHistory()];this.afc=[new NLMSCanceller(),new NLMSCanceller()];this.shift=[new FrequencyShifter(fs),new FrequencyShifter(fs)];this.pem=[new PEMWhitener(fs,16,0),new PEMWhitener(fs,16,256)];this.clips=0;}
 setSource(i,x){this.sources[i]=x;}
 // Accepts half-circle (mirrored KEMAR) or full-circle sets; a replacement set cross-fades over 20 ms.
 setHRIR(x){if(x.sample_rate!==this.fs)throw Error('Measured HRIR requires 44.1 kHz');const first=!this.hrir;this.hrir=toFullCircle(x);this.updateFilters();if(first){for(let i=0;i<4;i++)this.filters[i].set(this.nextFilters[i]);this.filterFade=0;}}
 configure(p){const old=this.p;this.p={...this.p,...p};if(this.p.feedbackGain!==old.feedbackGain||this.p.feedbackVariant!==old.feedbackVariant)this.fbPath=feedbackPath(this.fs,{gainDb:this.p.feedbackGain,variant:this.p.feedbackVariant});if((this.p.afc&&!old.afc)||this.p.afcMode!==old.afcMode){this.afc.forEach(a=>a.reset());this.pem.forEach(w=>w.reset());}if(this.p.feedback!==old.feedback||this.p.afc!==old.afc||this.p.feedbackGain!==old.feedbackGain||this.p.feedbackVariant!==old.feedbackVariant)this.clips=0;if(!this.p.freqShift&&old.freqShift)this.shift.forEach(s=>s.reset());this.gains=[nalr(this.p.left),nalr(this.p.right)];this.updateFilters();}
 updateFilters(){if(!this.hrir)return;for(let s=0;s<2;s++){const f=lookup(this.hrir,((this.p[s?'masker':'target']-this.p.head+540)%360)-180);this.nextFilters[2*s].set(f.left);this.nextFilters[2*s+1].set(f.right);}this.filterFade=Math.round(.02*this.fs);}
 readSource(i){const x=this.sources[i];if(!x?.length)return 0;const n=this.pos%x.length;const fade=Math.min(1,n/220,(x.length-1-n)/220);return x[n]*fade;}
 process(l,r,mic=null){const p=this.p, aided=p.mode==='C'||p.mode==='D', loss=p.mode==='B'||p.mode==='C';const atk=Math.exp(-1/(Math.max(.1,p.attack)*.001*this.fs)), rel=Math.exp(-1/(Math.max(1,p.release)*.001*this.fs));const d=Math.round(p.delay*this.fs/1000), count=l.length;let sumL=0,sumR=0,peak=0;const dirT=aided&&p.directional?direction(p.target-p.head):1,dirN=aided&&p.directional?direction(p.masker-p.head):1;const ng=p.snr>=60?0:db(-p.snr);const desired=db(p.volume),loop=p.mode==='D'&&p.feedback;
 for(let n=0;n<count;n++){
  this.seed=(1664525*this.seed+1013904223)>>>0;const w=(this.seed/4294967296)*2-1;this.noise+=.15*(w-this.noise);
  const a=(mic?mic[n]||0:this.readSource(0))*dirT;
  const b=(p.noise==='speech'?this.readSource(1):this.noise*.304)*ng*dirN;
  this.rings[0][this.ri]=a;this.rings[1][this.ri]=b;
  if(this.filterFade>0){for(let j=0;j<4;j++)for(let k=0;k<128;k++)this.filters[j][k]+=(this.nextFilters[j][k]-this.filters[j][k])/this.filterFade;this.filterFade--;}
  this.master+=(desired-this.master)/(this.fs*.02);
  for(let e=0;e<2;e++){
   let x=0;if(this.hrir){for(let s=0;s<2;s++)for(let k=0;k<128;k++)x+=this.rings[s][(this.ri-k+128)%128]*this.filters[2*s+e][k];}else{x=a+b;}
   let m=x;if(loop)m+=this.rx[e].dot(this.fbPath);const input=loop&&p.afc?m-this.afc[e].estimate(this.rx[e]):m;
   let y=input;if(aided||loss){y=0;let prev=0;for(let band=0;band<6;band++){let val=input;if(band<5){this.lp[e][band]+=this.alpha[band]*(input-this.lp[e][band]);val=this.lp[e][band];}const v=val-prev;prev=val;const abs=Math.abs(v),c=abs>this.env[e][band]?atk:rel;this.env[e][band]=c*this.env[e][band]+(1-c)*abs;const gain=aided?this.gains[e][band]+compGain(100+20*Math.log10(this.env[e][band]+1e-12),p.knee,p.ratio):0;const attenuation=loss?-(e?p.right:p.left)[band]:0;y+=v*db(gain+attenuation);}}
   this.delayRing[e][this.di]=y; if(aided)y=this.delayRing[e][(this.di-d+this.delayRing[e].length)%this.delayRing[e].length];if(loop){if(p.freqShift)y=this.shift[e].process(y,p.freqShift);let howl=false;if(Math.abs(y)>RECEIVER_LIMIT){y=Math.sign(y)*RECEIVER_LIMIT;this.clips++;howl=true;}if(p.afc){if(p.afcMode==='pem'){const w=this.pem[e],mw=w.step(m,input,this.rx[e].ring[this.rx[e].p],howl);this.afc[e].update(w.u,mw-this.afc[e].estimate(w.u),p.afcStep);}else this.afc[e].update(this.rx[e],input,p.afcStep);}this.rx[e].push(y);}
   if(p.mode==='D')y=(1-p.direct)*y+p.direct*x;
   y=clamp(y*this.master,-.89,.89);if(e===0){l[n]=y;sumL+=y*y;}else{r[n]=y;sumR+=y*y;}peak=Math.max(peak,Math.abs(y));
  }this.di=(this.di+1)%this.delayRing[0].length;this.ri=(this.ri+1)%128;this.pos++;
 }
 return {left:Math.sqrt(sumL/count),right:Math.sqrt(sumR/count),peak};}
 // Simulation-only telemetry: uses the true synthetic path, which the canceller never reads.
 feedbackReport(){const p=this.p,active=p.mode==='D'&&p.feedback;return {active,afc:active&&p.afc,afc_mode:p.afcMode,pitch_lag_ms:p.afcMode==='pem'&&this.pem[0].lag?this.pem[0].lag/this.fs*1000:null,pem_bypassed_ms:p.afcMode==='pem'?this.pem[0].bypassed/this.fs*1000:null,path_gain_db:p.feedbackGain,variant:p.feedbackVariant,freq_shift_hz:p.freqShift,receiver_clips:this.clips,misalignment_db:p.afc?this.afc.map(a=>a.misalignmentDb(this.fbPath)):null,msg_bound_db:{without_afc:magnitudeBoundMSG(this.fbPath),with_afc:p.afc?this.afc.map(a=>magnitudeBoundMSG(this.fbPath,a.w)):null}};}
}

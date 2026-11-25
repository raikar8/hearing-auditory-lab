// Educational reference DSP. See methodology.html and Skills.md for scope.
export const FREQ=[250,500,1000,2000,4000,6000];
export const PROFILES={normal:[0,0,0,0,0,0],sloping:[10,15,25,40,55,60],flat:[35,35,35,35,35,35]};
export function nalr(h){if(Math.max(...h)<=0)return h.map(()=>0);const s=h[1]+h[2]+h[3],a=s<=180?.05*s:9+.116*(s-180);return h.map((v,i)=>Math.max(0,a+.31*v+[-17,-8,1,-1,-2,-2][i]));}
export function compGain(level,knee,ratio){return Math.max(0,level-knee)*(1/ratio-1);}
export function direction(angle){return .15+.85*(1+Math.cos(angle*Math.PI/180))/2;}
const db=x=>10**(x/20), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class Engine{
 constructor(fs=44100){this.fs=fs;this.p={mode:'A',left:[...PROFILES.sloping],right:[...PROFILES.sloping],target:0,masker:90,head:0,snr:5,noise:'noise',directional:false,ratio:2,attack:10,release:150,knee:55,delay:0,direct:0,volume:-24};this.pos=0;this.seed=1234567;this.noise=0;this.sources=[];this.hrir=null;this.rings=[new Float64Array(128),new Float64Array(128)];this.ri=0;this.filters=Array.from({length:4},()=>new Float64Array(128));this.nextFilters=Array.from({length:4},()=>new Float64Array(128));this.filterFade=0;this.lp=[new Float64Array(5),new Float64Array(5)];this.env=[new Float64Array(6),new Float64Array(6)];this.alpha=[354,707,1414,2828,4899].map(f=>1-Math.exp(-2*Math.PI*f/fs));this.delayRing=[new Float64Array(Math.ceil(fs*.02)+1),new Float64Array(Math.ceil(fs*.02)+1)];this.di=0;this.master=db(this.p.volume);this.gains=[nalr(this.p.left),nalr(this.p.right)];}
 setSource(i,x){this.sources[i]=x;}
 setHRIR(x){if(x.sample_rate!==this.fs)throw Error('Measured HRIR requires 44.1 kHz');this.hrir=x;this.updateFilters();for(let i=0;i<4;i++)this.filters[i].set(this.nextFilters[i]);this.filterFade=0;}
 configure(p){this.p={...this.p,...p};this.gains=[nalr(this.p.left),nalr(this.p.right)];this.updateFilters();}
 updateFilters(){if(!this.hrir)return;for(let s=0;s<2;s++){let a=((this.p[s?'masker':'target']-this.p.head+540)%360)-180;const f=this.hrir.responses[Math.round(Math.abs(a)/5)];for(let e=0;e<2;e++)this.nextFilters[2*s+e].set(f[(a<0?1-e:e)?'right':'left']);}this.filterFade=Math.round(.02*this.fs);}
 readSource(i){const x=this.sources[i];if(!x?.length)return 0;const n=this.pos%x.length;const fade=Math.min(1,n/220,(x.length-1-n)/220);return x[n]*fade;}
 process(l,r,mic=null){const p=this.p, aided=p.mode==='C'||p.mode==='D', loss=p.mode==='B'||p.mode==='C';const atk=Math.exp(-1/(Math.max(.1,p.attack)*.001*this.fs)), rel=Math.exp(-1/(Math.max(1,p.release)*.001*this.fs));const d=Math.round(p.delay*this.fs/1000), count=l.length;let sumL=0,sumR=0,peak=0;const dirT=aided&&p.directional?direction(p.target-p.head):1,dirN=aided&&p.directional?direction(p.masker-p.head):1;const ng=p.snr>=60?0:db(-p.snr);const desired=db(p.volume);
 for(let n=0;n<count;n++){
  this.seed=(1664525*this.seed+1013904223)>>>0;const w=(this.seed/4294967296)*2-1;this.noise+=.15*(w-this.noise);
  const a=(mic?mic[n]||0:this.readSource(0))*dirT;
  const b=(p.noise==='speech'?this.readSource(1):this.noise*.304)*ng*dirN;
  this.rings[0][this.ri]=a;this.rings[1][this.ri]=b;
  if(this.filterFade>0){for(let j=0;j<4;j++)for(let k=0;k<128;k++)this.filters[j][k]+=(this.nextFilters[j][k]-this.filters[j][k])/this.filterFade;this.filterFade--;}
  this.master+=(desired-this.master)/(this.fs*.02);
  for(let e=0;e<2;e++){
   let x=0;if(this.hrir){for(let s=0;s<2;s++)for(let k=0;k<128;k++)x+=this.rings[s][(this.ri-k+128)%128]*this.filters[2*s+e][k];}else{x=a+b;}
   let y=x;if(aided||loss){y=0;let prev=0;for(let band=0;band<6;band++){let val=x;if(band<5){this.lp[e][band]+=this.alpha[band]*(x-this.lp[e][band]);val=this.lp[e][band];}const v=val-prev;prev=val;const abs=Math.abs(v),c=abs>this.env[e][band]?atk:rel;this.env[e][band]=c*this.env[e][band]+(1-c)*abs;const gain=aided?this.gains[e][band]+compGain(100+20*Math.log10(this.env[e][band]+1e-12),p.knee,p.ratio):0;const attenuation=loss?-(e?p.right:p.left)[band]:0;y+=v*db(gain+attenuation);}}
   this.delayRing[e][this.di]=y; if(aided)y=this.delayRing[e][(this.di-d+this.delayRing[e].length)%this.delayRing[e].length];if(p.mode==='D')y=(1-p.direct)*y+p.direct*x;
   y=clamp(y*this.master,-.89,.89);if(e===0){l[n]=y;sumL+=y*y;}else{r[n]=y;sumR+=y*y;}peak=Math.max(peak,Math.abs(y));
  }this.di=(this.di+1)%this.delayRing[0].length;this.ri=(this.ri+1)%128;this.pos++;
 }
 return {left:Math.sqrt(sumL/count),right:Math.sqrt(sumR/count),peak};}
}

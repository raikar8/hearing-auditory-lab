"""Image-source room scenes. Known geometry is used by the oracle-steered baseline only."""
from pathlib import Path
import json,numpy as np,soundfile as sf,rir_generator as rir
from scipy.signal import fftconvolve,resample_poly
FS=16000;root=Path('research/work');root.mkdir(parents=True,exist_ok=True)
manifest=json.loads(Path('research/data/manifest.json').read_text());rows=[]
centre=np.array([3.,2.5,1.5]);offsets=np.array([[-.09,.008,0],[-.09,-.008,0],[.09,.008,0],[.09,-.008,0]])
for index,clip in enumerate(manifest['clips']):
 x,rate=sf.read(clip['path']);assert rate==FS;x=x[:FS*3];x*=np.minimum(1,np.minimum(np.arange(len(x)),np.arange(len(x))[::-1])/160);x/=max(np.sqrt(np.mean(x*x)),1e-8)
 target=[-30,0,30,60][index];masker=[70,90,-80,-50][index]
 def pos(a):return centre+1.4*np.array([np.sin(np.deg2rad(a)),np.cos(np.deg2rad(a)),0])
 for rt in [0.,.3]:
  kwargs=dict(c=343,fs=FS,r=centre+offsets,L=[6,5,3],nsample=int(FS*.4),hp_filter=False)
  if rt:kwargs['reverberation_time']=rt
  else:kwargs['beta']=np.zeros(6)
  hs=rir.generate(s=pos(target),**kwargs);hn=rir.generate(s=pos(masker),**kwargs)
  target_m=np.stack([fftconvolve(x,hs[:,m])[:len(x)] for m in range(4)])
  scale=10**((65-100)/20)/np.sqrt(np.mean(target_m[0]**2));target_m*=scale
  for snr in [0,5]:
   key=f'{clip["speaker"]}_rt{rt:.1f}_snr{snr}'
   rng=np.random.default_rng(733+index);noise=rng.standard_normal(len(x)+FS)
   nm=np.stack([fftconvolve(noise,hn[:,m])[FS:FS+len(x)] for m in range(4)])
   nm*=np.sqrt(np.mean(target_m[0]**2)/np.mean(nm[0]**2))*10**(-snr/20)
   rng=np.random.default_rng(501+index);ncal=rng.standard_normal(FS*2)
   cm=np.stack([fftconvolve(ncal,hn[:,m])[FS:FS*2] for m in range(4)])
   cm*=np.sqrt(np.mean(nm[0]**2)/np.mean(cm[0]**2))
   mix=target_m+nm
   np.savez(root/(key+'.npz'),mixture=mix,target=target_m,noise=nm)
   for name,v in [('mix',mix),('noise',cm),('target',target_m)]:
    y=resample_poly(v,3,1,axis=1).astype('<f4');y.tofile(root/(key+'_'+name+'.f32'))
   rows.append(dict(id=key,speaker=clip['speaker'],utterance=clip['utterance'],target_deg=target,masker_deg=masker,nominal_rt60_s=rt,snr_left_db=snr,frames_48k=len(x)*3,frames_calibration_48k=FS*3))
json.dump({'fs':FS,'render_fs':48000,'room_m':[6,5,3],'centre_m':centre.tolist(),'offsets_m':offsets.tolist(),'source_distance_m':1.4,'rir_length_s':.4,'rir_generator':'0.3.0 image method; RT60 is requested, not measured','scenes':rows},open(root/'scenes.json','w'),indent=2)
print('Prepared',len(rows),'scenes',flush=True)

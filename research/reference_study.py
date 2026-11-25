"""One-utterance feasibility pilot; not a population or SOTA comparison."""
import json,time,platform,importlib.metadata
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from clarity.utils.audiogram import Audiogram
from clarity.enhancer.nalr import NALR
from clarity.evaluator.msbg.msbg import Ear
from clarity.evaluator.haspi import haspi_v2
root=Path('dist');fs,x=wavfile.read(root/'assets/speech.wav');x=x.astype(float)/32768
x=resample_poly(x,44100,fs);fs=44100;x=x[:fs*8];x=x/np.sqrt(np.mean(x*x))*10**((65-100)/20)
audio=Audiogram(levels=np.array([10,15,25,40,55,60]),frequencies=np.array([250,500,1000,2000,4000,6000]))
nal=NALR(220,fs);fir,_=nal.build(audio);delay=110
rng=np.random.default_rng(20261125);noise=rng.normal(size=x.shape);noise/=np.sqrt(np.mean(noise**2))
rows=[]
for snr in [0,5,10,15,None]:
 y=x.copy() if snr is None else x+noise*np.sqrt(np.mean(x*x))*10**(-snr/20)
 z=np.convolve(y,fir)[delay:delay+len(y)]
 scores=[]
 for signal in [y,z]:
  np.random.seed(20261125)
  score,_=haspi_v2(x,fs,signal,fs,audio,level1=100.0);scores.append(float(score))
 rows.append({'snr_db':snr,'unaided_haspi':scores[0],'nalr_haspi':scores[1],'nalr_peak':float(np.max(np.abs(z)))})
 print(rows[-1],flush=True)
# Listening illustrations use the established MSBG implementation separately.
# HASPI above already includes an auditory model; do not score MSBG outputs again.
out=root/'assets/reference';out.mkdir(exist_ok=True)
for name,signal in [('normal-reference',x),('msbg-unaided',x),('msbg-nalr',np.convolve(x,fir)[delay:delay+len(x)])]:
 if name!='normal-reference':
  ear=Ear(src_pos='ff',sample_rate=fs,equiv_0db_spl=100,ahr=0);ear.set_audiogram(audio);signal=ear.process(signal)[0]
 # Common playback gain; any actual clipping is recorded below, not normalized per condition.
 wavfile.write(out/(name+'.wav'),fs,(np.clip(signal*.5,-1,1)*32767).astype(np.int16))
result={'scope':'single short LibriSpeech utterance, monaural free field, stationary white noise; pilot only','utterance':'6930-75918-0000','duration_s':len(x)/fs,'sample_rate':fs,'reference_spl':65,'equiv_0db_spl':100,'audiogram_db_hl':audio.levels.tolist(),'seed':20261125,'nfir_order':220,'offline_alignment_samples':110,'nalr_group_delay_ms':110/fs*1000,'limiter_in_scores':False,'model':'HASPI v2; pyclarity 0.9.0','versions':{k:importlib.metadata.version(k) for k in ['pyclarity','numpy','scipy','numba']},'rows':rows}
(root/'reference-results.json').write_text(json.dumps(result,indent=2))

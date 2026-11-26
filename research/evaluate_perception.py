"""Matched downstream NAL-R, per-ear HASPI/HASQI, distortion and spatial diagnostics.
No independent per-condition normalization. The target ear image (including room)
is the reference: this evaluates enhancement, not dereverberation of dry speech.
"""
from pathlib import Path
import json,time,platform,resource,importlib.metadata,sys
import numpy as np,soundfile as sf
from scipy.signal import resample_poly,fftconvolve,stft
from clarity.utils.audiogram import Audiogram
from clarity.enhancer.nalr import NALR
from clarity.evaluator.haspi import haspi_v2
from clarity.evaluator.hasqi import hasqi_v2
FS=16000;root=Path('research/work');manifest=json.loads((root/'scenes.json').read_text());render=json.loads((root/'render-meta.json').read_text());meta={(r['scene'],r['method']):r for r in render}
methods=['reference','das','mvdr_known','mvdr_estimated','mvdr_rnnoise','neural_mvdr'];rows=[];crop=slice(3200,None)
audiogram=Audiogram(levels=np.array([10,15,25,40,55,60]),frequencies=np.array([250,500,1000,2000,4000,6000]));nal=NALR(220,FS);fir,_=nal.build(audiogram)
def fit(y):return np.stack([fftconvolve(c,fir)[110:110+len(c)] for c in y])
def read48(path):return resample_poly(np.fromfile(path,dtype='<f4').reshape(-1,2).T,1,3,axis=1)
from eval_metrics import sisdr,cues
out=Path('dist/assets/evaluation');out.mkdir(exist_ok=True,parents=True)
result={'version':'0.4','scope':'Four lab-held-out LibriSpeech test speakers; 16 synthetic stationary scenes, 96 method/scenario rows. Not clinical validation or a SOTA ranking. No guarantees of speaker disjointness from every third-party model training source.','config':{**{k:v for k,v in manifest.items() if k!='scenes'},'audiogram_db_hl':audiogram.levels.tolist(),'equiv_0db_spl':100,'target_reference_left_spl':65,'fitting':'Exact Clarity NAL-R FIR order 220, 110-sample delay removed offline; equal fitting and ±0.89 digital ceiling for all methods','metric_reference':'Reverberant target-only ear image at microphones 0 and 2; not dry speech','hasqi_equalisation':1,'discard_initial_s':.2,'neural_beamformer':'Offline pretrained MetricGAN+ mask proxy + Souden MVDR, whole-utterance statistics','cue_metrics':'Mixture-output vs target-image ILD 300–4000 Hz and integer GCC-PHAT ITD 300–1500 Hz (62.5 us resolution); not human localization error'},'versions':{k:importlib.metadata.version(k) for k in ['numpy','scipy','pyclarity','torch','speechbrain','rir-generator']},'speakers':json.loads(Path('research/data/manifest.json').read_text()),'rows':rows}
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--scene-index',type=int);parser.add_argument('--output',default='dist/perceptual-evaluation.json');args=parser.parse_args()
selected=manifest['scenes'] if args.scene_index is None else [manifest['scenes'][args.scene_index]]
for scene in selected:
 ref=np.load(root/(scene['id']+'.npz'))['target'][[0,2]];rc=ref[:,crop];refcues=cues(rc);fitted_ref=fit(ref)
 for method in methods:
  y=np.load(root/(scene['id']+'_neural_mvdr.npy')) if method=='neural_mvdr' else read48(root/(scene['id']+'_'+method+'.f32'))
  y=y[:,:ref.shape[-1]];yc=y[:,crop];c=cues(yc);fy=fit(y);clipping=float(np.mean(abs(fy)>.89));fy=np.clip(fy,-.89,.89)
  start=time.perf_counter();ears=[]
  for e in range(2):
   np.random.seed(20261125);h,_=haspi_v2(rc[e],FS,fy[e,crop],FS,audiogram,level1=100.)
   np.random.seed(20261125);q,*_=hasqi_v2(rc[e],FS,fy[e,crop],FS,audiogram,equalisation=1,level1=100.)
   ears.append({'haspi_v2':float(h),'hasqi_v2':float(q),'si_sdr_db':sisdr(rc[e],yc[e]),'output_level_change_db':float(10*np.log10((np.mean(yc[e]**2)+1e-20)/(np.mean(rc[e]**2)+1e-20)))})
  row={**scene,'method':method,'ears':ears,'ild_error_db':float(abs(c[0]-refcues[0])),'itd_error_us':float(abs(c[1]-refcues[1])),'clip_fraction_after_fitting':clipping,'metric_compute_s':time.perf_counter()-start}
  if method!='neural_mvdr':
   r=meta[scene['id'],method];row.update({k:r[k] for k in ['algorithmic_delay_ms','doa_mean_absolute_error_deg','doa_within_10deg_fraction']})
  else:row['algorithmic_delay_ms']=None
  targetfile=root/(scene['id']+'_'+method+'_targetout.f32')
  if targetfile.exists():
   target=read48(targetfile)[:,crop];noise=yc-target
   row['target_only']={'si_sdr_db':[sisdr(rc[e],target[e]) for e in range(2)],'level_change_db':[float(10*np.log10((np.mean(target[e]**2)+1e-20)/(np.mean(rc[e]**2)+1e-20))) for e in range(2)],'output_snr_db':[float(10*np.log10((np.mean(target[e]**2)+1e-20)/(np.mean(noise[e]**2)+1e-20))) for e in range(2)]}
  if scene['speaker']==manifest['scenes'][0]['speaker'] and scene['nominal_rt60_s']==.3 and scene['snr_left_db']==0:
   file=out/(method+'.wav');sf.write(file,(fy*.5).T,FS,subtype='PCM_16');row['audio']=str(file.relative_to('dist'))
  rows.append(row);print(scene['id'],method,round(ears[0]['haspi_v2'],3),round(ears[0]['hasqi_v2'],3),round(row['metric_compute_s'],2),'s',flush=True)
  result['completed_rows']=len(rows);result['complete']=len(rows)==len(manifest['scenes'])*len(methods);result['peak_process_rss_bytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
  Path(args.output).write_text(json.dumps(result,indent=2,allow_nan=False))

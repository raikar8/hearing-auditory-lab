"""Offline MetricGAN+ mask proxy + Souden MVDR; no clean stems/DOA used in inference.
This hybrid uses a published pretrained single-channel enhancer, not a retrained or
reproduced Heymann model. Its bidirectional LSTM and utterance PSD are noncausal.
"""
from pathlib import Path
import time,hashlib,json,platform,resource
import torch,numpy as np
from speechbrain.lobes.models.MetricGAN import EnhancementGenerator
REVISION='a196ce26b3bdace6fa1d819017584bdbcce462a8'
class NeuralMVDR:
 def __init__(self,path='research/models/enhance_model.ckpt'):
  torch.set_num_threads(1);start=time.perf_counter()
  self.model=EnhancementGenerator(input_size=257,hidden_size=200,num_layers=2,dropout=0)
  self.model.load_state_dict(torch.load(path,map_location='cpu',weights_only=True));self.model.eval()
  self.window=torch.hamming_window(512);self.load_ms=(time.perf_counter()-start)*1000
  self.provenance={'model':'speechbrain/metricgan-plus-voicebank','revision':REVISION,'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'weight_file_bytes':Path(path).stat().st_size,'parameters':sum(p.numel() for p in self.model.parameters()),'parameter_bytes':sum(p.numel()*p.element_size() for p in self.model.parameters()),'load_ms':self.load_ms,'license':'Apache-2.0','scope':'Offline log-magnitude mask converted to power ratio, then multichannel Souden MVDR. Not original-paper beamformer weights.'}
 @torch.inference_mode()
 def process(self,mixture):
  times={};start=time.perf_counter();x=torch.as_tensor(mixture,dtype=torch.float32)
  X=torch.stft(x,n_fft=512,hop_length=256,win_length=512,window=self.window,center=True,return_complex=True)
  times['stft_ms']=(time.perf_counter()-start)*1000;t=time.perf_counter()
  features=torch.log1p(X[0].abs()).T.unsqueeze(0)
  logmask=self.model(features,torch.ones(1))[0].T
  estimate=torch.expm1(logmask*torch.log1p(X[0].abs()))
  mask=(estimate/(X[0].abs()+1e-8)).square().clamp(.001,.999)
  times['network_and_mask_ms']=(time.perf_counter()-t)*1000;t=time.perf_counter()
  # Frequency × time × channels; normalized masked covariance.
  Z=X.permute(1,2,0).to(torch.complex128);ms=mask.double();mn=1-ms
  Rs=torch.einsum('ft,ftm,ftn->fmn',ms,Z,Z.conj())/(ms.sum(1)[:,None,None]+1e-12)
  Rn=torch.einsum('ft,ftm,ftn->fmn',mn,Z,Z.conj())/(mn.sum(1)[:,None,None]+1e-12)
  loading=(Rn.diagonal(dim1=-2,dim2=-1).real.sum(-1)*.01/4).clamp_min(1e-10)
  A=torch.linalg.solve(Rn+loading[:,None,None]*torch.eye(4),Rs)
  denominator=A.diagonal(dim1=-2,dim2=-1).sum(-1).real.clamp_min(1e-12)
  W=A[:,:,[0,2]]/denominator[:,None,None]
  Y=torch.einsum('fme,ftm->eft',W.conj(),Z).to(torch.complex64)
  times['covariance_and_solve_ms']=(time.perf_counter()-t)*1000;t=time.perf_counter()
  y=torch.istft(Y,n_fft=512,hop_length=256,win_length=512,window=self.window,center=True,length=x.shape[-1])
  times['istft_ms']=(time.perf_counter()-t)*1000;times['total_ms']=(time.perf_counter()-start)*1000
  return y.numpy().astype(float),times
if __name__=='__main__':
 m=NeuralMVDR();root=Path('research/work');scenes=json.loads((root/'scenes.json').read_text())['scenes'];rows=[]
 m.process(np.load(root/(scenes[0]['id']+'.npz'))['mixture']) # warm inference; no reload
 for s in scenes:
  x=np.load(root/(s['id']+'.npz'))['mixture'];y,t=m.process(x);np.save(root/(s['id']+'_neural_mvdr.npy'),y);rows.append({'scene':s['id'],'timings':t,'rtf':t['total_ms']/(x.shape[-1]/16),'offline_context_seconds':x.shape[-1]/16000,'algorithmic_delay_ms':None});print(s['id'],round(t['total_ms'],2),flush=True)
 Path('dist/neural-beamformer-runtime.json').write_text(json.dumps({'provenance':m.provenance,'host':platform.platform(),'cpu':next((line.split(':',1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')),platform.processor()) if Path('/proc/cpuinfo').exists() else platform.processor(),'torch_version':torch.__version__,'peak_process_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,'timing_protocol':'One warm-up inference, then 16 clips sequentially; one Torch CPU thread; checkpoint loaded once. No intentional concurrent research jobs. RSS includes Python, Torch, SpeechBrain and activations.','scope':'16 kHz offline full-utterance neural mask-based MVDR, two output ears. RTF is throughput, not streaming latency. Single CPU thread, initialized once.','rows':rows},indent=2))

"""Restore public assets with attribution. Run from repository root."""
import io,json,tarfile,urllib.request,zipfile,hashlib
from pathlib import Path
import numpy as np
from scipy.io import wavfile
import soundfile as sf
out=Path('dist/assets');out.mkdir(parents=True,exist_ok=True)
kemar=Path('kemar.zip')
if not kemar.exists(): urllib.request.urlretrieve('https://sound.media.mit.edu/resources/KEMAR/compact.zip',kemar)
responses=[]
with zipfile.ZipFile(kemar) as z:
 for angle in range(0,181,5):
  fs,x=wavfile.read(io.BytesIO(z.read(f'elev0/H0e{angle:03d}a.wav')))
  assert fs==44100 and x.shape==(128,2)
  responses.append({'azimuth':angle,'left':(x[:,0]/32768).tolist(),'right':(x[:,1]/32768).tolist()})
(out/'kemar-horizontal.json').write_text(json.dumps({'sample_rate':44100,'source':'MIT KEMAR compact, Gardner & Martin (1994/1995)','responses':responses}))
ids={'6930-75918-0000':'speech','6930-75918-0007':'interferer'}
with urllib.request.urlopen('https://www.openslr.org/resources/12/test-clean.tar.gz',timeout=120) as stream:
 with tarfile.open(fileobj=stream,mode='r|gz') as tar:
  for member in tar:
   key=Path(member.name).stem
   if key in ids and member.name.endswith('.flac'):
    data=tar.extractfile(member).read();(out/(ids[key]+'.flac')).write_bytes(data)
    x,fs=sf.read(io.BytesIO(data));sf.write(out/(ids[key]+'.wav'),x,fs,subtype='PCM_16')
    del ids[key]
    if not ids: break
assert not ids
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file() and p.name!='sha256.json'}
(out/'sha256.json').write_text(json.dumps(manifest,indent=2))
print('Restored measured HRIRs and two LibriSpeech passages.')

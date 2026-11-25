"""Download only the pinned checkpoint; verify bytes before loading weights."""
from pathlib import Path
import hashlib,urllib.request
REVISION='a196ce26b3bdace6fa1d819017584bdbcce462a8'
SHA='147bfb866bac8264603546e035bf283370e716ed2f4b7412d308d2bcee88304f'
p=Path('research/models/enhance_model.ckpt');p.parent.mkdir(parents=True,exist_ok=True)
if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=SHA:
 data=urllib.request.urlopen(f'https://huggingface.co/speechbrain/metricgan-plus-voicebank/resolve/{REVISION}/enhance_model.ckpt',timeout=120).read()
 assert hashlib.sha256(data).hexdigest()==SHA, 'Checkpoint hash mismatch'
 p.write_bytes(data)
print('Verified checkpoint',SHA)

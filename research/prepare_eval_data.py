"""Select four test-clean speakers, one utterance each; never tune on these clips."""
import urllib.request,tarfile,io,json,hashlib
from pathlib import Path
import soundfile as sf
root=Path('research/data');root.mkdir(exist_ok=True,parents=True)
if (root/'manifest.json').exists():
 manifest=json.loads((root/'manifest.json').read_text());needed={r['utterance']:r for r in manifest['clips'] if not Path(r['path']).exists() or hashlib.sha256(Path(r['path']).read_bytes()).hexdigest()!=r['sha256']}
 if not needed:
  print('All locked clips verified');raise SystemExit
 with urllib.request.urlopen('https://www.openslr.org/resources/12/test-clean.tar.gz',timeout=120) as stream:
  with tarfile.open(fileobj=stream,mode='r|gz') as tar:
   for member in tar:
    key=Path(member.name).stem
    if not member.name.endswith('.flac') or key not in needed:continue
    raw=tar.extractfile(member).read();row=needed[key]
    assert hashlib.sha256(raw).hexdigest()==row['sha256'], 'Locked clip checksum mismatch'
    Path(row['path']).write_bytes(raw);del needed[key];print('Restored',key,flush=True)
    if not needed:break
 assert not needed, 'Missing locked clips in source archive'
 raise SystemExit
rows=[];seen={'6930'}
with urllib.request.urlopen('https://www.openslr.org/resources/12/test-clean.tar.gz',timeout=120) as stream:
 with tarfile.open(fileobj=stream,mode='r|gz') as tar:
  for member in tar:
   if not member.name.endswith('.flac'):continue
   key=Path(member.name).stem;speaker=key.split('-')[0]
   if speaker in seen:continue
   raw=tar.extractfile(member).read();x,fs=sf.read(io.BytesIO(raw))
   if len(x)<fs*3:continue
   path=root/(key+'.flac');path.write_bytes(raw);seen.add(speaker)
   rows.append({'utterance':key,'speaker':speaker,'path':str(path),'sample_rate':fs,'original_seconds':len(x)/fs,'sha256':hashlib.sha256(raw).hexdigest()});print(key,flush=True)
   if len(rows)==4:break
assert len(rows)==4
(root/'manifest.json').write_text(json.dumps({'dataset':'LibriSpeech test-clean','license':'CC BY 4.0','source':'https://www.openslr.org/12','selection':'First four distinct speakers in archive order with >=3 s, excluding original demo speaker 6930; first 3 s used; no tuning','clips':rows},indent=2))

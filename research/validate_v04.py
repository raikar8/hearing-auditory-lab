"""Check stored result completeness and audio integrity without rerunning scoring."""
from pathlib import Path
import json,math,wave,hashlib
root=Path('dist');d=json.loads((root/'perceptual-evaluation.json').read_text());assert d['complete'] and d['completed_rows']==len(d['rows'])==96
assert len({(r['id'],r['method']) for r in d['rows']})==96
assert len({r['speaker'] for r in d['rows']})==4
for r in d['rows']:
 for e in r['ears']:
  assert 0<=e['haspi_v2']<=1 and 0<=e['hasqi_v2']<=1
  assert all(math.isfinite(x) for x in e.values())
 assert math.isfinite(r['ild_error_db']) and math.isfinite(r['itd_error_us'])
 if r['method']=='neural_mvdr':assert r['algorithmic_delay_ms'] is None
 else:assert r['algorithmic_delay_ms']>0
clips=[]
for p in sorted((root/'assets/evaluation').glob('*.wav')):
 with wave.open(str(p)) as w:assert w.getnchannels()==2 and w.getframerate()==16000 and w.getnframes()==48000
 clips.append({'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'license':'CC BY 4.0; see THIRD_PARTY.md'})
assert len(clips)==6
(root/'assets/evaluation/manifest.json').write_text(json.dumps({'source_utterance':'1320-122617-0003','common_playback_gain':.5,'clips':clips},indent=2))
assert len(json.loads((root/'localization-evaluation.json').read_text())['rows'])==16
b=json.loads((root/'array-benchmark-v04.json').read_text());assert len(b['runs'])==12
assert all('localization_numeric_bytes' in r['memory'] for r in b['runs'])
print('96 complete finite rows; six stereo clips; 16 DOA cases; 12 benchmark modes')

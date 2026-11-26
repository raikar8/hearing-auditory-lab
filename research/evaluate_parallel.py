"""Score independent scenes in bounded workers; preserve ordered complete output."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,subprocess,sys,os,argparse
p=argparse.ArgumentParser();p.add_argument('--workers',type=int,default=4);args=p.parse_args();assert 1<=args.workers<=8
root=Path('research/work');scenes=json.loads((root/'scenes.json').read_text())['scenes']
env={**os.environ,'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','NUMBA_NUM_THREADS':'1'}
def score(i):
 path=root/f'scores-{i}.json'
 with (root/f'scores-{i}.log').open('w') as log:
  subprocess.run([sys.executable,'research/evaluate_perception.py','--scene-index',str(i),'--output',str(path)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 value=json.loads(path.read_text());assert len(value['rows'])==6
 print('Completed scene',i+1,'of',len(scenes),flush=True);return value
with ThreadPoolExecutor(max_workers=args.workers) as pool:parts=list(pool.map(score,range(len(scenes))))
result=parts[0];result['rows']=[row for part in parts for row in part['rows']];result['completed_rows']=len(result['rows']);result['complete']=len(result['rows'])==len(scenes)*6
result['peak_process_rss_bytes']=max(part['peak_process_rss_bytes'] for part in parts)
result['scoring_execution']={'workers':args.workers,'rss_scope':'Maximum individual scoring-worker RSS; not sum of concurrent workers','worker_math_threads':1}
Path('dist/perceptual-evaluation.json').write_text(json.dumps(result,indent=2,allow_nan=False))
print('Complete',len(result['rows']),'rows',flush=True)

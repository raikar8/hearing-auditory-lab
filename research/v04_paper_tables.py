"""Generate tables from complete measured results, never hand-enter scores."""
from pathlib import Path
import json,statistics as st
root=Path('dist');d=json.loads((root/'perceptual-evaluation.json').read_text());assert d['complete'] and len(d['rows'])==96
names={'reference':'Reference pair','das':'Delay-and-sum','mvdr_known':'MVDR known','mvdr_estimated':'MVDR estimated','mvdr_rnnoise':'MVDR + RNNoise','neural_mvdr':'Neural MVDR (offline)'}
def avg(rows,fn):return st.mean(st.mean(fn(r) for r in rows if r['speaker']==s) for s in sorted({r['speaker'] for r in rows}))
def ear(key):return lambda r:st.mean(e[key] for e in r['ears'])
def table(file,caption,heads,rows):
 text='\\begin{table}[htbp]\\centering\\small\n\\caption{'+caption+'}\n\\begin{tabular}{l'+'r'*(len(heads)-1)+'}\\toprule\n'+' & '.join(heads)+' \\\\\n\\midrule\n'+'\n'.join(' & '.join(str(x) for x in row)+' \\\\' for row in rows)+'\n\\bottomrule\\end{tabular}\\end{table}\n'
 (root/file).write_text(text)
rows=[]
for m,name in names.items():
 rr=[r for r in d['rows'] if r['method']==m];rows.append([name,f'{avg(rr,ear("haspi_v2")):.3f}',f'{avg(rr,ear("hasqi_v2")):.3f}',f'{avg(rr,ear("si_sdr_db")):.2f}',f'{avg(rr,lambda r:r["ild_error_db"]):.2f}',f'{avg(rr,lambda r:r["itd_error_us"]):.1f}'])
table('v04-quality-table.tex','Equal-speaker means across all 16 scenes. SI-SDR and cues precede fitting.',['Method','HASPI','HASQI','SI-SDR dB','ILD dB','ITD $\\mu$s'],rows)
rows=[]
for m,name in names.items():
 vals=[]
 for rt in [0,.3]:
  rr=[r for r in d['rows'] if r['method']==m and r['nominal_rt60_s']==rt];vals += [f'{avg(rr,ear("haspi_v2")):.3f}',f'{avg(rr,ear("hasqi_v2")):.3f}']
 rows.append([name,*vals])
table('v04-room-table.tex','Anechoic versus requested RT60 0.3 s; each averages both SNRs.',['Method','HASPI 0','HASQI 0','HASPI .3','HASQI .3'],rows)
l=json.loads((root/'localization-evaluation.json').read_text());rows=[]
for r in l['rows']:
 if r['sector_half_width_deg']!=180 and r['scenario'] not in ['front','rear']:continue
 rows.append([r['scenario'].replace('_',' '),r['channels'],r['sector_half_width_deg'],f'{r["mean_absolute_error_deg"]:.1f}',f'{100*r["accepted_update_fraction"]:.1f}'])
table('v04-localization-table.tex','Waveform tests. Wrong-sector rear estimates can be confidently wrong.',['Case','Mics','Sector $\\pm$deg','MAE deg','Accepted \\%'],rows)
n=json.loads((root/'neural-beamformer-runtime.json').read_text());rows=[]
for k in ['stft_ms','network_and_mask_ms','covariance_and_solve_ms','istft_ms','total_ms']:
 v=[r['timings'][k] for r in n['rows']];rows.append([k.replace('_',' ').replace(' ms',''),f'{st.mean(v):.2f}',f'{max(v):.2f}'])
table('v04-runtime-table.tex','Offline neural CPU compute per three-second clip; no streaming-delay claim.',['Component','Mean ms','Maximum ms'],rows)

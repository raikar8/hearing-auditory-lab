"""Regenerate LaTeX result tables from the committed measurements (stdlib only)."""
import json
from pathlib import Path
b=json.loads(Path('dist/array-benchmark.json').read_text())
rows=[]
for r in b['runs']:
 t=r['timings']['total audio block']
 rows.append(f"{r['method']} {'+ RNNoise' if r['neural'] else ''} & {t['p50_ms']:.3f} & {t['p95_ms']:.3f} & {t['p99_ms']:.3f} & {t['max_ms']:.3f} & {r['rtf']:.3f} & {r['overruns']} \\\\")
s='\\textbf{Host:} '+b['cpu']+', Node '+b['node']+'.\\par\n'
s+=r'\begin{center}\small\begin{tabular}{@{}lrrrrrr@{}}\toprule Mode & p50 & p95 & p99 & Max & RTF & Overruns\\\midrule'+'\n'+'\n'.join(rows)+r'\bottomrule\end{tabular}\end{center}'
s+='\nExecution quantiles are milliseconds per 128-sample block. Overruns are measured over 1875 blocks per condition.\n'
Path('dist/array-tables.tex').write_text(s)
e=json.loads(Path('dist/array-evaluation.json').read_text());rows=[]
for r in e['rows']:
 if r['scene_snr_db']==0 and r['steering_error_deg']==0:
  ear=r['ears'][0];rows.append(f"{r['masker_deg']} & {r['method']} & {ear['snr_improvement_db']:.3f} & {ear['target_level_change_db']:.3f} \\\\")
Path('dist/array-spatial-table.tex').write_text(r'\begin{center}\small\begin{tabular}{@{}rlrr@{}}\toprule Masker ($^\circ$) & Mode & Left SNR gain (dB) & Target change (dB)\\\midrule'+'\n'+'\n'.join(rows)+r'\bottomrule\end{tabular}\end{center}'+'\nTarget and steering: 0 degrees; scene SNR: 0 dB. Values compare each processed ear against its reference microphone.\n')

r=b['runs'][-1]
rows=[]
for name, t in r['timings'].items():
 name=name.replace('×',r'$\times$').replace('&',r'\&')
 rows.append(f"{name} & {t['p50_ms']:.3f} & {t['p95_ms']:.3f} & {t['max_ms']:.3f} " + r"\\")
Path('dist/array-components-table.tex').write_text(r'\begin{center}\small\begin{tabular}{@{}lrrr@{}}\toprule Component & p50 (ms) & p95 (ms) & Max (ms)\\\midrule'+'\n'+'\n'.join(rows)+r'\bottomrule\end{tabular}\end{center}')

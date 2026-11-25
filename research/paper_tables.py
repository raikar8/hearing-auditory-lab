import json
from pathlib import Path
r=json.loads(Path('dist/reference-results.json').read_text());b=json.loads(Path('dist/compute-benchmark.json').read_text())
rows=[]
for x in r['rows']:
 snr='Quiet' if x['snr_db'] is None else str(x['snr_db'])+' dB'
 rows.append(f"{snr} & {x['unaided_haspi']:.4f} & {x['nalr_haspi']:.4f} & {x['nalr_haspi']-x['unaided_haspi']:.4f} \\\\")
Path('dist/pilot-table.tex').write_text('\\textbf{Measured pilot.} Duration '+f"{r['duration_s']:.3f}"+' seconds; pyclarity 0.9.0.\\par\n\\begin{center}\\begin{tabular}{lrrr}\\toprule\nSNR & Unaided HASPI & NAL-R HASPI & Difference\\\\\\midrule\n'+'\n'.join(rows)+'\n\\bottomrule\\end{tabular}\\end{center}\n')
Path('dist/timing-text.tex').write_text(f"On {b['cpu']} with Node {b['node']}, the reconstructed engine measured median {b['median_ms']:.3f} ms, p95 {b['p95_ms']:.3f} ms, p99 {b['p99_ms']:.3f} ms and maximum {b['max_ms']:.3f} ms per block. The measured real-time factor was {b['rtf']:.3f}; {b['overruns']} of {b['blocks']:,} blocks exceeded the {b['deadline_ms']:.3f} ms block interval. These are local Node DSP measurements, not browser or hearing-aid hardware measurements.\n")

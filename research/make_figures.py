from pathlib import Path
import json,numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
out=Path('dist/figures');out.mkdir(exist_ok=True)
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'savefig.bbox':'tight'})
f=np.array([250,500,1000,2000,4000,6000]);h=np.array([10,15,25,40,55,60]);s=sum(h[1:4]);a=.05*s;g=np.maximum(0,a+.31*h+np.array([-17,-8,1,-1,-2,-2]));freq=np.geomspace(80,12000,700);z=np.exp(-2j*np.pi*freq/44100);low=[]
for cutoff in [354,707,1414,2828,4899]:
 alpha=1-np.exp(-2*np.pi*cutoff/44100);low.append(alpha/(1-(1-alpha)*z))
bands=np.diff(np.vstack([np.zeros_like(freq),*low,np.ones_like(freq)]),axis=0)
response=20*np.log10(np.maximum(np.abs(np.sum(bands*10**(g[:,None]/20),axis=0)),1e-12))
fig,ax=plt.subplots(1,2,figsize=(9,3.1));ax[0].semilogx(f,h,'o-',color='#236d65');ax[0].invert_yaxis();ax[0].set(xlabel='Frequency (Hz)',ylabel='Threshold (dB HL)',title='Illustrative sloping audiogram');ax[1].semilogx(freq,response,label='Actual live linear bank',color='#236d65');ax[1].semilogx(f,g,'o--',label='NAL-R target',color='#b96b39');ax[1].set(xlabel='Frequency (Hz)',ylabel='Gain (dB)',title='Target versus implemented response');ax[1].legend(fontsize=8);fig.tight_layout();fig.savefig(out/'gain-response.pdf');fig.savefig(out/'gain-response.png',dpi=150);plt.close(fig)
r=json.loads(Path('dist/reference-results.json').read_text())['rows'];fig,ax=plt.subplots(figsize=(7,3));x=np.arange(len(r));ax.plot(x,[v['unaided_haspi'] for v in r],'o-',label='Unprocessed',color='#71838b');ax.plot(x,[v['nalr_haspi'] for v in r],'o-',label='Exact NAL-R FIR',color='#236d65');ax.set_xticks(x,['0','5','10','15','Quiet']);ax.set(xlabel='Input SNR (dB)',ylabel='HASPI v2',ylim=(0,1.02),title='One-utterance feasibility pilot; not a population estimate');ax.legend();fig.tight_layout();fig.savefig(out/'pilot-haspi.pdf');fig.savefig(out/'pilot-haspi.png',dpi=150)

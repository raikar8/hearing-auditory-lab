"""Waveform and binaural diagnostics, independent of fitting/inference."""
import numpy as np
from scipy.signal import stft
FS=16000
def sisdr(ref,y):
 ref=ref-ref.mean();y=y-y.mean();p=np.dot(y,ref)*ref/(np.dot(ref,ref)+1e-20);return float(10*np.log10((np.dot(p,p)+1e-20)/(np.sum((y-p)**2)+1e-20)))
def cues(y):
 _,_,z=stft(y,FS,nperseg=512,noverlap=256,axis=-1);f=np.fft.rfftfreq(512,1/FS);b=(f>=300)&(f<=4000)
 ild=float(10*np.log10((np.sum(abs(z[0,b])**2)+1e-20)/(np.sum(abs(z[1,b])**2)+1e-20)))
 # GCC-PHAT on pooled spectra, only 300--1500 Hz; integer-sample diagnostic.
 cross=np.mean(z[0]*np.conj(z[1]),axis=-1);cross/=np.maximum(abs(cross),1e-12);cross[(f<300)|(f>1500)]=0
 corr=np.fft.irfft(cross,512);lags=np.arange(-16,17);itd=float(lags[np.argmax(corr[lags%512])]/FS*1e6)
 return ild,itd

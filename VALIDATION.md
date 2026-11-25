# Edition 0.3 validation — 25 November 2026

- Checkpoint d648391 restored from GitHub after workspace maintenance; all 25 tests passed again on the restored checkout.
- New checks: radix-2 FFT, exact 512-sample reference reconstruction delay, distortionless complex constraints, coherent-noise rejection, target-muted calibration frame accounting/freeze, actual pretrained neural execution, and unique-buffer memory accounting.
- Chromium preview: started the audio engine at 48 kHz, observed 371 frozen noise frames and zero solver fallback bins, selected MVDR, enabled RNNoise and verified delay/memory UI updates. This was UI/runtime QA, not a listening-quality test or acoustic loopback measurement.
- AudioWorklet clock unavailable in that browser; fallback table explicitly identifies separate Node host measurements. Live numeric buffers and 16 MiB WASM reservation observed.
- Six Node benchmark conditions (reference/DAS/MVDR, each with/without RNNoise); calibration 1 s, warmup 1 s, measured 5 s. Full component quantiles, initialization, RTF, overruns and memory in `dist/array-benchmark.json`.
- RNNoise adapter lag measured on actual bundled speech: 1440 samples / 30 ms, correlation approximately 0.9665. Combined STFT + neural nominal alignment delay: 40.667 ms, excluding propagation and device I/O.
- Frozen-linear-filter evaluation: 3 masker angles, 4 SNRs, 0/20-degree steering error (reference uses 0 only), 60 rows. Distinct training/evaluation noise seeds. At 0 dB scene SNR and a 90-degree masker, left-ear SNR gains were 3.463 dB (DAS) and 14.628 dB (MVDR). Colocated sources give approximately zero gain. This favorable idealized scene is not perceptual or population evidence.
- Six-page LaTeX supplement compiled twice; citations resolved, no overfull boxes, all rendered pages visually reviewed. JavaScript syntax, local HTML links and pinned vendor SHA-256 verified.
- Final preview also verified the 40.67 ms neural-path label and populated Node fallback table with its explicit timing-source notice.
- Source and default model are bundled with wrapper and RNNoise licenses; exact package, submodule and SHA-256 provenance recorded.

Not verified: automatic localization/tracking (not implemented); hearing-aware benefit of the neural or array pipeline; calibrated headphone SPL; acoustic end-to-end latency; sustained browser deadline performance; physical multichannel capture; room/BTE realism; wearer benefit. Source upload and JSON downloads have code paths but no browser interaction QA claim in this phase. No neural quality ranking is claimed.

The original 0.2 validation record below applies only to its own implementation.

---

# Validation record — 25 November 2026

Reconstructed version 0.2.0. Earlier uncommitted workspace files were removed by workspace maintenance; measurements below were rerun against this revision. Previous browser checks are not claimed as checks of this reconstructed version.

## Completed

- 18 Node tests passed: 15 DSP tests and 3 AudioWorklet adapter tests.
- Independent formula checks for NAL-R targets and its severe-loss branch, including zero-loss bypass.
- Unity-band reconstruction, compressor slope, flat-loss attenuation, 5 ms delay shift, bounded finite output.
- Measured KEMAR dimensions, impulse match, ipsilateral arrival order and ear mirroring.
- Output invariance across streaming chunks; persistent state.
- Worklet source/config messages produce nonzero meters; exact 441000-sample-per-ear recording; unsupported HRIR rate produces an error.
- JavaScript syntax checks and Python source compilation.
- Offline pyclarity 0.9.0 NAL-R/HASPI v2/MSBG pilot executed; measured JSON and audio included.
- DSP benchmark: AMD EPYC 7763, Node v24.22.3; 3446 blocks, 128 samples, 44.1 kHz. Median 0.179 ms, p95 0.318 ms, p99 0.482 ms, max 1.667 ms; no observed interval exceedances; RTF 0.0745. Host DSP only.
- LaTeX compiled with pdfTeX; embedded fonts, citation resolution and rendered-page layout checked.
- Local HTML links and required assets checked after packaging.

## Not verified

- Browser UI interactions, real device playback, browser microphone permissions and download behavior for this reconstructed revision: browser-control tooling was unavailable.
- Hardware end-to-end latency, sustained browser underruns, acoustic output level, wearable CPU/memory/energy or listener benefit.
- Neural algorithms, real beamforming/localization and source separation: not implemented; literature entries are candidates.
- Full Clarity training dependency stack: only the documented evaluator subset was installed.

## Pilot interpretation

One 3.505-second utterance and one audiogram; five conditions are not independent trials. Exact Clarity FIR differs from the live broad-band approximation. HASPI evaluates unbounded float outputs, whose peaks exceed 1.0; an output-constrained comparison remains pending. Offline delay alignment must not be reported as zero physical latency. No clinical, SOTA ranking or population-level claim is made.

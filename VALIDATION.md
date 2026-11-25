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

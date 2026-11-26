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

## Version 0.4 — 26 November 2026

29 Node tests and four independent Python metric tests passed. All 96 method/scene rows are complete and finite; six 3-second 16 kHz stereo clips, 16 waveform-localization cases and 12 benchmark modes are validated. Audio hashes and attribution are committed. Regenerated left-ear HASPI/HASQI results match all 96 previously logged pairs to the recorded three-decimal precision.

| Method | Mean HASPI | Mean HASQI | Mean SI-SDR dB |
|---|---:|---:|---:|
| reference | 0.727 | 0.240 | 3.14 |
| das | 0.831 | 0.302 | 5.35 |
| mvdr_known | 0.925 | 0.627 | 12.79 |
| mvdr_estimated | 0.695 | 0.336 | -10.04 |
| mvdr_rnnoise | 0.896 | 0.658 | 11.18 |
| neural_mvdr | 0.813 | 0.353 | 5.98 |

Estimated-steering target DOA mean absolute error is 98.84 degrees; 2.62% of estimates lie within 10 degrees. Dominant-direction estimation often follows the noise. The known-direction MVDR result does not establish successful localization. Four-microphone near-clean free-field front/rear tests identify the tested grid directions; direction-step first accepted response is 88 ms. Two-microphone ambiguity and wrong-sector failures remain in the results.

Neural inference: mean 60.05 ms per three-second clip, one warm-up inference, one persistent checkpoint, one Torch CPU thread, AMD EPYC 7763 64-Core Processor. This bidirectional/full-utterance system has no streaming latency claim. Parameter tensors: 7.23 MiB; whole neural-process peak RSS: 380.5 MiB. The scorer's RSS is the maximum individual worker value, not the total of simultaneous workers.

Host MVDR with neural=False: RTF 0.060; p95 block compute 0.276 ms; 0/1875 budget overruns. Localizer numeric state 273,888 bytes.

Host MVDR with neural=True: RTF 0.196; p95 block compute 1.398 ms; 14/1875 budget overruns. Localizer numeric state 273,888 bytes.

Cloud-browser preview verified startup, calibration, estimated-steering telemetry, four/two microphone selection, pause, complete dashboard and room/speaker filters. The worklet clock was unavailable; the fallback explicitly identifies the separate Node host benchmark. The numerical protocol is unchanged by recovery. No acoustic device or production sign-in bypass test was performed. The LaTeX report was compiled and visually checked, and local links validated.

CONCEPTS.md contains 18 learning sections, equations, code exercises and paper/official standards references. Catalog scopes were checked for IEC 60118-0:2022, IEC 60118-15:2012, IEC 61669:2015+AMD1:2025 and ISO 21388-1:2026, with their roles compared to automotive ITU-T. No licensed normative test text is redistributed.

Limits: four short English speaker/geometry pairings, one sloping audiogram, synthetic image-source rooms and directional Gaussian noise. Calibration/true-angle versus future-context privileges differ. No real drone/head-mounted recordings, identity tracking, adaptive feedback cancellation, real-ear fitting verification, participant study or standards certification. Metrics describe different properties; no single result establishes clinical benefit.

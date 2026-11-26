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

## Version 0.5 — 26 November 2026

Host for all 0.5 measurements: Windows 11, AMD Ryzen 5 5500U, Node 26.13.1, Python 3.15.2 with numpy only. These numbers come from a different host than the 0.4 EPYC results and are not directly comparable to them.

### Tests

- **58 Node tests pass** (`npm test`): the 29 earlier tests unchanged, plus 11 feedback, 9 HRTF and 9 tracking tests. They cover:
  - feedback-path calibration, open-loop NLMS identification, the SSB frequency shifter;
  - closed-loop howl and recovery, NLMS failure versus PEM stability on real speech, PEM howl fallback;
  - mode-D-only gating, chunk invariance with the canceller on;
  - KEMAR mirroring, half- versus full-circle equivalence, ITD and spectral scaling, custom asymmetric sets, validation errors, cross-fade on set change;
  - time-frequency voting, track lifecycle, lock-on, the crossing guard, the speech-like policy, and end-to-end tracked MVDR steering.
- **5 Python SOFA-converter tests pass** (`tests/test_sofa_convert.py`, numpy only).
- **Not run on this host:** `tests/test_eval_metrics.py` needs scipy from the research stack, which is not installed here. The 0.4 record above remains the latest run of it.

### Browser QA (Claude desktop built-in Chromium, localhost)

- **Lab.** Started audio; in D with the path at −10 dB enabled PEM-AFC.
  - The page raised added delay from 0 to 4 ms and showed the reason. The loop converged (misalignment −19.3 dB, 0 clips). After *phone at ear* it saturated for 9 samples, then recovered (−21.6 dB).
  - Before the delay safeguard existed, the same test at 0 ms diverged (+15.5 dB misalignment, clipping). This led to the safeguard and the delay ablation.
- **HRTFs.**
  - Head width 17 cm gave ITD 808 µs (KEMAR 723 µs).
  - A custom full-circle JSON loaded through the file input.
  - A 48 kHz file was rejected with the expected message.
- **Array page.**
  - With target 30°, stationary masker −70°, −5 dB SNR and MVDR, the existing estimated mode steered to −70°.
  - Tracked lock-on steered to 31°. The speech-like policy selected 30° with modulation 3.83 vs 0.11 for the noise.
  - Track markers rendered.
- **Evaluations page.** The new v0.5 section renders 16 tracking rows, 12 feedback rows and the ablation summary.
- **Links.** A local link and module-import check passes for every page and served Markdown file. A pre-existing broken README link in the served CONCEPTS.md was fixed.
- **Not checked:** listening quality, real microphones or acoustic loopback, and other browsers. The AudioWorklet clock was unavailable, so the timing tables show the Node host benchmark, as designed.

### Measurements

- **Tracking** (`dist/tracking-evaluation.json`): 4 scenarios × 5 controllers, 8 s each. Full table in `dist/tracking-method.md`.
  - Loud stationary masker: dominant −2.79 dB, lock-on +15.30 dB (= known), speech-like +10.60 dB.
  - Two talkers: lock-on +17.37 dB vs known +17.41 dB; dominant had 27 source switches.
  - Crossing talker (delay-and-sum): lock-on 0.6° mean error after adding the crossing guard (22.7° before it).
- **Feedback** (`dist/feedback-evaluation.json`): 3 inputs × 4 conditions × 21 path gains, path-change runs and a 24-run delay ablation. Summary in `dist/feedback-method.md`.
  - Plain NLMS and NLMS + shift are unstable on speech in quiet at every gain.
  - PEM is stable up to the +10 dB sweep edge on both speech inputs, fails at −5 and 0 dB on the tone complex, and attenuates the tone complex by 5.4 dB.
  - With 0 ms forward delay, 6/6 PEM cases howl; with 1–4 ms, 18/18 are stable.
- **Lab engine cost** (`dist/compute-benchmark-v05.json`, 44.1 kHz, 2.90 ms budget): baseline D RTF 0.112; PEM 0.363 (p95 1.59 ms); PEM + 6 Hz shift 0.394 (max 2.90 ms, at the budget, 0 overruns).
- **Array cost** (`dist/array-benchmark-v05.json`): MVDR without RNNoise RTF 0.088 manual vs 0.175 tracked (tracking p95 0.24 ms, 0/1875 overruns). With RNNoise: 0.272 vs 0.365, with 7/1875 overruns in tracked mode. Tracking state is 5,472 bytes; templates are shared with the SRP localizer.

### Bugs found and fixed during this release

- The PEM pitch predictor was silently disabled by a misplaced comment. Found by a unit test; all PEM results were regenerated after the fix.
- A strided pitch search missed odd-aligned pulses.
- The speech-like policy selected the noise when no speech track was confirmed.
- The feedback status line stayed on "saturating" after recovery.
- The first feedback evaluation counted speech-peak clipping as howling. It now compares against a feedback-free reference.

### Not verified

- The SOFA reader (h5py) on a real measured SOFA file: none was downloaded.
- Perceptual benefit of any 0.5 feature; measured feedback paths; vehicle-style AEC; elevation HRTFs; voice-identity tracking; a new LaTeX paper (0.5 is documented in Markdown method notes).

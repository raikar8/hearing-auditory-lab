# Hearing Auditory Lab

A research and teaching lab for **binaural acoustics, hearing loss and hearing-aid DSP**. Includes a real-time browser prototype, a cited literature survey, a LaTeX implementation white paper, tests, a reproducible offline HASPI/MSBG pilot, and compute benchmarks. Edition **0.5** adds a simulated acoustic feedback loop with adaptive feedback cancellation, individualized HRTFs, and multi-source target tracking for the beamformer.

Read [CONCEPTS.md](CONCEPTS.md) for the guided course: hearing physiology, hardware, DSP, localization, neural beamforming, evaluation and the IEC/ISO counterparts to automotive ITU-T testing.

## Quick start: browser lab

Requirements: Python 3 (static server only), a recent browser supporting AudioWorklet, headphones. No npm install, Python dependencies, model download or GPU is needed for playback when bundled assets are present.

```bash
git clone https://github.com/raikar8/hearing-auditory-lab.git
cd hearing-auditory-lab
python -m http.server 8000 --directory dist
```

Open **http://localhost:8000**, click **Start listening**, and start at low device volume. Do not open `index.html` with `file://`: AudioWorklet needs localhost or HTTPS. This edition requires a 44.1 kHz AudioContext. Browser, OS and hardware buffering add latency; real-time throughput is not a hearing-aid latency guarantee.

1. Move target, masker and head; compare left/right levels.
2. Compare A (reference), B (audibility-loss illustration), C (aided illustration), D (aid output).
3. Change per-ear thresholds, compression ratio and time constants.
4. Test added delay/direct blend in D, then export settings or a 10-second stereo WAV.
5. Open Literature for paper status and the separately measured offline pilot.
6. **Panel 05, acoustic feedback:** in D, enable the feedback path, raise its gain until it howls, then enable the canceller (PEM-AFC by default). Try *Bring phone to ear*. Lower device volume first.
7. **Panel 06, HRTFs:** switch between KEMAR, KEMAR scaled to your head width and spectral scale, or a custom set converted from SOFA.

Microphone capture is optional and requests browser permission. Use headphones to avoid acoustic feedback; disable the mic to return to file input. Files and mic audio are processed locally. Google Fonts is the only nonlocal UI resource; system fonts work offline.

## Feedback cancellation, HRTFs and tracking (0.5)

| Feature | Where | Method note | Evaluation |
|---|---|---|---|
| Closed feedback loop + NLMS / frequency-shift / PEM-AFC cancellers | Lab panel 05, condition D | [feedback-method.md](dist/feedback-method.md) | `npm run evaluate:feedback` → `dist/feedback-evaluation.json` |
| KEMAR scaled to head width / spectral scale; custom full-circle sets; SOFA converter | Lab panel 06 | [hrtf-method.md](dist/hrtf-method.md) | `tests/hrtf.test.mjs`, `tests/test_sofa_convert.py` |
| Time-frequency voting + multi-target tracker; lock-on and speech-like target selection | array.html → *Tracked target* | [tracking-method.md](dist/tracking-method.md) | `npm run evaluate:tracking` → `dist/tracking-evaluation.json` |

Headline results, all from idealized simulation (see each method note for limits):

- **Tracking.** With a stationary masker 5 dB louder than the target, the v0.4 dominant-direction controller
  steers to the masker (−2.8 dB SNR change). Lock-on matches known-direction MVDR (+15.3 dB), and the speech-like policy
  reaches +10.6 dB with no direction prior. With two talkers, lock-on keeps the target (+17.4 dB, 0 source switches vs 27).
  The speech-like policy cannot separate two voices.
- **Feedback.** Plain NLMS is unstable on speech in quiet at every tested path gain, because closed-loop bias makes it learn
  the speech. PEM-AFC is stable up to the +10 dB sweep edge on both speech inputs, but it fails at two path gains on a tone
  complex and attenuates steady tones by 5.4 dB. Every canceller needs forward-path delay: at 0 ms, 6/6 PEM cases howl.
- **HRTFs.** Head-width scaling changes ITD in proportion (KEMAR 723 µs at 90 degrees → 808 µs at 17 cm). A SOFA file converts
  through `research/sofa_to_lab.py` (needs `h5py`); the converter core is tested on synthetic data, and the h5py reader has not
  yet been run on a real SOFA file.

```bash
npm run evaluate:feedback     # tens of minutes on a laptop CPU; full sweep + delay ablation
npm run evaluate:tracking     # about 1 minute
npm run benchmark:v05         # lab engine cost per feedback configuration
npm run benchmark:array       # writes dist/array-benchmark-v05.json (includes tracked steering)
python -m unittest tests/test_sofa_convert.py
```

## Array, localization and neural experiments (0.4)

Open **http://localhost:8000/array.html** (or **Array + neural** in the lab navigation).
This separate 48 kHz experiment adds four simulated free-field microphones, normalized delay-and-sum,
noise-calibrated MVDR, and real pretrained RNNoise WASM with two persistent ear states. There is no
head scattering/HRTF in the array renderer; the original 44.1 kHz KEMAR/fitting lab remains available.

- Start includes one second of noise-only learning. Change manual steering to test DOA errors.
- Compare spatial modes, then enable RNNoise. Select SRP-PHAT estimated steering, two/four localization microphones, and full-circle/sector search. This is dominant-direction estimation, not identity tracking.
- Inspect component execution quantiles, allocated memory and delay. If the worklet lacks a timer,
  the table explicitly uses the separate Node host benchmark. Browser I/O is shown separately.
- STFT alignment delay is **10.67 ms**; RNNoise adds **30 ms** in this pinned adapter. The combined
  path is **40.67 ms**, excluding propagation/device buffering. Throughput is not low wearable latency.
- Some measured neural blocks exceed the 2.67 ms callback budget. See the full benchmark, not just RTF.

```bash
npm test
npm run benchmark:array
npm run evaluate:array
```

Run these sequentially. No GPU or npm install is needed. Vendored model/runtime provenance and licenses
are in `dist/vendor/` and `THIRD_PARTY.md`. Read [the array method](dist/array-method.md) and
[the LaTeX supplement](dist/array-supplement.tex) / [PDF](dist/array-supplement.pdf).
The original white paper describes edition 0.2; the supplement specifies the 0.3 extension. Edition 0.5 is documented in the three method notes listed above rather than a new LaTeX paper.

## Research environment

Tested with Python 3.12, Node 24.22.3 on Linux. Edition 0.5 code was additionally tested on Windows 11 with Node 26.13.1 and Python 3.15 (numpy only). Python 3.12 is recommended for reproducing the pinned research stack. In a new virtual environment:

```bash
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell instead:
# .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install pyclarity==0.9.0 --no-deps
```

The second command deliberately installs only Clarity's core package: this project calls NAL-R, MSBG and HASPI, not training recipes. Full Clarity training requires its additional dependencies. See `Skills.md` for the exact scope and troubleshooting.

```bash
npm test                         # Node built-in test runner; no npm install
npm run benchmark                # warm DSP benchmark; overwrites current host result
python research/reference_study.py # exact NAL-R, HASPI v2 and offline MSBG audio
python research/make_figures.py   # plots from current result files
```

If assets are missing, run `python research/restore_data.py`. It downloads MIT KEMAR and streams LibriSpeech test-clean until two specified passages are found; network traffic may be substantial. The archive and dependencies are not hearing-aid microphone-array data. Asset SHA-256 hashes are in `dist/assets/sha256.json`.

## White paper

Read `dist/white-paper.pdf`, edit `dist/white-paper.tex`. Build from the repository root using a working TeX Live installation:

```bash
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/white-paper.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/white-paper.tex
```

Run `python research/paper_tables.py` after changing measurements to refresh the LaTeX tables.

The paper uses an embedded bibliography and generated plots in `dist/figures/`; no BibTeX step is needed. Regenerate research results and figures before updating result claims.

## Implemented versus planned

| Component | Status |
|---|---|
| Measured KEMAR horizontal two-ear HRIR rendering | Implemented, 128 taps, 44.1 kHz, 5-degree grid |
| NAL-R targets + broad filter-bank realization | Live approximation; exact Clarity FIR offline |
| Per-band WDRC, added delay, direct blend, bounded output | Educational implementation |
| Hearing-loss browser audio | Attenuation illustration only, not physiological simulation |
| Clarity MSBG model | Separate offline examples |
| HASPI v2 / HASQI v2 | Expanded 16-scene, four-speaker offline study; exploratory |
| Front-facing directionality | Oracle source access, not a microphone beamformer |
| Microphone beamforming/localization | DS, calibrated MVDR, SRP-PHAT; live 48 kHz array page |
| Multi-source tracking / target selection | TF voting, alpha-beta tracks, crossing guard; lock-on (by direction) and speech-like selection (0.5) |
| Neural processing | RNNoise live postfilter; offline pretrained mask proxy + Souden MVDR |
| Voice identity (speaker recognition) / competing-speaker separation | Not implemented; tracking keeps identity by direction only |
| Acoustic feedback loop + adaptive cancellation | Simulated synthetic path; NLMS, frequency shift, PEM-AFC (0.5) |
| Individualized HRTFs | Anthropometric KEMAR scaling, custom sets, SOFA converter (0.5); horizontal plane only |
| Vehicle-style AEC, measured feedback paths, hardware validation | Planned |

The lab is not a clinical device or fitting prescription. Audiogram values do not uniquely predict a person's perception. A digital limiter is not SPL calibration. NAL-R is a transparent historical baseline, not NAL-NL2. Published neural results are labeled separately from local measurements.

## Project map

- `dist/`: static web app, paper, literature cards, public data and measured JSON results.
- `dist/dsp.js`, `processor.js`: streaming engine and AudioWorklet adapter.
- `dist/feedback.js`, `dist/hrtf.js`, `dist/tracking.js`: 0.5 feedback loop/cancellers, HRTF sets and personalization, multi-source tracker.
- `research/`: data restoration, offline study, figures and host benchmark.
- `tests/`: independent checks of formulas, streaming state, spatial rendering and output bounds.
- `Skills.md`: reproducibility instructions and research workflow for a human or Codex.
- `VALIDATION.md`: checks performed and limits.
- `THIRD_PARTY.md`: citations, data provenance and licenses.

## Evidence and attribution

Byrne & Dillon (1986), DOI: [10.1097/00003446-198608000-00007](https://doi.org/10.1097/00003446-198608000-00007); Kates (2005), DOI: [10.1177/108471380500900202](https://doi.org/10.1177/108471380500900202); [MIT KEMAR](https://sound.media.mit.edu/resources/KEMAR.html), Gardner & Martin; [LibriSpeech](https://www.openslr.org/12), Panayotov et al. (2015), CC BY 4.0; [Clarity](https://github.com/claritychallenge/clarity), pyclarity 0.9.0; [HASPI/HASQI overview](https://pubmed.ncbi.nlm.nih.gov/36137862/), Kates & Arehart (2022).

For broader methods, see the paper and `dist/survey-data.json`. The RNNoise runtime is bundled; the MetricGAN+ checkpoint is downloaded at a pinned revision. Our neural mask/MVDR combination is an experimental hybrid, not reproduction of a published multichannel score.

### Compile the extension paper

With a standard TeX Live or MiKTeX installation, from the repository root:

```bash
python research/array-paper-tables.py
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/array-supplement.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/array-supplement.tex
```

Tables are generated from committed benchmark/evaluation JSON, not manually typed results.

## Expanded evaluation and neural beamformer

Open **http://localhost:8000/evals.html** for HASPI v2, HASQI v2, SI-SDR, target-only distortion where valid, ILD/ITD diagnostics, localization tests, six matched listening clips and runtime provenance. Recorded results require no Python environment to view. Read [the v0.4 supplement](dist/localization-neural-supplement.pdf) for the protocol and measured limitations.

The live localization uses observed spectra and a 5-degree SRP-PHAT grid, with 100 ms smoothing and 21.33 ms updates. Two microphones can be front/back ambiguous. A sector is a user prior; the dominant direction may be the masker. The estimated-steering method must be compared with known steering, not assumed to be correct.

The **offline** neural beamformer converts a pinned MetricGAN+ enhancement estimate into a power-mask proxy and applies reference-channel Souden MVDR. Its bidirectional network and whole-utterance statistics use future context. It is not selectable as a live mode. RNNoise is a separate live postfilter, not that neural beamformer.

### Reproduce v0.4 research

Use Python 3.12 in a separate environment. Tested on CPU with one Torch thread; no GPU needed. The exact tested stack is torch/torchaudio 2.5.1 CPU, SpeechBrain 1.0.3 and pyclarity 0.9.0. Platform wheel availability may differ.

```bash
python -m pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-research.txt
python -m pip install pyclarity==0.9.0 --no-deps
python research/prepare_eval_data.py
python research/restore_neural_model.py
python research/prepare_spatial_scenes.py
node research/render_spatial_eval.mjs
python research/neural_mvdr.py
python research/evaluate_parallel.py --workers 4
npm run evaluate:localization
npm run benchmark:array
```

Run the listed stages sequentially; the scorer alone distributes independent scenes across four bounded workers with one math-library thread each. Use `python research/evaluate_perception.py` for a single-process scorer. Avoid competing CPU jobs when measuring compute. The model loads once per script invocation, not once per utterance. Model download is about 7.3 MB; streaming the LibriSpeech archive can require substantial network traffic. The locked manifest verifies original FLAC checksums. Intermediates and model weights remain under ignored `research/work/` and `research/models/`; result JSON and selected derived WAV clips are committed.

There are 4 speakers × 2 room conditions × 2 SNRs × 6 methods = 96 rows. Each speaker has only one geometry and one three-second clip, so speaker/geometry effects cannot be separated. Requested RT60 is not measured RT60. All quality scores use the same NAL-R fitting, audiogram and assumed level calibration. References include room coloration. Calibration privileges and future context differ across methods. These results are not a clinical outcome study, standards certification, or SOTA ranking.

`dist/array-benchmark.json` and earlier papers retain the v0.3 archive; the current host report is `dist/array-benchmark-v04.json`. To rebuild the new paper:

```bash
python research/v04_paper_tables.py
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/localization-neural-supplement.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/localization-neural-supplement.tex
```

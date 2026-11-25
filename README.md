# Hearing Auditory Lab

A research and teaching lab for **binaural acoustics, hearing loss and hearing-aid DSP**. Includes a real-time browser prototype, a cited literature survey, a LaTeX implementation white paper, tests, a reproducible offline HASPI/MSBG pilot, and a compute benchmark.

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

Microphone capture is optional and requests browser permission. Use headphones to avoid acoustic feedback; disable the mic to return to file input. Files and mic audio are processed locally. Google Fonts is the only nonlocal UI resource; system fonts work offline.

## New in 0.3: array and neural experiment

Open **http://localhost:8000/array.html** (or **Array + neural** in the lab navigation).
This separate 48 kHz experiment adds four simulated free-field microphones, normalized delay-and-sum,
noise-calibrated MVDR, and real pretrained RNNoise WASM with two persistent ear states. There is no
head scattering/HRTF in the array renderer; the original 44.1 kHz KEMAR/fitting lab remains available.

- Start includes one second of noise-only learning. Change manual steering to test DOA errors.
- Compare spatial modes, then enable RNNoise. Localization/target tracking is a documented next step.
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
The original white paper describes edition 0.2; the supplement specifies the 0.3 extension.

## Research environment

Tested with Python 3.12, Node 24.22.3 on Linux. Python 3.12 is recommended for reproducing these exact pins. In a new virtual environment:

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
| HASPI v2 | One-utterance feasibility pilot, not a leaderboard |
| Front-facing directionality | Oracle source access, not a microphone beamformer |
| Real beamforming/localization, neural enhancement, separation | Literature candidates and next milestones |
| Feedback cancellation/AEC, individualized HRTFs, hardware validation | Planned |

The lab is not a clinical device or fitting prescription. Audiogram values do not uniquely predict a person's perception. A digital limiter is not SPL calibration. NAL-R is a transparent historical baseline, not NAL-NL2. Published neural results are labeled separately from local measurements.

## Project map

- `dist/`: static web app, paper, literature cards, public data and measured JSON results.
- `dist/dsp.js`, `processor.js`: streaming engine and AudioWorklet adapter.
- `research/`: data restoration, offline study, figures and host benchmark.
- `tests/`: independent checks of formulas, streaming state, spatial rendering and output bounds.
- `Skills.md`: reproducibility instructions and research workflow for a human or Codex.
- `VALIDATION.md`: checks performed and limits.
- `THIRD_PARTY.md`: citations, data provenance and licenses.

## Evidence and attribution

Byrne & Dillon (1986), DOI: [10.1097/00003446-198608000-00007](https://doi.org/10.1097/00003446-198608000-00007); Kates (2005), DOI: [10.1177/108471380500900202](https://doi.org/10.1177/108471380500900202); [MIT KEMAR](https://sound.media.mit.edu/resources/KEMAR.html), Gardner & Martin; [LibriSpeech](https://www.openslr.org/12), Panayotov et al. (2015), CC BY 4.0; [Clarity](https://github.com/claritychallenge/clarity), pyclarity 0.9.0; [HASPI/HASQI overview](https://pubmed.ncbi.nlm.nih.gov/36137862/), Kates & Arehart (2022).

For broader methods, see the paper and `dist/survey-data.json`. No neural checkpoint is shipped or claimed to have been reproduced.

### Compile the extension paper

With a standard TeX Live or MiKTeX installation, from the repository root:

```bash
python research/array-paper-tables.py
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/array-supplement.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/array-supplement.tex
```

Tables are generated from committed benchmark/evaluation JSON, not manually typed results.

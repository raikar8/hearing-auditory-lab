# Skills.md — Reproduce and extend the Hearing Auditory Lab

This is a project reproduction guide for people and Codex. It is not an installed agent skill or a claim of clinical validation. Read README.md first. Research snapshot: 26 November 2026; implementation 0.5.0.

## Goal and scientific contract

Understand auditory impairment, implement transparent compensation baselines, and compare future hearing-aid algorithms under shared conditions. Every method must point to a paper or an explicitly labeled engineering assumption. Keep these categories separate:

1. Published claim (cite the original source, hardware, dataset and latency definition).
2. Locally reproduced measurement (save configuration, versions, input hashes and raw output).
3. Educational approximation (state what mechanism it does and does not model).
4. Planned experiment (never display invented scores or claim an unimplemented method runs).

Do not call ordinary attenuation a complete sensorineural hearing-loss simulation. Do not call known-source weighting a real beamformer. Do not call real-time factor an end-to-end latency measurement. Do not infer clinical benefit from a single objective score.

## Clean setup

Use Node.js 22 or newer for tests; the recorded benchmark used Node 24.22.3. Use Python 3.12 for the pinned research stack and a modern browser with AudioWorklet. No GPU is needed for current baselines.

```bash
git clone https://github.com/raikar8/hearing-auditory-lab.git
cd hearing-auditory-lab
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install pyclarity==0.9.0 --no-deps
npm test
python -m http.server 8000 --directory dist
```

Visit http://localhost:8000. The static application needs no npm install or Python packages beyond the server itself. Research dependencies are separate. HTTPS or localhost is required; file:// is unsupported.

`pyclarity --no-deps` is intentional for this narrowly tested evaluator subset. It does not install Clarity's training environment. For new training recipes use the upstream supported full installation in a separate environment. Do not silently change package versions and reuse old results.

## Data restoration and provenance

Bundled assets are sufficient for the demo. To rebuild them:

```bash
python research/restore_data.py
```

This obtains MIT KEMAR compact.zip and streams OpenSLR LibriSpeech test-clean. It extracts exactly 6930-75918-0000 and 6930-75918-0007. Both are the same speaker. KEMAR is 44.1 kHz, 128 taps, two ears; horizontal 0:5:180-degree responses are serialized without per-ear normalization. Negative directions swap the ears. Original int16 scale is retained. Speech WAV remains at its native 16 kHz; the browser decoder resamples to the AudioContext rate.

Do not double-apply head filtering. Ear HRIRs are not BTE microphone transfer functions. Room reverberation requires appropriate BRIRs or a separately defined room-to-head renderer. For microphone beamforming, use an actual microphone transfer-function set or measured multi-mic scenes.

The data script saves SHA-256 hashes for top-level assets. See THIRD_PARTY.md for source links, licensing and modifications. The download can consume hundreds of MB even though only two clips are retained. Network availability and source terms may change.

## DSP implementation map

- `dist/dsp.js`: NAL-R target rule, persistent source/HRIR state, six overlapping one-pole bands, envelope compression, optional gain/directivity/loss illustration, delay and ceiling.
- `dist/processor.js`: AudioWorklet adapter, telemetry, 10-second capture; initializes once.
- `dist/app.js`: scene controls, audiograms, local audio decoding, microphone lifecycle, charts and export.
- `research/reference_study.py`: independently calls Clarity's NAL-R, HASPI v2 and MSBG. It does not score the browser engine.
- `research/benchmark.mjs`: warm Node timing of the actual browser DSP engine, excluding UI/audio-device work.
- `dist/feedback.js`: synthetic feedback path, receiver history, NLMS, PEM prewhitening with howl fallback, Hilbert frequency shifter, magnitude-bound MSG (0.5).
- `dist/hrtf.js`: full-circle HRIR schema, mirroring of the half-circle KEMAR, validation, ITD/spectral personalization, ITD measurement (0.5).

Live configuration: 44,100 Hz; nominal 128-sample quantum; HRIR coefficient transition 20 ms; two sources, two ears; 128-tap convolution. Six target bands at 250, 500, 1000, 2000, 4000, 6000 Hz. Lowpass corner frequencies: 354, 707, 1414, 2828, 4899 Hz. Bands are lowpass differences plus a residual. Unity gains reconstruct the input, unequal gains approximate the desired curve.

Compression uses an absolute-value envelope with separate attack/release constants. Assumed level = 100 + 20log10(envelope). Knee 55 dB, ratio default 2:1, attack 10 ms, release 150 ms. This is a pedagogic choice, not an audiological prescription. Independent-ear control is a known binaural-cue risk.

Oracle directionality is 0.15 + 0.85(1+cos(relative azimuth))/2, applied separately to source stems before mixing. Label it oracle in every plot. Final output has a default −24 dB master gain and hard ±0.89 sample ceiling. This is not an acoustic safety calibration.

## Reproduce measurements

```bash
npm test
npm run benchmark
python research/reference_study.py
python research/make_figures.py
python research/paper_tables.py
```

Save result JSON files before rerunning if comparing machines. The pilot uses a single short utterance, full-clip RMS corresponding to 65 dB SPL under a numerical 100 dB SPL-per-0 dBFS mapping, one audiogram and white noise at 0/5/10/15 dB plus quiet. Seed 20261125. NAL-R order 220; remove 110 samples offline for alignment. HASPI v2 receives the original audiogram and `level1=100`; the reference waveform is already scaled to the desired level. Do not set level1=65 after scaling to −35 dBFS: that would change calibration.

HASPI receives unprocessed and NAL-R signals, not MSBG audio. MSBG is a separate illustrative output. Its files share playback multiplier 0.5. Do not independently normalize listening conditions if comparing gain benefit. Inspect clipping before writing audio.

The scoring path uses floating point without an output limiter. Peaks above 1.0 are stored in metadata; this is not a deployable amplitude result. Add a calibrated limiter as an explicit separate condition before deployment claims.

Timing: discard a 1-second warm-up, measure approximately 10 seconds of blocks, report median/p95/p99/max, block deadline exceedances and RTF. Keep CPU, runtime, block size and sample rate. An underrun-free short run is not a hard real-time guarantee. Browser buffering, ADC/DAC, transport and acoustic propagation require separate loopback measurements.

## Build the paper

With a complete TeX Live installation, run from the repo root:

```bash
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/white-paper.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory dist dist/white-paper.tex
```

Use the current figure files and measured tables. Check undefined citations, overfull boxes and visual page rendering. If TeX is unavailable, preserve the .tex source and report compilation as unverified; do not label a separately typeset document as the compiled LaTeX paper.

## Verification checklist

- Formula targets, normal-loss bypass, compression slope, unity-band reconstruction.
- Measured HRIR impulse match, left/right mirror and correct ipsilateral arrival.
- Chunk-size invariance, output bounds and added-delay sample shift.
- Browser Start/Pause/Resume, settings changes, local file and permission/error handling.
- Actual nonzero audio meters, 10-second stereo WAV dimensions, no stale processing state.
- Local links/assets and survey filters; small-screen layout.
- Reference-study outputs and independently regenerated plots.
- No model loads or network requests in the audio callback.

Consult VALIDATION.md to distinguish checks completed in this environment from pending checks. Tests do not establish perceptual validity.

## Extension protocol: real algorithms

1. Add a microphone-array scene with pinned BTE/BRIR data and held-out rooms/talkers. Keep clean target/noise stems for evaluation only.
2. Implement delay-and-sum and causal MVDR. Test covariance adaptation, steering error, diffuse noise, moving head and numerical regularization. Compare to the oracle only as an upper-bound illustration, not a fair deployable baseline.
3. Implement binaural MWF/MWF-N with target and residual-noise ITD/ILD evaluation.
4. Choose one public checkpoint with explicit license and streaming state. DeepFilterNet is a feasibility candidate; it is not presumed to satisfy a <5 ms open-fit delay budget. Review Deep FIR/Viking and ultra-low-latency alternatives separately.
5. Define adapter contract: init(config, fs, channels), reset(), process(block), metadata() returning lookahead, frame/hop, delay convention, model/checkpoint hash, parameters, MAC estimate and license. Model weights load once. Preserve recurrent, convolution, FFT and overlap state across callbacks.
6. Evaluate unprocessed, fixed amplification, WDRC, enhancement only, and enhancement + the same fitting stage. Never optimize an audiogram on the test set.
7. Report HASPI/HASQI (calibrated and versioned), supplementary signal metrics, spatial cues, peak/clipping, latency, RAM and energy. Add listener testing and confidence intervals for perceptual claims.
8. Build acoustic feedback as an explicit receiver-output-to-input loop. Record feedback-path change tests and maximum stable gain. Automotive AEC and hearing-aid feedback cancellation have different identification conditions.

For each new paper record search date, primary URL, evidence access (full paper/abstract), code and weight availability, dataset/split, causality, latency definition and reproduction status. Do not claim this curated survey is exhaustive.

## Version control and publication

Keep results, paper, guide and code synchronized in Git. Preserve the existing repository and its visibility. Never commit access tokens, microphone recordings, user uploads, private profiles or installation-specific credentials. The provided GitHub repository is the canonical source; publication is subject to its existing permissions. If pushing is unavailable, provide the source archive and exact setup commands, and state that the push did not complete.

## Edition 0.3 reproduction: array, neural and timing

1. Read `dist/array-method.md` for the acoustic model and equations.
2. Serve `dist`, then open `array.html`. Use headphones, start low, wait for the
   one-second target-muted calibration and compare reference/DAS/MVDR. Steering
   is manual; changing scene/noise geometry starts a fresh calibration.
3. Enable RNNoise. It loads once; two recurrent states persist, with reset on
   toggles. Do not replace this with a framewise model reload.
4. Run `npm test`, `npm run evaluate:array`, then `npm run benchmark:array`
   sequentially. Preserve resulting JSON with host/configuration and timestamps.
5. Keep target/noise decomposition scoring confined to frozen linear processors.
   RNNoise needs a separate nonlinear evaluation with aligned clean references.
6. Verify the current bundle's latency: 1440 samples/30 ms in the adapter, plus
   512 samples/10.67 ms for the array STFT. Do not infer total delay from frame size.
7. Read timing-source labels: AudioWorklet may lack `performance.now`; Node
   benchmark numbers are not the user's browser timings. Report tail overruns,
   reserved WASM heap and whole-process RSS with their distinct meanings.
8. Use `dist/vendor/provenance.json` and the two vendor license files for exact
   reproducibility. Run npm pack only when restoring the pinned package; do not
   silently replace weights with latest upstream.
9. Compile `dist/array-supplement.tex` using pdfLaTeX twice. Preserve original
   white paper plus supplement. Update evaluation/benchmark tables from JSON.
10. For localization, compare known/manual steering, fixed-front and estimated
    DOA with target association; include angular errors, track swaps, control
    lag and audio delay separately. No automatic DOA is implemented in 0.3.

The extension isolates enhancement before fitting. Do not describe its free-field
renderer as measured BTE acoustics or its neural runtime as a binaural neural
model. Neither an acoustic feedback canceller nor AEC is implemented.

## Version 0.4 reproduction and interpretation

Read CONCEPTS.md for the teaching sequence and current IEC/ISO/ITU-T reference map. Follow the v0.4 command sequence in README.md in order. `requirements-research.txt` adds SpeechBrain and the image-source RIR generator to the evaluator environment; install the pinned CPU Torch pair separately. `restore_neural_model.py` verifies the pinned model SHA before use. `prepare_eval_data.py` restores missing locked FLACs by exact utterance ID and checksum.

Never tune on these four evaluation speakers and continue calling them held out. Record any future tuning as a new development split. Do not claim their identities are absent from every third-party model's training sources. The study has one geometry per speaker, 3-second clips and synthetic stationary noise. A larger crossed design is needed for generalization.

- `research/prepare_spatial_scenes.py`: deterministic image-source mixtures, independent noise-calibration signal, reference stems reserved for scoring.
- `research/render_spatial_eval.mjs`: actual causal JavaScript DSP, oracle/estimated steering, RNNoise; no model reload per condition.
- `research/neural_mvdr.py`: one persistent offline pretrained mask estimator; whole-utterance PSD and two reference-channel outputs.
- `research/evaluate_perception.py`: matched fitting, HASPI/HASQI, waveform/cue metrics and common-gain listening clips. Completeness is recorded in JSON; never publish partial rows as a complete study.
- `research/localization-evaluation.mjs`: actual waveform/FFT localization tests, including ambiguity, sector exclusion, a direction step and louder interference.
- `research/array-benchmark.mjs`: execution/memory benchmark; from 0.5 it adds the `tracked` steering mode and writes `array-benchmark-v05.json`, preserving the v0.3 and v0.4 reports.

A true streaming neural extension must explicitly declare look-ahead and persistent state. Evaluate target association separately from angular estimation. Avoid using clean stems or true target angle in a method labeled estimated. A learned mask is not necessarily an identity-conditioned speaker mask. For fixed linear methods, target/noise decomposition uses the same frozen weights; nonlinear methods require a different justified attribution method.

After measurements: run all Node tests, Python metric tests, JSON completeness/finite-value checks, refresh generated paper tables, compile the paper twice, and update VALIDATION.md. Keep data provenance, model hash, dependency pins, information access, reference definition and hardware timing scope attached to results. Package with `research/package.py`, which excludes transient scenes, model weights, raw downloaded FLACs and hosting credentials. Push checkpoints to the authorized GitHub repository; preserve the private Site audience.

### Recovery and bounded metric workers

`research/evaluate_parallel.py --workers 4` runs independent scene scoring workers and merges their outputs in manifest order. Each worker resets the same per-ear metric random seed and uses one BLAS/OpenMP/Numba thread. The final JSON is written only after all 16 scenes return six rows. Its peak RSS field is the largest individual scoring-worker RSS, not aggregate memory across simultaneous workers. Neural inference and runtime profiling remain separate stages, with the checkpoint loaded once. The serial `evaluate_perception.py` route remains available.

After a workspace reset, recover source from the GitHub checkpoint and use the locked data/model restore scripts. Recompute missing outputs; never reconstruct full result rows from a log containing only selected summary values. Keep any regenerated runtime numbers tied to their actual host/run metadata.

## Version 0.5 reproduction: feedback, HRTFs and tracking

```bash
npm test                                   # 58 Node tests
python -m unittest tests/test_eval_metrics.py tests/test_sofa_convert.py
npm run evaluate:tracking                  # dist/tracking-evaluation.json
npm run evaluate:feedback                  # dist/feedback-evaluation.json (long: full sweep + delay ablation)
node research/feedback-evaluation.mjs rescore    # recompute score fields from stored per-second data only
node research/feedback-evaluation.mjs ablation   # rerun only the forward-delay ablation
npm run benchmark:v05                      # dist/compute-benchmark-v05.json
npm run benchmark:array                    # dist/array-benchmark-v05.json
```

Contracts that keep these results honest:

- **Feedback.** The canceller reads only the microphone and receiver signals. Misalignment and the stable-gain bound use the simulator's true path and are labelled simulation truth. The feedback path is synthetic and fits inside the canceller, so stable-gain values are upper bounds for the model. Always report the wanted-sound level change (`tail_level_change_db`) next to stability: a canceller can buy stability by cancelling the signal. Keep the forward delay of 1 ms or more that the method needs, and report it.
- **Tracking.** The localizer and tracker read only microphone spectra. Lock-on receives one designated direction at t = 0 and must be labelled with that privilege. Speech-like selection receives none. Do not describe either policy as speaker identification. Score with target-only/noise-only shadow scenes through the identical time-varying filter.
- **HRTFs.** Scaled KEMAR is a two-parameter model, not a measurement. Record the source, the personalization factors and the converter's `conversion` block with any result. Check dataset licenses before committing converted sets.

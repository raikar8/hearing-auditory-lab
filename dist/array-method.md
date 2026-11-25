# Array and neural extension — research edition 0.3

This supplement extends the original hearing-loss lab with a separate four-microphone experiment. `array.html` uses actual microphone-mixture spatial filtering; the original `index.html` retains measured KEMAR ear responses and the illustrative hearing-aid fitting chain. They are separate experiments, not one validated hearing-aid product. Automatic localization is not implemented.

## Acoustic model

At 48 kHz, four ideal omnidirectional microphones are at (x,y) = (-0.09,+0.008), (-0.09,-0.008), (+0.09,+0.008), (+0.09,-0.008) metres. Positive x is right; positive y is front. Each source is a far-field plane wave. For head-relative azimuth θ, microphone delay is:

τ_m = 24 − 48000 (x_m sin θ + y_m cos θ) / 343 samples.

A causal linear interpolator implements the delay. Approximately 0.24–0.77 ms of synthetic propagation precedes processing. This 24-sample common offset makes the renderer causal; it is not measured physical distance. There is no head scattering, pinna, reverberation, microphone mismatch or self-noise. The head drawing only marks geometry. This is not a measured behind-the-ear array. Head rotation subtracts from source and steering angles. No HRTF is used in this page; the original lab still uses measured KEMAR HRIRs.

For integer delay n and fractional part f, the steering transfer is d_m(k) = exp(−jωn)[(1−f)+f exp(−jω)]. This matches the simulator interpolator, rather than assuming a magnitude-one ideal delay. The source renderer owns clean stems; the Beamformer API receives four mixtures only. Noise learning is an explicitly supervised noise-only calibration, not blind noise estimation.

## Streaming analysis and beamforming

A 512-sample periodic square-root Hann window, 128-sample hop and four analysis FFTs feed two synthesis IFFTs. The synthesis overlap sum is scaled by 1/2. All three spatial modes pass through the same analysis/synthesis path. An impulse/reconstruction test verifies exactly 512 samples (10.667 ms) of reference delay. Analysis and synthesis delays must not be counted twice.

Reference passes the front microphone at each ear. Delay-and-sum uses w = d/(dᴴd). MVDR minimizes wᴴR_nw subject to wᴴd=1, giving w = R_n⁻¹d/(dᴴR_n⁻¹d) [1]. The implementation solves a complex 4×4 system with pivoting; it does not explicitly invert the matrix. Loading is max(10⁻¹⁰, λ tr(R_n)/4)I with λ=0.01 by default. A failed solve falls back to normalized delay-and-sum and reports the number of fallback bins.

A one-second calibration mutes the target, discards the first four STFT frames to remove previous speech from analysis history, and averages 371 noise-only outer products. Statistics then freeze. Start and source/geometry/noise changes trigger calibration; a button requests it again. This controlled stationary-noise baseline needs subsequent VAD/mask-based tracking for real environments. Weight solves run on configuration changes and at calibration completion. They can cause callback-time spikes and are included in the calibration/solve timing report.

Both enhanced ears are obtained as z_e = d_e wᴴx, using front-ear reference transfer functions. The target constraint preserves modeled target transfer functions approximately after STFT processing. Residual noise is also mapped to target cues, so this is not preservation of all source locations. Short windows, finite spatial filters, regularization and steering errors create practical deviations. No synchronization cost for wireless communication between ears is modeled.

## Neural baseline

The checkbox runs the real pretrained RNNoise WASM module, once per ear, after spatial filtering. It does not perform source separation or target identity tracking. The module is created once; recurrent states persist across 128-sample callbacks. Input/output is scaled between normalized float PCM and the library's 16-bit amplitude convention. Two independent states process 480 samples per inference call. A checkbox transition resets signal/model state, without reloading weights.

The browser bundle is unmodified `@jitsi/rnnoise-wasm@0.2.1`. Exact wrapper and RNNoise submodule revisions, npm integrity and SHA-256 are recorded in `vendor/provenance.json`. Valin (2018) [3] motivates the hybrid DSP/neural approach; the shipped later revision is **not the paper's original checkpoint**. See its `delayed_X` processing in the pinned `src/denoise.c`. This bundle has two frames of internal delay, plus one frame in our streaming adapter: 30 ms additional nominal alignment delay. Speech cross-correlation in `array-benchmark.json` independently checks the lag at 1440 samples. Do not equate 10 ms inference frames with 10 ms pipeline delay. This is an alignment measurement on one clip, not a universal perceptual or device-latency measure.

With neural processing, the nominal processing alignment delay is 10.667 + 30 = 40.667 ms, before synthetic propagation and OS/browser/device buffering. No GPU or network inference is used. Independent-ear denoising may damage interaural cues. Noise attenuation, speech distortion and binaural perception need evaluation together. RNNoise is an established neural baseline, not a claim to reproduce current state-of-the-art hearing-aid performance.

## Component compute and memory

The profiler records scene rendering, analysis FFTs, covariance update, weight solve, spatial filtering, synthesis IFFTs, neural framing/inference, output gain/ceiling, and total block execution. Component values are per call, usually per 128-sample audio block. RNNoise executes in bursts every 480 samples, so most adapter calls are cheaper. Quantiles cannot be summed. Compute time is not an added queue delay when a callback meets its deadline.

AudioWorklet may not expose `performance.now`. In that case the page explicitly labels the table as a **separate Node host measurement** for the selected mode; it does not invent live timings. Memory tables remain live. In the tested Chromium session the worklet clock was unavailable. Node benchmarking uses one second of calibration, one second of additional warmup and five seconds measured per condition. RTF is summed compute duration / audio duration. Report p50/p95/p99/max and counts above the 2.667 ms block budget; occasional overruns are retained. Initialization and calibration timings are separate. The benchmark's instrumentation, host contention and Node runtime influence results; it is not a wearable power/CPU prediction.

Memory counts are allocated typed-array buffers, deduplicated by underlying ArrayBuffer. The array numeric state is 190,208 bytes; scene delay lines 2,048 bytes; channel buffers 3,072 bytes. Two neural adapter input/output pairs take 7,680 bytes. WASM reserves a 16 MiB linear-memory heap shared by both neural states. This is not 16 MiB of network weights. Decoded source PCM, profiler rings, vendor bundle bytes and whole-process RSS are reported separately. JS objects, code/JIT, browser/decoder memory and device buffers are not included in the typed-array totals. Node RSS high-water mark spans the entire process, not isolated components.

The existing audiogram/NAL-R approximation and WDRC are not in this array path. Their original total benchmark remains `compute-benchmark.json`; no component-specific timing for that older path is claimed here. Integrating fitting after enhancement, then validating the combined perceptual chain, is a further experiment.

## Reproduction and evaluation

```
python -m http.server 8000 --directory dist
# Open http://localhost:8000/array.html and Start.
npm test
npm run benchmark:array
npm run evaluate:array
```

No npm installation is needed: the pinned runtime and model are bundled. Benchmark scripts use the same DSP classes as the browser. Node's deterministic linear 16→48 kHz resampler differs from browser `decodeAudioData`; do not treat waveform samples as bit-identical. Neither benchmark includes live microphone capture. Avoid running evaluations and benchmarks concurrently. The browser supports a mono source file rendered into four simulated channels, not four physical live microphones.

`array-evaluation.json` evaluates target at 0°, masker at 0°, 30° and 90°, input SNR 0/5/10/15 dB, steering errors 0° and 20°. Noise-only training and evaluation use distinct seeds. After freezing weights, target and noise are passed separately through the same linear filter; output component energy defines SNR and gain relative to the reference ear. This decomposition is valid for these frozen linear processors; **do not use it to score nonlinear RNNoise, WDRC or a limiter**. The neural baseline currently has runtime, finite-output, persistent-state and latency tests, not an intelligibility superiority claim.

Discard 100 ms at startup and evaluate three seconds of one speech clip loop. This is an engineering check, not held-out multi-speaker or clinical validation. Colocated target/noise is a negative control. Steering error also changes target level, which is reported alongside SNR improvement. The source file and published dataset attribution remain in THIRD_PARTY.md. Baselines are not loudness-normalized independently during listening; enhancement can change level. Informal toggle listening is not a blinded perceptual score.

## Localization, tracking and the next study

Localization is needed for automatic steering toward a moving source, but not for manual steering or headphone rendering from known scene coordinates. A DOA estimator supplies directions; selecting the intended voice is a separate task. Strongest-direction steering may follow an interferer. Adiloğlu et al. [2] demonstrate why steering/tracking matters; this lab does not reproduce their full system.

The next controlled comparison should retain manual/known-direction baselines, then add an SRP-PHAT or GCC-based DOA estimator, target association and head-coordinate tracking. Report angular error, front/back confusions, target swaps, confidence and tracking lag; compare fixed-front, known-direction and estimated-direction beamforming. Estimator observation windows may add control lag without buffering the audio path. Measure both, with component compute and memory. Add moving speakers, head turns, multiple talkers and reverberant measured BTE/BRIR scenes before making robust localization claims.

Further neural candidates require documented pretrained weights, licenses, causal streaming state and matched latency/level evaluation. DeepFilterNet or a hearing-aid-specific low-latency binaural network belongs in that comparison; no placeholder model is counted as integrated. A native worker/real-time engine may be needed if burst inference misses browser deadlines. Add binaural HASPI/HASQI, cue error and listening tests before ranking algorithms.

Acoustic feedback cancellation concerns receiver-to-microphone coupling in a hearing aid. AEC concerns a separate known playback reference returning through an acoustic path. Neither is implemented in this isolated headphone rendering experiment, and neither is replaced by localization.

## References

[1] J. Capon, “High-resolution frequency-wavenumber spectrum analysis,” Proceedings of the IEEE, 57(8), 1408–1418, 1969. https://doi.org/10.1109/PROC.1969.7278

[2] K. Adiloğlu et al., “A Binaural Steering Beamformer System for Enhancing a Moving Speech Source,” Trends in Hearing, 19, 2015. https://doi.org/10.1177/2331216515618903

[3] J.-M. Valin, “A Hybrid DSP/Deep Learning Approach to Real-Time Full-Band Speech Enhancement,” MMSP, 2018. https://jmvalin.ca/papers/rnnoise_mmsp2018.pdf

[4] Jitsi, RNNoise WASM, pinned package 0.2.1. https://github.com/jitsi/rnnoise-wasm/tree/cb529a59a8478fe604e57986fc96afdaecfa6fb7

[5] Xiph.Org RNNoise implementation, pinned submodule. https://github.com/xiph/rnnoise/tree/372f7b4b76cde4ca1ec4605353dd17898a99de38

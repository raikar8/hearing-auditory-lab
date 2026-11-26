# Acoustic feedback and adaptive feedback cancellation (edition 0.5)

Source: `dist/feedback.js`, loop wiring in `dist/dsp.js`. Live in **index.html → panel 05** (condition D).
Evaluation: `npm run evaluate:feedback` → `dist/feedback-evaluation.json`. Tests: `tests/feedback.test.mjs`.

## The loop

A hearing aid's receiver (loudspeaker) output y leaks back to its own microphone through an acoustic path
F. The microphone signal is m = x + F∗y, where x is the incoming sound. With forward gain G, the closed loop
howls once |G·F| reaches 1 at a frequency where the loop phase is a multiple of 2π (Nyquist criterion; review:
van Waterschoot & Moonen 2011, Proc. IEEE 99:288, doi:10.1109/JPROC.2010.2090998).

The lab closes this loop sample by sample inside the existing engine, in condition D only. Condition C mixes
the loss illustration into the same band sums, so it has no clean receiver signal.

* **Feedback path F:** synthetic, not measured. Two damped resonances after an 8-sample bulk delay, 48 taps,
  scaled so the peak magnitude equals the *path gain* control. *Nominal*: 2.7 and 5.2 kHz, a BTE-like open
  fit. *Phone at ear*: 2.3 and 4.6 kHz and +12 dB.
* **Receiver saturation** at 115 dB SPL peak, under the lab's 100 dB SPL = 0 dBFS mapping. This bounds a howl the way a
  real receiver does. Saturation events are counted and used as a crude howl detector.
* **Forward path:** the existing NAL-R bands, WDRC, added delay and an optional frequency shift.

## Cancellers

All three cancellers subtract an estimate Ŵ∗y from m. Ŵ is a 64-tap FIR filter and the step size μ defaults to 0.004.

| Mode | Update | Why |
|---|---|---|
| Plain NLMS | Ŵ += μ·e·u / (‖u‖² + δ) on raw signals | Textbook baseline |
| NLMS + frequency shift | Same, with a 6 or 12 Hz single-sideband shift in the forward path (63-tap Hamming Hilbert filter, +0.70 ms) | Decorrelates the receiver signal from incoming sound |
| **PEM-AFC** (default) | NLMS on signals prewhitened by a model of the incoming sound | Removes the bias that makes plain NLMS fail on speech |

**Why NLMS fails on speech.** The receiver signal is a delayed, amplified copy of the incoming sound. For
voiced speech, a few milliseconds of delay is close to a pitch period, so the sound is predictable from the
receiver signal. NLMS then converges toward a *speech predictor* rather than F: the estimate is biased.
The biased filter is itself a feedback loop, and it can make a loop howl that is stable with no canceller at all.

**PEM-AFC** (prediction-error method; Spriet et al. 2005, IEEE TSP 53:3749) models the incoming sound with:
* a short-term LPC of order 16 (Levinson-Durbin, 60 Hz Gaussian lag window, bandwidth expansion γ = 0.9);
* a one-tap long-term (pitch) predictor searched between 2.5 and 16 ms, used if it explains at least 10 % of the residual energy.

The model is estimated from the feedback-compensated signal every 512 samples over a 23 ms Hann window, with
the two ears staggered. Both m and y pass through the same whitening filter before the NLMS update.

**Howl fallback (adaptation control).** While the receiver saturates, and for 100 ms afterwards, the
whitening filter is replaced by identity. Otherwise the predictor would model the howl tone as incoming
sound and whiten it away, and the canceller could never learn the path that causes it.

## Results (idealized simulation)

Setup: flat 50 dB HL, NAL-R, linear 1:1 compression, **4 ms forward delay**, 65 dB SPL input, measured KEMAR, 10 s
per run. A run counts as stable if none of its last 5 s has more receiver saturation than the feedback-free run, or more than 3 dB extra
output. The path gain is swept from −40 to +10 dB in 2.5 dB steps, so +10 means "no failure found up to the sweep edge".

| Input | No canceller | Plain NLMS | NLMS + 6 Hz | PEM-AFC |
|---|---:|---:|---:|---:|
| Speech + noise (10 dB SNR) | −25 | +10 (edge) | +10 (edge) | +10 (edge) |
| Speech in quiet | −25 | **unstable at every gain** | **unstable at every gain** | +10 (edge) |
| Tone complex in quiet | −22.5 | +10 (edge) | +10 (edge) | −7.5 (fails at −5 and 0) |

Maximum stable path gain in dB; higher is better.

Additional measurements:

* **Misalignment** of PEM at +10 dB path gain: −38.6 dB (speech + noise), −33.2 dB (speech in quiet).
* **Recovery after a path change.** The path switches to *phone at ear* (+12 dB) at 5 s. Every canceller saturates during the
  switch second, then has zero clipped samples. Plain NLMS on quiet speech never settles.
* **Wanted-sound damage** (output level change over the final 5 s vs the feedback-free run). Speech: within
  ±0.6 dB for all cancellers. Tone complex: −2.8 dB (NLMS), −2.2 dB (NLMS + shift), **−5.4 dB (PEM)**. Cancellers
  partly cancel periodic input. PEM, whose speech model treats a steady tone as predictable, is worst here,
  and it entrains (+5–9 dB excess without clipping) at −5 and 0 dB path gain.
* **Forward-delay ablation** (PEM, −30/−20/−10 dB path gain). At **0 ms the loop howls in every case**
  (misalignment +10 to +31 dB): with no delay the receiver signal is an almost instantaneous copy of the incoming
  sound. With 1, 2 or 4 ms every case is stable. The lab therefore raises a 0 ms added delay to 4 ms when the
  canceller is switched on.

## Cost

Node host, AMD Ryzen 5 5500U, 128-sample blocks at 44.1 kHz (2.90 ms budget), `dist/compute-benchmark-v05.json`:

| Configuration | Median ms | p95 ms | Max ms | Overruns | RTF |
|---|---:|---:|---:|---:|---:|
| Condition D baseline | 0.32 | 0.34 | 0.57 | 0 | 0.112 |
| + feedback path | 0.35 | 0.35 | 0.75 | 0 | 0.119 |
| + plain NLMS | 0.44 | 0.45 | 8.99 | 1 | 0.154 |
| + PEM-AFC | 0.82 | 1.59 | 2.66 | 0 | 0.363 |
| + PEM-AFC + 6 Hz shift | 1.60 | 1.72 | 2.90 | 0 | 0.394 |

The single NLMS overrun is an isolated 9 ms block, which looks like a runtime pause, not the algorithm. PEM with the
shift reached the block budget in its worst block. A browser worklet adds scheduling and I/O that this
host measurement excludes.

## Limits

* The feedback path is synthetic, time-invariant between user changes, shorter than the canceller, and has no noise.
  Real paths change continuously and have long tails. The stable-gain figures above are **upper bounds for
  this model**, not device performance, and should not be compared with published device results.
* Stability is judged from saturation and output level, not from a perceptual howl or artifact rating.
* One speaker, one tone complex, one audiogram. The misalignment and stable-gain bound use the simulator's true path
  and are not available to a real device.

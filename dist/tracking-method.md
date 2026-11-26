# Multi-source tracking and target selection (edition 0.5)

Source: `dist/tracking.js`. Live in **array.html → Steering controller → Tracked target**. Evaluation:
`npm run evaluate:tracking` → `dist/tracking-evaluation.json`. Tests: `tests/tracking.test.mjs`.

## Problem

The 0.4 SRP-PHAT controller steers MVDR to the single strongest direction. In the v0.4 study its target
direction error averaged 98.84 degrees because the strongest direction is often the interferer. A
beamformer that faithfully steers toward the masker makes things worse than no steering at all.

## Method

1. **Time-frequency voting.** For every 512-point STFT frame (2.67 ms hop, 48 kHz) and every bin between
   300 Hz and 4 kHz, PHAT-normalised cross-spectra of the six microphone pairs are smoothed over 20 ms. Each
   bin finds its best direction on the 5-degree grid using the existing SRP templates. A bin votes only if its
   normalised coherence is at least 0.6, and every bin's vote has weight equal to its coherence, not its energy. Speech is sparse
   in time and frequency (approximate W-disjoint orthogonality; Yilmaz & Rickard 2004, IEEE TSP 52:1830), so
   a weaker talker still wins the bins it dominates. A loud masker can no longer suppress it the way it
   suppresses an energy-weighted SRP map.
2. **Direction histogram.** Votes decay with a 150 ms time constant. Every 8 frames (21.3 ms) up to four
   peaks are taken: circular local maxima at least 15 % of the largest, at least 20 degrees apart, refined
   by parabolic interpolation.
3. **Tracks.** Alpha-beta filters (alpha 0.35, beta 0.05, velocity limited to ±90 deg/s), greedy
   nearest-neighbour association inside a 20-degree gate. A track is confirmed after 4 hits. Confirmed tracks
   coast with decaying velocity through speech pauses for up to 60 updates (1.28 s).
4. **Crossing guard.** While another confirmed track lies inside the selected track's gate, the selected
   track does not take any peaks and keeps its prediction. Without the guard, a talker walking through the
   target's direction captured the target track and dragged the beam away (error 22.7 degrees, steered
   nearer the masker 52 % of the time). With it the error is 0.6 degrees.
5. **Target selection.**
   * **Lock-on** (`lock`): the user designates a direction once, using the manual direction slider and
     *Lock onto source*. The nearest confirmed track within 45 degrees becomes the target, and it is followed by
     continuity of direction. If the track dies, the tracker re-acquires the nearest confirmed track within
     30 degrees of the last target direction. This is **identity by position**, not by voice.
   * **Speech-like** (`speech`): no direction prior. The tracker picks the confirmed track with the highest
     amplitude-modulation index (standard deviation / mean of its peak strength over ~0.5 s). The index must
     be at least 0.5: stationary noise measured 0.1–0.2 and speech above 1. Switching needs 30 % more
     modulation sustained for 0.5 s.

The localizer and tracker see only the four microphone mixtures. True angles and source stems are used
only by the evaluation scorer.

## Results

8 s per run after 1 s of target-muted noise calibration; the first second is excluded. The masker is either
seeded stationary noise or a second passage from the same LibriSpeech speaker. Gains are left-ear output SNR
relative to the unsteered front microphone pair, measured exactly by passing target-only and noise-only shadow
scenes through the identical time-varying filter. MVDR is used throughout, except for the crossing scenario,
which uses delay-and-sum because a moving masker invalidates the frozen MVDR noise statistics.

| Scenario | Method | SNR gain L (dB) | Mean abs. error (deg) | Within 10 deg | Steered nearer masker | Source switches |
|---|---|---:|---:|---:|---:|---:|
| loud_noise | known | 15.30 | 0.0 | 100% | 0% | 0 |
| loud_noise | dominant | -2.79 | 100.0 | 0% | 100% | 0 |
| loud_noise | track_lock | 15.30 | 0.0 | 100% | 0% | 0 |
| loud_noise | track_speech | 10.60 | 5.5 | 95% | 5% | 1 |
| moving_target | known | 13.17 | 0.3 | 100% | 0% | 0 |
| moving_target | dominant | -2.68 | 142.5 | 1% | 98% | 4 |
| moving_target | track_lock | 12.67 | 6.5 | 77% | 0% | 0 |
| moving_target | track_speech | 12.69 | 7.3 | 74% | 0% | 0 |
| two_talkers | known | 17.41 | 0.0 | 100% | 0% | 0 |
| two_talkers | dominant | 8.18 | 49.8 | 45% | 55% | 27 |
| two_talkers | track_lock | 17.37 | 0.2 | 100% | 0% | 0 |
| two_talkers | track_speech | 7.84 | 35.5 | 61% | 39% | 6 |
| crossing_talker | known | 2.04 | 0.0 | 100% | 0% | 0 |
| crossing_talker | dominant | 0.39 | 18.6 | 59% | 50% | 25 |
| crossing_talker | track_lock | 2.09 | 0.6 | 100% | 2% | 2 |
| crossing_talker | track_speech | 0.05 | 34.0 | 29% | 38% | 5 |

Scenarios: *loud_noise* has the target at 30 degrees and stationary noise at −70 degrees, −5 dB SNR.
*moving_target* sweeps the target from −45 to +45 degrees at 11.25 deg/s, with noise at 150 degrees and 0 dB SNR.
*two_talkers* has the target at 30 degrees and the second passage at −60 degrees, 0 dB SNR.
*crossing_talker* has the target at 0 degrees while the second passage moves from −90 to +90 degrees and crosses at 4 s.

## How to read this

* **Lock-on** matches known-direction steering when the target is static, and stays within 0.5 dB when it
  moves. Its 6.5-degree mean error on the moving target is tracking lag. It is told the target direction once
  at t = 0, which is a real privilege; the dominant and speech-like controllers get no direction.
* **Speech-like** selection solves speech-versus-stationary-noise without any prior (+10.6 dB where the
  dominant controller loses 2.8 dB). It **cannot** separate two talkers: both are modulated, so it picks
  roughly at random (+7.8 dB vs +17.4 dB for lock-on). Telling voices apart needs a speaker-identity cue,
  such as a voice embedding, which this lab does not have.
* The crossing case is reported because continuity-based identity is weakest there. The guard holds the
  prediction while sources overlap; a target that changes direction *during* the overlap would be lost.
* All results come from free-field simulation with one speaker's voice, idealized omnidirectional
  microphones, no room and no head shadow, and one seed per scenario. They are engineering checks of the
  controller logic, not perceptual or clinical results.

## Cost

Voting adds about 40 bins × 72 directions × 6 pairs ≈ 17k multiply-adds per 2.67 ms frame. Host
timings are in `array-benchmark-v05.json` (steeringMode `tracked`). The SRP templates are shared with the
existing localizer, so the only extra state is the per-bin cross-spectra and histogram (`tracking_numeric_bytes`).

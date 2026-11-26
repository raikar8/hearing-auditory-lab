// Simulated acoustic feedback loop and adaptive feedback cancellation (AFC), edition 0.5.
// Educational model: a synthetic receiver-to-microphone impulse response, a time-domain NLMS
// canceller and an optional Hilbert frequency shifter for decorrelation. See feedback-method.md.
// References: van Waterschoot & Moonen (2011) doi:10.1109/JPROC.2010.2090998 (review, MSG/ASG,
// NLMS bias under closed-loop correlation, frequency shifting as decorrelation).

export const AFC_TAPS = 64;
export const RECEIVER_LIMIT = 10 ** (15 / 20); // 115 dB SPL peak under the lab's 100 dB SPL = 0 dBFS mapping

// Two damped resonances after a short bulk delay, scaled so max |F(f)| equals gainDb.
// 'nominal' is a BTE-like open fit; 'changed' imitates a phone or hand near the ear: +12 dB and
// lower, sharper resonances. Values are engineering assumptions, not a measured feedback path.
const VARIANTS = {
  nominal: { delay: 8, modes: [[2700, 0.35, 1.0], [5200, 0.25, 0.6]], offsetDb: 0 },
  changed: { delay: 9, modes: [[2300, 0.55, 1.0], [4600, 0.4, 0.8]], offsetDb: 12 },
};

// |DFT| on n points with cached twiddles (no trig in the loop; safe to call from the audio thread).
const TWIDDLES = new Map();
export function magnitudeResponse(h, n = 1024) {
  let tw = TWIDDLES.get(n);
  if (!tw) { tw = [Float64Array.from({length: n}, (_, i) => Math.cos(2 * Math.PI * i / n)), Float64Array.from({length: n}, (_, i) => Math.sin(2 * Math.PI * i / n))]; TWIDDLES.set(n, tw); }
  const [c, s] = tw, out = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < h.length; t++) { const i = (k * (t + 1)) % n; re += h[t] * c[i]; im -= h[t] * s[i]; } // tap t acts on y[n-1-t]
    out[k] = Math.hypot(re, im);
  }
  return out;
}

export function feedbackPath(fs = 44100, { gainDb = -25, variant = 'nominal', taps = 48 } = {}) {
  const v = VARIANTS[variant];
  if (!v) throw Error(`Unknown feedback path variant ${variant}`);
  const h = new Float64Array(taps);
  for (let t = v.delay; t < taps; t++) {
    const s = (t - v.delay) / fs, taper = 0.5 + 0.5 * Math.cos(Math.PI * (t - v.delay) / (taps - v.delay));
    for (const [f, tauMs, amp] of v.modes) h[t] += amp * Math.exp(-s / (tauMs * 1e-3)) * Math.sin(2 * Math.PI * f * s + 0.3) * taper;
  }
  const peak = Math.max(...magnitudeResponse(h));
  const scale = 10 ** ((gainDb + v.offsetDb) / 20) / peak;
  for (let t = 0; t < taps; t++) h[t] *= scale;
  return h;
}

// Receiver history: ring[p..p+L-1] holds y[n-1], y[n-2], ... (double-written for contiguous reads).
export class ReceiverHistory {
  constructor(length = AFC_TAPS) { this.L = length; this.ring = new Float64Array(2 * length); this.p = 0; }
  push(y) { this.p = (this.p - 1 + this.L) % this.L; this.ring[this.p] = this.ring[this.p + this.L] = y; }
  dot(h) { let s = 0; const r = this.ring, p = this.p, n = Math.min(h.length, this.L); for (let k = 0; k < n; k++) s += h[k] * r[p + k]; return s; }
  power() { let s = 0; const r = this.ring, p = this.p; for (let k = 0; k < this.L; k++) s += r[p + k] * r[p + k]; return s; }
  reset() { this.ring.fill(0); this.p = 0; }
}

// Normalized LMS estimate of the feedback path driven by the receiver signal.
export class NLMSCanceller {
  constructor(taps = AFC_TAPS) { this.w = new Float64Array(taps); this.delta = 1e-6; }
  estimate(history) { return history.dot(this.w); }
  update(history, error, mu) {
    const g = mu * error / (history.power() + this.delta * this.w.length), r = history.ring, p = history.p;
    for (let k = 0; k < this.w.length; k++) this.w[k] += g * r[p + k];
  }
  reset() { this.w.fill(0); }
  // 10 log10(||f - w||^2 / ||f||^2); requires the simulator's true path, telemetry only.
  misalignmentDb(f) {
    let num = 0, den = 0;
    for (let k = 0; k < this.w.length; k++) { const t = k < f.length ? f[k] : 0, d = t - this.w[k]; num += d * d; den += t * t; }
    return den > 0 ? 10 * Math.log10(num / den + 1e-12) : null;
  }
}

// Prediction-error-method prewhitening (PEM-AFC; Spriet et al. 2005, IEEE TSP 53:3749; van Waterschoot &
// Moonen 2011). The incoming sound is modelled from the feedback-compensated signal by a short-term LPC
// (order 16, Levinson-Durbin) followed by a one-tap long-term (pitch) predictor, re-estimated every 11.6 ms
// over a 23 ms Hann window. The same whitening filter is applied to the microphone and receiver signals,
// so the NLMS update no longer learns to predict voiced speech from the delayed receiver signal.
// Adaptation control: while the receiver saturates (a crude howl detector) and for 100 ms afterwards the
// whitening falls back to identity, because a howl tone would otherwise be modelled as incoming sound and
// whitened away; plain NLMS converges fast when feedback dominates. Bandwidth expansion gamma = 0.9.
export class PEMWhitener {
  constructor(fs = 44100, order = 16, phase = 0) {
    this.gamma = 0.9; this.P = order; this.win = 1024; this.hop = 512; this.phase = phase; // phase staggers ears across render blocks
    this.minLag = Math.round(0.0025 * fs); this.maxLag = Math.round(0.016 * fs);
    this.R = 2048; // raw rings, power of two; longest history needed: maxLag + order + AFC_TAPS
    this.e = new Float64Array(this.R); this.m = new Float64Array(this.R); this.y = new Float64Array(this.R); this.n = 0;
    this.a = new Float64Array(order + 1); this.a[0] = 1; this.lag = 0; this.beta = 0;
    this.hann = Float64Array.from({length: this.win}, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / this.win));
    this.frame = new Float64Array(this.win); this.res = new Float64Array(this.win); this.r = new Float64Array(order + 1); this.tmp = new Float64Array(order + 1);
    this.u = new ReceiverHistory(AFC_TAPS); // whitened receiver history for the NLMS update
    this.hold = Math.round(0.1 * fs); this.sinceHowl = Infinity; this.bypassed = 0;
  }
  // Short-term then long-term whitening of ring x at absolute sample index t.
  white(x, t) {
    const M = this.R - 1, st = (i) => { let s = 0; for (let k = 0; k <= this.P; k++) s += this.a[k] * x[(i - k) & M]; return s; };
    return this.lag ? st(t) - this.beta * st(t - this.lag) : st(t);
  }
  // Called once per sample, before the canceller update: m = microphone, e = compensated signal, yPrev = y[n-1].
  step(m, e, yPrev, howling = false) {
    const M = this.R - 1, t = this.n;
    if (howling) { if (this.sinceHowl >= this.hold) { this.a.fill(0); this.a[0] = 1; this.lag = 0; } this.sinceHowl = 0; } else this.sinceHowl++;
    if (this.sinceHowl < this.hold) this.bypassed++;
    this.m[t & M] = m; this.e[t & M] = e; this.y[(t - 1) & M] = yPrev;
    this.u.push(this.white(this.y, t - 1));
    if ((t + this.phase) % this.hop === 0 && t >= this.win && this.sinceHowl >= this.hold) this.estimate(t);
    this.n++;
    return this.white(this.m, t);
  }
  estimate(t) {
    const M = this.R - 1, W = this.win, P = this.P, f = this.frame, r = this.r;
    for (let i = 0; i < W; i++) f[i] = this.e[(t - W + 1 + i) & M] * this.hann[i];
    for (let k = 0; k <= P; k++) { let s = 0; for (let i = k; i < W; i++) s += f[i] * f[i - k]; r[k] = s * (k ? Math.exp(-0.5 * (2 * Math.PI * 60 * k / 44100) ** 2) : 1.0001); }
    if (r[0] < 1e-9) return; // silence: keep the previous model
    const a = this.tmp; a.fill(0); a[0] = 1; let err = r[0];
    for (let i = 1; i <= P; i++) {
      let acc = r[i]; for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
      const k = -acc / err; const prev = Float64Array.from(a);
      for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
      a[i] = k; err *= 1 - k * k; if (err <= 0) return;
    }
    for (let k = 1; k <= P; k++) a[k] *= this.gamma ** k; // bandwidth expansion: a howl tone is not whitened away
    this.a.set(a);
    // Long-term predictor on the short-term residual of the unwindowed frame.
    const res = this.res; for (let i = 0; i < W; i++) { let s = 0; for (let k = 0; k <= P; k++) s += a[k] * this.e[(t - W + 1 + i - k) & M]; res[i] = s; }
    let best = 0, bestLag = 0, bestBeta = 0;
    for (let L = this.minLag; L <= this.maxLag; L++) {
      let xy = 0, yy = 0; for (let i = L; i < W; i++) { xy += res[i] * res[i - L]; yy += res[i - L] * res[i - L]; }
      if (yy > 0 && xy > 0 && xy * xy / yy > best) { best = xy * xy / yy; bestLag = L; bestBeta = xy / yy; }
    }
    let rr = 0; for (let i = 0; i < W; i++) rr += res[i] * res[i];
    const gain = rr > 0 ? best / rr : 0; // fraction of residual energy the pitch tap explains
    this.lag = gain > 0.1 ? bestLag : 0; this.beta = Math.min(1, bestBeta);
  }
  reset() { this.sinceHowl = Infinity; this.bypassed = 0; this.e.fill(0); this.m.fill(0); this.y.fill(0); this.n = 0; this.a.fill(0); this.a[0] = 1; this.lag = 0; this.beta = 0; this.u.reset(); }
}

// Single-sideband frequency shift: y = x_d cos(phi) - H{x} sin(phi). Hamming-windowed FIR Hilbert transformer
// (63 taps) adds 31 samples (0.70 ms at 44.1 kHz) of forward-path delay when enabled. Its magnitude is within
// 4% of unity from 1 kHz upward; below that the shift is incomplete and leaves a mirror component
// (|H| = 0.67 at 500 Hz), which listeners hear as slight roughness on low-frequency tones.
export class FrequencyShifter {
  constructor(fs = 44100, taps = 63) {
    this.fs = fs; this.taps = taps; this.c = (taps - 1) / 2; this.h = new Float64Array(taps);
    for (let i = 0; i < taps; i++) {
      const n = i - this.c, w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1)); // Hamming
      this.h[i] = n % 2 ? (2 / (Math.PI * n)) * w : 0;
    }
    this.ring = new Float64Array(2 * taps); this.p = 0; this.phase = 0;
  }
  get delaySamples() { return this.c; }
  process(x, shiftHz) {
    const L = this.taps; this.p = (this.p - 1 + L) % L; this.ring[this.p] = this.ring[this.p + L] = x;
    let hil = 0; for (let k = 0; k < L; k++) hil += this.h[k] * this.ring[this.p + k];
    const xd = this.ring[this.p + this.c];
    this.phase += 2 * Math.PI * shiftHz / this.fs; if (this.phase > Math.PI) this.phase -= 2 * Math.PI;
    return xd * Math.cos(this.phase) - hil * Math.sin(this.phase);
  }
  reset() { this.ring.fill(0); this.p = 0; this.phase = 0; }
}

// Magnitude-only (conservative) maximum stable broadband gain in dB: -20 log10 max_f |F(f) - W(f)|.
// The true MSG also requires the loop phase condition; this bound ignores phase and the WDRC forward path.
export function magnitudeBoundMSG(f, w = null) {
  const L = Math.max(f.length, w ? w.length : 0), r = new Float64Array(L);
  for (let k = 0; k < L; k++) r[k] = (k < f.length ? f[k] : 0) - (w && k < w.length ? w[k] : 0);
  return -20 * Math.log10(Math.max(...magnitudeResponse(r)) + 1e-12);
}

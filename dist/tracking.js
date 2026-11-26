// Multi-source localization and target tracking, edition 0.5. See tracking-method.md.
// 1. Time-frequency voting: every STFT bin between 300 Hz and 4 kHz votes for its own best SRP-PHAT
//    direction (equal weight per coherent bin), so a weaker but sparse talker still wins the bins it dominates
//    (W-disjoint orthogonality of speech: Yilmaz & Rickard 2004, IEEE TSP 52:1830).
// 2. A decaying direction histogram gives up to four peaks every 21.3 ms.
// 3. Alpha-beta tracks with gating, confirmation and coasting through speech pauses.
// 4. Target selection: 'lock' keeps the track the user designated (identity by continuity, not by voice),
//    'speech' picks the most amplitude-modulated confirmed track (stationary noise is weakly modulated).
// Uses observed microphone spectra only; true angles are used by the evaluation scorer, never here.
import {FS, N, H} from './array-dsp.js';
import {Localizer, wrap} from './localization.js';

const GRID = 72, STEP = 5;

export class MultiSourceLocalizer {
  constructor(base = new Localizer()) {
    this.base = base; // shares SRP templates, pairs and band limits (no duplicate 276 kB table)
    this.cr = new Float64Array(6 * base.bins); this.ci = new Float64Array(this.cr.length);
    this.alpha = Math.exp(-H / (FS * 0.02)); // 20 ms per-bin cross-spectrum smoothing
    this.decay = Math.exp(-H / (FS * 0.15)); // 150 ms histogram memory
    this.hist = new Float64Array(GRID); this.smooth = new Float64Array(GRID); this.score = new Float64Array(GRID);
    this.frame = 0; this.peaks = []; this.minCoherence = 0.6; this.votes = 0;
  }
  get channels() { return this.base.channels; }
  reset() { this.cr.fill(0); this.ci.fill(0); this.hist.fill(0); this.frame = 0; this.peaks = []; }
  // Returns true when a new peak list is available (every 8 frames).
  process(xr, xi) {
    const b = this.base, bins = b.bins, a = this.alpha, two = b.channels === 2;
    let energy = 0; for (let k = b.lo; k <= b.hi; k++) energy += xr[0][k] ** 2 + xi[0][k] ** 2;
    for (let g = 0; g < GRID; g++) this.hist[g] *= this.decay;
    if (energy / (N * N) >= 1e-10) {
      const floor = 1e-4 * energy / bins; // ignore bins 40 dB below the mean bin energy
      for (let k = b.lo; k <= b.hi; k++) {
        const q0 = k - b.lo, pw = xr[0][k] ** 2 + xi[0][k] ** 2;
        for (let p = 0; p < 6; p++) {
          if (two && p !== 1) continue;
          const [i, j] = b.pairs[p], re = xr[i][k] * xr[j][k] + xi[i][k] * xi[j][k], im = xi[i][k] * xr[j][k] - xr[i][k] * xi[j][k], mag = Math.max(Math.hypot(re, im), 1e-15), q = p * bins + q0;
          this.cr[q] = a * this.cr[q] + (1 - a) * re / mag; this.ci[q] = a * this.ci[q] + (1 - a) * im / mag;
        }
        if (pw < floor) continue;
        let best = -Infinity, arg = -1;
        for (let g = 0; g < GRID; g++) {
          if (Math.abs(wrap(-180 + STEP * g - b.anchor)) > b.sector) continue;
          let s = 0;
          for (let p = 0; p < 6; p++) { if (two && p !== 1) continue; const q = p * bins + q0, t = g * 6 * bins + q; s += this.cr[q] * b.templatesR[t] + this.ci[q] * b.templatesI[t]; }
          if (s > best) { best = s; arg = g; }
        }
        const coherence = best / (two ? 1 : 6);
        if (arg >= 0 && coherence >= this.minCoherence) { this.hist[arg] += coherence; this.votes++; }
      }
    }
    if (++this.frame % 8 !== 0) return false;
    for (let g = 0; g < GRID; g++) this.smooth[g] = 0.25 * this.hist[(g + GRID - 1) % GRID] + 0.5 * this.hist[g] + 0.25 * this.hist[(g + 1) % GRID];
    let max = 0; for (const v of this.smooth) max = Math.max(max, v);
    const cand = [];
    for (let g = 0; g < GRID; g++) {
      const v = this.smooth[g];
      if (v > 0.5 && v >= 0.15 * max && v >= this.smooth[(g + GRID - 1) % GRID] && v > this.smooth[(g + 1) % GRID]) {
        // parabolic refinement on the 5-degree grid
        const l = this.smooth[(g + GRID - 1) % GRID], r = this.smooth[(g + 1) % GRID], d = l - 2 * v + r, off = d < 0 ? 0.5 * (l - r) / d : 0;
        cand.push({angle: wrap(-180 + STEP * (g + off)), strength: v});
      }
    }
    cand.sort((x, y) => y.strength - x.strength);
    this.peaks = [];
    for (const c of cand) if (this.peaks.length < 4 && this.peaks.every(p => Math.abs(wrap(p.angle - c.angle)) >= 20)) this.peaks.push(c);
    return true;
  }
}

let nextId = 1;
export class Tracker {
  constructor({gate = 20, alpha = 0.35, beta = 0.05, confirmHits = 4, maxMisses = 60, maxTracks = 6} = {}) {
    Object.assign(this, {gate, alpha, beta, confirmHits, maxMisses, maxTracks});
    this.dt = 8 * H / FS; this.tracks = []; this.policy = 'lock'; this.targetId = null; this.pendingLock = null;
    this.lastTarget = null; this.switches = 0; this.challenger = null; this.challengeTime = 0;
    this.modTau = Math.exp(-this.dt / 0.5); this.minModulation = 0.5; // stationary noise measured ~0.1-0.2, speech > 1
  }
  reset() { this.tracks = []; this.targetId = null; this.lastTarget = null; this.switches = 0; this.challenger = null; }
  lock(angle) { this.pendingLock = wrap(angle); this.targetId = null; }
  configure({policy} = {}) { if (policy && policy !== this.policy) { this.policy = policy; this.targetId = null; this.challenger = null; } }
  // Peak-strength modulation index: std/mean over ~0.5 s. Speech (syllables, pauses) >> stationary noise.
  modulation(t) { const m = t.m1, v = Math.max(0, t.m2 - m * m); return m > 1e-9 ? Math.sqrt(v) / m : 0; }
  update(peaks) {
    const dt = this.dt;
    for (const t of this.tracks) t.angle = wrap(t.angle + t.vel * dt);
    // Crossing guard: while another confirmed track is inside the selected track's gate, peaks cannot be
    // attributed reliably, so the selected track coasts (keeps its prediction) instead of being captured.
    const sel = this.tracks.find(t => t.id === this.targetId);
    this.frozen = !!sel && sel.confirmed && this.tracks.some(o => o !== sel && o.confirmed && Math.abs(wrap(o.angle - sel.angle)) < this.gate);
    const pairs = [];
    this.tracks.forEach((t, ti) => { if (this.frozen && t === sel) return; peaks.forEach((p, pi) => { const d = Math.abs(wrap(p.angle - t.angle)); if (d <= this.gate) pairs.push([d, ti, pi]); }); });
    pairs.sort((a, b) => a[0] - b[0]);
    const usedT = new Set(), usedP = new Set();
    for (const [, ti, pi] of pairs) {
      if (usedT.has(ti) || usedP.has(pi)) continue; usedT.add(ti); usedP.add(pi);
      const t = this.tracks[ti], p = peaks[pi], r = wrap(p.angle - t.angle);
      t.angle = wrap(t.angle + this.alpha * r); t.vel = Math.max(-90, Math.min(90, t.vel + this.beta * r / dt));
      t.hits++; t.misses = 0; t.strength = p.strength; if (t.hits >= this.confirmHits) t.confirmed = true;
    }
    this.tracks.forEach((t, ti) => { if (!usedT.has(ti)) { if (!(this.frozen && t === sel)) t.misses++; t.strength = 0; t.vel *= 0.9; } t.age++; t.m1 = this.modTau * t.m1 + (1 - this.modTau) * t.strength; t.m2 = this.modTau * t.m2 + (1 - this.modTau) * t.strength ** 2; });
    this.tracks = this.tracks.filter(t => t.misses <= (t.confirmed ? this.maxMisses : 5));
    peaks.forEach((p, pi) => { if (!usedP.has(pi) && this.tracks.length < this.maxTracks) this.tracks.push({id: nextId++, angle: p.angle, vel: 0, hits: 1, misses: 0, age: 0, strength: p.strength, m1: p.strength, m2: p.strength ** 2, confirmed: false}); });
    this.select();
    return this.target();
  }
  select() {
    const confirmed = this.tracks.filter(t => t.confirmed), current = this.tracks.find(t => t.id === this.targetId);
    const choose = (t) => { if (t && t.id !== this.targetId) { if (this.targetId !== null) this.switches++; this.targetId = t.id; } };
    if (this.policy === 'lock') {
      if (this.pendingLock !== null) {
        const near = confirmed.filter(t => Math.abs(wrap(t.angle - this.pendingLock)) <= 45).sort((a, b) => Math.abs(wrap(a.angle - this.pendingLock)) - Math.abs(wrap(b.angle - this.pendingLock)))[0];
        if (near) { this.targetId = near.id; this.lastTarget = near.angle; this.pendingLock = null; }
        return;
      }
      if (!current && this.lastTarget !== null) { // track lost: re-acquire near the last known target direction
        const near = confirmed.filter(t => Math.abs(wrap(t.angle - this.lastTarget)) <= 30).sort((a, b) => Math.abs(wrap(a.angle - this.lastTarget)) - Math.abs(wrap(b.angle - this.lastTarget)))[0];
        choose(near);
      }
    } else { // 'speech': most modulated confirmed track above minModulation, 30 % hysteresis held for 0.5 s
      const speechLike = confirmed.filter(t => this.modulation(t) >= this.minModulation);
      if (!speechLike.length) return; // nothing speech-like: keep the current track or coast on the last direction
      const best = speechLike.reduce((a, b) => this.modulation(b) > this.modulation(a) ? b : a);
      if (!current || this.modulation(current) < this.minModulation && current.misses === 0) { choose(best); this.challenger = null; const t = this.tracks.find(x => x.id === this.targetId); if (t) this.lastTarget = t.angle; return; }
      if (best.id !== current.id && this.modulation(best) > 1.3 * this.modulation(current)) {
        if (this.challenger !== best.id) { this.challenger = best.id; this.challengeTime = 0; }
        this.challengeTime += this.dt; if (this.challengeTime >= 0.5) { choose(best); this.challenger = null; }
      } else this.challenger = null;
    }
    const t = this.tracks.find(x => x.id === this.targetId); if (t) this.lastTarget = t.angle;
  }
  target() { const t = this.tracks.find(x => x.id === this.targetId); return t ? t.angle : this.lastTarget; }
  report() {
    return {policy: this.policy, target_id: this.targetId, crossing_hold: !!this.frozen, target_deg: this.target(), awaiting_lock_deg: this.pendingLock, switches: this.switches,
      tracks: this.tracks.filter(t => t.confirmed).map(t => ({id: t.id, angle_deg: t.angle, velocity_deg_s: t.vel, strength: t.strength, modulation: this.modulation(t), coasting: t.misses > 0}))};
  }
}

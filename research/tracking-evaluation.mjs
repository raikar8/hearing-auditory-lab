// Steering-controller comparison on full waveforms: simulated 4-mic mixtures -> STFT -> localizer/tracker ->
// MVDR steering. Target/noise-only "shadow" scenes pass through the identical time-varying linear filter,
// so output SNR is measured exactly. Truth (true angles, stems) is used only by the scorer.
// Usage: node research/tracking-evaluation.mjs [explore]
import fs from 'node:fs';
import {Scene, Beamformer, H, FS} from '../dist/array-dsp.js';
import {Localizer, wrap} from '../dist/localization.js';
import {MultiSourceLocalizer, Tracker} from '../dist/tracking.js';
import {speech} from './array-benchmark.mjs';

const target = speech(), talker = speech('dist/assets/interferer.wav');
const SECONDS = 8, CAL_BLOCKS = 375, WARM = 1.0;

export const SCENARIOS = {
  loud_noise: {note: 'target 30 deg; stationary low-pass noise at -70 deg; -5 dB SNR', masker: 'noise', snr: -5, target: () => 30, maskerAt: () => -70},
  moving_target: {note: 'target sweeps -45 to +45 deg at 11.25 deg/s; noise at 150 deg; 0 dB SNR', masker: 'noise', snr: 0, target: (t) => -45 + 11.25 * t, maskerAt: () => 150},
  two_talkers: {note: 'target talker 30 deg; second passage (same speaker) at -60 deg; 0 dB SNR', masker: 'speech', snr: 0, target: () => 30, maskerAt: () => -60},
  crossing_talker: {note: 'target talker 0 deg; second passage moves -90 to +90 deg at 22.5 deg/s, crossing at 4 s; 0 dB SNR; delay-and-sum (a moving masker invalidates the calibrated MVDR statistics)', beam: 'das', masker: 'speech', snr: 0, target: () => 0, maskerAt: (t) => -90 + 22.5 * t},
};
export const METHODS = ['reference', 'known', 'dominant', 'track_lock', 'track_speech'];

function scenePair(s) {
  const make = (kind) => { const sc = new Scene(); sc.seed = 20261126; sc.sources = [kind === 'noise' ? new Float32Array(target.length) : target, talker]; sc.configure({target: s.target(0), masker: s.maskerAt(0), snr: kind === 'target' ? 300 : s.snr, noise: s.masker}); return sc; };
  return {mix: make('mix'), tgt: make('target'), nse: make('noise')};
}

export function run(name, method, log = null) {
  const s = SCENARIOS[name], sc = scenePair(s), bf = {mix: new Beamformer(), tgt: new Beamformer(), nse: new Beamformer()};
  const buf = () => Array.from({length: 4}, () => new Float32Array(H)), out = () => [new Float32Array(H), new Float32Array(H)];
  const io = {mix: [buf(), out()], tgt: [buf(), out()], nse: [buf(), out()]};
  // Noise covariance from 1 s with the target muted (the existing calibration privilege), copied to shadows.
  bf.mix.calibrate(); for (let i = 0; i < CAL_BLOCKS; i++) { sc.mix.process(io.mix[0], true); bf.mix.process(io.mix[0], io.mix[1]); }
  for (const k of ['tgt', 'nse']) { bf[k].rr.set(bf.mix.rr); bf[k].ri.set(bf.mix.ri); bf[k].noiseFrames = bf.mix.noiseFrames; }
  const beamMethod = method === 'reference' ? 'reference' : s.beam ?? 'mvdr';
  let steer = method === 'reference' ? 0 : s.target(0); // lock privilege: the user points at the target once at t = 0
  const setSteer = (a) => { const q = Math.round(a); if (q === steer && bf.mix.angle === q) return; steer = q; for (const b of Object.values(bf)) b.configure({method: beamMethod, angle: q}); };
  for (const b of Object.values(bf)) b.configure({method: beamMethod, angle: steer});
  // Reset beamformer streaming state so all three start aligned after calibration.
  for (const b of Object.values(bf)) { b.history.forEach(h => h.fill(0)); b.ola.forEach(o => o.fill(0)); b.p = 0; b.op = 0; b.samples = 0; }
  const loc = new Localizer(), ms = new MultiSourceLocalizer(loc), tr = new Tracker();
  if (method === 'track_speech') tr.configure({policy: 'speech'}); else tr.lock(s.target(0));
  let time = 0; const trace = [];
  bf.mix.onSpectrum = (xr, xi) => {
    if (method === 'dominant' && loc.process(xr, xi)) { if (loc.valid && loc.confidence >= 0.02) setSteer(loc.direction); trace.push(time); }
    if (method.startsWith('track') && ms.process(xr, xi)) { const a = tr.update(ms.peaks); if (a !== null) setSteer(a); trace.push(time); if (log && trace.length % 24 === 0) log(time.toFixed(2), 'peaks', ms.peaks.map(p => p.angle.toFixed(0) + ':' + p.strength.toFixed(1)).join(' '), '| tracks', tr.report().tracks.map(t => `${t.id}@${t.angle_deg.toFixed(0)} m${t.modulation.toFixed(2)}`).join(' '), '| target', a?.toFixed(0)); }
  };
  const blocks = Math.round(SECONDS * FS / H), energy = {tgt: [0, 0], nse: [0, 0], refT: 0}, steps = [];
  for (let b = 0; b < blocks; b++) {
    time = b * H / FS;
    const ta = s.target(time), ma = s.maskerAt(time);
    for (const k of ['mix', 'tgt', 'nse']) { sc[k].configure({target: ta, masker: ma}); sc[k].process(io[k][0], false); }
    if (method === 'known') setSteer(ta);
    for (const k of ['mix', 'tgt', 'nse']) bf[k].process(io[k][0], io[k][1]);
    if (time >= WARM) for (const k of ['tgt', 'nse']) for (let e = 0; e < 2; e++) for (let i = 0; i < H; i++) energy[k][e] += io[k][1][e][i] ** 2;
    if (time >= WARM && b % 8 === 0) {
      const applied = method === 'reference' ? null : wrap(bf.mix.angle), err = applied === null ? null : Math.abs(wrap(applied - ta)), mErr = applied === null ? null : Math.abs(wrap(applied - ma));
      steps.push({time_s: +time.toFixed(4), target_deg: ta, masker_deg: wrap(ma), steering_deg: applied, error_deg: err, nearer_masker: applied === null ? null : mErr < err});
    }
  }
  const scored = steps.filter(x => x.error_deg !== null);
  return {scenario: name, method, output_snr_db: [0, 1].map(e => 10 * Math.log10(energy.tgt[e] / energy.nse[e])),
    mean_abs_error_deg: scored.length ? scored.reduce((a, x) => a + x.error_deg, 0) / scored.length : null,
    within_10deg_fraction: scored.length ? scored.filter(x => x.error_deg <= 10).length / scored.length : null,
    nearer_masker_fraction: scored.length ? scored.filter(x => x.nearer_masker).length / scored.length : null,
    source_switches: scored.reduce((n, x, i) => n + (i > 0 && x.nearer_masker !== scored[i - 1].nearer_masker ? 1 : 0), 0) || (scored.length ? 0 : null),
    track_reacquisitions: method.startsWith('track') ? tr.switches : null, steering_trace: steps.filter((_, i) => i % 4 === 0)};
}

export function evaluate(log = console.log) {
  const rows = [];
  for (const name of Object.keys(SCENARIOS)) {
    let ref = null;
    for (const method of METHODS) {
      const r = run(name, method); if (method === 'reference') ref = r.output_snr_db;
      r.snr_gain_vs_reference_db = r.output_snr_db.map((v, e) => v - ref[e]); rows.push(r);
      log(name.padEnd(16), method.padEnd(13), 'gainL', r.snr_gain_vs_reference_db[0].toFixed(2), 'MAE', r.mean_abs_error_deg?.toFixed(1) ?? '-', 'w10', r.within_10deg_fraction?.toFixed(2) ?? '-', 'nearMasker', r.nearer_masker_fraction?.toFixed(2) ?? '-', 'srcSwitch', r.source_switches ?? '-');
    }
  }
  return rows;
}

if (process.argv[1]?.endsWith('tracking-evaluation.mjs')) {
  if (process.argv[2] === 'explore') { const [name, method] = [process.argv[3] ?? 'loud_noise', process.argv[4] ?? 'track_lock']; const r = run(name, method, console.log); console.log({...r, steering_trace: undefined}); }
  else {
    const rows = evaluate();
    fs.writeFileSync('dist/tracking-evaluation.json', JSON.stringify({version: '0.5', utc: new Date().toISOString(), node: process.version,
      scope: `Free-field 4-microphone simulation, one LibriSpeech speaker for both talkers, ${SECONDS} s per run after 1 s target-muted noise calibration; first ${WARM} s excluded. MVDR (loading 0.01) for all steered methods except crossing_talker (delay-and-sum); SNR gain is relative to the unsteered front-pair reference. 'known' uses the true target angle (upper bound). 'track_lock' is told the target direction once at t = 0 (user designation); 'dominant' and 'track_speech' receive no direction. Steering quantized to 1 degree. Not a perceptual or clinical result.`,
      scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.note])), methods: METHODS, rows}, null, 1));
  }
}

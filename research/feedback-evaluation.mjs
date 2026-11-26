// Closed-loop feedback evaluation of the actual browser engine (dist/dsp.js) in Node.
// Truth (the synthetic feedback path) is used only by the scorer: misalignment and the reference run.
// Usage: node research/feedback-evaluation.mjs            full sweep + delay ablation -> dist/feedback-evaluation.json
//        node research/feedback-evaluation.mjs rescore    recompute score fields from stored per-second data
//        node research/feedback-evaluation.mjs ablation   rerun only the forward-delay ablation
import fs from 'node:fs';
import {Engine} from '../dist/dsp.js';
import {magnitudeBoundMSG, feedbackPath} from '../dist/feedback.js';
import {speech} from './array-benchmark.mjs';

const FS = 44100, BLOCK = 128, SECONDS = 10;
const hrir = JSON.parse(fs.readFileSync('dist/assets/kemar-horizontal.json'));
const resample = (x) => Float32Array.from({length: Math.floor(x.length * FS / 48000)}, (_, i) => { const p = i * 48000 / FS, j = Math.floor(p), f = p - j; return (1 - f) * x[j] + f * x[Math.min(j + 1, x.length - 1)]; });
// speech() scales to RMS 0.05 (74 dB SPL under 100 dB SPL = 0 dBFS); rescale to 65 dB SPL conversational level.
const LEVEL = 10 ** ((65 - 74) / 20), RMS65 = 0.05 * LEVEL;
const target = resample(speech('dist/assets/speech.wav')).map(v => v * LEVEL);
// Tonal input (three harmonics of 440 Hz, slow 0.5 Hz amplitude modulation): the classic case in which a
// closed-loop NLMS estimate is biased by the input's own autocorrelation.
const tonal = (() => { const x = Float32Array.from({length: FS * 4}, (_, i) => { const t = i / FS; return (Math.sin(2 * Math.PI * 440 * t) + .5 * Math.sin(2 * Math.PI * 880 * t) + .3 * Math.sin(2 * Math.PI * 1320 * t)) * (0.75 + 0.25 * Math.sin(2 * Math.PI * .5 * t)); }); const r = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length); return x.map(v => v * RMS65 / r); })();

export const BASE = {mode: 'D', left: [50, 50, 50, 50, 50, 50], right: [50, 50, 50, 50, 50, 50], ratio: 1, delay: 4, direct: 0, target: 0, masker: 90, noise: 'noise', volume: 0};
// The engine's stationary noise is not level-scaled: an snr setting of 19 dB gives 10 dB after the 9 dB target rescale.
export const INPUTS = {
  speech_in_noise: {source: target, snr: 19, note: 'speech 0 deg + stationary noise 90 deg, 10 dB SNR'},
  speech_quiet: {source: target, snr: 60, note: 'speech only'},
  tonal_quiet: {source: tonal, snr: 60, note: 'harmonic tone complex only'},
};
export const CONDITIONS = {
  no_afc: {feedback: true, afc: false, freqShift: 0},
  nlms: {feedback: true, afc: true, afcMode: 'nlms', freqShift: 0},
  nlms_shift6hz: {feedback: true, afc: true, afcMode: 'nlms', freqShift: 6},
  pem: {feedback: true, afc: true, afcMode: 'pem', freqShift: 0},
};

export function run(config, input, seconds = SECONDS, change = null, setup = null) {
  const e = new Engine(FS); e.setHRIR(hrir); e.setSource(0, input.source); e.configure({...BASE, snr: input.snr, ...config}); e.master = 1; setup?.(e);
  const l = new Float32Array(BLOCK), r = new Float32Array(BLOCK), blocks = Math.ceil(seconds * FS / BLOCK), perSecond = [], trace = [];
  let acc = 0, n = 0, clips = 0, last = 0;
  for (let b = 0; b < blocks; b++) {
    if (change && b === Math.round(change.at_s * FS / BLOCK)) { e.configure(change.config); last = 0; }
    e.process(l, r);
    const now = e.clips; clips += now - last; last = now;
    for (let i = 0; i < BLOCK; i++) acc += l[i] * l[i];
    n += BLOCK;
    if (n >= FS) { perSecond.push({rms_db: 10 * Math.log10(acc / n + 1e-20), clips}); clips = 0; acc = 0; n = 0; }
    if (b % 86 === 0 && config.afc) trace.push({time_s: +(b * BLOCK / FS).toFixed(3), misalignment_db: e.feedbackReport().misalignment_db[0]});
  }
  return {perSecond, trace, report: e.feedbackReport(), weights: e.afc[0].w.slice()};
}

// A second is "howling" when it has more receiver saturations than the feedback-free run, or > 3 dB more output.
// Stable = no howling second in the final 5 s. Time to stable = start of the first second after which none howl.
// tail_level_change_db: mean output level change versus the feedback-free run over the final 5 s. Negative values
// mean the canceller removes part of the wanted sound (a known AFC artifact for periodic input).
export function score(perSecond, refPerSecond) {
  const howl = perSecond.map((s, i) => s.clips > refPerSecond[i].clips || s.rms_db - refPerSecond[i].rms_db > 3);
  const tail = howl.slice(-5), lastHowl = howl.lastIndexOf(true), diff = perSecond.slice(-5).map((s, i) => s.rms_db - refPerSecond.at(-5 + i).rms_db);
  return {stable: !tail.includes(true), howling_seconds: howl.filter(Boolean).length, time_to_stable_s: lastHowl < howl.length - 5 ? lastHowl + 1 : null,
    tail_excess_db: Math.max(...diff), tail_level_change_db: diff.reduce((a, b) => a + b, 0) / diff.length};
}
const maxStableOf = (rows) => { let best = null; for (const r of rows) { if (!r.stable) break; best = r.path_gain_db; } return best; };
function summarize(rows, inputs, conditions) {
  const maxStable = Object.fromEntries(inputs.map(i => [i, Object.fromEntries(conditions.map(c => [c, maxStableOf(rows.filter(r => r.input === i && r.condition === c))]))]));
  const asg = Object.fromEntries(Object.entries(maxStable).map(([i, m]) => [i, Object.fromEntries(conditions.filter(n => n !== 'no_afc').map(n => [n, m[n] === null || m.no_afc === null ? null : m[n] - m.no_afc]))]));
  return {max_stable_path_gain_db: maxStable, added_stable_gain_db: asg};
}

// Forward-delay ablation: the canceller needs decorrelation delay in the forward path.
export function ablation(log = console.log) {
  const rows = [];
  for (const inputName of ['speech_in_noise', 'speech_quiet']) {
    const input = INPUTS[inputName];
    for (const delay of [0, 1, 2, 4]) {
      const ref = run({feedback: false, delay}, input);
      for (const g of [-30, -20, -10]) {
        const res = run({...CONDITIONS.pem, feedbackGain: g, delay}, input), s = score(res.perSecond, ref.perSecond);
        rows.push({input: inputName, condition: 'pem', forward_delay_ms: delay, path_gain_db: g, ...s, final_misalignment_db: res.report.misalignment_db[0]});
        log('ablation', inputName.padEnd(16), `${delay} ms`, String(g).padStart(4), s.stable ? 'stable' : 'HOWL', `mis=${res.report.misalignment_db[0].toFixed(1)}`, `level=${s.tail_level_change_db.toFixed(1)}`);
      }
    }
  }
  return rows;
}

export function evaluate(log = console.log) {
  const gains = []; for (let g = -40; g <= 10; g += 2.5) gains.push(g);
  const rows = [], reference = {}, pathChange = {};
  for (const [inputName, input] of Object.entries(INPUTS)) {
    const ref = run({feedback: false}, input); reference[inputName] = ref.perSecond;
    for (const [name, c] of Object.entries(CONDITIONS)) {
      for (const g of gains) {
        const res = run({...c, feedbackGain: g}, input), s = score(res.perSecond, ref.perSecond), path = feedbackPath(FS, {gainDb: g});
        rows.push({input: inputName, condition: name, path_gain_db: g, ...s, final_misalignment_db: res.report.misalignment_db?.[0] ?? null,
          magnitude_bound_msg_db: magnitudeBoundMSG(path, c.afc ? res.weights : null), per_second: res.perSecond});
        log(inputName.padEnd(16), name.padEnd(14), String(g).padStart(5), s.stable ? 'stable' : 'HOWL  ', `howl s=${s.howling_seconds}`, `mis=${rows.at(-1).final_misalignment_db?.toFixed(1) ?? '-'}`);
      }
    }
    // Path change at 5 s: nominal -20 dB to 'changed' (+12 dB, shifted resonances), 12 s run.
    pathChange[inputName] = Object.fromEntries(Object.entries(CONDITIONS).map(([n, c]) => { const res = run({...c, feedbackGain: -20}, input, 12, {at_s: 5, config: {feedbackVariant: 'changed'}}); return [n, {per_second: res.perSecond, misalignment_trace: res.trace}]; }));
  }
  return {gains_db: gains, reference_per_second: reference, rows, ...summarize(rows, Object.keys(INPUTS), Object.keys(CONDITIONS)), path_change: pathChange};
}

if (process.argv[1]?.endsWith('feedback-evaluation.mjs')) {
  const mode = process.argv[2] ?? 'full', file = 'dist/feedback-evaluation.json';
  let result;
  if (mode === 'rescore' || mode === 'ablation') {
    result = JSON.parse(fs.readFileSync(file));
    for (const r of result.rows) Object.assign(r, score(r.per_second, result.reference_per_second[r.input]));
    Object.assign(result, summarize(result.rows, Object.keys(result.inputs), Object.keys(result.conditions)));
    if (mode === 'ablation') result.delay_ablation = ablation();
    result.rescored_utc = new Date().toISOString();
  } else {
    result = {version: '0.5', utc: new Date().toISOString(), node: process.version,
      scope: 'Idealized closed-loop simulation of the actual browser engine, mode D, left ear reported. Flat 50 dB HL audiogram, NAL-R gains, linear (1:1) compression, 4 ms forward delay, 65 dB SPL assumed input level, measured KEMAR HRIRs. Synthetic, time-invariant two-resonance feedback path (not measured) that fits inside the 64-tap canceller, no microphone noise or transducer nonlinearity: added stable gain is therefore an upper bound for this model, not a device result. Sweep -40 to +10 dB path gain in 2.5 dB steps; a value at the sweep edge means the limit was not reached. Stability judged on the last 5 s of 10 s (no second with excess receiver clipping or > 3 dB output excess). tail_level_change_db < 0 means wanted sound is cancelled. Magnitude-bound MSG ignores the loop phase condition and is conservative.',
      base: BASE, inputs: Object.fromEntries(Object.entries(INPUTS).map(([k, v]) => [k, {snr_setting: v.snr, note: v.note}])), conditions: CONDITIONS, step_size: 0.004, seconds_per_run: SECONDS, ...evaluate(), delay_ablation: ablation()};
  }
  fs.writeFileSync(file, JSON.stringify(result, null, 1));
  console.log(JSON.stringify({max_stable_path_gain_db: result.max_stable_path_gain_db, added_stable_gain_db: result.added_stable_gain_db}, null, 1));
}

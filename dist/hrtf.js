// HRIR set handling and anthropometric personalization, edition 0.5. See hrtf-method.md.
// Full-circle schema (format 'hearing-lab-hrir', version 2): 44.1 kHz, 128 taps, 72 azimuths -180:5:175,
// explicit left/right per azimuth (no mirroring). The bundled KEMAR half circle is mirrored into this form.
// Personalization is a model: ITD scaling in proportion to head width (spherical-head ITD is proportional
// to radius; Kuhn 1977 JASA 62:157; Algazi, Avendano & Duda 2001 J. Audio Eng. Soc. 49:472) and frequency
// scaling of the whole response (after Middlebrooks 1999 JASA 106:1480, who scaled directional transfer functions).

export const TAPS = 128, STEP = 5, COUNT = 72, FS = 44100;
export const KEMAR_HEAD_WIDTH_CM = 15.2; // assumed KEMAR head breadth (manikin: Burkhard & Sachs 1975 JASA 58:214); a reference, not a fit
export const FORMAT = 'hearing-lab-hrir';

const fit = (x) => { const y = new Float64Array(TAPS); for (let i = 0; i < Math.min(TAPS, x.length); i++) y[i] = x[i]; return y; };

// Accepts the bundled half-circle KEMAR file or a version-2 full-circle file; returns a full-circle set.
export function toFullCircle(set) {
  if (!set || typeof set !== 'object' || !Array.isArray(set.responses)) throw Error('HRIR file must be an object with a responses array');
  if (set.sample_rate !== FS) throw Error(`HRIR sample rate must be ${FS} Hz (got ${set.sample_rate}); resample with research/sofa_to_lab.py`);
  const list = (x) => Array.isArray(x) || ArrayBuffer.isView(x);
  for (const r of set.responses) {
    if (!Number.isFinite(r?.azimuth) || !list(r.left) || !list(r.right)) throw Error('Each response needs azimuth, left and right');
    if (r.left.length === 0 || r.left.length > 1024 || r.right.length !== r.left.length) throw Error('Left/right responses must have equal length, 1 to 1024 taps');
    for (const v of r.left) if (!Number.isFinite(v)) throw Error('HRIR taps must be finite numbers');
    for (const v of r.right) if (!Number.isFinite(v)) throw Error('HRIR taps must be finite numbers');
  }
  const by = new Map(set.responses.map(r => [Math.round(((r.azimuth + 180) % 360 + 360) % 360 - 180), r]));
  const half = set.coverage !== 'full';
  const responses = [];
  for (let i = 0; i < COUNT; i++) {
    const az = -180 + STEP * i;
    let r = by.get(az), left, right;
    if (r) { left = r.left; right = r.right; }
    else if (half && az === -180 && by.get(180)) { r = by.get(180); left = r.left; right = r.right; }
    else if (half && by.get(-az)) { r = by.get(-az); left = r.right; right = r.left; } // mirror: swap ears
    else throw Error(`HRIR set is missing azimuth ${az} degrees (need a 5-degree horizontal grid)`);
    responses.push({azimuth: az, left: fit(left), right: fit(right)});
  }
  return {format: FORMAT, version: 2, sample_rate: FS, coverage: 'full', azimuth_step_deg: STEP, source: set.source ?? 'unspecified', personalization: set.personalization ?? null, responses};
}

export function lookup(full, azimuth) {
  const i = ((Math.round(azimuth / STEP) + COUNT / 2) % COUNT + COUNT) % COUNT;
  return full.responses[i];
}

// Band-limited (windowed-sinc) evaluation of h at fractional index x; cutoff in units of Nyquist.
function sample(h, x, cutoff = 1) {
  const k0 = Math.floor(x); let s = 0;
  for (let k = k0 - 7; k <= k0 + 8; k++) {
    if (k < 0 || k >= h.length) continue;
    const d = x - k, w = 0.5 + 0.5 * Math.cos(Math.PI * d / 8.5), a = Math.PI * cutoff * d;
    s += h[k] * cutoff * (Math.abs(a) < 1e-12 ? 1 : Math.sin(a) / a) * w;
  }
  return s;
}
export function delayed(h, shift) { return Float64Array.from({length: h.length}, (_, n) => sample(h, n - shift)); }

// Left-minus-right arrival lag in microseconds (positive: left ear lags, source on the right).
export function itdMicroseconds(r, fs = FS, maxLag = 44) {
  const c = (lag) => { let s = 0; for (let n = 0; n < r.left.length; n++) { const j = n - lag; if (j >= 0 && j < r.right.length) s += r.left[n] * r.right[j]; } return s; };
  let best = 0, bestV = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) { const v = c(lag); if (v > bestV) { bestV = v; best = lag; } }
  const a = c(best - 1), b = c(best + 1), den = a - 2 * bestV + b, frac = den < 0 ? 0.5 * (a - b) / den : 0;
  return (best + frac) / fs * 1e6;
}

const onset = (h) => { const m = Math.max(...h.map(Math.abs)); return h.findIndex(v => Math.abs(v) >= 0.2 * m); };

// itdScale multiplies each azimuth's ITD; spectralScale s maps H(f) to H(f / s) (s < 1 lowers features).
export function personalize(full, {itdScale = 1, spectralScale = 1} = {}) {
  if (!(itdScale > 0.5 && itdScale < 1.5) || !(spectralScale > 0.7 && spectralScale < 1.3)) throw Error('Personalization factors out of range');
  const cutoff = Math.min(1, 1 / spectralScale), responses = full.responses.map(r => {
    const t0 = Math.min(onset(Array.from(r.left)), onset(Array.from(r.right)));
    // Frequency scaling about the first arrival keeps the bulk delay; h'(n) = s h(t0 + s (n - t0)).
    let left = r.left, right = r.right;
    if (spectralScale !== 1) {
      const warp = (h) => Float64Array.from({length: TAPS}, (_, n) => n < t0 - 8 ? 0 : spectralScale * sample(h, t0 + spectralScale * (n - t0), cutoff));
      left = warp(r.left); right = warp(r.right);
    }
    // Restore then scale the original ITD by delaying (or advancing) the lagging ear.
    const original = itdMicroseconds(r), now = itdMicroseconds({left, right}), shift = (itdScale * original - now) * FS / 1e6;
    if (Math.abs(shift) > 1e-3) { if (original >= 0) left = delayed(left, shift); else right = delayed(right, -shift); }
    return {azimuth: r.azimuth, left, right};
  });
  return {...full, personalization: {itd_scale: itdScale, spectral_scale: spectralScale, base: full.source}, responses};
}

export function headWidthToItdScale(widthCm) { return widthCm / KEMAR_HEAD_WIDTH_CM; }

// Serializable copy (plain arrays) for export or worklet transfer.
export function serialize(full) { return {...full, responses: full.responses.map(r => ({azimuth: r.azimuth, left: Array.from(r.left), right: Array.from(r.right)}))}; }

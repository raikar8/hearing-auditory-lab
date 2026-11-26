"""Convert a SOFA SimpleFreeFieldHRIR file into the lab's full-circle HRIR JSON (format version 2).

    python -m pip install h5py numpy
    python research/sofa_to_lab.py subject.sofa dist/assets/my-hrtf.json

Then choose "Custom set" in panel 06 of the lab and load the JSON. What the converter does:

* horizontal plane only: measurements with |elevation| <= --elevation-tolerance (default 2.5 deg);
* nearest measured azimuth for each 5-degree lab direction; fails if any is farther than --max-gap;
* SOFA azimuth is counterclockwise (+90 = left); the lab uses +90 = right, so azimuth is negated;
* receivers 0/1 are left/right unless ReceiverPosition says otherwise (y > 0 is left);
* windowed-sinc resampling to 44.1 kHz, one common time shift for all responses (keeps ITDs),
  128 taps with a 16-tap half-Hann fade-out;
* overall gain matched to the bundled KEMAR mean energy, so switching sets does not jump in level.

SOFA is a netCDF-4/HDF5 container (AES69). Only reading needs h5py; the conversion core uses numpy alone.
"""
from __future__ import annotations

import argparse
import json
import pathlib

import numpy as np

LAB_FS, TAPS, STEP = 44100, 128, 5
LAB_AZIMUTHS = np.arange(-180, 180, STEP)


def resample(ir: np.ndarray, fs_in: float, fs_out: float = LAB_FS, half_width: int = 16) -> np.ndarray:
    """Band-limited resampling of the last axis (windowed sinc, anti-aliased when downsampling)."""
    if fs_in == fs_out:
        return ir.astype(np.float64)
    ratio = fs_out / fs_in
    cutoff = min(1.0, ratio)
    n_out = int(np.ceil(ir.shape[-1] * ratio))
    t = np.arange(n_out) / ratio  # output instants in input samples
    k = np.floor(t)[:, None] + np.arange(-half_width + 1, half_width + 1)[None, :]
    d = t[:, None] - k
    kernel = cutoff * np.sinc(cutoff * d) * (0.5 + 0.5 * np.cos(np.pi * d / (half_width + 0.5)))
    valid = (k >= 0) & (k < ir.shape[-1])
    kernel = np.where(valid, kernel, 0.0)
    idx = np.clip(k, 0, ir.shape[-1] - 1).astype(int)
    return np.einsum('...ij,ij->...i', ir[..., idx], kernel)


def spherical(positions: np.ndarray, kind: str) -> np.ndarray:
    """Return (azimuth, elevation) in degrees, SOFA convention (counterclockwise azimuth)."""
    p = np.asarray(positions, dtype=np.float64)
    if kind.lower().startswith('cart'):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        return np.column_stack([np.degrees(np.arctan2(y, x)), np.degrees(np.arctan2(z, np.hypot(x, y)))])
    return p[:, :2]


def convert(ir: np.ndarray, fs: float, source_az_el: np.ndarray, *, left_receiver: int = 0,
            reference_energy: float | None = None, elevation_tolerance: float = 2.5, max_gap: float = 2.5,
            source: str = 'SOFA') -> dict:
    """ir: (measurements, receivers, samples). source_az_el: (measurements, 2) SOFA degrees."""
    ir = np.asarray(ir, dtype=np.float64)
    if ir.ndim != 3 or ir.shape[1] < 2:
        raise ValueError(f'Expected Data.IR with shape (M, 2, N); got {ir.shape}')
    az, el = source_az_el[:, 0], source_az_el[:, 1]
    horizontal = np.flatnonzero(np.abs(el) <= elevation_tolerance)
    if horizontal.size == 0:
        raise ValueError('No horizontal-plane measurements within the elevation tolerance')
    lab_az = (-az[horizontal] + 180) % 360 - 180  # counterclockwise -> clockwise (+ = right)
    chosen, errors = [], []
    for target in LAB_AZIMUTHS:
        diff = np.abs((lab_az - target + 180) % 360 - 180)
        j = int(np.argmin(diff))
        if diff[j] > max_gap:
            raise ValueError(f'No measurement within {max_gap} deg of lab azimuth {target} (nearest {diff[j]:.1f} deg)')
        chosen.append(horizontal[j]); errors.append(float(diff[j]))
    right_receiver = 1 - left_receiver
    pair = np.stack([ir[chosen, left_receiver], ir[chosen, right_receiver]], axis=1)  # (72, 2, N)
    pair = resample(pair, fs)
    peak = np.max(np.abs(pair))
    if not np.isfinite(peak) or peak == 0:
        raise ValueError('Impulse responses are empty or non-finite')
    onsets = np.argmax(np.abs(pair) >= 0.2 * np.max(np.abs(pair), axis=-1, keepdims=True), axis=-1)
    start = max(0, int(onsets.min()) - 8)
    total = np.sum(pair ** 2)
    out = np.zeros(pair.shape[:-1] + (TAPS,))
    seg = pair[..., start:start + TAPS]
    out[..., :seg.shape[-1]] = seg
    out[..., -16:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, 17) / 16)
    retained = float(np.sum(out ** 2) / total)
    if reference_energy is not None:
        out *= np.sqrt(reference_energy / np.mean(np.sum(out ** 2, axis=-1)))
    return {
        'format': 'hearing-lab-hrir', 'version': 2, 'sample_rate': LAB_FS, 'coverage': 'full', 'azimuth_step_deg': STEP,
        'source': source,
        'conversion': {'input_sample_rate': fs, 'common_shift_samples_44k1': start, 'energy_retained_fraction': retained,
                       'max_azimuth_error_deg': max(errors), 'elevation_tolerance_deg': elevation_tolerance,
                       'note': 'Nearest-neighbour horizontal selection; level matched to bundled KEMAR when a reference is given.'},
        'responses': [{'azimuth': int(a), 'left': out[i, 0].tolist(), 'right': out[i, 1].tolist()} for i, a in enumerate(LAB_AZIMUTHS)],
    }


def kemar_energy(path: pathlib.Path) -> float:
    k = json.loads(path.read_text())
    return float(np.mean([np.sum(np.square(r[e])) for r in k['responses'] for e in ('left', 'right')]))


def read_sofa(path: pathlib.Path):
    try:
        import h5py
    except ImportError as error:
        raise SystemExit('Reading SOFA needs h5py: python -m pip install h5py') from error
    with h5py.File(path, 'r') as f:
        convention = f.attrs.get('SOFAConventions', b'')
        convention = convention.decode() if isinstance(convention, bytes) else str(convention)
        if convention and convention not in ('SimpleFreeFieldHRIR', 'SingleRoomSRIR', 'GeneralFIR'):
            print(f'warning: convention {convention}; expecting SimpleFreeFieldHRIR')
        ir = np.asarray(f['Data.IR'])
        fs = float(np.ravel(f['Data.SamplingRate'])[0])
        pos = np.asarray(f['SourcePosition'])
        kind = f['SourcePosition'].attrs.get('Type', b'spherical')
        kind = kind.decode() if isinstance(kind, bytes) else str(kind)
        left = 0
        if 'ReceiverPosition' in f:
            rp = np.asarray(f['ReceiverPosition']).reshape(-1, 3)
            if rp.shape[0] >= 2 and rp[1, 1] > rp[0, 1]:
                left = 1
        title = f.attrs.get('Title', path.name)
        title = title.decode() if isinstance(title, bytes) else str(title)
    return ir, fs, spherical(pos, kind), left, title


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sofa', type=pathlib.Path)
    ap.add_argument('output', type=pathlib.Path)
    ap.add_argument('--elevation-tolerance', type=float, default=2.5)
    ap.add_argument('--max-gap', type=float, default=2.5, help='largest allowed azimuth error, degrees')
    ap.add_argument('--reference', type=pathlib.Path, default=root / 'dist/assets/kemar-horizontal.json')
    ap.add_argument('--no-level-match', action='store_true')
    a = ap.parse_args()
    ir, fs, az_el, left, title = read_sofa(a.sofa)
    result = convert(ir, fs, az_el, left_receiver=left, source=f'{title} ({a.sofa.name}, converted)',
                     reference_energy=None if a.no_level_match else kemar_energy(a.reference),
                     elevation_tolerance=a.elevation_tolerance, max_gap=a.max_gap)
    a.output.write_text(json.dumps(result))
    c = result['conversion']
    print(f"wrote {a.output}: 72 azimuths, {fs:.0f} -> {LAB_FS} Hz, energy retained {c['energy_retained_fraction']:.3f}, "
          f"max azimuth error {c['max_azimuth_error_deg']:.1f} deg")


if __name__ == '__main__':
    main()

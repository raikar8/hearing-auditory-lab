"""SOFA conversion core (numpy only; no h5py needed). Run: python -m unittest tests/test_sofa_convert.py"""
import pathlib
import sys
import unittest

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'research'))
from sofa_to_lab import convert, resample, spherical  # noqa: E402

FS = 48000


def synthetic(step=2.0, fs=FS, radius=0.0875):
    """Two delayed impulses per direction, SOFA convention (+azimuth = left), Woodworth ITD."""
    az = np.arange(-180, 180, step)
    az = np.concatenate([az, az])
    el = np.concatenate([np.zeros(az.size // 2), np.full(az.size // 2, 30.0)])  # one off-plane ring to ignore
    ir = np.zeros((az.size, 2, 256))
    t = np.arange(256)
    for m, a in enumerate(az):
        th = np.arcsin(np.sin(np.radians(a)))  # lateral angle
        itd = radius / 343 * (th + np.sin(th)) * fs  # >0: source on the left, right ear lags
        for r, d in ((0, 40 - itd / 2), (1, 40 + itd / 2)):
            ir[m, r] = np.sinc(t - d) * np.hanning(256) * (1.0 if el[m] == 0 else 5.0)
    return ir, np.column_stack([az, el])


def onset(x):
    return np.argmax(np.abs(x)) + 0.0


class SofaConvert(unittest.TestCase):
    def test_grid_rate_and_schema(self):
        ir, pos = synthetic()
        out = convert(ir, FS, pos, reference_energy=1.0)
        self.assertEqual(out['sample_rate'], 44100)
        self.assertEqual(len(out['responses']), 72)
        self.assertEqual(out['responses'][0]['azimuth'], -180)
        self.assertTrue(all(len(r['left']) == 128 and len(r['right']) == 128 for r in out['responses']))
        self.assertLessEqual(out['conversion']['max_azimuth_error_deg'], 1.0)
        energy = np.mean([np.sum(np.square(r[e])) for r in out['responses'] for e in ('left', 'right')])
        self.assertAlmostEqual(energy, 1.0, places=9)

    def test_azimuth_sign_and_itd_preserved(self):
        ir, pos = synthetic()
        out = {r['azimuth']: r for r in convert(ir, FS, pos)['responses']}
        # SOFA +90 (left) becomes lab -90: the left ear leads there.
        self.assertLess(onset(out[-90]['left']), onset(out[-90]['right']))
        self.assertGreater(onset(out[90]['left']), onset(out[90]['right']))
        lag = onset(out[90]['left']) - onset(out[90]['right'])
        expected = 0.0875 / 343 * (np.pi / 2 + 1) * 44100
        self.assertLess(abs(lag - expected), 1.0)

    def test_off_plane_measurements_ignored_and_gaps_rejected(self):
        ir, pos = synthetic()
        out = convert(ir, FS, pos)
        self.assertLess(max(max(map(abs, r['left'])) for r in out['responses']), 2.0)  # the 5x ring was skipped
        sparse = pos[:, 0] % 20 == 0
        with self.assertRaises(ValueError):
            convert(ir[sparse], FS, pos[sparse])

    def test_resampler_preserves_a_tone(self):
        t = np.arange(4800) / FS
        y = resample(np.sin(2 * np.pi * 1000 * t)[None, :], FS)[0]
        u = np.arange(y.size) / 44100
        mid = slice(200, y.size - 200)
        self.assertLess(np.max(np.abs(y[mid] - np.sin(2 * np.pi * 1000 * u[mid]))), 2e-3)

    def test_cartesian_positions(self):
        az_el = spherical(np.array([[1.0, 0, 0], [0, 1.0, 0], [0, 0, 1.0]]), 'cartesian')
        np.testing.assert_allclose(az_el, [[0, 0], [90, 0], [0, 90]], atol=1e-12)


if __name__ == '__main__':
    unittest.main()

# Individualized HRTFs (edition 0.5)

Source: `dist/hrtf.js`, `research/sofa_to_lab.py`. Live in **index.html → panel 06**. Tests:
`tests/hrtf.test.mjs`, `tests/test_sofa_convert.py`.

## What changed

Up to 0.4 the lab rendered every listener through the MIT KEMAR manikin, mirrored left/right. A
generic head is a known source of front/back confusion and of elevation and externalization errors.
Edition 0.5 supports three HRTF sources, all rendered by the same 128-tap, 44.1 kHz convolution with
a 20 ms cross-fade when the set changes:

| Set | What it is | What it is not |
|---|---|---|
| MIT KEMAR (default) | Measured manikin, horizontal plane, 5-degree grid, mirrored for negative azimuths | Anyone's own ears |
| KEMAR scaled to anthropometry | KEMAR with ITD scaled to the listener's head width, and the response optionally scaled in frequency | A measurement; a two-parameter model of a listener |
| Custom set | Any full-circle set in the lab JSON schema, typically converted from a SOFA file | Validated by the lab beyond format, rate and finiteness checks |

## Schema (format `hearing-lab-hrir`, version 2)

```json
{"format": "hearing-lab-hrir", "version": 2, "sample_rate": 44100, "coverage": "full",
 "azimuth_step_deg": 5, "source": "...",
 "responses": [{"azimuth": -180, "left": [128 taps], "right": [128 taps]}, "... 72 entries to 175"]}
```

Azimuth is clockwise from the front, so +90 is the listener's right. Each entry has its own left and right
response; there is no mirroring, so asymmetric heads are preserved. Longer responses are truncated to
128 taps and shorter ones are zero-padded. The bundled half-circle KEMAR file still loads, and is expanded by
mirroring.

## Anthropometric scaling

* **ITD scaling.** In a spherical-head model the interaural time difference is proportional to head radius
  (Kuhn 1977, JASA 62:157; Algazi, Avendano & Duda 2001, J. Audio Eng. Soc. 49:472). For each azimuth the
  lab measures KEMAR's broadband ITD by cross-correlation with parabolic interpolation (722.6 µs at 90
  degrees), then delays or advances the lagging ear with a 16-tap windowed-sinc fractional delay. The result
  has ITD × (head width / 15.2 cm). The 15.2 cm KEMAR head breadth is an assumed reference value. Tests
  confirm the target ITD to within 2 % or 8 µs at 30, 60, 90, −90 and 135 degrees.
* **Spectral scaling.** Middlebrooks (1999, JASA 106:1480) showed that inter-subject differences in
  directional transfer functions shrink when one subject's functions are scaled in frequency. The lab maps
  H(f) to H(f / s) by resampling the impulse response in time around its first arrival, h'(n) = s·h(t0 + s(n − t0)),
  with an anti-aliasing cutoff when s > 1. Values of s below 1 move pinna notches down, as for larger ears.
  Deviations from Middlebrooks: the lab scales the whole response, including non-directional components,
  rather than the directional transfer function only, and it leaves the choice of s to the user. The
  interaural delay is restored after warping, so the two controls are independent. Tests confirm that a
  6 kHz resonance moves to 5.4 kHz (±2 %) at s = 0.9 while ITD stays within 10 µs.

## Converting a measured SOFA file

```bash
python -m pip install h5py numpy
python research/sofa_to_lab.py subject.sofa dist/assets/subject-hrtf.json
```

The converter reads SimpleFreeFieldHRIR (AES69) data and:
1. keeps measurements within 2.5 degrees of the horizontal plane;
2. negates SOFA's counterclockwise azimuth;
3. picks the nearest measurement for each 5-degree direction, and fails if any is more than 2.5 degrees away;
4. resamples to 44.1 kHz with a windowed sinc;
5. applies one common time shift, so ITDs survive;
6. windows to 128 taps;
7. matches the mean energy of the bundled KEMAR, so switching sets does not jump in level.

It records the retained energy fraction and the maximum azimuth error in the output. The numpy core is
tested on a synthetic Woodworth-sphere set: 72 azimuths, sign convention, ITD within 1 sample, off-plane
rejection, gap rejection, tone resampling and Cartesian positions. End to end, a 48 kHz synthetic set
loads in the browser with a 657 µs ITD at 90 degrees against the 656 µs model value. The h5py reader
itself has **not** been run against a real SOFA file in this edition, because no SOFA dataset is bundled
or was downloaded. Public sets include ARI, CIPIC, SADIE II and the HUTUBS database. Check each set's license
before redistributing converted files.

## Limits

* Horizontal plane only. There is no elevation, and no interpolation between measured directions (nearest 5-degree grid).
* No headphone equalization. Custom sets are level-matched, not spectrally equalized.
* ITD and spectral scaling do not reproduce an individual's pinna. The two-parameter model is a
  teaching tool for asking what changes when the head is bigger, not a substitute for measurement or a
  validated individualization method.
* No listening test has been run. Whether a scaled KEMAR localizes better for any listener is untested here.

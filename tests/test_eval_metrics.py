import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'research'))
import numpy as np
from eval_metrics import sisdr,cues
class MetricsTest(unittest.TestCase):
 def test_sisdr_identity_gain_and_noise(self):
  rng=np.random.default_rng(11);x=rng.normal(size=16000)
  self.assertGreater(sisdr(x,x*.01),100)
  self.assertLess(abs(sisdr(x,x+rng.normal(size=len(x)))),.3)
 def test_ild_known_gain(self):
  x=np.random.default_rng(12).normal(size=16000);ild,itd=cues(np.stack([2*x,x]));self.assertAlmostEqual(ild,20*np.log10(2),places=5);self.assertEqual(itd,0)
 def test_itd_known_delay(self):
  x=np.random.default_rng(13).normal(size=16000);lag=5
  _,itd=cues(np.stack([np.pad(x[:-lag],(lag,0)),x]));self.assertEqual(itd,lag/16000*1e6)
 def test_silence_is_finite(self):self.assertTrue(np.isfinite(sisdr(np.zeros(16000),np.zeros(16000))))
if __name__=='__main__':unittest.main()

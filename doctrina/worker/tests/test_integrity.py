import hashlib
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from integrity import verify_and_extract
from extractor import ExtractionError

class IntegrityTests(unittest.TestCase):
    def test_verified_text(self):
        data = b'example'
        job = SimpleNamespace(bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), objeto_storage='sample.txt', mime='text/plain')
        self.assertEqual(verify_and_extract(data, job)['cantidad_unidades'], 1)

    def test_rejects_wrong_digest(self):
        data = b'example'
        job = SimpleNamespace(bytes=len(data), sha256='0'*64, objeto_storage='sample.txt', mime='text/plain')
        with self.assertRaises(ExtractionError):
            verify_and_extract(data, job)

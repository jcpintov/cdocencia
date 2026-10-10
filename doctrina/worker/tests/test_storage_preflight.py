import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import runner
from extractor import ExtractionError
from storage_preflight import validate_private_key

class StoragePreflightTests(unittest.TestCase):
    def test_valid_key(self):
        self.assertEqual(validate_private_key("private/a.txt"), "private/a.txt")

    def test_reject_unsafe_keys(self):
        for key in ("../a.txt", "/a.txt", "a//b.txt", "a/./b.txt",
                    "https://host/a.txt", "a\\b.txt", "a%2fb.txt",
                    "a.txt?token=x", "a\x00.txt", "a.exe", ""):
            with self.subTest(key=key), self.assertRaises(ExtractionError):
                validate_private_key(key)

    def test_invalid_key_never_reaches_storage(self):
        job = SimpleNamespace(id="test", objeto_storage="../private.txt")
        fetch = Mock()
        with patch.object(runner, "reserve_next", return_value=job), \
             patch.object(runner, "mark_failure") as failure:
            result = runner.run_once(lambda: DummyConnection(), fetch, "worker", lambda _: True)
        fetch.assert_not_called()
        self.assertEqual(result.status, "revision_requerida")
        self.assertTrue(failure.call_args.kwargs["needs_review"])

class DummyConnection:
    def __enter__(self): return self
    def __exit__(self, *args): return False

if __name__ == "__main__":
    unittest.main()

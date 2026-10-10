"""Pruebas del coordinador con conexiones y Storage simulados."""
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import runner
from extractor import ExtractionError


@contextmanager
def connection():
    yield object()


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.job = SimpleNamespace(id="j1", objeto_storage="private/file.txt")

    def test_empty_queue(self):
        with patch.object(runner, "reserve_next", return_value=None):
            result = runner.run_once(connection, lambda key: b"data", "worker-1")
        self.assertEqual(result.status, "sin_trabajo")

    def test_success_requires_review(self):
        with patch.object(runner, "reserve_next", return_value=self.job), \
             patch.object(runner, "verify_and_extract", return_value={"unidades": [{"orden": 1}]}), \
             patch.object(runner, "finish_extraction") as finish:
            result = runner.run_once(connection, lambda key: b"data", "worker-1")
        self.assertEqual(result.status, "pendiente_revision")
        finish.assert_called_once()

    def test_integrity_error_goes_to_review(self):
        with patch.object(runner, "reserve_next", return_value=self.job), \
             patch.object(runner, "verify_and_extract", side_effect=ExtractionError("checksum")), \
             patch.object(runner, "mark_failure") as fail:
            result = runner.run_once(connection, lambda key: b"data", "worker-1")
        self.assertEqual(result.status, "revision_requerida")
        self.assertTrue(fail.call_args.kwargs["needs_review"])

    def test_storage_failure_sanitized(self):
        def fail_fetch(key):
            raise RuntimeError("sensitive storage detail")
        with patch.object(runner, "reserve_next", return_value=self.job), \
             patch.object(runner, "mark_failure") as fail:
            result = runner.run_once(connection, fail_fetch, "worker-1")
        self.assertEqual(result.status, "error_controlado")
        self.assertFalse(fail.call_args.kwargs["needs_review"])

    def test_database_failure_propagates_without_marking_extraction_error(self):
        with patch.object(runner, "reserve_next", return_value=self.job), \
             patch.object(runner, "verify_and_extract", return_value={"unidades": [{"orden": 1}]}), \
             patch.object(runner, "finish_extraction", side_effect=RuntimeError("database failure")), \
             patch.object(runner, "mark_failure") as fail:
            with self.assertRaises(RuntimeError):
                runner.run_once(connection, lambda key: b"data", "worker-1")
        fail.assert_not_called()

    def test_failure_recording_error_propagates(self):
        with patch.object(runner, "reserve_next", return_value=self.job), \
             patch.object(runner, "verify_and_extract", side_effect=ExtractionError("invalid")), \
             patch.object(runner, "mark_failure", side_effect=RuntimeError("lease lost")):
            with self.assertRaises(RuntimeError):
                runner.run_once(connection, lambda key: b"data", "worker-1")

    def test_invalid_worker_id(self):
        with self.assertRaises(ValueError):
            runner.run_once(connection, lambda key: b"data", "")


if __name__ == "__main__":
    unittest.main()

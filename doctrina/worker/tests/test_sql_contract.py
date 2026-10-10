"""Regresiones de estructura SQL sin acceso a la base de datos."""
import inspect
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import queue_repository
import recovery


class SqlContractTests(unittest.TestCase):
    def test_reserva_limit_antes_de_for_update(self):
        source = inspect.getsource(queue_repository.reserve_next).lower()
        self.assertRegex(source, r"limit 1\s+for update of t, v skip locked")

    def test_recuperacion_limit_antes_de_for_update(self):
        source = inspect.getsource(recovery.quarantine_expired).lower()
        self.assertRegex(source, r"limit %s\s+for update of t, v skip locked")

    def test_transiciones_vinculadas_a_version_reservada(self):
        for method in (queue_repository.finish_extraction,
                       queue_repository.mark_failure):
            source = inspect.getsource(method).lower()
            self.assertIn("t.version_id = %s", source)
            self.assertIn("job.version_id, worker_id", source)

    def test_finalizacion_exige_reserva_vigente(self):
        source = inspect.getsource(queue_repository.finish_extraction).lower()
        self.assertIn("arrendado_hasta > clock_timestamp()", source)

    def test_fallo_exige_reserva_vigente(self):
        source = inspect.getsource(queue_repository.mark_failure).lower()
        self.assertIn("arrendado_hasta > clock_timestamp()", source)


if __name__ == "__main__":
    unittest.main()

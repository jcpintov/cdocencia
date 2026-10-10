"""Pruebas del adaptador usando una conexión simulada sin datos reservados."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from queue_repository import reserve_next, finish_extraction, mark_failure, renew_lease, ReservedJob


class Cursor:
    def __init__(self, row):
        self.row = row
    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, rows):
        self.rows = iter(rows)
        self.queries = []
    def execute(self, sql, params=None):
        self.queries.append((sql, params))
        return Cursor(next(self.rows, None))


class QueueTests(unittest.TestCase):
    def test_renovacion_reserva_vigente(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([{"id": "t1"}])
        self.assertTrue(renew_lease(db, job, "worker-test"))
        self.assertIn("arrendado_hasta > now()", db.queries[0][0])
        self.assertEqual(db.queries[0][1], ("t1", "v1", "worker-test"))

    def test_reserva_vencida_no_se_renueva(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([None])
        self.assertFalse(renew_lease(db, job, "worker-test"))

    def test_finalizacion_exige_reserva_vigente(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([None])
        with self.assertRaises(RuntimeError):
            finish_extraction(db, job, "worker-test", [])
        self.assertIn("arrendado_hasta > now()", db.queries[0][0])

    def test_no_reserva_cuando_cola_vacia(self):
        db = FakeConnection([None])
        self.assertIsNone(reserve_next(db, "worker-test"))
        self.assertEqual(len(db.queries), 1)

    def test_reserva_tarea_pendiente(self):
        row = dict(id="t1", version_id="v1", sha256="a" * 64,
                   objeto_storage="v1/original.txt", mime="text/plain", bytes=5)
        db = FakeConnection([row, {"id": "t1"}, None])
        job = reserve_next(db, "worker-test")
        self.assertEqual(job.version_id, "v1")
        self.assertEqual(len(db.queries), 3)
        self.assertIn("skip locked", db.queries[0][0].lower())

    def test_fallo_rechaza_procesador_ajeno(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([None])
        with self.assertRaises(RuntimeError):
            mark_failure(db, job, "procesador-ajeno", needs_review=False)
        self.assertEqual(len(db.queries), 1)

    def test_fallo_exige_estado_vigente(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([{"trabajo_estado": "listo", "version_estado": "revision"}])
        with self.assertRaises(ValueError):
            mark_failure(db, job, "worker-test", needs_review=True)
        self.assertEqual(len(db.queries), 1)

    def test_fallo_controlado_sin_error_crudo(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([{"trabajo_estado": "procesando", "version_estado": "procesando"}])
        mark_failure(db, job, "worker-test", needs_review=True)
        self.assertEqual(len(db.queries), 3)
        self.assertEqual(db.queries[1][1][0], "revision")
        self.assertNotIn("traceback", repr(db.queries).lower())

    def test_finalizacion_rechaza_procesador_ajeno(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([None])
        with self.assertRaises(RuntimeError):
            finish_extraction(db, job, "otro-worker", [])
        self.assertEqual(len(db.queries), 1)

    def test_finalizacion_rechaza_unidades_vacias(self):
        job = ReservedJob("t1", "v1", "a" * 64, "v1/file.txt", "text/plain", 5)
        db = FakeConnection([{"trabajo_estado": "procesando",
                              "version_estado": "procesando"}])
        with self.assertRaises(ValueError):
            finish_extraction(db, job, "worker-test", [])
        self.assertEqual(len(db.queries), 1)


if __name__ == "__main__":
    unittest.main()

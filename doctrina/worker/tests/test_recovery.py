"""Pruebas sin acceso a datos reales de la recuperación de arrendamientos."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from recovery import quarantine_expired


class Result:
    def __init__(self, rows):
        self.rows = rows
    def fetchall(self):
        return self.rows


class DB:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []
    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return Result(self.rows)


class RecoveryTests(unittest.TestCase):
    def test_sin_trabajos_vencidos(self):
        db = DB([])
        self.assertEqual(quarantine_expired(db), 0)
        self.assertEqual(len(db.calls), 1)

    def test_tarea_vencida_a_revision(self):
        db = DB([{"id": "trabajo", "version_id": "version"}])
        self.assertEqual(quarantine_expired(db), 1)
        self.assertEqual(len(db.calls), 3)
        self.assertIn("skip locked", db.calls[0][0].lower())
        self.assertIn("estado = 'revision'", db.calls[2][0])

    def test_lote_invalido(self):
        for value in (0, -1, 101, True, "5"):
            with self.assertRaises(ValueError):
                quarantine_expired(DB([]), value)

    def test_dos_trabajos_no_se_reintentan(self):
        db = DB([{"id": "t1", "version_id": "v1"},
                 {"id": "t2", "version_id": "v2"}])
        self.assertEqual(quarantine_expired(db, limit=2), 2)
        self.assertEqual(len(db.calls), 5)
        self.assertNotIn("set estado = 'pendiente'", repr(db.calls).lower())


if __name__ == "__main__":
    unittest.main()

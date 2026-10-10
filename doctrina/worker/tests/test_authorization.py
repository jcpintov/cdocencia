"""Pruebas de denegación por defecto de autorización local."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from authorization import authorize_local_analysis


class Cursor:
    def __init__(self, value):
        self.value = value

    def fetchone(self):
        return self.value


class Connection:
    def __init__(self, value):
        self.value = value
        self.sql = None
        self.params = None

    def execute(self, sql, params):
        self.sql, self.params = sql, params
        return Cursor(self.value)


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.job = SimpleNamespace(version_id="v1", sha256="a" * 64,
                                   objeto_storage="v1/original.txt")

    def test_denies_missing_authorization(self):
        self.assertFalse(authorize_local_analysis(Connection(None), self.job))

    def test_accepts_verified_row(self):
        self.assertTrue(authorize_local_analysis(Connection({"permitido": 1}), self.job))

    def test_binds_exact_version_hash_and_storage_key(self):
        db = Connection(None)
        authorize_local_analysis(db, self.job)
        self.assertEqual(db.params, ("v1", "a" * 64, "v1/original.txt"))
        self.assertIn("a.revocado_en is null", db.sql)
        self.assertIn("a.alcance = 'analisis_local'", db.sql)
        self.assertIn("v.estado = 'procesando'", db.sql)

    def test_database_failure_is_not_permission(self):
        class BrokenConnection:
            def execute(self, sql, params):
                raise RuntimeError("database unavailable")
        with self.assertRaises(RuntimeError):
            authorize_local_analysis(BrokenConnection(), self.job)


if __name__ == "__main__":
    unittest.main()

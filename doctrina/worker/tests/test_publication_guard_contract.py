"""Pruebas estáticas del borrador de protección editorial.

Estas comprobaciones no sustituyen pruebas SQL de integración.
"""
from pathlib import Path
import unittest

SQL = (Path(__file__).resolve().parents[2] / "migrations" /
       "20261010_guard_publicacion.sql").read_text(encoding="utf-8").lower()


class PublicationGuardContractTests(unittest.TestCase):
    def test_approval_required(self):
        self.assertIn("new.aprobado_por is null", SQL)
        self.assertIn("new.publicado_en is null", SQL)

    def test_only_active_superadmin_approves(self):
        self.assertIn("s.auth_user_id = new.aprobado_por", SQL)
        self.assertIn("s.activo = true", SQL)

    def test_requires_reviewed_evidence(self):
        self.assertIn("a.estado_revision = 'aprobado'", SQL)
        self.assertIn("u.estado_revision = 'validado'", SQL)
        self.assertIn("v.estado = 'listo'", SQL)

    def test_each_source_has_active_dependency(self):
        self.assertIn("d.fuente_version_id = u.version_id", SQL)
        self.assertIn("d.estado_revision = 'vigente'", SQL)

    def test_rejects_empty_content(self):
        self.assertIn("nullif(btrim(new.contenido), '') is null", SQL)

    def test_not_applied_by_tests(self):
        self.assertIn("borrador", SQL.splitlines()[0].lower())


if __name__ == "__main__":
    unittest.main()

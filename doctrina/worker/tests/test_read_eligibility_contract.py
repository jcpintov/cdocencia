"""Contratos estáticos de lectura privada; requieren validación PostgreSQL posterior."""
from pathlib import Path
import unittest

QUERY = (Path(__file__).resolve().parents[2] / "queries" /
         "publicaciones_vigentes_privadas.sql").read_text(encoding="utf-8").lower()


class ReadEligibilityContractTests(unittest.TestCase):
    def test_requires_publication_state(self):
        self.assertIn("p.estado = 'publicado'", QUERY)

    def test_requires_active_approver(self):
        self.assertIn("s.activo = true", QUERY)

    def test_requires_every_source_reviewed(self):
        self.assertIn("not exists (", QUERY)
        self.assertIn("a.estado_revision is distinct from 'aprobado'", QUERY)
        self.assertIn("u.estado_revision is distinct from 'validado'", QUERY)
        self.assertIn("v.estado is distinct from 'listo'", QUERY)

    def test_requires_active_source_consent(self):
        self.assertIn("af.alcance = 'publicacion_derivados'", QUERY)
        self.assertIn("af.revocado_en is null", QUERY)

    def test_requires_version_dependency(self):
        self.assertIn("dep.fuente_version_id = v.id", QUERY)
        self.assertIn("dep.estado_revision = 'vigente'", QUERY)

    def test_is_read_only(self):
        self.assertTrue(QUERY.lstrip().startswith("-- borrador"))
        self.assertIn("\nselect ", QUERY)
        for forbidden in ("\ninsert ", "\nupdate ", "\ndelete ", "\ngrant "):
            self.assertNotIn(forbidden, QUERY)


if __name__ == "__main__":
    unittest.main()

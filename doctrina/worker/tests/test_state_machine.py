"""Pruebas de transiciones de la cola privada."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from state_machine import (
    CLAIM, EXTRACTED, FAILED, REVIEW_REQUIRED,
    TransitionError, publication_allowed, validate_transition,
)


class StateMachineTests(unittest.TestCase):
    def test_reserva_pendiente(self):
        self.assertEqual(validate_transition("pendiente", "pendiente", CLAIM),
                         ("procesando", "procesando"))

    def test_extraccion_termina_en_revision(self):
        self.assertEqual(validate_transition("procesando", "procesando", EXTRACTED),
                         ("listo", "revision"))

    def test_archivo_requiere_revision(self):
        self.assertEqual(validate_transition("procesando", "procesando", REVIEW_REQUIRED),
                         ("error", "revision"))

    def test_error_tecnico(self):
        self.assertEqual(validate_transition("procesando", "procesando", FAILED),
                         ("error", "error"))

    def test_rechaza_transicion_invalida(self):
        with self.assertRaises(TransitionError):
            validate_transition("listo", "revision", CLAIM)

    def test_no_publicar_sin_revision_humana(self):
        for state in ("pendiente", "procesando", "revision", "error"):
            self.assertFalse(publication_allowed(state, True))
        self.assertFalse(publication_allowed("listo", False))
        self.assertTrue(publication_allowed("listo", True))


if __name__ == "__main__":
    unittest.main()

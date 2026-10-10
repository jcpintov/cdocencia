"""Pruebas unitarias de extracción; ejecutar con python -m unittest discover -s doctrina/worker/tests."""
import hashlib
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extractor import ExtractionError, extract

class ExtractorTests(unittest.TestCase):
    def test_txt_preserva_texto_y_huella(self):
        raw = "Artículo 1. Deber\nContenido exacto.\n\nArtículo 2. Excepción\nSalvedad.".encode()
        result = extract(raw, "norma.txt")
        self.assertEqual(result["sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(result["cantidad_unidades"], 2)
        self.assertEqual(result["unidades"][0]["texto_fiel"], "Artículo 1. Deber\nContenido exacto.")
        self.assertEqual(result["estado"], "pendiente_revision")

    def test_rechaza_pdf_falso(self):
        with self.assertRaises(ExtractionError):
            extract(b"no es PDF", "falso.pdf")

    def test_rechaza_extension_peligrosa(self):
        with self.assertRaises(ExtractionError):
            extract(b"contenido", "ejecutar.exe")

    def test_rechaza_txt_binario(self):
        with self.assertRaises(ExtractionError):
            extract(b"abc\x00def", "binario.txt")

    def test_rechaza_archivo_vacio(self):
        with self.assertRaises(ExtractionError):
            extract(b"", "vacio.txt")

if __name__ == "__main__":
    unittest.main()

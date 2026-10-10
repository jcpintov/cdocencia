"""Pruebas sintéticas del contrato de ingesta privada, sin datos institucionales."""
import ast
import hashlib
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extractor import ExtractionError, extract


class PrivateIngestionContractTests(unittest.TestCase):
    def test_utf8_bom_y_sha_de_bytes_originales(self):
        data = b"\xef\xbb\xbf" + "Artículo 1. Texto íntegro".encode("utf-8")
        result = extract(data, "DOCUMENTO.TXT")
        self.assertEqual(result["sha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual(result["unidades"][0]["texto_fiel"], "Artículo 1. Texto íntegro")

    def test_articulo_con_rotulo_identificable(self):
        result = extract("Artículo 12 Obligaciones".encode(), "norma.txt")
        self.assertEqual(result["unidades"][0]["tipo"], "articulo")
        self.assertIn("12", result["unidades"][0]["rotulo"])

    def test_huellas_distintas_para_textos_distintos(self):
        first = extract(b"A", "a.txt")
        second = extract(b"B", "b.txt")
        self.assertNotEqual(first["unidades"][0]["huella"], second["unidades"][0]["huella"])

    def test_resultado_nunca_autopublica(self):
        result = extract(b"Texto de prueba", "a.txt")
        self.assertEqual(result["estado"], "pendiente_revision")
        self.assertNotIn("publicado", result)
        self.assertNotIn("autorizacion_procesamiento_externo", result)

    def test_rechaza_txt_utf8_invalido(self):
        with self.assertRaises(ExtractionError):
            extract(b"\xff\xfe\xfa", "a.txt")

    def test_codigo_no_importa_clientes_de_red(self):
        source = (Path(__file__).resolve().parents[1] / "extractor.py").read_text(encoding="utf-8")
        parsed = ast.parse(source)
        forbidden = {"requests", "httpx", "urllib", "socket", "supabase", "boto3", "subprocess"}
        modules = []
        for node in ast.walk(parsed):
            if isinstance(node, ast.Import):
                modules.extend(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(node.module.split(".")[0])
        self.assertFalse(forbidden.intersection(modules), "Revisar dependencias externas del extractor")


if __name__ == "__main__":
    unittest.main()

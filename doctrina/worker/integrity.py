"""Puerta de integridad antes de persistir unidades; sin acceso a red."""
from hashlib import sha256
from hmac import compare_digest

from extractor import ExtractionError, MAX_BYTES, MIMES, extract


def verify_and_extract(data: bytes, job) -> dict:
    """Compara los bytes con los metadatos inmutables de la versión."""
    if not isinstance(data, bytes) or not data or len(data) > MAX_BYTES:
        raise ExtractionError("Tamaño de origen inválido")
    if type(job.bytes) is not int or len(data) != job.bytes:
        raise ExtractionError("Tamaño de origen no coincide")
    if not isinstance(job.sha256, str) or len(job.sha256) != 64:
        raise ExtractionError("Huella esperada inválida")
    if not compare_digest(sha256(data).hexdigest(), job.sha256):
        raise ExtractionError("Integridad de origen no coincide")
    path = job.objeto_storage
    if not isinstance(path, str) or not path or path.startswith("/") or chr(92) in path:
        raise ExtractionError("Identificador de origen inválido")
    if any(segment in ("", ".", "..") for segment in path.split("/")):
        raise ExtractionError("Identificador de origen inválido")
    extension = "." + path.rsplit(".", 1)[-1].lower()
    if extension not in MIMES or MIMES[extension] != job.mime:
        raise ExtractionError("Tipo de origen no coincide")
    result = extract(data, "original" + extension)
    if result["mime_esperado"] != job.mime:
        raise ExtractionError("Tipo de origen no coincide")
    return result

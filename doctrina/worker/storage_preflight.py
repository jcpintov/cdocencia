"""Validación de claves de Storage antes de recuperar objetos privados."""
from extractor import ExtractionError, MIMES


def validate_private_key(path: str) -> str:
    if not isinstance(path, str) or not path or len(path) > 1024:
        raise ExtractionError("Identificador de origen inválido")
    if path.startswith("/") or "\\" in path or any(ord(c) < 32 or ord(c) == 127 for c in path):
        raise ExtractionError("Identificador de origen inválido")
    if any(segment in ("", ".", "..") for segment in path.split("/")):
        raise ExtractionError("Identificador de origen inválido")
    if any(c in path for c in ("?", "#", "%", ":")):
        raise ExtractionError("Identificador de origen inválido")
    ext = "." + path.rsplit(".", 1)[-1].lower()
    if ext not in MIMES:
        raise ExtractionError("Extensión de origen no admitida")
    return path

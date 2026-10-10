"""Ejecución de una sola ingesta, sin conexiones ni privilegios implícitos.

Dependencias inyectadas: connection_factory() entrega una conexión DB-API
con soporte de context manager transaccional; fetch_private_object(key)
recupera bytes de Storage privado, nunca una URL pública.
"""
from dataclasses import dataclass
from typing import Callable, Any

from extractor import ExtractionError
from integrity import verify_and_extract
from queue_repository import reserve_next, finish_extraction, mark_failure


@dataclass(frozen=True)
class RunResult:
    status: str
    job_id: str | None = None


def run_once(connection_factory: Callable[[], Any],
             fetch_private_object: Callable[[str], bytes],
             worker_id: str) -> RunResult:
    """Una reserva por ejecución; la revisión humana es siempre obligatoria."""
    if not isinstance(worker_id, str) or not worker_id.strip() or len(worker_id) > 128:
        raise ValueError("Identificador de procesador inválido")
    # La reserva debe confirmarse antes de realizar operaciones de Storage.
    with connection_factory() as conn:
        job = reserve_next(conn, worker_id)
    if job is None:
        return RunResult("sin_trabajo")
    try:
        data = fetch_private_object(job.objeto_storage)
        extracted = verify_and_extract(data, job)
        # La inserción de unidades y el cambio de estados son atómicos.
        with connection_factory() as conn:
            finish_extraction(conn, job, worker_id, extracted["unidades"])
        return RunResult("pendiente_revision", str(job.id))
    except Exception as exc:
        # Nunca persistir excepciones ni fragmentos de documentos.
        # Una reserva perdida o una falla de BD se propaga al supervisor.
        with connection_factory() as conn:
            mark_failure(conn, job, worker_id,
                         needs_review=isinstance(exc, ExtractionError))
        return RunResult("revision_requerida" if isinstance(exc, ExtractionError)
                         else "error_controlado", str(job.id))

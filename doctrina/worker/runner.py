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
from storage_preflight import validate_private_key


@dataclass(frozen=True)
class RunResult:
    status: str
    job_id: str | None = None


def run_once(connection_factory: Callable[[], Any],
             fetch_private_object: Callable[[str], bytes],
             worker_id: str,
             authorize_local_analysis: Callable[[Any], bool]) -> RunResult:
    """Una reserva por ejecución; la revisión humana es siempre obligatoria."""
    if not isinstance(worker_id, str) or not worker_id.strip() or len(worker_id) > 128:
        raise ValueError("Identificador de procesador inválido")
    if not callable(authorize_local_analysis):
        raise ValueError("Control de autorización local obligatorio")
    # La reserva debe confirmarse antes de realizar operaciones de Storage.
    with connection_factory() as conn:
        job = reserve_next(conn, worker_id)
    if job is None:
        return RunResult("sin_trabajo")
    # Denegación previa a Storage: no acceder a bytes protegidos.
    # El supervisor recuperará reservas vencidas si no hay autorización.
    if authorize_local_analysis(job) is not True:
        with connection_factory() as conn:
            mark_failure(conn, job, worker_id, needs_review=True)
        return RunResult("autorizacion_denegada", str(job.id))
    try:
        validate_private_key(job.objeto_storage)
        data = fetch_private_object(job.objeto_storage)
        extracted = verify_and_extract(data, job)
    except Exception as exc:
        # Solo fallos de lectura y extracción pueden clasificarse aquí.
        # Errores transaccionales y reservas perdidas deben propagarse.
        with connection_factory() as conn:
            mark_failure(conn, job, worker_id,
                         needs_review=isinstance(exc, ExtractionError))
        return RunResult("revision_requerida" if isinstance(exc, ExtractionError)
                         else "error_controlado", str(job.id))
    # Verificar nuevamente el consentimiento ante revocaciones durante extracción.
    if authorize_local_analysis(job) is not True:
        with connection_factory() as conn:
            mark_failure(conn, job, worker_id, needs_review=True)
        return RunResult("autorizacion_revocada", str(job.id))
    # Fallos de escritura o commit no deben convertirse en falsos
    # errores de extracción ni en una segunda transición de estado.
    with connection_factory() as conn:
        finish_extraction(conn, job, worker_id, extracted["unidades"])
    return RunResult("pendiente_revision", str(job.id))

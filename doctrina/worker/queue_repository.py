"""Adaptador de persistencia para la cola de Doctrina.

Se inyecta una conexión DB-API privada desde un proceso confiable.
No abre conexiones, no contiene secretos y no accede a la red.
"""
from dataclasses import dataclass
from typing import Any

from state_machine import CLAIM, EXTRACTED, FAILED, REVIEW_REQUIRED, validate_transition


@dataclass(frozen=True)
class ReservedJob:
    id: str
    version_id: str
    sha256: str
    objeto_storage: str
    mime: str
    bytes: int


def reserve_next(connection: Any, worker_id: str) -> ReservedJob | None:
    """Invocar dentro de una transacción; el llamador confirma o revierte."""
    row = connection.execute("""
        select t.id, t.version_id, v.sha256, v.objeto_storage, v.mime, v.bytes
        from doctrina.trabajos t
        join doctrina.versiones v on v.id = t.version_id
        where t.tipo = 'ingesta' and t.estado = 'pendiente'
          and v.estado = 'pendiente'
        order by t.creado_en, t.id
        for update of t skip locked
        limit 1
    """).fetchone()
    if row is None:
        return None
    validate_transition("pendiente", "pendiente", CLAIM)
    updated = connection.execute("""
        update doctrina.trabajos
        set estado = 'procesando', intentos = intentos + 1,
            procesador_id = %s, iniciado_en = now(),
            arrendado_hasta = now() + interval '10 minutes',
            actualizado_en = now()
        where id = %s and estado = 'pendiente'
        returning id
    """, (worker_id, row["id"])).fetchone()
    if updated is None:
        raise RuntimeError("Reserva concurrente inválida")
    connection.execute("""
        update doctrina.versiones set estado = 'procesando'
        where id = %s and estado = 'pendiente'
    """, (row["version_id"],))
    return ReservedJob(**{key: row[key] for key in
                          ("id", "version_id", "sha256", "objeto_storage", "mime", "bytes")})


def finish_extraction(connection: Any, job: ReservedJob, worker_id: str,
                      units: list[dict[str, Any]]) -> None:
    """Invocar dentro de transacción: inserción y finalización atómicas."""
    lock = connection.execute("""
        select t.estado as trabajo_estado, v.estado as version_estado
        from doctrina.trabajos t
        join doctrina.versiones v on v.id = t.version_id
        where t.id = %s and t.procesador_id = %s
        for update of t, v
    """, (job.id, worker_id)).fetchone()
    if lock is None:
        raise RuntimeError("Trabajo no pertenece al procesador")
    validate_transition(lock["trabajo_estado"], lock["version_estado"], EXTRACTED)
    if not units:
        raise ValueError("Extracción sin unidades")
    for unit in units:
        connection.execute("""
            insert into doctrina.unidades
            (version_id, orden, tipo, rotulo, texto_fiel,
             pagina_inicio, pagina_fin, huella, estado_revision)
            values (%s, %s, %s, %s, %s, %s, %s, %s, 'pendiente')
        """, (job.version_id, unit["orden"], unit["tipo"], unit["rotulo"],
              unit["texto_fiel"], unit["pagina_inicio"], unit["pagina_fin"],
              unit["huella"]))
    connection.execute("""
        update doctrina.versiones
        set estado = 'revision', verificacion_integridad_en = now(),
            error_seguro = null
        where id = %s
    """, (job.version_id,))
    connection.execute("""
        update doctrina.trabajos
        set estado = 'listo', finalizado_en = now(),
            arrendado_hasta = null, actualizado_en = now()
        where id = %s and procesador_id = %s
    """, (job.id, worker_id))


def mark_failure(connection: Any, job: ReservedJob, worker_id: str,
                 needs_review: bool) -> None:
    """Invocar dentro de transacción. Nunca almacenar errores crudos."""
    transition = REVIEW_REQUIRED if needs_review else FAILED
    validate_transition("procesando", "procesando", transition)
    version_state = "revision" if needs_review else "error"
    connection.execute("""
        update doctrina.versiones set estado = %s,
            error_seguro = 'Procesamiento no completado'
        where id = %s and estado = 'procesando'
    """, (version_state, job.version_id))
    connection.execute("""
        update doctrina.trabajos
        set estado = 'error', ultimo_error = 'Procesamiento no completado',
            finalizado_en = now(), arrendado_hasta = null,
            actualizado_en = now()
        where id = %s and procesador_id = %s and estado = 'procesando'
    """, (job.id, worker_id))

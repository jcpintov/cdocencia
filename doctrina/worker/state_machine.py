"""Política de transición de estados para ingesta privada.

Módulo puro: sin conexiones, secretos, descargas ni efectos externos.
El adaptador de base de datos deberá aplicar bloqueos y transacciones.
"""
from dataclasses import dataclass
from enum import Enum


class JobState(str, Enum):
    PENDING = "pendiente"
    PROCESSING = "procesando"
    DONE = "listo"
    ERROR = "error"


class VersionState(str, Enum):
    PENDING = "pendiente"
    PROCESSING = "procesando"
    REVIEW = "revision"
    READY = "listo"
    ERROR = "error"


class TransitionError(ValueError):
    pass


@dataclass(frozen=True)
class Transition:
    job_before: JobState
    version_before: VersionState
    job_after: JobState
    version_after: VersionState
    requires_review: bool


CLAIM = Transition(JobState.PENDING, VersionState.PENDING,
                   JobState.PROCESSING, VersionState.PROCESSING, False)
EXTRACTED = Transition(JobState.PROCESSING, VersionState.PROCESSING,
                       JobState.DONE, VersionState.REVIEW, True)
REVIEW_REQUIRED = Transition(JobState.PROCESSING, VersionState.PROCESSING,
                             JobState.ERROR, VersionState.REVIEW, True)
FAILED = Transition(JobState.PROCESSING, VersionState.PROCESSING,
                    JobState.ERROR, VersionState.ERROR, False)


def validate_transition(
    job: str, version: str, transition: Transition
) -> tuple[str, str]:
    if job != transition.job_before.value or version != transition.version_before.value:
        raise TransitionError("Transición inválida o estado desactualizado")
    return transition.job_after.value, transition.version_after.value


def publication_allowed(version_state: str, human_approved: bool) -> bool:
    # La extracción por sí sola nunca autoriza publicar.
    return version_state == VersionState.READY.value and human_approved

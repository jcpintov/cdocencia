"""Consulta de autorización local para ingesta de una versión concreta.

Solo debe llamarse desde un backend privado con conexión autenticada y
permisos mínimos. Nunca retorna originales ni concede privilegios.
"""


def authorize_local_analysis(connection, job) -> bool:
    """Denegar por defecto si falta autorización vigente o la versión cambió."""
    row = connection.execute("""
        select 1 as permitido
        from doctrina.versiones v
        join doctrina.documentos d on d.id = v.documento_id
        where v.id = %s
          and v.sha256 = %s
          and v.objeto_storage = %s
          and v.estado = 'procesando'
          and exists (
            select 1 from doctrina.autorizaciones_fuente a
            where a.documento_id = d.id
              and a.alcance = 'analisis_local'
              and a.revocado_en is null
          )
        limit 1
    """, (job.version_id, job.sha256, job.objeto_storage)).fetchone()
    return row is not None


def make_authorizer(connection_factory):
    """Adaptar la consulta privada al contrato del runner.

    Cada llamada usa una transacción corta independiente. El bloqueo
    transaccional definitivo se realiza en finish_extraction.
    """
    if not callable(connection_factory):
        raise ValueError("Fábrica de conexión obligatoria")

    def check(job):
        with connection_factory() as connection:
            return authorize_local_analysis(connection, job)

    return check

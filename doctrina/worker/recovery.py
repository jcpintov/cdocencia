"""Recuperación conservadora de tareas con reserva vencida.

Invocar únicamente desde un proceso privado y dentro de una transacción.
No reintenta ni elimina contenido automáticamente.
"""


def quarantine_expired(connection, limit=50):
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("Límite de lote inválido")
    rows = connection.execute("""
        select t.id, t.version_id
        from doctrina.trabajos t
        join doctrina.versiones v on v.id = t.version_id
        where t.estado = 'procesando' and v.estado = 'procesando'
          and t.arrendado_hasta is not null and t.arrendado_hasta < now()
        order by t.arrendado_hasta, t.id
        limit %s
        for update of t, v skip locked
    """, (limit,)).fetchall()
    for row in rows:
        connection.execute("""
            update doctrina.trabajos
            set estado = 'error',
                ultimo_error = 'Arrendamiento vencido: revisión requerida',
                finalizado_en = now(), arrendado_hasta = null,
                actualizado_en = now()
            where id = %s and estado = 'procesando'
        """, (row["id"],))
        connection.execute("""
            update doctrina.versiones
            set estado = 'revision',
                error_seguro = 'Ejecución interrumpida: revisión requerida'
            where id = %s and estado = 'procesando'
        """, (row["version_id"],))
    return len(rows)

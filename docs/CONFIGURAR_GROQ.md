# Groq para DOCTRINA

Preparado el 21 de octubre de 2026. Sin despliegue ni envío real al proveedor.

## Estado

Integración en la API documental existente, exclusivamente Superadmin. Modelo fijo `openai/gpt-oss-120b`; endpoint fijo de chat completions de Groq. Sin herramientas, navegación, archivos externos, entrenamiento ni proveedor alternativo automático. No se crea facturación ni se cambia el plan.

El proyecto Vercel consultado no tiene variables `GROQ_*`. Por tanto no es posible completar una prueba real ni afirmar que retención cero esté activada. Las pruebas utilizan respuestas sintéticas.

## Configuración que requiere acceso a la cuenta

1. Crear o ingresar a la cuenta en https://console.groq.com/ y conservar el plan Free; comprobar las cuotas y disponibilidad del modelo en esa cuenta.
2. En Data Controls, activar Zero Data Retention para la organización y comprobar que quedó guardado. No confundir retención cero con ausencia de procesamiento externo. No activar funciones de batch o fine-tuning para este flujo.
3. Crear una API key dedicada a DOCTRINA y copiarla directamente a las variables de servidor del proyecto Vercel, como `GROQ_API_KEY`. No pegarla en conversaciones, repositorio, HTML, capturas o formularios de la plataforma.
4. Solo después de comprobar Data Controls, agregar `GROQ_ZDR_CONFIRMADO=true` en Vercel. Esta variable es una constancia administrativa; el código no tiene una API de Groq para verificar remotamente el ajuste. No establecerla por anticipado.
5. Mantener sin redeploy hasta la publicación autorizada del conjunto. La configuración no estará disponible para un despliegue ya construido por agregar variables.
6. Aplicar la migración preparada `sql/doctrina_extraccion_paginas.sql` después de las migraciones previas indicadas en el checkpoint. Esta versión incorpora permisos y auditoría Groq; no volver a aplicar encima de una definición diferente sin revisar diferencias.
7. Probar primero con un PDF sintético: cargar, aprobar original, extraer, revisar cada página, aprobar extracción y autorizar su versión para Groq en el nuevo panel. No autorizar automáticamente documentos privados.
8. Ejecutar consultas de control y revisar contenido, fidelidad documental, referencias y comportamiento ante insuficiencia antes de autorizar originales privados individualmente.

## Privacidad y permisos

Cada autorización queda ligada a versión, huella, proveedor y modelo. La aprobación documental no concede permiso de envío. Hay panel para autorizar y revocar, con confirmación explícita y registro de actor/fecha. Cambios de versión o huella no heredan permisos. Revocar impide nuevos envíos y descarta resultados pendientes; no deshace una solicitud ya iniciada.

Se recuperan pasajes desde el corpus aprobado y se filtran por autorización en servidor. Antes del envío se comprueban de nuevo vigencia, aprobación, huella, permiso y su revisión. Se seleccionan hasta seis pasajes de mil caracteres. Se envían pregunta, antecedentes y metadatos bibliográficos mínimos de esos pasajes; no se envían originales completos, claves de Supabase ni SHA/UUID internos al modelo. El expediente completo tiene límite conservador de 12.000 bytes UTF-8; esto no sustituye un contador exacto de tokens.

La auditoría local conserva actor, fecha, modelo, estado, referencias y huella del expediente; no guarda pregunta, antecedentes, fragmentos ni respuesta generada en esa tabla. Groq recibe el expediente autorizado y mantiene sus propias condiciones y metadatos de uso. Nuestra retención local es independiente de la configuración del proveedor.

## Uso y fallos

Una reserva durable por usuario serializa envíos. Límite preventivo: una generación por minuto y 20 por día UTC. El proveedor puede aplicar límites distintos o más restrictivos, compartidos con otros usos de su organización. No se garantiza cuota gratuita permanente ni disponibilidad continua.

Tiempo máximo del proveedor: 30 segundos. Salida limitada a 2.600 tokens, JSON estricto y diez secciones. Se rechazan referencias ajenas, estructura inválida y respuestas truncadas. La revisión posterior descarta el análisis si cambió permiso, original o revisión del texto. Los errores no exponen la respuesta interna del proveedor ni la clave, no reintentan automáticamente y presentan la consulta documental local.

La validación de referencias acredita pertenencia al expediente, no la corrección semántica de cada afirmación. El análisis requiere contraste humano. La recuperación sigue siendo léxica; búsqueda semántica y evaluación del razonamiento sobre casos reales permanecen pendientes.

## Evidencia de pruebas

220 pruebas automatizadas aprobadas; PostgreSQL aislado verifica permisos, revocación y reautorización, cambios de extracción, bloqueo concurrente y límite diario, historial y ACL. DOM y navegador escritorio/móvil verifican consulta, referencias, permiso y revocación. Ninguna prueba utilizó un token real ni envió originales a Groq.

Referencias técnicas verificadas: https://console.groq.com/docs/api-reference ; https://console.groq.com/docs/structured-outputs ; https://console.groq.com/docs/your-data ; https://console.groq.com/docs/rate-limits .

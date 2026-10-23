# Semántica y crítica argumental — SIN PUBLICAR

## Cambios

- Criterios compartidos para consultas, planificación de búsqueda, revisión previa y elaboración de oratoria: intención, premisas y conclusión; negación y alcance, cuantificadores, condiciones, modalidad, citas de terceros, hipótesis, símbolos y metáforas. No se reescriben hechos del usuario.
- Señales orientativas de corrección/cambio de tema, nunca tomadas como hechos u órdenes. Solo las continuaciones explícitas pueden reutilizar exclusivamente las fuentes previas; las correcciones y preguntas nuevas vuelven al planificador. Permisos y hashes documentales siguen verificándose.
- Contexto acotado con hasta doce intervenciones, conservando correcciones intermedias y dando mayor espacio a intervenciones del usuario. Los recortes se marcan […]; no se presume el contenido omitido.
- Criterios de falacias formales/informales, sin catálogo cerrado. Se exige examinar el argumento y su contexto, diferenciar validez, premisas y fuerza inductiva; considerar contraejemplos y evitar etiquetas por palabras aisladas. Autoridad competente, tradición, emoción y analogía no son falaces por sí mismas.
- Orador: nueva categoría privada argumentacion. Pasaje verificable, explicación del posible defecto y corrección, sin acusar mala fe. La revisión llega a la generación y figura en el apartado 6 del informe privado. La pieza oral corrige con tacto, sin convertirse en una lista de falacias.
- Conclusiones ordinarias con trabajo revisado: uno a tres apoyos de bloques válidos que reproduzcan íntegramente un pasaje suministrado. No se admiten recortes de negaciones, apoyos inventados o bloques inexistentes. Se guardan como auditoría privada, fuera de la pieza oral. Se conserva la revisión formal y el rango 315–385 palabras.
- Sin llamada adicional de autoevaluación ni nuevas dependencias. El planificador vuelve a intervenir cuando cambia el asunto o se rectifica el caso; las continuaciones claras conservan la optimización previa. Se evita duplicar criterios en los prompts del Orador.

## Validación

356 pruebas Node aprobadas, incluidas nuevas pruebas de señales/contexto, preservación de redacción, integración de repregunta con corrección y fuentes anteriores, instrucciones enviadas al proveedor, categoría de argumentación y apoyos de oratoria. Regresión DOM de Orador, plataforma y memoria aprobada; observaciones renderizadas como texto seguro. Sintaxis y git diff --check correctos.

Se prueba el contrato de instrucciones, la recuperación, la integridad de evidencia y los flujos con respuestas simuladas. Esto no acredita comprensión perfecta ni sensibilidad/especificidad real del modelo para toda falacia. La evaluación semántica real con casos positivos y contraejemplos queda pendiente de una prueba autorizada con el proveedor; se mantiene revisión humana.

No se han enviado documentos reales al proveedor, aplicado migraciones, hecho push, fusionado ni desplegado. El conjunto previo de mejoras y sus dos migraciones permanece pendiente de publicación.

# Agente de consultas de DOCTRINA

Estado: circuito documental local implementado y probado, sin despliegue. No hay proveedor generativo conectado ni documentos autorizados para un servicio externo por esta implementación.

## Funcionamiento

Solo el Superadmin autenticado puede llamar `agente_consultar` en la API documental existente. La identidad se verifica con Auth y perfil antes de recuperar fuentes. La pregunta, los términos de recuperación y los antecedentes se validan por separado. La búsqueda usa exclusivamente la función SQL protegida: originales vigentes, última versión, extracción aprobada y huella coincidente. Se devuelven hasta 50 pasajes con clase, página PDF, versión, UUID y SHA-256. No se descargan originales ni se envían fragmentos a terceros para consultar.

El informe local organiza alcance, alegaciones, fuentes, tradición y límites, hipótesis, examen doctrinal/ético, objeciones, conclusión condicionada, evidencia y preguntas pendientes. No realiza inferencias semánticas ni afirma resolver el caso. Una coincidencia léxica no acredita una obligación, una derogación ni competencia normativa. Los antecedentes del consultante no se convierten en hechos acreditados. La falta de resultados produce indeterminación.

La interfaz muestra cobertura y referencias contrastables con el PDF original. Trata documentos, preguntas y respuestas como texto, nunca como HTML o instrucciones ejecutables. Una consulta tiene espera máxima de 45 segundos; conserva la pregunta ante error. Recargar la biblioteca invalida resultados previos. Cerrar sesión cancela la consulta y borra formulario y resultados; respuestas tardías no se muestran en otra sesión.

## Conexión generativa pendiente

El contrato requiere autorización explícita por documento y servicio externo. No existe un proveedor/modelo autorizado identificado. La aprobación de vigencia o extracción de un documento no es permiso para transmitirlo a un LLM.

Antes de habilitar generación: registrar proveedor/modelo y autorización revocable por versión/documento y servicio; guardar credenciales exclusivamente en servidor; filtrar el contexto nuevamente al enviar; limitar fragmentos y costes; validar referencias devueltas contra el conjunto recuperado; registrar procedencia/modelo/autorización sin divulgar originales; declarar insuficiencia y separar hechos, alegaciones e inferencias. El modelo no podrá decidir sanciones ni emitir interpretaciones institucionalmente vinculantes. No publicar respuestas automáticamente.

## Comprobaciones

203 pruebas automatizadas aprobadas. Pruebas de API: identidad, límites y recuperación protegida. Pruebas del informe: falta de evidencia, conservación de referencias, alegaciones y texto adversarial sin obediencia. PostgreSQL aislado: cobertura, revisión, vigencia y huella. DOM y navegador escritorio/móvil: formulario, informe, referencias y acceso a página original; protección contra HTML y limpieza de respuestas tardías tras cerrar sesión. Datos sintéticos; ningún correo real ni consulta a proveedor externo.

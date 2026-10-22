# Agente y Orador: memoria persistente y calidad

El agente conserva criterios editoriales en config/memoria-agente.json y recupera al iniciar sesión un JSON privado de casos revisados. La copia temporal se limpia al salir; los casos del servidor permanecen. Las respuestas nuevas son candidatas hasta que el administrador las aprueba y puede retirarlas. Se comprueban de nuevo sus fuentes antes de reutilizarlas; los recuerdos no constituyen normas ni reentrenan los pesos del modelo.

La consulta lee páginas en paralelo, evita repeticiones dentro del turno y registra métricas sin contenido privado. Los límites de Groq conservan el avance y muestran cuándo reanudar, sin esperas automáticas largas. El Orador aplica criterios diferenciados para conclusiones y ceremonias, exige pasajes verificables en la revisión y permite un único ajuste de formato en la generación. El formulario solicita solo Grado; informe y Word evitan la duplicación de Tenida.

Activación: aplicar sql/agente_casos_revisados.sql una sola vez y configurar DOCTRINA_MEMORIA_CASOS_ENABLED=true en production. La tabla tiene RLS, sin privilegios anon/authenticated; el backend verifica Superadmin y filtra por actor.

Validación local: 304 pruebas Node 24 y nueve programas de UI/DOM/PostgreSQL aislado aprobados. El benchmark es una simulación, no latencia acreditada de producción. CI ejecuta ambas suites sobre main. El build production verifica Groq y una muestra sintética del Orador; no certifica fidelidad a documentos reales.

Nodemailer fijado en 10.2.1, sin alerta alta en la auditoría local. Permanecen tres alertas moderadas transitivas de Mammoth; no se aplicó la regresión incompatible sugerida por audit fix.

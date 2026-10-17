-- Reemplazo oficial: 4 áreas/8 unidades/24 subunidades/139 temas (175 entradas).
-- Cuatro objetivos transcritos del PDF. No altera texto/PDF/preguntas/progreso.
CREATE TABLE IF NOT EXISTS public.areas_docencia (
 codigo varchar(7) PRIMARY KEY,
 objetivo_general text NOT NULL CHECK(length(btrim(objetivo_general))>0),
 paginas_fuente text NOT NULL
);
ALTER TABLE public.areas_docencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS areas_docencia_lectura_auth ON public.areas_docencia;
CREATE POLICY areas_docencia_lectura_auth ON public.areas_docencia FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.areas_docencia FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.areas_docencia TO authenticated;
CREATE TABLE IF NOT EXISTS public.modulos_temas (
 modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
 codigo varchar(40) NOT NULL REFERENCES public.unidades_docencia(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
 PRIMARY KEY(modulo_id,codigo)
);
CREATE INDEX IF NOT EXISTS modulos_temas_codigo_idx ON public.modulos_temas(codigo);
ALTER TABLE public.modulos_temas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS modulos_temas_lectura_auth ON public.modulos_temas;
CREATE POLICY modulos_temas_lectura_auth ON public.modulos_temas FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.modulos_temas FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.modulos_temas TO authenticated;
DO $datos$
DECLARE n int;
BEGIN
 IF (SELECT count(*) FROM public.unidades_docencia)<>112 THEN RAISE EXCEPTION 'Requiere catálogo previo de 112 entradas'; END IF;
 IF (SELECT count(*) FROM public.modulos)<>6 THEN RAISE EXCEPTION 'Cantidad de trabajos inesperada'; END IF;
 IF EXISTS (SELECT 1 FROM public.modulos WHERE unidad_codigo IS NOT NULL) THEN RAISE EXCEPTION 'Trabajos ya clasificados; detener'; END IF;
 IF EXISTS (SELECT 1 FROM public.modulos_temas) THEN RAISE EXCEPTION 'Relaciones existentes; detener'; END IF;
 DELETE FROM public.unidades_docencia;
 INSERT INTO public.unidades_docencia(codigo,detalle,orden,activo) VALUES
 ('INCI000','CONTENIDO INICIÁTICO',1,true),
 ('INCI0100','UNIDAD 1: BASAMENTOS DOCTRINARIOS',2,true),
 ('INCI0110','1.1 CONCEPTOS FUNDAMENTALES DEL GRADO',3,true),
 ('INCI011A','El concepto Hirámico del Taller',4,true),
 ('INCI011B','El Jefe de Obra según el modelo de Hiram',5,true),
 ('INCI011C','Los malos compañeros',6,true),
 ('INCI0120','1.2 LA EXALTACIÓN',7,true),
 ('INCI012A','La Ceremonia de Exaltación como etapa iniciática',8,true),
 ('INCI012B','Significado de la Exaltación',9,true),
 ('INCI0130','1.3 LAS VIRTUDES DEL GRADO DE MAESTRO',10,true),
 ('INCI013A','Celo',11,true),
 ('INCI013B','Fervor',12,true),
 ('INCI013C','Constancia',13,true),
 ('INCI0140','1.4 ASPECTOS SIMBÓLICOS FUNDAMENTALES',14,true),
 ('INCI014A','La Acacia',15,true),
 ('INCI014B','La Edad del Maestro',16,true),
 ('INCI014C','El Signo de Socorro',17,true),
 ('INCI014D','Los 5 Puntos Perfectos de la Maestría',18,true),
 ('INCI014E','El Templo de Salomón',19,true),
 ('INCI014F','Jubelás, Jubelós, Jubelum',20,true),
 ('INCI014G','El Orden en el Caos',21,true),
 ('INCI014H','El Maestro Hiram como símbolo',22,true),
 ('INCI014I','La Cámara del Medio',23,true),
 ('INCI014J','Lápiz, barro y carbón',24,true),
 ('INCI014K','Ambición, Hipocresía e Ignorancia',25,true),
 ('INCI014L','¡Es nuestro Maestro!',26,true),
 ('INCI0200','UNIDAD 2: CONOCIMIENTO SIMBÓLICO-INICIÁTICO',27,true),
 ('INCI0210','2.1 RETEJADOR EN EL GRADO DE MAESTRO',28,true),
 ('INCI021A','La Batería',29,true),
 ('INCI021B','Posición al Orden',30,true),
 ('INCI021C','Signo',31,true),
 ('INCI021D','Palabra de Paso',32,true),
 ('INCI021E','Toque',33,true),
 ('INCI021F','Palabra Sagrada',34,true),
 ('INCI021G','Marcha del Maestro',35,true),
 ('INCI021H','Aclamación del Grado',36,true),
 ('INCI0220','2.2 RITUAL DE EXALTACIÓN — CÁMARA DE REFLEXIONES',37,true),
 ('INCI022A','La caverna o gruta',38,true),
 ('INCI022B','El cirio',39,true),
 ('INCI022C','El reloj de arena',40,true),
 ('INCI022D','La guadaña',41,true),
 ('INCI022E','El pan',42,true),
 ('INCI022F','El agua',43,true),
 ('INCI022G','El esqueleto humano o la calavera',44,true),
 ('INCI022H','Las 3 sentencias',45,true),
 ('INCI0230','2.3 PREPARACIÓN DEL POSTULANTE',46,true),
 ('INCI023A','Las Vestimentas',47,true),
 ('INCI023B','La Escuadra atada al antebrazo derecho',48,true),
 ('INCI023C','Las perneras arremangadas',49,true),
 ('INCI023D','Las mangas arremangadas',50,true),
 ('INCI0240','2.4 PREPARACIÓN DEL TEMPLO',51,true),
 ('INCI024A','Las colgaduras negras',52,true),
 ('INCI024B','La calavera con las tibias cruzadas',53,true),
 ('INCI024C','Las siete lágrimas blancas',54,true),
 ('INCI024D','El mazo sobre el sitial del Respetable Maestro',55,true),
 ('INCI024E','La escuadra sobre el sitial del Primer Vigilante',56,true),
 ('INCI024F','La regla sobre el sitial del Segundo Vigilante',57,true),
 ('INCI024G','La calavera en el sitial del Respetable Maestro',58,true),
 ('INCI024H','La urna fúnebre',59,true),
 ('INCI0250','2.5 LAS PRUEBAS INICIÁTICAS',60,true),
 ('INCI025A','El examen en el vestíbulo',61,true),
 ('INCI025B','El primer Viaje Misterioso',62,true),
 ('INCI025C','El segundo Viaje Misterioso',63,true),
 ('INCI025D','El tercer Viaje Misterioso',64,true),
 ('INCI025E','Los 5 juramentos',65,true),
 ('INCI0260','2.6 LA ACUSACIÓN',66,true),
 ('INCI026A','La imputación del Guardatemplo',67,true),
 ('INCI026B','La expulsión del Templo',68,true),
 ('INCI026C','El examen y la prueba de inocencia',69,true),
 ('INCI0270','2.7 EL MITO HIRAMITA',70,true),
 ('INCI027A','La Retrogradación',71,true),
 ('INCI027B','El cadáver',72,true),
 ('INCI027C','Salomón, el Rey de Tiro e Hiram Abí',73,true),
 ('INCI027D','El crimen y los golpes mortales (Garganta, Corazón, Cabeza)',74,true),
 ('INCI027E','El ocultamiento del cadáver',75,true),
 ('INCI027F','La búsqueda del Maestro y los Nueve Maestros',76,true),
 ('INCI027G','El hallazgo',77,true),
 ('INCI027H','La Rama de Acacia',78,true),
 ('INCI027I','La carne se desprende de los huesos',79,true),
 ('INCI027J','La Palabra perdida y la Palabra sustituta',80,true),
 ('INCI0280','2.8 EL JURAMENTO',81,true),
 ('INCI028A','Postura y estado en que se presta',82,true),
 ('INCI028B','La Escuadra sobre el Compas',83,true),
 ('INCI028C','Obligaciones del Juramento',84,true),
 ('INCI0290','2.9 CONSTITUCIÓN DEL MAESTRO',85,true),
 ('INCI029A','La Bóveda de Acero',86,true),
 ('INCI029B','Los Nueve Golpes Misteriosos',87,true),
 ('INCI029C','El Mandil y la Banda de Maestro',88,true),
 ('INCI02A0','2.10 RITUAL DE APERTURA Y CLAUSURA',89,true),
 ('INCI02AA','La Acacia me es conocida',90,true),
 ('INCI02AB','El primer deber en la Cámara del Medio',91,true),
 ('INCI02AC','La búsqueda de la Palabra Perdida',92,true),
 ('INCI02AD','El libro de Eclesiastés Cap. 12, Ver. 1 y 7',93,true),
 ('INCI02AE','Posición de la Escuadra y el Compas',94,true),
 ('INCI02AF','La distribución de la Palabra Sagrada',95,true),
 ('INCI02B0','2.11 GNOSIS NUMERAL DEL GRADO',96,true),
 ('INCI02BA','El Seis',97,true),
 ('INCI02BB','El Siete',98,true),
 ('INCI02BC','El Ocho',99,true),
 ('INCI02BD','El Nueve',100,true),
 ('INCI02C0','2.12 EL TEMPLO MASÓNICO DE TERCER GRADO — CONOCIMIENTO RITUALÍSTICO',101,true),
 ('INCI02CA','Análisis Esotérico del Ritual Fúnebre',102,true),
 ('INCI02CB','Análisis del Ritual de Instalación de Oficialidad',103,true),
 ('INCI02CC','Análisis de los Rituales de Consagración y Desconsagración de Templo',104,true),
 ('INCI02D0','2.13 CONOCIMIENTO TRADICIONAL',105,true),
 ('INCI02DA','Los Usos y Costumbres',106,true),
 ('INCI02DB','Año de la Luz y Era Vulgar',107,true),
 ('INCI02DC','Los 3 puntos de abreviación',108,true),
 ('INCI02DD','Los Landmarks',109,true),
 ('INCI02DE','La regularidad con fuente de reconocimiento y territorialidad docente',110,true),
 ('INCI02DF','El derecho masónico',111,true),
 ('INCI02DG','El balotaje',112,true),
 ('INCI02DH','La Cámara del Medio',113,true),
 ('INST000','CONTENIDO INSTITUCIONAL',114,true),
 ('INST0100','UNIDAD 1: HISTORIA DE LA MASONERÍA',115,true),
 ('INST0110','1.1 HISTORIA DE LA MASONERÍA',116,true),
 ('INST011A','Origen del Grado de Maestro',117,true),
 ('INST011B','Análisis crítico de la historia de la Masonería Chilena',118,true),
 ('INST0200','UNIDAD 2: REGLAMENTACIÓN MASÓNICA CHILENA',119,true),
 ('INST0210','2.1 REGLAMENTACIÓN MASÓNICA CHILENA',120,true),
 ('INST021A','Reglamento General de la Gran Logia:',121,true),
 ('INST021B','Reglamentos Complementarios',122,true),
 ('INST021C','Reglamento de Administración de Justicia Masónica',123,true),
 ('INST021D','Reglamento Especial de Votaciones y Escrutinios',124,true),
 ('INST021E','Reglamento Especial sobre uso de Paramentos y Distintivos Masónicos',125,true),
 ('INST021F','Reglamento Especial sobre Templos y Casas Masónicas',126,true),
 ('FILO000','CONTENIDO FILOSÓFICO',127,true),
 ('FILO0100','UNIDAD 1: BASAMENTOS DOCTRINARIOS',128,true),
 ('FILO0110','1.1 FILOSOFÍA GENERAL',129,true),
 ('FILO011A','Axiología',130,true),
 ('FILO011B','Humanismo',131,true),
 ('FILO011C','Laicismo',132,true),
 ('FILO011D','Grandes corrientes del pensamiento moderno',133,true),
 ('FILO011E','Pensamiento filosófico contemporáneo',134,true),
 ('FILO011F','Derechos de la condición humana',135,true),
 ('FILO0120','1.2 FILOSOFÍA MASÓNICA',136,true),
 ('FILO012A','¿Hacia dónde vamos?',137,true),
 ('FILO012B','El sentido de la vida',138,true),
 ('FILO012C','La defensa y propagación de la Verdad',139,true),
 ('FILO012D','La inmortalidad del alma',140,true),
 ('FILO012E','La búsqueda de la felicidad',141,true),
 ('FILO0200','UNIDAD 2: LA DIMENSIÓN FILOSÓFICA DEL RITUAL DE EXALTACIÓN',142,true),
 ('FILO0210','2.1 LA DIMENSIÓN FILOSÓFICA DEL RITUAL DE EXALTACIÓN',143,true),
 ('FILO021A','La vida nace de la muerte',144,true),
 ('FILO021B','El porqué, el cómo y el cuándo de todo lo que existe',145,true),
 ('FILO021C','La verdad como concepto magisterial',146,true),
 ('FILO021D','El Pueblo, la Libertad, la Igualdad y la Fraternidad',147,true),
 ('FILO021E','La negación de la luz y la vida',148,true),
 ('FILO021F','El talento previsor',149,true),
 ('FILO021G','La vida es eterna',150,true),
 ('FILO021H','La civilización y el progreso como fuerzas indestructibles',151,true),
 ('ETIC000','CONTENIDO ÉTICO',152,true),
 ('ETIC0100','UNIDAD 1: BASAMENTOS DOCTRINARIOS',153,true),
 ('ETIC0110','1.1 ÉTICA MASÓNICA',154,true),
 ('ETIC011A','El bien y el mal como categorías éticas',155,true),
 ('ETIC011B','Discernimiento entre el error y la verdad',156,true),
 ('ETIC011C','El secreto en la Maestría',157,true),
 ('ETIC011D','El respeto a la ley civil',158,true),
 ('ETIC011E','El respeto a la ley masónica',159,true),
 ('ETIC011F','El respeto al secreto de nuestros Hermanos',160,true),
 ('ETIC011G','La protección y defensa de nuestros Hermanos',161,true),
 ('ETIC011H','El respeto a la mujer de nuestro Hermano',162,true),
 ('ETIC011I','El respeto a la familia de nuestros Hermanos',163,true),
 ('ETIC011J','El modelo constructivo de Hiram',164,true),
 ('ETIC011K','La inteligencia equilibrada y el carácter justiciero',165,true),
 ('ETIC011L','La perseverancia en la vida masónica',166,true),
 ('ETIC011M','Deberes y derechos del Maestro',167,true),
 ('ETIC0200','UNIDAD 2: LA DIMENSIÓN ÉTICA DEL RITUAL DE EXALTACIÓN',168,true),
 ('ETIC0210','2.1 LA DIMENSIÓN ÉTICA DEL RITUAL DE EXALTACIÓN',169,true),
 ('ETIC021A','El Templo de Diana. Su simbolismo ético',170,true),
 ('ETIC021B','Los ideales fecundos',171,true),
 ('ETIC021C','La ambición, la hipocresía y la ignorancia',172,true),
 ('ETIC021D','La conciencia horrorizada',173,true),
 ('ETIC021E','No nos entreguemos al reposo',174,true),
 ('ETIC021F','El trabajo fecundo y honesto',175,true);
 INSERT INTO public.areas_docencia(codigo,objetivo_general,paginas_fuente) VALUES
 ('INCI000','Establecer en el conocimiento del Maestro, los contenidos fundamentales para compenetrarse del lenguaje esotérico iniciático del Tercer Grado e identificar en símbolos y rituales los elementos doctrinarios que pongan al Maestro Masón en contacto con los aspectos fundantes del proceso iniciático en su Grado.','57, 58, 59, 60, 61'),
 ('INST000','Investigar los orígenes del Grado y ahondar en el conocimiento de los antecedentes constitutivos de la tradición del Grado de Maestro y la tradición del Rito. Adquirir una noción amplia acerca de la naturaleza, historia y alcances de la institución a la que se pertenece.','63'),
 ('FILO000','Construir una concepción personal acerca del sentido de la existencia y de la vida. Relacionar al Maestro con el pensamiento filosófico que se desprende la doctrina del Grado, propendiendo hacia el fortalecimiento de su autonomía de juicio, ayudándolo a comprender el tiempo y el espacio en que vive y convive.','65, 66'),
 ('ETIC000','Identificar los aspectos que configuran la dimensión ética de la Francmasonería, a través del Ritual de Exaltación, adquiriendo los conocimientos para moldear la propia noción de ética individual, aprendiendo a mirarse a sí mismo como sujeto y objeto de su propia comprensión sobre la convivencia humana y sus responsabilidades en la sociedad de la que es parte.','67, 68')
 ON CONFLICT (codigo) DO UPDATE SET objetivo_general=EXCLUDED.objetivo_general,paginas_fuente=EXCLUDED.paginas_fuente;
 UPDATE public.modulos m SET unidad_codigo=v.codigo
 FROM (VALUES
 (1,'INCI013A','CELO FERVOR Y CONSTANCIA.'),
 (2,'INCI025E','LOS 5 JURAMENTOS'),
 (3,'INCI012A','EL RITUAL DE EXALTACIÓN AL TERCER GRADO'),
 (4,'INCI028C','LAS OBLIGACIONES DEL JURAMENTO DE MAESTRO'),
 (5,'INCI028B','LA ESCUADRA SOBRE EL COMPÁS'),
 (6,'INCI012B','SIGNIFICADO DE LA EXALTACIÓN')
 ) AS v(numero_orden,codigo,titulo)
 WHERE m.numero_orden=v.numero_orden AND m.titulo=v.titulo;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>6 THEN RAISE EXCEPTION 'No se clasificaron los seis trabajos: %',n; END IF;
 INSERT INTO public.modulos_temas(modulo_id,codigo)
 SELECT m.id,r.codigo FROM public.modulos m JOIN (VALUES
 (1,'INCI013A'),(1,'INCI013B'),(1,'INCI013C'),
 (2,'INCI025E'),(3,'INCI012A'),(4,'INCI028C'),
 (5,'INCI028B'),(6,'INCI012B')
 ) AS r(numero_orden,codigo) ON r.numero_orden=m.numero_orden;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>8 THEN RAISE EXCEPTION 'Se esperaban ocho relaciones temáticas: %',n; END IF;
END $datos$;
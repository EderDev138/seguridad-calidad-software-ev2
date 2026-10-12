# Sistema de exámenes médicos Cuidarte+

## Informe de seguridad y calidad en el desarrollo de software

**ISY1102 — Seguridad y Calidad en el Desarrollo de Software**

**Evaluación Parcial N.º 2**

**Caso B: Cuidarte+ (Sistema de exámenes médicos)**

**Integrantes**

Eder Valdivia

Marcelo Morales

Carrera: Ingeniería en Informática

Sección: 003V

Docente: Mauricio Andrés Velásquez Silva

Fecha: 12 de octubre de 2026

Documento de referencia: *Especificación de Requerimientos de Software del Caso B
(Cuidarte+) v1.1*, CreaLab SpA — Departamento de desarrollo.

---

# ÍNDICE

1. [Introducción](#1-introducción)
   1.1 Contexto del software evaluado
   1.2 Arquitectura y módulos críticos
   1.3 Propósito del plan de pruebas
   1.4 Alcance del plan de pruebas
   1.5 Objetivos del plan de pruebas
   1.6 Contenido y estructura del informe
   1.7 Ajustes respecto de la EP01
2. [Criterios de calidad, seguridad y cumplimiento](#2-criterios-de-calidad-seguridad-y-cumplimiento)
3. [Plan de pruebas](#3-plan-de-pruebas)
   3.1 Estrategia de pruebas
   3.2 Tipos de prueba: origen, justificación e impacto
   3.3 Criterios de aceptación
   3.4 Herramientas utilizadas
   3.5 Recursos
   3.6 Cronograma
4. [Diseño de casos de prueba](#4-diseño-de-casos-de-prueba)
   4.1 Resumen de trazabilidad caso → requerimiento
   4.2 Matriz de trazabilidad bidireccional
5. [Análisis estático del código fuente](#5-análisis-estático-del-código-fuente)
6. [Ejecución de pruebas](#6-ejecución-de-pruebas)
   6.1 Resumen de ejecución
   6.2 Detalle de ejecución
   6.3 Incidentes identificados y su criticidad
7. [Análisis ético y normativo de los resultados](#7-análisis-ético-y-normativo-de-los-resultados)
8. [Propuesta de mejora](#8-propuesta-de-mejora)
9. [Conclusiones](#9-conclusiones)
10. [Anexos](#10-anexos)

---

# 1. Introducción

## 1.1 Contexto del software evaluado

Cuidarte+ es una plataforma web orientada a centros de salud que permite gestionar
pacientes, exámenes médicos y documentos clínicos. El sistema contempla cuatro tipos de
usuario —administrador, médico, paciente y visitante anónimo—, cada uno con permisos
diferenciados según su función (ERS §2.3).

La solución está construida con **React** en el frontend, **Node.js con Express** en el
backend y **PostgreSQL** como sistema de gestión de base de datos (ERS §4). Utiliza
autenticación mediante **JWT**, almacenamiento interno de documentos médicos con
referencia en base de datos y mecanismos de auditoría para registrar las acciones
críticas realizadas dentro de la plataforma.

La información que administra el sistema es, en su mayor parte, **dato personal sensible
de salud**. Esa condición es la que determina el nivel de exigencia de este plan: una
falla en Cuidarte+ no produce una molestia operativa, produce la exposición del historial
clínico de una persona.

## 1.2 Arquitectura y módulos críticos

**Arquitectura (ERS §4):**

- **Frontend:** SPA en React 19, responsiva, servida por nginx. Consume la API REST por
  el mismo origen.
- **Backend:** API RESTful en Node.js 24 / Express 5, organizada en **arquitectura
  limpia**: dominio (modelos, puertos y reglas), aplicación (casos de uso) e
  infraestructura (PostgreSQL, HTTP, seguridad y almacenamiento).
- **Base de datos:** PostgreSQL 17, con las tablas `usuario`, `paciente`, `examen`,
  `documento` y `auditoria`.
- **Almacenamiento de documentos:** repositorio interno en disco; la base de datos
  conserva únicamente la referencia (ERS RF-4.4).
- **Seguridad transversal:** TLS en tránsito, hashing bcrypt, validación y saneamiento
  de entradas, control de acceso por rol aplicado en el backend y auditoría de acciones
  críticas.

La elección de arquitectura limpia no es decorativa: permite ejecutar la **misma lógica
de negocio** contra un adaptador en memoria (pruebas unitarias y BDD, sin base de datos)
o contra PostgreSQL (integración y QA). Esa propiedad es la que hace viable una batería
de 132 pruebas automatizadas que se ejecuta en poco más de un minuto.

**Módulos críticos, priorizados por riesgo:**

| Módulo | Por qué es crítico | Requerimientos asociados |
|---|---|---|
| Autenticación y sesión | Es la puerta de entrada; un fallo compromete todo el sistema y todos los historiales clínicos. | RF-1.1, RF-1.2, NFR-SEG-2, NFR-SEG-9 |
| Control de acceso por rol | Un paciente solo debe leer. Si el control vive en la interfaz y no en el backend, cualquiera altera información clínica por API. | NFR-SEG-4, RB-1, RB-2, RB-3 |
| Exámenes médicos | Es el registro clínico del paciente; su integridad y su conservación son la razón de ser del sistema. | RF-3.1 a RF-3.3, RF-4.1 |
| Documentos clínicos | Contienen resultados médicos: el dato más sensible del sistema. | RF-4.2, RF-4.3, RF-4.4, NFR-SEG-3 |
| Auditoría | Es la evidencia de trazabilidad y la prueba de cumplimiento ante una fiscalización. | RF-5.1, NFR-SEG-6 |
| Gestión de pacientes | Un duplicado de ficha fragmenta el historial clínico de una persona real. | RF-2.2 a RF-2.4 |

## 1.3 Propósito del plan de pruebas

El presente plan tiene por objetivo asegurar la calidad, la seguridad y el cumplimiento
normativo de Cuidarte+ antes de su puesta en producción.

A diferencia de la EP01 —que **diseñó** el plan de pruebas—, esta EP02 **ejecuta el ciclo
completo** sobre el software desplegado en contenedores Docker y sobre su código fuente,
aplicando análisis estático, análisis de dependencias, pruebas automatizadas, pruebas
dinámicas de seguridad, medición de carga y revisión manual, con el fin de identificar
vulnerabilidades, desviaciones y brechas de cumplimiento, documentarlas con evidencia
reproducible y clasificar su criticidad.

Las pruebas verifican que los flujos clínicos críticos operen correctamente, que la
información esté protegida frente a accesos no autorizados y que el software cumpla la
normativa vigente: **Ley 19.628** sobre protección de la vida privada y su modernización
por la **Ley 21.719**, **Ley 21.663** marco de ciberseguridad, **Ley 20.422** sobre
inclusión de personas con discapacidad, las pautas **WCAG 2.1** y los estándares
**ISO/IEC 25010**, **ISO/IEC 27001** e **ISO/IEC 29119**.

## 1.4 Alcance del plan de pruebas

**Dentro del alcance:**

- Los requisitos funcionales **RF-1 a RF-5** del ERS: autenticación y sesión, registro y
  gestión de usuarios y pacientes, gestión de exámenes médicos, visualización y descarga
  de información médica, y auditoría.
- Los requisitos no funcionales **NFR-SEG-1 a 9**, **NFR-PERF-1 a 3**, **NFR-USAB-1 a 4**,
  **NFR-DIS-1/2** y **NFR-COMPAT-1/2**.
- Las reglas de negocio **RB-1 a RB-3**.
- Los requisitos **adicionales propuestos** en el documento
  `03_Requerimientos_Adicionales_ERS_v1.2.md`, que esta evaluación incorpora y verifica.
- Los cuatro roles del sistema y el control de acceso aplicado en el backend.
- La interfaz responsiva, la API REST y el esquema de base de datos PostgreSQL.
- La seguridad de la aplicación frente al **OWASP Top 10**, el cifrado en tránsito y la
  trazabilidad de auditoría.
- La **ejecución del ciclo de pruebas** sobre el ambiente QA y el **análisis estático**
  del código fuente.

**Fuera del alcance, por no estar definido en el ERS:**

- Aplicación móvil nativa; solo se prueba la web responsiva (ERS §1.2).
- Integración con sistemas externos de salud (FONASA, ISAPRE, RNPI) y facturación.
- Integración de correo electrónico para verificación y notificaciones: el ERS la declara
  como dependencia (§2.5) pero no especifica su comportamiento, por lo que no es
  verificable.
- Seguridad física de los centros de datos y de la infraestructura cloud subyacente.
- Conformidad de accesibilidad de nivel AAA; se verifica el nivel **AA** de WCAG 2.1.
- Pruebas de penetración con explotación avanzada o ingeniería social.

## 1.5 Objetivos del plan de pruebas

1. Verificar que el **100 % de los requisitos funcionales (RF-1 a RF-5)** se comporta
   según su criterio de aceptación.
2. Validar las **reglas de negocio RB-1 a RB-3** como invariantes del sistema,
   comprobándolas por API y no solo por la interfaz.
3. Comprobar que las métricas no funcionales están dentro de los umbrales del ERS:
   CRUD < 300 ms (NFR-PERF-1), página principal < 2 s (NFR-PERF-2) y 200 usuarios
   concurrentes (NFR-PERF-3).
4. Confirmar que el **control de acceso por rol se aplica en el backend** (NFR-SEG-4) y
   que no existen vulnerabilidades críticas o altas del OWASP Top 10 sin mitigación.
5. Verificar el cifrado en tránsito, el hashing de contraseñas y el tratamiento de datos
   conforme a la **Ley 19.628/21.719** (NFR-SEG-1, 2, 3, 8).
6. **Ejecutar los 34 casos de prueba diseñados**, registrar evidencia auditable y
   reproducible, clasificar los incidentes por criticidad y entregar recomendaciones de
   remediación.
7. **Auditar el código fuente y las dependencias** con herramientas de análisis estático
   (SAST) y de composición (SCA), contrastando los hallazgos con la normativa aplicable.
8. **Verificar la corrección**: re-ejecutar el ciclo completo sobre la versión corregida
   para confirmar el cierre de cada incidente (prueba de regresión).

## 1.6 Contenido y estructura del informe

El informe se organiza en: los criterios de calidad, seguridad y cumplimiento que el
software debe satisfacer (§2); el plan de pruebas, con su estrategia, los tipos de prueba
con su origen y justificación, los criterios de aceptación, las herramientas, los recursos
y el cronograma (§3); el diseño de los casos de prueba trazados al ERS, con su tipo de
prueba (§4); el **análisis estático del código fuente y de las dependencias** (§5); la
**ejecución de las pruebas**, con resumen, detalle caso a caso e incidentes clasificados
por criticidad (§6); el **análisis ético y normativo** de los resultados (§7); las
propuestas de mejora (§8); las conclusiones (§9) y los anexos con la evidencia (§10).

## 1.7 Ajustes respecto de la EP01

La EP01 entregó el diseño del plan de pruebas de Cuidarte+ con seis casos trazados al
ERS. Los ajustes incorporados en esta EP02 se resumen a continuación.

| # | Observación sobre la EP01 | Ajuste aplicado en la EP02 | Sección |
|---|---|---|---|
| 1 | Los casos de prueba no declaraban explícitamente su **tipo de prueba**. | Cada caso incorpora el campo **TIPO DE PRUEBA** y una convención de identificadores `CP-[FUN\|INT\|SEG\|SAST\|SCA\|PERF\|USA\|COMPAT\|DIS\|CAL\|REG]-NN`. | 4 |
| 2 | La lista de tipos de prueba no justificaba el **propósito** de cada uno. | La sección 3.2 pasa de una lista a una tabla con **origen, objetivo, impacto de omitirlo, requerimientos cubiertos y herramienta**. | 3.2 |
| 3 | La cobertura era **parcial**: 6 casos cubrían 6 requisitos de un total de 25. | Se diseñan **34 casos** que cubren el 100 % de los RF, NFR y RB del ERS, verificado con una matriz bidireccional. | 4.2 |
| 4 | El plan no contemplaba **análisis estático** del código. | Se agrega la sección 5, con ESLint (incluidos los complementos de seguridad y accesibilidad), SonarQube y análisis de dependencias. | 5 |
| 5 | No existía **ejecución ni evidencia**: el plan quedaba en el diseño. | Se ejecuta el ciclo completo y se documenta cada resultado con evidencia **reproducible** mediante scripts versionados. | 6, 10 |
| 6 | Los defectos no se **clasificaban por criticidad**. | Se adopta la escala CRÍTICO / GRAVE / MODERADO / LEVE y se clasifican los 14 incidentes detectados. | 6.3 |
| 7 | El análisis normativo era **declarativo**: citaba leyes sin vincularlas a hallazgos. | Cada incidente se vincula a la norma concreta que incumple y a su implicancia legal. | 7.2 |
| 8 | No se proponían **remediaciones**. | Se entrega una propuesta de mejora por incidente, priorizada, y se **verifica su cierre** por regresión. | 8 |
| 9 | El ERS presenta vacíos en seguridad, calidad y accesibilidad. | Se proponen **23 requisitos adicionales** (RF y NFR) documentados como anexo a la ERS. | Anexo `03_` |
| 10 | Formato: el documento no aplicaba la tipografía exigida por la pauta. | Se exporta a Word/PDF con Arial 12 en títulos, Arial 11 en cuerpo, interlineado 1,5 y texto justificado, y se sube el archivo directamente a AVA. | Formal |

---

# 2. Criterios de calidad, seguridad y cumplimiento

Los criterios se basan en los requisitos del ERS y se alinean con el modelo de calidad
**ISO/IEC 25010**, la gestión de seguridad de la información **ISO/IEC 27001**, el
estándar de pruebas **ISO/IEC 29119** y la normativa chilena vigente.

## 2.1 Calidad

- **Funcionalidad y confiabilidad:** cumplimiento total de RF-1 a RF-5, especialmente en
  autenticación, gestión de pacientes, exámenes médicos, documentos y auditoría.
- **Usabilidad y accesibilidad:** interfaz clara, responsiva y usable en distintos
  dispositivos, con atención especial a los **usuarios adultos mayores** que el ERS
  identifica como población objetivo (NFR-USAB-1, §1.2).
- **Rendimiento:** operaciones CRUD simples bajo 300 ms, página principal bajo 2 s y
  soporte de 200 usuarios concurrentes (NFR-PERF-1 a 3).
- **Disponibilidad y compatibilidad:** disponibilidad objetivo de 99,5 % mensual y
  compatibilidad con las últimas dos versiones de Chrome, Firefox, Safari y Edge
  (NFR-DIS-1, NFR-COMPAT-1).
- **Mantenibilidad:** código con convenciones automatizadas, complejidad acotada,
  cobertura de pruebas verificada y arquitectura que aísla el dominio de los frameworks
  (ISO/IEC 25010 — mantenibilidad).

## 2.2 Seguridad

- **Confidencialidad e integridad:** TLS en todas las comunicaciones, hashing seguro de
  contraseñas con bcrypt y cifrado de datos sensibles en reposo (NFR-SEG-1, 2, 3).
- **Control de acceso:** los permisos se aplican según el rol **desde el backend**, no
  desde la interfaz (NFR-SEG-4). Esta distinción es el eje de la auditoría de seguridad
  de este informe.
- **Protección frente a ataques:** medidas contra CSRF, XSS e inyección SQL, con
  validación y saneamiento de entradas (NFR-SEG-5), alineadas al OWASP Top 10.
- **Gestión de sesiones y auditoría:** acceso mediante JWT de corta vigencia con
  revocación efectiva en el cierre de sesión, y registro de las acciones críticas
  (RF-1.2, RF-5.1, NFR-SEG-9).
- **Gestión segura de logs:** los registros no deben contener credenciales ni datos
  clínicos (NFR-SEG-6).

## 2.3 Cumplimiento normativo

- **Protección de datos personales (Ley 19.628, modernizada por la Ley 21.719):** los
  datos de salud son **datos sensibles**. Su tratamiento exige finalidad, minimización,
  confidencialidad, seguridad y trazabilidad del acceso. La Ley 21.719 agrega el deber de
  seguridad del tratamiento y el régimen sancionatorio asociado.
- **Marco de ciberseguridad (Ley 21.663):** obliga a implementar controles de seguridad,
  gestionar los riesgos y **notificar los incidentes** de seguridad relevantes.
- **Accesibilidad digital (Ley 20.422 y WCAG 2.1 nivel AA):** la plataforma debe ser
  utilizable por personas con discapacidad. Dado que el ERS identifica a los adultos
  mayores como usuarios objetivo, la accesibilidad no es un extra: es un requisito
  funcional del producto.
- **Evidencia auditable (ISO/IEC 29119):** la documentación de pruebas debe constituir
  prueba de cumplimiento ante una auditoría. Por eso, en esta evaluación, toda la
  evidencia se genera con scripts versionados y reproducibles.

---

# 3. Plan de pruebas

## 3.1 Estrategia de pruebas

Se aplica un **enfoque mixto**: pruebas manuales para la validación funcional y de
usabilidad, soportadas por automatización para la regresión, la carga, el escaneo de
seguridad y el análisis estático.

**Etapas del proceso:**

| Etapa | Actividad |
|---|---|
| 1 | Análisis del ERS, extracción de requisitos y construcción de la matriz de trazabilidad |
| 2 | Diseño de casos de prueba y preparación de datos sintéticos |
| 3 | Preparación del ambiente QA reproducible (Docker) |
| 4 | Análisis estático del código y de las dependencias |
| 5 | Ejecución de pruebas y captura de evidencia |
| 6 | Clasificación de incidentes y análisis ético-normativo |
| 7 | Remediación y **re-ejecución (regresión)** |

**Priorización por riesgo.** Se priorizan los módulos que procesan datos sensibles de
salud y los que concentran el riesgo de acceso no autorizado: autenticación, control de
acceso por rol, exámenes médicos y documentos clínicos. Por sobre ellos se sitúa un único
criterio: **todo lo que pueda exponer el historial clínico de un paciente a quien no debe
verlo**.

**Reparto entre manual y automatizado, con su justificación:**

| Actividad | Modalidad | Por qué |
|---|---|---|
| Pruebas funcionales de flujos clínicos | Automatizada (Jest + Supertest) | Son deterministas y deben repetirse en cada cambio; automatizarlas convierte la verificación en una puerta de calidad. |
| Reglas de negocio (RB-1 a RB-3) | Automatizada (Cucumber, BDD en español) | Expresadas en lenguaje natural, permiten que un stakeholder no técnico valide el comportamiento esperado. |
| Control de acceso y acceso a datos ajenos | Automatizada + manual por API | Debe probarse **sin pasar por la interfaz**: es la única forma de distinguir un control real de uno cosmético. |
| Usabilidad y accesibilidad | Mixta | El contraste y los atributos ARIA se verifican con script; la navegación por teclado y la claridad de los flujos requieren juicio humano. |
| Rendimiento y carga | Automatizada (JMeter / script de carga) | Necesita 200 peticiones concurrentes y medición objetiva de percentiles. |
| Seguridad dinámica | Automatizada (OWASP ZAP) + manual | El escaneo cubre lo conocido; el manual valida la lógica de autorización, que ninguna herramienta puede inferir. |
| Análisis estático y de dependencias | Automatizada (ESLint, SonarQube, npm audit, Snyk) | Revisa el 100 % del código y del árbol de dependencias, algo inviable manualmente. |
| Verificación de criptografía y base de datos | Manual asistida | Requiere inspeccionar la configuración y consultar directamente la base. |

**Criterios de entrada:** ERS v1.1 disponible; ambiente QA levantado con Docker (frontend,
backend y PostgreSQL); datos sintéticos cargados; usuarios de los tres roles creados;
herramientas instaladas.

**Criterios de salida:** 100 % de los casos críticos ejecutados; sin hallazgos críticos ni
graves abiertos; métricas de rendimiento dentro de los umbrales del ERS; cobertura de
pruebas sobre el umbral definido; evidencia completa y trazable para cada caso.

**Manejo de defectos:** cada defecto se registra con identificador, caso que lo detectó,
criticidad, evidencia, norma afectada y propuesta de remediación. Los **críticos y graves
bloquean** la liberación.

## 3.2 Tipos de prueba: origen, justificación e impacto

La tabla justifica, para cada tipo de prueba, **de dónde nace** en este caso concreto,
**por qué es necesaria**, **qué ocurriría si se omitiera**, qué requerimientos cubre y con
qué herramienta se ejecuta.

| Tipo de prueba | Origen (qué lo motiva) | Objetivo y justificación en Cuidarte+ | Impacto si se omite | Requerimientos | Herramienta |
|---|---|---|---|---|---|
| **Funcionales** | El ERS define cinco grupos de requisitos funcionales con criterios de aceptación explícitos. | Verificar que autenticación, pacientes, exámenes, documentos y auditoría operan según lo especificado. | Se libera software con flujos clínicos rotos: un médico no puede registrar un examen o un paciente no ve sus resultados. | RF-1 a RF-5 | Jest + Supertest |
| **De integración** | La consulta de un examen cruza tres entidades (paciente → examen → documento) y debe respetar la titularidad en toda la cadena. | Verificar que los módulos se comunican y que las reglas compuestas se mantienen de extremo a extremo. | Un fallo silencioso permitiría descargar el documento de otro paciente llegando por una ruta distinta. | RF-4.1 a RF-4.4, RF-5.1 | Jest + Supertest, Cucumber |
| **De seguridad — control de acceso** | El ERS exige expresamente control de acceso por rol **en el backend** (NFR-SEG-4) y la regla RB-1 limita al paciente a solo lectura. | Comprobar que la autorización se aplica en el servidor y no solo ocultando botones en la interfaz. | Un paciente podría crear, modificar o eliminar exámenes enviando peticiones directamente a la API. | NFR-SEG-4, RB-1, RB-2, RB-3 | curl / Postman, Jest |
| **De seguridad — acceso a datos de terceros** | Las rutas exponen identificadores numéricos (`/pacientes/2`), que son triviales de enumerar. | Verificar que el servidor comprueba la **titularidad del dato** y no solo el rol. | Cualquier paciente leería el historial clínico de cualquier otro cambiando un número en la URL (OWASP A01). | RB-1, NFR-SEG-4 | curl / Postman, Jest |
| **De seguridad — inyección** | Formularios y filtros reciben texto libre que termina en consultas SQL y en el DOM del navegador. | Detectar inyección SQL, XSS y asignación masiva de atributos. | Exfiltración o alteración de datos clínicos; secuestro de sesión mediante script inyectado. | NFR-SEG-5 (OWASP A01/A03) | OWASP ZAP, payloads manuales, SonarQube |
| **De seguridad — criptografía** | El ERS exige TLS, bcrypt y cifrado en reposo (NFR-SEG-1 a 3) para datos de salud. | Verificar la fortaleza real de los parámetros criptográficos, no solo su presencia. | Un hashing débil convierte un volcado de base de datos en una lista de contraseñas recuperables. | NFR-SEG-1, 2, 3 | Inspección de BD, openssl |
| **De seguridad — gestión de sesión** | El criterio de aceptación de RF-1 exige que el logout **invalide** la sesión. | Comprobar que la revocación es efectiva en el servidor y no un simple borrado en el navegador. | Un token interceptado seguiría siendo válido después de que el usuario cerró sesión. | RF-1.2, NFR-SEG-9 | curl / Postman, Jest |
| **Análisis estático (SAST)** | Hay defectos que no se manifiestan en ejecución pero sí están en el código. | Auditar el 100 % del código buscando patrones inseguros, complejidad excesiva y malas prácticas. | Vectores como `dangerouslySetInnerHTML` o SQL concatenado pasarían inadvertidos. | NFR-SEG-5, ISO/IEC 25010 | ESLint (+ security, jsx-a11y), SonarQube |
| **Análisis de dependencias (SCA)** | El 85 % del código que se despliega proviene de terceros (122 paquetes de producción). | Detectar vulnerabilidades conocidas en librerías directas y transitivas. | Se desplegaría una vulnerabilidad pública conocida, con exploit disponible. | NFR-SEG-6, OWASP A06 | `npm audit`, Snyk |
| **De rendimiento y carga** | El ERS fija umbrales numéricos y una concurrencia objetivo de 200 usuarios. | Medir latencia y tasa de error bajo la concurrencia especificada. | Degradación en el horario de mayor atención, justo cuando el centro de salud más lo necesita. | NFR-PERF-1, 2, 3 | JMeter, script de carga |
| **De usabilidad y accesibilidad** | El ERS señala a los **adultos mayores** como usuarios objetivo y exige contraste, ARIA y navegación por teclado. | Evaluar contraste, anuncio de mensajes, tamaño de controles y claridad de los flujos. | Exclusión de usuarios con baja visión o ceguera; incumplimiento de la Ley 20.422. | NFR-USAB-1 a 4 | Verificador de contraste, Lighthouse, revisión manual |
| **De compatibilidad** | El ERS exige las dos últimas versiones de cuatro navegadores y soporte móvil. | Verificar el funcionamiento en los navegadores y dispositivos objetivo. | Fallos en navegadores no probados, invisibles hasta que los reporta un usuario. | NFR-COMPAT-1, 2 | Matriz de navegadores, DevTools |
| **De disponibilidad** | Un centro de salud no puede quedarse sin acceso al historial clínico. | Confirmar el objetivo de uptime y que el despliegue ocurre sin pérdida de datos. | Indisponibilidad en atención clínica; pérdida de datos en una migración. | NFR-DIS-1, 2 | Healthcheck, monitoreo |
| **De calidad del proceso** | Sin puertas automatizadas, los controles dependen de la disciplina individual. | Verificar cobertura, formato, convenciones y que el pipeline bloquea lo que no cumple. | Los controles se saltan bajo presión de entrega, que es justo cuando más se necesitan. | NFR-CAL-1 a 5 (propuestos) | Jest, GitHub Actions |
| **De regresión** | Cada corrección puede romper algo ya validado. | Re-ejecutar la batería completa tras cada corrección. | Reintroducción de defectos ya corregidos. | Todos | Jest, Cucumber, pipeline CI |

## 3.3 Criterios de aceptación

Una prueba se considera **aprobada** cuando:

- **Funcional:** el resultado obtenido coincide con el esperado y respeta el criterio de
  aceptación del requerimiento asociado.
- **Reglas de negocio:** el comportamiento respeta RB-1, RB-2 y RB-3 **verificadas por
  API**, no solo a través de la interfaz.
- **No funcional:** las métricas están dentro de los umbrales del ERS (CRUD < 300 ms,
  vista principal < 2 s, 200 usuarios concurrentes) **con tasa de error 0 %**.
- **Seguridad:** no existen vulnerabilidades críticas ni altas sin mitigación; toda
  operación no autorizada se deniega en el servidor con el código HTTP correspondiente.
- **Accesibilidad:** todos los pares de color alcanzan el contraste mínimo de WCAG 2.1 AA
  y los mensajes de estado se anuncian al lector de pantalla.
- **Evidencia:** cada ejecución queda respaldada con su salida, fecha y ejecutor, y es
  **reproducible** mediante el script versionado correspondiente.

## 3.4 Herramientas utilizadas

| Herramienta | Uso en las pruebas | Fundamento de la elección |
|---|---|---|
| **Docker / Docker Compose** | Ambiente QA reproducible | Levanta frontend, backend y PostgreSQL idénticos al ambiente del ERS, aislados de producción y reconstruibles desde cero. |
| **Jest + Supertest** | Pruebas unitarias, de integración y de API | Ejercen la API completa con sus middlewares de seguridad reales, sin depender de un navegador; se ejecutan en segundos y sirven de puerta en CI. |
| **Cucumber (BDD, Gherkin en español)** | Reglas de negocio | Permite que las reglas RB-1 a RB-3 queden escritas en lenguaje natural y sean validables por un stakeholder no técnico. |
| **ESLint + `eslint-plugin-security`** | Análisis estático del backend | Detecta patrones inseguros sin ejecutar la aplicación e integra la seguridad en el flujo diario del desarrollador. |
| **ESLint + `eslint-plugin-jsx-a11y`** | Análisis estático de accesibilidad | Convierte los requisitos de accesibilidad del ERS en una puerta automatizada y prohíbe `dangerouslySetInnerHTML`. |
| **Prettier** | Formato consistente | Elimina la discusión de estilo del proceso de revisión, que así se concentra en la lógica. |
| **SonarQube** | SAST y Quality Gate | Detecta vulnerabilidades, *code smells*, duplicación y complejidad; consume la cobertura de Jest para una visión única de calidad. |
| **`npm audit` / Snyk** | Análisis de dependencias (SCA) | Identifican CVE conocidos en dependencias directas y transitivas, incluidas las que nadie declaró explícitamente. |
| **OWASP ZAP** | Seguridad dinámica (DAST) | Escanea la aplicación en ejecución: cabeceras, cookies, fugas de información e inyección. |
| **Trivy** | Escaneo de imágenes de contenedor | Las vulnerabilidades del sistema operativo base también se despliegan; Trivy las detecta antes del despliegue. |
| **Apache JMeter** | Pruebas de carga | Artefacto formal del plan: simula 200 usuarios concurrentes y entrega percentiles. |
| **Script de carga propio (Node)** | Medición de rendimiento | Mide los mismos umbrales sin requerir la instalación de JMeter; produce las cifras citadas en este informe. |
| **Verificador de contraste propio (Node)** | Accesibilidad | Calcula la relación de contraste WCAG de cada par de colores desde el código fuente, cubriendo estados que no están en pantalla. |
| **Lighthouse** | Rendimiento y accesibilidad del frontend | Audita el DOM renderizado y complementa la verificación estática. |
| **GitHub Actions** | Integración continua | Ejecuta todas las puertas en cada cambio: sin pipeline, los controles dependen de que alguien se acuerde. |
| **Git / GitHub** | Control de versiones y trazabilidad | Versiona código, informe y evidencia, de modo que cada hallazgo es atribuible a un estado concreto del software. |

## 3.5 Recursos

- **Humanos:** líder de QA (coordinación, trazabilidad y reporte), tester funcional
  (diseño y ejecución de casos), especialista en seguridad (análisis estático, escaneo y
  pruebas de acceso) y apoyo de desarrollo (corrección de defectos y datos de prueba).
- **Técnicos:** equipos con navegadores actualizados (Chrome, Firefox, Safari, Edge),
  Docker, Node.js 24, PostgreSQL 17, dispositivos o emuladores para el viewport móvil y
  lector de pantalla para la verificación de accesibilidad.
- **Entorno:** ambiente QA aislado de producción, con **datos sintéticos** exclusivamente.
  Ningún dato clínico real participa en las pruebas, por las razones expuestas en §7.1.

## 3.6 Cronograma

| # | Etapa | Actividades principales | Duración | Responsable | Entregable |
|---|---|---|---|---|---|
| 1 | Análisis del ERS y trazabilidad | Extracción de RF/NFR/RB, detección de vacíos y matriz de trazabilidad | 2 días | Líder de QA | Matriz de trazabilidad + requisitos adicionales propuestos |
| 2 | Diseño de casos y datos | Redacción de los 34 casos y del conjunto de datos sintéticos | 3 días | Tester funcional | Casos de prueba + semilla de datos |
| 3 | Preparación del ambiente QA | `docker compose up`, carga de datos, configuración de herramientas | 1 día | Apoyo de desarrollo | Ambiente QA reproducible |
| 4 | Análisis estático y de dependencias | ESLint, SonarQube, `npm audit`, Snyk, Trivy | 2 días | Especialista en seguridad | Reporte SAST/SCA |
| 5 | Ejecución funcional y de integración | Casos CP-FUN, CP-INT y escenarios BDD | 3 días | Tester funcional | Evidencia + defectos |
| 6 | Ejecución de seguridad | RBAC, IDOR, inyección, criptografía, sesión, cabeceras, DAST | 3 días | Especialista en seguridad | Reporte de seguridad |
| 7 | Rendimiento, usabilidad y compatibilidad | Carga con 200 usuarios, contraste, ARIA, matriz de navegadores | 2 días | Tester funcional | Métricas y hallazgos |
| 8 | Clasificación y análisis normativo | Criticidad de incidentes y vinculación a la norma | 2 días | Líder de QA | Tabla de incidentes + análisis |
| 9 | Remediación y regresión | Corrección de los 14 incidentes y re-ejecución completa | 3 días | Apoyo de desarrollo + QA | Versión corregida verificada |
| 10 | Consolidación y entrega | Informe, evidencia y presentación | 2 días | Líder de QA | Informe final |
| | **Total** | | **23 días hábiles (≈ 5 semanas)** | | |

---

# 4. Diseño de casos de prueba

Se diseñaron **34 casos de prueba** trazados a los requerimientos del ERS del Caso B,
cubriendo los tipos funcional, de integración, de seguridad, de análisis estático, de
dependencias, de rendimiento, de usabilidad, de compatibilidad, de disponibilidad, de
calidad del proceso y de regresión.

Cada caso declara su **TIPO DE PRUEBA**. La convención de identificadores es:

```
CP-[FUN | INT | SEG | SAST | SCA | PERF | USA | COMPAT | DIS | CAL | REG]-NN
```

Los casos marcados con **(A)** están automatizados y se ejecutan en cada cambio mediante
el pipeline de integración continua; el resto se ejecuta de forma manual o asistida.

---

## CP-FUN-01 · Inicio de sesión con credenciales válidas (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-01 · Inicio de sesión con credenciales válidas |
| **DESCRIPCIÓN** | Verificar que un usuario registrado puede autenticarse con su nombre de usuario y contraseña, y que el sistema genera un token de sesión JWT. |
| **REQUERIMIENTO** | RF-1.1 / NFR-SEG-9 |
| **TIPO DE PRUEBA** | Funcional (autenticación) |
| **PRECONDICIONES** | Usuario `medico1` registrado y activo, con credenciales válidas. |
| **PASOS** | 1) Enviar `POST /api/v1/auth/login` con credenciales válidas. 2) Verificar el código de estado y el cuerpo. 3) Usar el token en una petición autenticada. 4) Consultar el registro de auditoría. |
| **RESULTADO ESPERADO** | HTTP 200 con token JWT y token de refresco; el token permite acceder a un recurso protegido; el acceso queda registrado en auditoría. |
| **CRITERIO DE ACEPTACIÓN** | El login exitoso genera una sesión válida mediante JWT y la respuesta **no expone** el hash de la contraseña. |
| **DATOS DE PRUEBA** | `medico1` / `Cuidarte2026!` |

## CP-FUN-02 · Credenciales inválidas y bloqueo por intentos (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-02 · Rechazo de credenciales inválidas y bloqueo temporal |
| **DESCRIPCIÓN** | Verificar que las credenciales incorrectas se rechazan sin revelar si la cuenta existe, y que tras varios intentos fallidos la cuenta se bloquea temporalmente. |
| **REQUERIMIENTO** | RF-1.1 / RF-1.3 (propuesto) / NFR-SEG-11 (propuesto) |
| **TIPO DE PRUEBA** | Funcional negativa / seguridad |
| **PRECONDICIONES** | Usuario `medico1` activo. |
| **PASOS** | 1) Intentar login con contraseña incorrecta. 2) Intentar login con un usuario inexistente y comparar las respuestas. 3) Repetir 5 intentos fallidos. 4) Intentar con la contraseña **correcta**. |
| **RESULTADO ESPERADO** | HTTP 401 en los intentos fallidos, con **mensaje idéntico** para usuario inexistente y contraseña incorrecta; tras 5 fallos, HTTP 429 incluso con la contraseña correcta. |
| **CRITERIO DE ACEPTACIÓN** | No es posible enumerar cuentas por diferencias en la respuesta (OWASP A07) y el bloqueo temporal frena la fuerza bruta. |
| **DATOS DE PRUEBA** | `medico1` con contraseña incorrecta; usuario `no-existe`. |

## CP-FUN-03 · Cierre de sesión y revocación del token (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-03 · Cierre de sesión con revocación efectiva del token |
| **DESCRIPCIÓN** | Verificar que, tras cerrar sesión, el mismo token deja de ser aceptado por el servidor, aunque siga siendo criptográficamente válido y no haya expirado. |
| **REQUERIMIENTO** | RF-1.2 / NFR-SEG-9 |
| **TIPO DE PRUEBA** | Funcional / seguridad (gestión de sesión) |
| **PRECONDICIONES** | Sesión iniciada con token vigente. |
| **PASOS** | 1) Usar el token en `GET /auth/yo`. 2) Ejecutar `POST /auth/logout`. 3) Reintentar `GET /auth/yo` con el **mismo** token. 4) Verificar que un token de acceso no sirve como token de refresco. |
| **RESULTADO ESPERADO** | HTTP 200 antes del logout, HTTP 200 en el logout y **HTTP 401** al reintentar con el mismo token. |
| **CRITERIO DE ACEPTACIÓN** | El logout invalida la sesión **en el servidor**. Un JWT descartado solo en el cliente no cumple el criterio. |
| **DATOS DE PRUEBA** | Token capturado del login de `medico1`. |

## CP-FUN-04 · Autorregistro con rol por defecto (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-04 · Autorregistro de usuario con rol paciente por defecto |
| **DESCRIPCIÓN** | Verificar que un visitante puede registrarse y que el sistema le asigna el rol `PACIENTE`, sin posibilidad de elegir otro rol. |
| **REQUERIMIENTO** | RF-2.1 / RB-1 / NFR-SEG-4 |
| **TIPO DE PRUEBA** | Funcional / seguridad (escalada de privilegios) |
| **PRECONDICIONES** | Ninguna; el endpoint es público. |
| **PASOS** | 1) Registrar un usuario con datos válidos. 2) Verificar el rol asignado. 3) **Repetir enviando `"rol":"ADMIN"`** en el cuerpo. 4) Verificar que el usuario no se creó con ese rol. 5) Intentar registrar un usuario o correo ya existente. |
| **RESULTADO ESPERADO** | HTTP 201 con rol `PACIENTE`; **HTTP 400** al enviar el campo `rol`; HTTP 409 ante duplicados. |
| **CRITERIO DE ACEPTACIÓN** | El rol lo determina el servidor. Ningún campo enviado por el cliente puede alterar el nivel de privilegio (OWASP A01). |
| **DATOS DE PRUEBA** | `nuevo.paciente` / `Cuidarte2026!`; payload con `rol: ADMIN`. |

## CP-FUN-05 · Normalización y validación del RUT (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-05 · Normalización del RUT y validación del dígito verificador |
| **DESCRIPCIÓN** | Verificar que el RUT se normaliza a una forma canónica antes de persistirse y que se valida su dígito verificador mediante módulo 11. |
| **REQUERIMIENTO** | RF-2.2 / RN-01 (propuesto) |
| **TIPO DE PRUEBA** | Funcional / integridad de datos |
| **PRECONDICIONES** | Ninguna; se prueba la lógica del dominio. |
| **PASOS** | 1) Normalizar `12.345.678-5`, `12345678-5` y `  12.345.678-5  `. 2) Normalizar un RUT con dígito verificador `k` minúscula. 3) Intentar normalizar un RUT con dígito verificador incorrecto. 4) Intentar con un formato inválido. |
| **RESULTADO ESPERADO** | Las tres primeras formas producen `12345678-5`; `20.347.024-k` produce `20347024-K`; los RUT inválidos se rechazan con error de datos. |
| **CRITERIO DE ACEPTACIÓN** | Dos escrituras del mismo RUT producen el **mismo** valor almacenado; un dígito verificador incorrecto nunca se acepta. |
| **DATOS DE PRUEBA** | `12.345.678-5`, `20.347.024-k`, `12.345.678-9` (inválido), `no-es-un-rut`. |

## CP-FUN-06 · Registro, edición y baja de paciente (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-06 · Ciclo de vida de la ficha del paciente |
| **DESCRIPCIÓN** | Verificar que un médico o administrador puede registrar, consultar, editar y dar de baja la ficha de un paciente, y que cada acción queda auditada. |
| **REQUERIMIENTO** | RF-2.2 / RF-2.3 / RF-2.4 / RF-5.1 |
| **TIPO DE PRUEBA** | Funcional |
| **PRECONDICIONES** | Usuario `medico1` autenticado. |
| **PASOS** | 1) Crear un paciente con RUT válido. 2) Consultarlo. 3) Editar su teléfono y correo. 4) Intentar editar sin indicar ningún campo. 5) Dar de baja la ficha. 6) Consultar la auditoría. |
| **RESULTADO ESPERADO** | HTTP 201 al crear con el RUT normalizado; HTTP 200 al editar; HTTP 400 si no se indica ningún campo; HTTP 404 sobre una ficha inexistente; registros de auditoría para creación, edición y baja. |
| **CRITERIO DE ACEPTACIÓN** | Las operaciones respetan el requerimiento y queda registro del usuario responsable de cada una. |
| **DATOS DE PRUEBA** | RUT `20.347.024-K`; nombres `Carla Rojas Muñoz`. |

## CP-FUN-07 · Registro y edición de examen médico (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-07 · Registro y edición de examen médico |
| **DESCRIPCIÓN** | Verificar que un médico puede registrar un examen para un paciente y editar posteriormente sus datos y su estado. |
| **REQUERIMIENTO** | RF-3.1 / RF-3.2 |
| **TIPO DE PRUEBA** | Funcional |
| **PRECONDICIONES** | Paciente registrado; usuario `medico1` autenticado. |
| **PASOS** | 1) Crear un examen indicando tipo, descripción y fecha. 2) Verificar que queda asociado al médico que lo registró. 3) Editar tipo, descripción y estado. 4) Intentar fijar un estado fuera del conjunto permitido. 5) Intentar crear un examen para un paciente inexistente. |
| **RESULTADO ESPERADO** | HTTP 201 con `medicoId` del autor y estado inicial `PENDIENTE`; HTTP 200 al editar; HTTP 400 ante un estado inválido; HTTP 404 ante un paciente inexistente. |
| **CRITERIO DE ACEPTACIÓN** | Las operaciones CRUD validan correctamente el ingreso y la edición, y la auditoría indica los campos modificados. |
| **DATOS DE PRUEBA** | Tipo `Perfil lipídico`; estados `PENDIENTE`, `COMPLETADO`, `ANULADO` (inválido). |

## CP-FUN-08 · Eliminación lógica de examen con confirmación (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-08 · Eliminación lógica de examen previa confirmación |
| **DESCRIPCIÓN** | Verificar que la eliminación de un examen exige confirmación del usuario y es **lógica**: el registro deja de aparecer entre los activos pero se conserva en la base de datos. |
| **REQUERIMIENTO** | RF-3.3 |
| **TIPO DE PRUEBA** | Funcional / integridad y trazabilidad |
| **PRECONDICIONES** | Examen existente; usuario `medico1` autenticado. |
| **PASOS** | 1) Solicitar la eliminación desde la interfaz y verificar el diálogo de confirmación. 2) Confirmar. 3) Consultar los exámenes activos del paciente. 4) **Consultar directamente la base de datos** por el identificador eliminado. |
| **RESULTADO ESPERADO** | El examen no aparece entre los activos, pero la consulta a la base devuelve el registro con su campo `eliminado_en` poblado. |
| **CRITERIO DE ACEPTACIÓN** | La eliminación es lógica y solo se efectúa tras confirmación explícita. Si la consulta a la base no devuelve ninguna fila, la eliminación fue física y el caso **falla**. |
| **DATOS DE PRUEBA** | Examen `Hemograma completo` del paciente con RUT `12345678-5`. |

## CP-FUN-09 · Política de contraseñas validada en el servidor (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-09 · Política de contraseñas configurable y validada en servidor |
| **DESCRIPCIÓN** | Verificar que la contraseña debe cumplir la política del ERS (mínimo configurable de 12 caracteres, con mayúscula, minúscula, número y símbolo) y que la validación ocurre en el servidor. |
| **REQUERIMIENTO** | ERS §2.4 / RF-1.4 (propuesto) |
| **TIPO DE PRUEBA** | Funcional / seguridad |
| **PRECONDICIONES** | Ninguna. |
| **PASOS** | 1) Registrar con una contraseña válida. 2) Probar contraseñas que incumplan cada regla por separado. 3) Verificar que el error enumera **todas** las reglas incumplidas. 4) Enviar la petición directamente a la API, sin pasar por el formulario. |
| **RESULTADO ESPERADO** | La contraseña válida se acepta; cada incumplimiento devuelve HTTP 400 con el detalle de las reglas no cumplidas; la validación opera igual sin el formulario. |
| **CRITERIO DE ACEPTACIÓN** | El mínimo es configurable y por defecto 12; la validación del navegador no es el control. |
| **DATOS DE PRUEBA** | `Cuidarte2026!` (válida); `abc`, `cuidarte2026!`, `CUIDARTE2026!`, `CuidartePlus!`, `Cuidarte20266`. |

## CP-FUN-10 · Administración de usuarios y cambio de rol (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-FUN-10 · Administración de usuarios y asignación de roles |
| **DESCRIPCIÓN** | Verificar que el administrador puede listar, crear, editar —incluido el rol— y eliminar usuarios, y que no puede dejar el sistema sin administrador. |
| **REQUERIMIENTO** | RF-2.5 / RF-2.6 / RF-2.7 / RB-2 |
| **TIPO DE PRUEBA** | Funcional / seguridad (control de acceso) |
| **PRECONDICIONES** | Usuario `admin1` autenticado. |
| **PASOS** | 1) Listar usuarios. 2) Crear un usuario con rol `MEDICO`. 3) Cambiar su rol a `ADMIN`. 4) Eliminarlo. 5) Intentar **cambiar su propio rol** y **eliminar su propia cuenta**. 6) Intentar asignar un rol inexistente. |
| **RESULTADO ESPERADO** | Las operaciones legítimas responden 200/201; la autodegradación y la autoeliminación devuelven HTTP 409; un rol inexistente devuelve HTTP 400. |
| **CRITERIO DE ACEPTACIÓN** | Solo el administrador gestiona usuarios y el sistema no puede quedarse sin ningún administrador. |
| **DATOS DE PRUEBA** | `medico2` / rol `MEDICO` → `ADMIN`; rol `SUPERADMIN` (inválido). |

---

## CP-INT-01 · Adjuntar documento a un examen médico (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-INT-01 · Carga de documento con almacenamiento interno y referencia en BD |
| **DESCRIPCIÓN** | Verificar que un médico puede adjuntar un documento a un examen, que el archivo se guarda en el storage interno y que la base de datos conserva únicamente su referencia. |
| **REQUERIMIENTO** | RF-4.3 / RF-4.4 |
| **TIPO DE PRUEBA** | Integración (documental) |
| **PRECONDICIONES** | Examen existente; usuario `medico1` autenticado; archivo PDF válido. |
| **PASOS** | 1) Adjuntar un PDF al examen. 2) Verificar la respuesta. 3) Listar los documentos del examen. 4) Verificar que el registro contiene la ruta de storage y no el binario. 5) Verificar que el nombre del archivo se sanea. |
| **RESULTADO ESPERADO** | HTTP 201 con `rutaStorage`, `mime` y `tamanoBytes`; el binario no aparece en la respuesta ni en la base; un nombre con componentes de ruta queda saneado. |
| **CRITERIO DE ACEPTACIÓN** | El documento se almacena en el storage interno y queda referenciado en la base; la carga se completa en menos de 10 segundos (ERS RF-4, criterio de aceptación). |
| **DATOS DE PRUEBA** | `informe.pdf`; nombre malicioso `../../etc/passwd.pdf`. |

## CP-INT-02 · Descarga del documento por su titular (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-INT-02 · Descarga de documento por el paciente titular, con auditoría |
| **DESCRIPCIÓN** | Verificar que el paciente puede descargar los documentos de **sus** exámenes, que la descarga queda auditada y que el navegador no renderiza el archivo en el origen de la aplicación. |
| **REQUERIMIENTO** | RF-4.2 / RB-1 / RF-5.1 |
| **TIPO DE PRUEBA** | Integración / seguridad |
| **PRECONDICIONES** | Documento adjunto al examen de la ficha vinculada a la cuenta `paciente1`. |
| **PASOS** | 1) Descargar el documento como `paciente1`. 2) Verificar las cabeceras de la respuesta. 3) Consultar la auditoría. 4) Intentar la misma descarga como `paciente2`. |
| **RESULTADO ESPERADO** | HTTP 200 con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`; registro `DESCARGAR_DOCUMENTO` en auditoría; HTTP 404 para `paciente2`. |
| **CRITERIO DE ACEPTACIÓN** | La descarga y la subida se completan en menos de 10 segundos y cada acceso a un documento clínico queda trazado. |
| **DATOS DE PRUEBA** | Documento del examen del paciente `12345678-5`. |

## CP-INT-03 · Flujo escalonado paciente → exámenes (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-INT-03 · Acceso escalonado: primero el paciente, luego sus exámenes |
| **DESCRIPCIÓN** | Verificar que la consulta de exámenes se realiza a través del paciente, tal como exige el requisito de usabilidad del ERS, y que la autorización del examen hereda la del paciente. |
| **REQUERIMIENTO** | RF-4.1 / NFR-USAB-4 |
| **TIPO DE PRUEBA** | Integración / usabilidad |
| **PRECONDICIONES** | Paciente con dos exámenes registrados. |
| **PASOS** | 1) Consultar `GET /pacientes/{id}/examenes`. 2) Verificar que todos los resultados pertenecen al paciente indicado. 3) Consultar con un identificador de paciente inexistente. 4) Consultar con un identificador no numérico. 5) Dar de baja un examen y repetir la consulta. |
| **RESULTADO ESPERADO** | HTTP 200 con los exámenes del paciente; HTTP 404 ante un paciente inexistente; HTTP 400 ante un identificador no numérico; el examen dado de baja desaparece del listado. |
| **CRITERIO DE ACEPTACIÓN** | El flujo de acceso a la información es escalonado y la validación de los parámetros de ruta ocurre antes de llegar al dominio. |
| **DATOS DE PRUEBA** | Paciente id 1; identificadores `99999` y `abc`. |

## CP-INT-04 · Auditoría de acciones críticas (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-INT-04 · Registro de auditoría de las acciones críticas |
| **DESCRIPCIÓN** | Verificar que cada acción crítica genera un registro de auditoría que identifica al usuario, la acción, la entidad afectada y el instante, y que el administrador puede consultarlo y exportarlo. |
| **REQUERIMIENTO** | RF-5.1 / RF-5.2 (propuesto) / RB-2 |
| **TIPO DE PRUEBA** | Integración / normativo |
| **PRECONDICIONES** | Usuarios de los tres roles disponibles. |
| **PASOS** | 1) Ejecutar login, creación de examen, subida de documento, descarga y baja. 2) Consultar la auditoría como administrador. 3) Verificar que cada registro identifica usuario, acción, entidad e instante. 4) Exportar el registro. 5) Intentar consultarlo con rol paciente y con rol médico. |
| **RESULTADO ESPERADO** | Un registro por cada acción crítica con todos sus campos; exportación con fecha, responsable y total; HTTP 403 para los roles no administradores. |
| **CRITERIO DE ACEPTACIÓN** | Se generan registros de auditoría en cada acción crítica y el registro es **inmutable**: no existe operación que lo modifique o elimine. |
| **DATOS DE PRUEBA** | Secuencia de acciones sobre el paciente id 1. |

## CP-INT-05 · Unicidad del RUT del paciente (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-INT-05 · No se admiten dos fichas con el mismo RUT |
| **DESCRIPCIÓN** | Verificar que no es posible registrar dos pacientes con el mismo RUT, **ni siquiera escribiéndolo con un formato distinto**, y que el rechazo se comunica con el código HTTP correcto. |
| **REQUERIMIENTO** | RN-01 (propuesto) / RF-2.2 / ISO/IEC 25010 |
| **TIPO DE PRUEBA** | Integración / reglas de negocio |
| **PRECONDICIONES** | Paciente con RUT `12345678-5` registrado. |
| **PASOS** | 1) Intentar crear un paciente con `12345678-5`. 2) Intentar crear uno con `12.345.678-5`. 3) Verificar el estado de la restricción en la base de datos. 4) Intentar asignar a un paciente el RUT de otro mediante edición. |
| **RESULTADO ESPERADO** | **HTTP 409** en los cuatro casos, nunca HTTP 201 ni HTTP 500; existe un índice único sobre `paciente.rut` entre los registros vigentes. |
| **CRITERIO DE ACEPTACIÓN** | La unicidad se garantiza en el backend **y** en la base de datos (defensa en profundidad), y no se puede evadir cambiando el formato de entrada. |
| **DATOS DE PRUEBA** | `12345678-5`, `12.345.678-5`. |

---

## CP-SEG-01 · Control de acceso por rol aplicado en el backend (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-01 · El control de acceso se aplica en el servidor, no en la interfaz |
| **DESCRIPCIÓN** | Verificar que las operaciones de escritura se deniegan a los roles sin permiso **cuando la petición se envía directamente a la API**, sin pasar por la interfaz. |
| **REQUERIMIENTO** | NFR-SEG-4 / RB-1 / RB-2 / RB-3 |
| **TIPO DE PRUEBA** | Seguridad (control de acceso) |
| **PRECONDICIONES** | Tokens válidos de los roles `PACIENTE`, `MEDICO` y `ADMIN`. |
| **PASOS** | 1) Con token de paciente, enviar `POST`, `PUT` y `DELETE` sobre `/examenes`. 2) Con token de paciente, enviar `POST` sobre `/pacientes` y `GET` sobre `/usuarios` y `/auditoria`. 3) Con token de médico, `GET /usuarios`. 4) Con token de administrador, las mismas consultas. 5) Sin token, `GET /pacientes`. |
| **RESULTADO ESPERADO** | **HTTP 403** en todas las operaciones no autorizadas, HTTP 200/201 en las autorizadas y HTTP 401 sin token. Ningún dato se altera en los casos denegados. |
| **CRITERIO DE ACEPTACIÓN** | Toda operación no autorizada se deniega en el backend, **sin importar la interfaz utilizada**. Ocultar un botón no constituye un control de acceso. |
| **DATOS DE PRUEBA** | Tokens de `paciente1`, `medico1` y `admin1`. |

## CP-SEG-02 · Acceso a información clínica de terceros (IDOR) (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-02 · Un paciente no accede a la información de otro paciente |
| **DESCRIPCIÓN** | Verificar que el servidor comprueba la **titularidad del dato** y no solo el rol, de modo que un paciente no pueda leer la ficha, los exámenes ni los documentos de otro cambiando el identificador de la URL. |
| **REQUERIMIENTO** | RB-1 / NFR-SEG-4 / OWASP A01 / Ley 19.628 |
| **TIPO DE PRUEBA** | Seguridad (control de acceso a nivel de objeto) |
| **PRECONDICIONES** | Dos pacientes con cuentas y fichas distintas, cada uno con exámenes propios. |
| **PASOS** | 1) Como `paciente1`, consultar su propia ficha y sus exámenes. 2) Consultar la ficha de `paciente2`. 3) Consultar los exámenes de `paciente2`. 4) Consultar un examen ajeno por su identificador directo. 5) Descargar un documento ajeno. 6) Listar pacientes. |
| **RESULTADO ESPERADO** | HTTP 200 en lo propio; **HTTP 404** en todo lo ajeno; el listado de pacientes contiene **únicamente** la ficha propia. |
| **CRITERIO DE ACEPTACIÓN** | Se responde 404 y no 403 ante un recurso ajeno, para no confirmar su existencia a quien no debe conocerla. El listado aplica minimización de datos. |
| **DATOS DE PRUEBA** | `paciente1` (ficha id 1), `paciente2` (ficha id 2). |

## CP-SEG-03 · Resistencia a inyección y a asignación masiva (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-03 · Inyección SQL, XSS almacenado y *mass assignment* |
| **DESCRIPCIÓN** | Verificar que las entradas se validan y se tratan como datos, de modo que no alteren consultas SQL, no se ejecuten en el navegador y no modifiquen campos no declarados. |
| **REQUERIMIENTO** | NFR-SEG-5 / OWASP A01 y A03 |
| **TIPO DE PRUEBA** | Seguridad (inyección) |
| **PRECONDICIONES** | Ambiente QA con datos de prueba; tokens de médico y administrador. |
| **PASOS** | 1) Enviar un payload SQL en el campo RUT y verificar que la tabla sigue operativa. 2) Enviar un payload de tautología en el filtro de la auditoría y comparar el número de registros devueltos con la consulta legítima. 3) Almacenar `<script>alert(1)</script>` como descripción y recuperarlo. 4) Enviar campos no declarados en el esquema. 5) Revisar el código fuente del frontend buscando `dangerouslySetInnerHTML`. |
| **RESULTADO ESPERADO** | HTTP 400 ante los payloads en campos validados; el filtro inyectado devuelve **los mismos o menos** registros que el legítimo; el payload XSS se devuelve como texto en una respuesta JSON; los campos no declarados producen HTTP 400; no se usa `dangerouslySetInnerHTML`. |
| **CRITERIO DE ACEPTACIÓN** | No existen vulnerabilidades de inyección explotables. Si el payload de tautología devuelve **más** registros que el filtro legítimo, la consulta es inyectable y el caso **falla**. |
| **DATOS DE PRUEBA** | `12345678-5'; DROP TABLE paciente;--`; `LOGIN' OR '1'='1`; `<script>alert(1)</script>`. |

## CP-SEG-04 · Cifrado en tránsito, en reposo y hashing de contraseñas

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-04 · TLS, hashing bcrypt y cifrado de datos sensibles |
| **DESCRIPCIÓN** | Verificar que las comunicaciones usan TLS, que las contraseñas se almacenan con bcrypt y un **factor de costo suficiente**, y que los datos sensibles están cifrados en reposo. |
| **REQUERIMIENTO** | NFR-SEG-1 / NFR-SEG-2 / NFR-SEG-3 |
| **TIPO DE PRUEBA** | Seguridad (criptografía) |
| **PRECONDICIONES** | Acceso a la configuración del servicio y a la base de datos. |
| **PASOS** | 1) Verificar la cabecera `Strict-Transport-Security` y la configuración TLS. 2) Consultar la tabla `usuario` y leer el prefijo de los hashes. 3) Verificar que el factor de costo es ≥ 12. 4) Verificar que la respuesta del login no contiene el hash. 5) Verificar que `pgcrypto` está disponible para el cifrado de campos sensibles. 6) Inspeccionar el algoritmo declarado en la cabecera del JWT. |
| **RESULTADO ESPERADO** | HSTS presente; hashes con prefijo `$2b$12$` o superior; ninguna contraseña en claro; la respuesta de login no expone el hash; el JWT declara `HS256` y no `none`. |
| **CRITERIO DE ACEPTACIÓN** | El factor de costo cumple el mínimo de **12** que exige OWASP para bcrypt. Un factor menor hace el caso **fallido**, aunque el hashing exista. |
| **DATOS DE PRUEBA** | Hashes de los cinco usuarios de prueba. |

## CP-SEG-05 · Gestión segura de logs y minimización de datos

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-05 · Los registros del servicio no contienen credenciales ni datos clínicos |
| **DESCRIPCIÓN** | Verificar que los logs del servicio no registran contraseñas, tokens ni contenido clínico, aplicando el principio de minimización. |
| **REQUERIMIENTO** | NFR-SEG-6 / NFR-SEG-8 / NFR-SEG-15 (propuesto) / Ley 19.628 |
| **TIPO DE PRUEBA** | Seguridad / normativo |
| **PRECONDICIONES** | Servicio en ejecución con nivel de log `info`. |
| **PASOS** | 1) Enviar un intento de autenticación con una contraseña conocida y única. 2) Buscar esa cadena en los logs del servicio. 3) Verificar que los campos sensibles aparecen enmascarados. 4) Verificar que el cuerpo de las peticiones no se registra. 5) Verificar que los intentos fallidos se auditan **sin** la contraseña. |
| **RESULTADO ESPERADO** | La contraseña **no aparece** en ninguna línea del log; los campos sensibles aparecen como `[REDACTED]`; la auditoría registra el nombre de usuario intentado pero no la credencial. |
| **CRITERIO DE ACEPTACIÓN** | Ningún dato personal sensible ni credencial queda escrito en los registros. Un log es un destino de propagación: lo que entra allí se copia, se exporta y lo lee gente que no debería verlo. |
| **DATOS DE PRUEBA** | Contraseña sonda `SondaDeAuditoria2026!`. |

## CP-SEG-06 · Cabeceras de seguridad HTTP (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-06 · Cabeceras de seguridad presentes en todas las respuestas |
| **DESCRIPCIÓN** | Verificar que el servidor envía las cabeceras de seguridad que mitigan XSS, *clickjacking*, *sniffing* de contenido y degradación a HTTP, y que no revela el framework. |
| **REQUERIMIENTO** | NFR-SEG-10 (propuesto) / NFR-SEG-1 / OWASP A05 |
| **TIPO DE PRUEBA** | Seguridad (configuración) |
| **PRECONDICIONES** | Servicio en ejecución. |
| **PASOS** | 1) Solicitar `/api/v1/salud` y capturar las cabeceras. 2) Verificar `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy` y `Permissions-Policy`. 3) Verificar que `X-Powered-By` **no** está presente. 4) Repetir sobre los archivos estáticos de la SPA. |
| **RESULTADO ESPERADO** | Las seis cabeceras presentes con valores restrictivos; `X-Powered-By` ausente; las mismas cabeceras en las respuestas de la SPA. |
| **CRITERIO DE ACEPTACIÓN** | Las seis cabeceras están presentes en **toda** respuesta. La CSP debe ser restrictiva (`default-src 'self'`) y no permisiva. |
| **DATOS DE PRUEBA** | Respuesta de `/api/v1/salud` y de `/`. |

## CP-SEG-07 · Validación de tipo y tamaño de los documentos (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-07 · Solo se aceptan documentos permitidos con contenido coherente |
| **DESCRIPCIÓN** | Verificar que la validación del documento no se basa únicamente en el tipo que declara el cliente, sino también en la **firma binaria** del contenido y en el tamaño. |
| **REQUERIMIENTO** | NFR-SEG-12 (propuesto) / RF-4.3 / OWASP A04 |
| **TIPO DE PRUEBA** | Seguridad (validación de entrada) |
| **PRECONDICIONES** | Examen existente; token de médico. |
| **PASOS** | 1) Subir un PDF real. 2) Subir un **ejecutable de Windows renombrado a `.pdf` y declarado como `application/pdf`**. 3) Subir un documento HTML con script. 4) Subir un archivo que exceda 10 MB. 5) Intentar subir como paciente. |
| **RESULTADO ESPERADO** | HTTP 201 solo para el PDF real; **HTTP 400** para el ejecutable disfrazado y para el HTML; HTTP 413 para el archivo excesivo; HTTP 403 para el paciente. |
| **CRITERIO DE ACEPTACIÓN** | El `Content-Type` lo elige el cliente y por tanto no es confiable: debe verificarse la firma del contenido. Aceptar el ejecutable hace el caso **fallido**. |
| **DATOS DE PRUEBA** | `informe-valido.pdf`, `malicioso.pdf` (cabecera `MZ`), `pagina.html`. |

## CP-SEG-08 · Escaneo dinámico de seguridad (DAST)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SEG-08 · Escaneo dinámico con OWASP ZAP |
| **DESCRIPCIÓN** | Ejecutar un escaneo pasivo y de línea base sobre la aplicación en funcionamiento para detectar cabeceras inseguras, cookies sin atributos de protección y fugas de información. |
| **REQUERIMIENTO** | NFR-SEG-5 / NFR-SEG-10 (propuesto) |
| **TIPO DE PRUEBA** | Seguridad dinámica (DAST) |
| **PRECONDICIONES** | Ambiente QA levantado; reglas configuradas en `.zap/rules.tsv`. |
| **PASOS** | 1) Ejecutar `zap-baseline.py` contra la API. 2) Revisar las alertas y clasificarlas. 3) Contrastar cada alerta marcada como fallo con su requerimiento del ERS. 4) Generar y adjuntar el reporte. |
| **RESULTADO ESPERADO** | Cero alertas de las reglas marcadas como fallo (cabeceras de seguridad, inyección, fuga de versión del servidor). |
| **CRITERIO DE ACEPTACIÓN** | Las reglas que corresponden a un requisito del ERS se marcan como **FAIL**, de modo que el resultado del escaneo sea una verificación del requisito y no una lista de avisos sin consecuencia. |
| **DATOS DE PRUEBA** | Ambiente QA en `http://localhost:3000`. |

---

## CP-SAST-01 · Análisis estático del código fuente (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SAST-01 · Análisis estático de seguridad, accesibilidad y mantenibilidad |
| **DESCRIPCIÓN** | Auditar el 100 % del código fuente sin ejecutarlo, buscando patrones inseguros, problemas de accesibilidad, complejidad excesiva y malas prácticas. |
| **REQUERIMIENTO** | NFR-SEG-5 / NFR-USAB-1 a 3 / NFR-CAL-3 y 5 (propuestos) / ISO/IEC 25010 |
| **TIPO DE PRUEBA** | Análisis estático (SAST) |
| **PRECONDICIONES** | Código fuente disponible; dependencias instaladas. |
| **PASOS** | 1) Ejecutar ESLint sobre la API con el complemento de seguridad. 2) Ejecutar ESLint sobre la SPA con el complemento de accesibilidad. 3) Ejecutar el análisis de SonarQube y revisar el Quality Gate. 4) Clasificar los hallazgos por severidad. 5) **Contrastar cada hallazgo con la revisión manual** para descartar falsos positivos. |
| **RESULTADO ESPERADO** | Cero errores en ambos proyectos; las advertencias de complejidad resueltas o justificadas; el Quality Gate en estado aprobado. |
| **CRITERIO DE ACEPTACIÓN** | No existen hallazgos de severidad alta o crítica sin plan de remediación. Los falsos positivos se documentan con su justificación en lugar de silenciarse globalmente. |
| **DATOS DE PRUEBA** | Código fuente de `api/src` y `web/src`. |

## CP-SCA-01 · Análisis de dependencias de terceros (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-SCA-01 · Vulnerabilidades conocidas en dependencias |
| **DESCRIPCIÓN** | Detectar vulnerabilidades publicadas (CVE) en las dependencias directas y transitivas, distinguiendo las que llegan a producción de las que solo se usan en desarrollo. |
| **REQUERIMIENTO** | NFR-SEG-6 / NFR-CAL-4 (propuesto) / OWASP A06 / ISO/IEC 27001 A.8.8 |
| **TIPO DE PRUEBA** | Análisis de composición (SCA) |
| **PRECONDICIONES** | `package-lock.json` presente; conexión a la base de avisos. |
| **PASOS** | 1) Ejecutar `npm audit --omit=dev` sobre la API y la SPA. 2) Ejecutar `npm audit --audit-level=high` sobre el árbol completo. 3) Obtener el resumen por severidad. 4) Ejecutar Snyk como segunda fuente. 5) Clasificar cada hallazgo según si se despliega o no. |
| **RESULTADO ESPERADO** | **Cero** vulnerabilidades de cualquier severidad en las dependencias de producción; cero de severidad alta o crítica en el árbol completo. |
| **CRITERIO DE ACEPTACIÓN** | El umbral para producción es estricto (cualquier severidad) porque ese código se despliega; para desarrollo es alto/crítico, porque ejecuta en el pipeline pero no en el servidor. |
| **DATOS DE PRUEBA** | 122 dependencias de producción y 736 de desarrollo. |

---

## CP-PERF-01 · Tiempo de carga de la vista principal (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-PERF-01 · La vista principal responde en menos de 2 segundos |
| **DESCRIPCIÓN** | Medir el tiempo de respuesta del listado de pacientes —la primera vista tras el acceso— bajo la concurrencia objetivo. |
| **REQUERIMIENTO** | NFR-PERF-2 / NFR-PERF-3 |
| **TIPO DE PRUEBA** | Rendimiento y carga |
| **PRECONDICIONES** | Base poblada; ambiente QA estable; sesión autenticada. |
| **PASOS** | 1) Lanzar 200 peticiones concurrentes a `GET /pacientes`. 2) Repetir 3 iteraciones. 3) Registrar p50, p95 y p99. 4) Registrar la tasa de error. |
| **RESULTADO ESPERADO** | p95 ≤ 2.000 ms con **0 % de errores**. |
| **CRITERIO DE ACEPTACIÓN** | Se evalúa sobre el **p95**, no sobre el promedio: el promedio esconde la cola, y es la cola lo que el usuario percibe como lentitud. Una tasa de error distinta de cero hace el caso fallido aunque la latencia cumpla. |
| **DATOS DE PRUEBA** | 200 usuarios concurrentes × 3 iteraciones = 600 peticiones. |

## CP-PERF-02 · Latencia de las operaciones CRUD (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-PERF-02 · Las operaciones CRUD simples responden en menos de 300 ms |
| **DESCRIPCIÓN** | Medir la latencia de una operación CRUD simple sobre un recurso anidado, incluyendo la verificación del token y la relectura del usuario. |
| **REQUERIMIENTO** | NFR-PERF-1 |
| **TIPO DE PRUEBA** | Rendimiento |
| **PRECONDICIONES** | Paciente con exámenes registrados; sesión autenticada. |
| **PASOS** | 1) Lanzar 200 peticiones concurrentes a `GET /pacientes/{id}/examenes`. 2) Repetir 3 iteraciones. 3) Registrar los percentiles y la tasa de error. 4) Comparar con la latencia del healthcheck como línea base. |
| **RESULTADO ESPERADO** | p95 ≤ 300 ms con 0 % de errores. |
| **CRITERIO DE ACEPTACIÓN** | La medición incluye el costo real de la verificación de sesión, no solo el de la consulta a la base. |
| **DATOS DE PRUEBA** | 600 peticiones sobre el paciente id 1. |

## CP-PERF-03 · Soporte de 200 usuarios concurrentes (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-PERF-03 · El sistema soporta 200 usuarios concurrentes sin errores |
| **DESCRIPCIÓN** | Verificar que la concurrencia objetivo del ERS se sostiene sin que el sistema rechace tráfico legítimo. |
| **REQUERIMIENTO** | NFR-PERF-3 |
| **TIPO DE PRUEBA** | Carga |
| **PRECONDICIONES** | Ambiente QA; límites de peticiones configurados. |
| **PASOS** | 1) Ejecutar los escenarios de CP-PERF-01 y CP-PERF-02 con 200 concurrentes. 2) Registrar la tasa de error y el código de estado de los rechazos. 3) Verificar que los rechazos **no** provienen de un control de seguridad mal dimensionado. |
| **RESULTADO ESPERADO** | 0 % de errores; ninguna respuesta HTTP 429. |
| **CRITERIO DE ACEPTACIÓN** | Un control de seguridad que rechaza tráfico legítimo incumple este requisito igual que una falla de capacidad. El límite de peticiones debe dimensionarse **a partir** de la concurrencia que el ERS exige. |
| **DATOS DE PRUEBA** | 200 concurrentes × 3 iteraciones sobre dos escenarios. |

---

## CP-USA-01 · Accesibilidad: contraste, ARIA y vista móvil

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-USA-01 · Contraste WCAG, anuncio de mensajes y uso desde dispositivo móvil |
| **DESCRIPCIÓN** | Verificar que la interfaz es utilizable por personas con baja visión o ceguera y que el flujo de consulta de exámenes se completa desde un dispositivo móvil. |
| **REQUERIMIENTO** | NFR-USAB-1 / NFR-USAB-2 / NFR-USAB-3 / NFR-COMPAT-2 / WCAG 2.1 AA / Ley 20.422 |
| **TIPO DE PRUEBA** | Usabilidad y accesibilidad |
| **PRECONDICIONES** | Paciente autenticado con al menos un examen; viewport móvil 375×667; lector de pantalla. |
| **PASOS** | 1) Calcular la relación de contraste de cada par de colores de la interfaz. 2) Verificar que los mensajes de estado llevan `role` y `aria-live`. 3) Recorrer el flujo completo solo con teclado. 4) Verificar el tamaño mínimo de los controles. 5) Completar el flujo paciente → exámenes → documento en viewport móvil. 6) Ejecutar Lighthouse sobre el DOM renderizado. |
| **RESULTADO ESPERADO** | Todos los pares de color ≥ 4,5:1 (texto) y ≥ 3:1 (componentes); los mensajes se anuncian al lector de pantalla; el flujo se completa por teclado; controles de al menos 48×48 px; sin desplazamiento horizontal en móvil. |
| **CRITERIO DE ACEPTACIÓN** | El ERS identifica a los adultos mayores como usuarios objetivo, por lo que la accesibilidad es un requisito funcional. Un mensaje de error que no se puede leer ni se anuncia equivale a no mostrar el error. |
| **DATOS DE PRUEBA** | Tokens de color de `estilos.css`; viewport 375×667. |

## CP-COMPAT-01 · Compatibilidad con navegadores modernos

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-COMPAT-01 · Funcionamiento en las dos últimas versiones de los navegadores objetivo |
| **DESCRIPCIÓN** | Verificar que los flujos críticos funcionan en las dos últimas versiones de Chrome, Firefox, Safari y Edge, y en viewport de móvil y tablet. |
| **REQUERIMIENTO** | NFR-COMPAT-1 / NFR-COMPAT-2 |
| **TIPO DE PRUEBA** | Compatibilidad |
| **PRECONDICIONES** | Ambiente QA accesible; navegadores instalados. |
| **PASOS** | 1) Ejecutar el flujo login → paciente → exámenes → documento en cada navegador y versión. 2) Registrar errores de consola y diferencias de maquetación. 3) Repetir en viewport de tablet y móvil. 4) Verificar que la construcción de producción no usa sintaxis no soportada. |
| **RESULTADO ESPERADO** | El flujo se completa sin errores bloqueantes en las 8 combinaciones navegador/versión. |
| **CRITERIO DE ACEPTACIÓN** | Cero errores bloqueantes y cero errores de consola atribuibles a incompatibilidad. |
| **DATOS DE PRUEBA** | Matriz de 4 navegadores × 2 versiones × 3 viewports. |

## CP-DIS-01 · Disponibilidad y ventana de mantenimiento

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-DIS-01 · Disponibilidad 99,5 % mensual y migración segura |
| **DESCRIPCIÓN** | Verificar que el servicio expone un healthcheck para su monitoreo, que el apagado es ordenado y que una actualización con migración de datos no pierde información. |
| **REQUERIMIENTO** | NFR-DIS-1 / NFR-DIS-2 / NFR-DIS-3 (propuesto) |
| **TIPO DE PRUEBA** | Disponibilidad |
| **PRECONDICIONES** | Ambiente QA; procedimiento de despliegue definido. |
| **PASOS** | 1) Consultar el healthcheck y verificar que informa estado, versión e instante. 2) Verificar que el healthcheck **no** consume la cuota del limitador de peticiones. 3) Enviar `SIGTERM` y verificar el apagado ordenado. 4) Ejecutar un despliegue con migración de esquema y verificar la integridad de los datos. 5) Verificar que el esquema se aplica de forma idempotente. |
| **RESULTADO ESPERADO** | Healthcheck operativo y exento del límite de peticiones; apagado ordenado sin cortar peticiones en curso; migración idempotente sin pérdida de datos. |
| **CRITERIO DE ACEPTACIÓN** | El monitoreo de disponibilidad no puede verse afectado por los controles de seguridad del propio sistema: si lo fuera, reportaría caídas inexistentes. |
| **DATOS DE PRUEBA** | Esquema aplicado dos veces consecutivas; datos sembrados antes y después. |

---

## CP-CAL-01 · Cobertura de pruebas y puertas de calidad (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-CAL-01 · Cobertura de pruebas verificada como puerta de calidad |
| **DESCRIPCIÓN** | Verificar que la batería de pruebas se ejecuta completa, que la cobertura supera el umbral definido y que el incumplimiento **detiene** la construcción. |
| **REQUERIMIENTO** | NFR-CAL-1 / NFR-CAL-2 (propuestos) |
| **TIPO DE PRUEBA** | Calidad del proceso |
| **PRECONDICIONES** | Dependencias instaladas. |
| **PASOS** | 1) Ejecutar la batería con medición de cobertura. 2) Verificar los umbrales de líneas, ramas, funciones y sentencias. 3) Reducir deliberadamente el umbral de una métrica y confirmar que la construcción falla. 4) Ejecutar los escenarios BDD. |
| **RESULTADO ESPERADO** | 132 pruebas aprobadas; cobertura de líneas ≥ 80 % y de ramas ≥ 70 %; 6 escenarios BDD aprobados. |
| **CRITERIO DE ACEPTACIÓN** | La cobertura es una **puerta**, no un indicador informativo: si baja del umbral, la construcción falla. Se declara expresamente que 100 % de cobertura no equivale a 100 % de calidad. |
| **DATOS DE PRUEBA** | Batería completa de `api/tests`. |

## CP-CAL-02 · Pipeline de integración continua (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-CAL-02 · El pipeline bloquea los cambios que no cumplen los controles |
| **DESCRIPCIÓN** | Verificar que el pipeline ejecuta todas las puertas (formato, análisis estático, pruebas, BDD, dependencias, contenedor y DAST) y que falla ante cualquier incumplimiento. |
| **REQUERIMIENTO** | NFR-SEG-14 / NFR-TRAZ-1 (propuestos) |
| **TIPO DE PRUEBA** | Calidad del proceso |
| **PRECONDICIONES** | Repositorio con el workflow configurado. |
| **PASOS** | 1) Revisar que el workflow declara las nueve etapas. 2) Verificar que los secretos no están en el repositorio. 3) Introducir un incumplimiento deliberado y comprobar que la etapa correspondiente falla. 4) Verificar que el resumen vincula cada control con su requisito. 5) Verificar que la imagen del contenedor no corre como root. |
| **RESULTADO ESPERADO** | Las nueve etapas presentes; ningún secreto versionado; el incumplimiento detiene el pipeline; el resumen muestra la trazabilidad control → requisito. |
| **CRITERIO DE ACEPTACIÓN** | Sin pipeline, los controles dependen de la disciplina individual y se omiten justo cuando hay presión de entrega. |
| **DATOS DE PRUEBA** | `.github/workflows/calidad-y-seguridad.yml`. |

## CP-REG-01 · Regresión tras la remediación (A)

| Campo | Contenido |
|---|---|
| **ID / NOMBRE** | CP-REG-01 · Re-ejecución completa sobre la versión corregida |
| **DESCRIPCIÓN** | Re-ejecutar la totalidad del ciclo de pruebas sobre la versión corregida para confirmar que cada incidente quedó cerrado y que las correcciones no introdujeron defectos nuevos. |
| **REQUERIMIENTO** | Todos |
| **TIPO DE PRUEBA** | Regresión |
| **PRECONDICIONES** | Versión corregida construida y desplegada; evidencia de la versión auditada disponible para comparación. |
| **PASOS** | 1) Regenerar el ambiente QA con la versión corregida. 2) Ejecutar el script de captura de evidencia completo. 3) Comparar cada resultado con el de la versión auditada. 4) Verificar que los 14 incidentes aparecen cerrados. 5) Verificar que ningún caso que antes aprobaba ahora falla. |
| **RESULTADO ESPERADO** | 132 de 132 pruebas aprobadas; 6 de 6 escenarios BDD; cero errores de análisis estático; cero vulnerabilidades en dependencias de producción; todos los umbrales de rendimiento cumplidos con 0 % de errores; todos los pares de color conformes. |
| **CRITERIO DE ACEPTACIÓN** | Una corrección sin re-prueba no es una corrección: es una afirmación. Cada incidente se declara cerrado solo con la evidencia de su re-ejecución. |
| **DATOS DE PRUEBA** | Evidencia comparada de `evidencias/v1.0/` y `evidencias/v1.1/`. |

---

## 4.1 Resumen de trazabilidad caso → requerimiento

| Caso | Tipo de prueba | Requerimientos cubiertos |
|---|---|---|
| CP-FUN-01 | Funcional (autenticación) | RF-1.1, NFR-SEG-9 |
| CP-FUN-02 | Funcional negativa / seguridad | RF-1.1, RF-1.3\*, NFR-SEG-11\* |
| CP-FUN-03 | Funcional / seguridad de sesión | RF-1.2, NFR-SEG-9 |
| CP-FUN-04 | Funcional / seguridad | RF-2.1, RB-1, NFR-SEG-4 |
| CP-FUN-05 | Funcional / integridad | RF-2.2, RN-01\* |
| CP-FUN-06 | Funcional | RF-2.2, RF-2.3, RF-2.4, RF-5.1 |
| CP-FUN-07 | Funcional | RF-3.1, RF-3.2 |
| CP-FUN-08 | Funcional / trazabilidad | RF-3.3 |
| CP-FUN-09 | Funcional / seguridad | ERS §2.4, RF-1.4\* |
| CP-FUN-10 | Funcional / control de acceso | RF-2.5, RF-2.6, RF-2.7, RB-2 |
| CP-INT-01 | Integración documental | RF-4.3, RF-4.4 |
| CP-INT-02 | Integración / seguridad | RF-4.2, RB-1, RF-5.1 |
| CP-INT-03 | Integración / usabilidad | RF-4.1, NFR-USAB-4 |
| CP-INT-04 | Integración / normativo | RF-5.1, RF-5.2\*, RB-2 |
| CP-INT-05 | Integración / reglas de negocio | RN-01\*, RF-2.2 |
| CP-SEG-01 | Seguridad (control de acceso) | NFR-SEG-4, RB-1, RB-2, RB-3 |
| CP-SEG-02 | Seguridad (acceso a objeto) | RB-1, NFR-SEG-4 |
| CP-SEG-03 | Seguridad (inyección) | NFR-SEG-5 |
| CP-SEG-04 | Seguridad (criptografía) | NFR-SEG-1, NFR-SEG-2, NFR-SEG-3 |
| CP-SEG-05 | Seguridad / normativo | NFR-SEG-6, NFR-SEG-8, NFR-SEG-15\* |
| CP-SEG-06 | Seguridad (configuración) | NFR-SEG-10\*, NFR-SEG-1 |
| CP-SEG-07 | Seguridad (validación) | NFR-SEG-12\*, RF-4.3 |
| CP-SEG-08 | Seguridad dinámica | NFR-SEG-5, NFR-SEG-10\* |
| CP-SAST-01 | Análisis estático | NFR-SEG-5, NFR-USAB-1 a 3, NFR-CAL-3\*, NFR-CAL-5\* |
| CP-SCA-01 | Análisis de dependencias | NFR-SEG-6, NFR-CAL-4\* |
| CP-PERF-01 | Rendimiento y carga | NFR-PERF-2, NFR-PERF-3 |
| CP-PERF-02 | Rendimiento | NFR-PERF-1 |
| CP-PERF-03 | Carga | NFR-PERF-3 |
| CP-USA-01 | Usabilidad y accesibilidad | NFR-USAB-1, 2, 3, NFR-COMPAT-2 |
| CP-COMPAT-01 | Compatibilidad | NFR-COMPAT-1, NFR-COMPAT-2 |
| CP-DIS-01 | Disponibilidad | NFR-DIS-1, NFR-DIS-2, NFR-DIS-3\* |
| CP-CAL-01 | Calidad del proceso | NFR-CAL-1\*, NFR-CAL-2\* |
| CP-CAL-02 | Calidad del proceso | NFR-SEG-14\*, NFR-TRAZ-1\* |
| CP-REG-01 | Regresión | Todos |

\* Requisitos **propuestos** en esta evaluación; su especificación completa está en
`03_Requerimientos_Adicionales_ERS_v1.2.md`.

## 4.2 Matriz de trazabilidad bidireccional (requerimiento ↔ caso)

### Requisitos funcionales del ERS

| Requerimiento | Caso(s) que lo cubren | Cobertura |
|---|---|---|
| RF-1.1 Autenticación con usuario y contraseña | CP-FUN-01, CP-FUN-02 | Dedicada |
| RF-1.2 Cierre de sesión y revocación de tokens | CP-FUN-03 | Dedicada |
| RF-2.1 Autorregistro con rol paciente por defecto | CP-FUN-04 | Dedicada |
| RF-2.2 Registro de paciente | CP-FUN-05, CP-FUN-06, CP-INT-05 | Dedicada |
| RF-2.3 Edición de paciente | CP-FUN-06 | Dedicada |
| RF-2.4 Visualización de paciente | CP-FUN-06, CP-SEG-02 | Dedicada |
| RF-2.5 Visualización de usuarios por el administrador | CP-FUN-10 | Dedicada |
| RF-2.6 Edición de usuario y asignación de roles | CP-FUN-10 | Dedicada |
| RF-2.7 Eliminación de usuario | CP-FUN-10 | Dedicada |
| RF-3.1 Registro de examen médico | CP-FUN-07 | Dedicada |
| RF-3.2 Edición de examen y de documentos | CP-FUN-07, CP-INT-01 | Dedicada |
| RF-3.3 Eliminación de examen o de documentos | CP-FUN-08, CP-INT-04 | Dedicada |
| RF-4.1 Visualización de exámenes por el paciente | CP-INT-03, CP-SEG-02 | Dedicada |
| RF-4.2 Descarga de documentos por el paciente | CP-INT-02 | Dedicada |
| RF-4.3 Adjuntar un documento por examen | CP-INT-01, CP-SEG-07 | Dedicada |
| RF-4.4 Storage interno con referencia en BD | CP-INT-01 | Dedicada |
| RF-5.1 Auditoría de acciones críticas | CP-INT-04, CP-FUN-06, CP-INT-02 | Dedicada |

**17/17 requisitos funcionales cubiertos.**

### Requisitos no funcionales de seguridad

| Requerimiento | Caso(s) que lo cubren | Cobertura |
|---|---|---|
| NFR-SEG-1 TLS obligatorio | CP-SEG-04, CP-SEG-06 | Dedicada |
| NFR-SEG-2 Hashing seguro con bcrypt | CP-SEG-04, CP-FUN-09 | Dedicada |
| NFR-SEG-3 Cifrado de datos sensibles en reposo | CP-SEG-04 | Dedicada |
| NFR-SEG-4 Control de acceso por rol en backend | CP-SEG-01, CP-SEG-02, CP-FUN-04 | Dedicada |
| NFR-SEG-5 Protección CSRF, XSS, SQLi y saneamiento | CP-SEG-03, CP-SEG-08, CP-SAST-01 | Dedicada |
| NFR-SEG-6 Gestión segura de logs | CP-SEG-05, CP-SCA-01 | Dedicada |
| NFR-SEG-7 Políticas de respaldo y recuperación | CP-DIS-01 | Dedicada |
| NFR-SEG-8 Cumplimiento de protección de datos | CP-SEG-02, CP-SEG-05, CP-INT-02 | Dedicada |
| NFR-SEG-9 Manejo de sesión mediante JWT | CP-FUN-01, CP-FUN-03 | Dedicada |

**9/9 requisitos de seguridad cubiertos.**

### Rendimiento, usabilidad, disponibilidad y compatibilidad

| Requerimiento | Caso(s) que lo cubren | Cobertura |
|---|---|---|
| NFR-PERF-1 CRUD < 300 ms | CP-PERF-02 | Dedicada |
| NFR-PERF-2 Página principal < 2 s | CP-PERF-01 | Dedicada |
| NFR-PERF-3 200 usuarios concurrentes | CP-PERF-03, CP-PERF-01, CP-PERF-02 | Dedicada |
| NFR-USAB-1 Tipografía, contraste y controles grandes | CP-USA-01 | Dedicada |
| NFR-USAB-2 Flujos claros de registro y visualización | CP-USA-01, CP-INT-03 | Dedicada |
| NFR-USAB-3 Ayuda contextual y mensajes amigables | CP-USA-01, CP-FUN-09 | Dedicada |
| NFR-USAB-4 Flujo escalonado paciente → exámenes | CP-INT-03 | Dedicada |
| NFR-DIS-1 Disponibilidad 99,5 % mensual | CP-DIS-01 | Dedicada |
| NFR-DIS-2 Ventana de mantenimiento y migración segura | CP-DIS-01 | Dedicada |
| NFR-COMPAT-1 Navegadores modernos | CP-COMPAT-01 | Dedicada |
| NFR-COMPAT-2 Responsivo en móviles y tablets | CP-USA-01, CP-COMPAT-01 | Dedicada |

**3/3 de rendimiento, 4/4 de usabilidad, 2/2 de disponibilidad y 2/2 de compatibilidad.**

### Reglas de negocio y restricciones del ERS

| Requerimiento | Caso(s) que lo cubren | Cobertura |
|---|---|---|
| RB-1 El paciente solo tiene permisos de lectura | CP-SEG-01, CP-SEG-02, CP-INT-02, CP-FUN-04 | Dedicada |
| RB-2 El administrador tiene acceso completo | CP-FUN-10, CP-INT-04, CP-SEG-01 | Dedicada |
| RB-3 El médico ve la información de cualquier paciente | CP-SEG-01, CP-SEG-02 | Dedicada |
| §2.4 Política de contraseñas configurable | CP-FUN-09 | Dedicada |
| §2.4 Hashing en backend con bcrypt | CP-SEG-04 | Dedicada |
| §2.4 TLS en todas las comunicaciones | CP-SEG-04, CP-SEG-06 | Dedicada |
| §2.4 Documentos fuertemente controlados | CP-INT-02, CP-SEG-07 | Dedicada |
| §3.1.2 Validación de entradas server-side | CP-SEG-03, CP-FUN-09 | Dedicada |

**3/3 reglas de negocio y 5/5 restricciones relevantes cubiertas.**

### Resultado de cobertura

| Grupo | Requisitos | Cubiertos | Cobertura |
|---|---|---|---|
| Funcionales (RF) | 17 | 17 | 100 % |
| Seguridad (NFR-SEG) | 9 | 9 | 100 % |
| Rendimiento (NFR-PERF) | 3 | 3 | 100 % |
| Usabilidad (NFR-USAB) | 4 | 4 | 100 % |
| Disponibilidad (NFR-DIS) | 2 | 2 | 100 % |
| Compatibilidad (NFR-COMPAT) | 2 | 2 | 100 % |
| Reglas de negocio (RB) | 3 | 3 | 100 % |
| Restricciones del ERS | 5 | 5 | 100 % |
| **Total** | **45** | **45** | **100 %** |

**Cobertura inversa:** los 34 casos diseñados están trazados a al menos un requerimiento;
no existen casos huérfanos. La matriz es por tanto **bidireccional y completa**.

---

# 5. Análisis estático del código fuente

El análisis estático complementa la ejecución: revisa el código **sin ejecutarlo**, por lo
que alcanza el 100 % de las líneas, incluidas las ramas que ninguna prueba recorre. Es la
única técnica capaz de encontrar un vector de ataque que vive en una rama de error que no
se dispara nunca en condiciones normales.

## 5.1 Herramientas, alcance y configuración

| Herramienta | Tipo | Alcance | Qué detecta |
|---|---|---|---|
| **ESLint** + `eslint-plugin-security` | Linter y SAST | Todo `api/src` y `api/tests` | Uso de `eval`, expresiones regulares con riesgo de ReDoS, operaciones de archivo con rutas dinámicas, comparaciones no estrictas, complejidad ciclomática y funciones excesivamente largas. |
| **ESLint** + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks` | Linter de accesibilidad y corrección | Todo `web/src` | Controles sin etiqueta asociada, imágenes sin texto alternativo, roles ARIA inválidos, uso de `dangerouslySetInnerHTML` y violaciones de las reglas de los hooks. |
| **Prettier** | Formato | Todo el código | Inconsistencias de formato, que se eliminan automáticamente para que la revisión humana se concentre en la lógica. |
| **SonarQube** | SAST y Quality Gate | Repositorio completo | Vulnerabilidades, *security hotspots*, *code smells*, duplicación, complejidad cognitiva y deuda técnica; consume el informe de cobertura de Jest. |
| **`npm audit`** | SCA | `package-lock.json` de API y SPA | Vulnerabilidades publicadas (CVE) en dependencias directas y transitivas. |
| **Snyk** | SCA (segunda fuente) | Árbol completo de dependencias | Rutas vulnerables que `npm audit` no reporta, con su propia base de avisos. |
| **Trivy** | Escaneo de imagen | Imágenes Docker de API y SPA | Vulnerabilidades en los paquetes del sistema operativo base del contenedor. |

**Dos decisiones de configuración que condicionan los resultados:**

1. **La prohibición de `dangerouslySetInnerHTML` se declara como regla de ESLint**, no como
   convención de equipo. React escapa el contenido por defecto, y ese atributo es la única
   forma de perder esa protección; convertirlo en error de compilación elimina la
   posibilidad de introducir un XSS por descuido.
2. **La accesibilidad se trata como análisis estático.** Las reglas de `jsx-a11y`
   convierten los requisitos NFR-USAB-1 a 3 del ERS en una puerta automatizada. Sin esto,
   la accesibilidad depende de que alguien recuerde revisarla.

## 5.2 Hallazgos del análisis estático sobre la versión auditada

Resultado de la ejecución sobre la versión 1.0 (anexos 3.1, 3.2 y 3.3):

| ID | Hallazgo | Archivo / ubicación | Herramienta | Severidad | Norma o requisito afectado |
|---|---|---|---|---|---|
| **SAST-01** | Uso de `dangerouslySetInnerHTML` para renderizar la descripción del examen, que es contenido introducido por el usuario. | `web/src/componentes/Examenes.jsx:199` | ESLint (regla propia `no-restricted-syntax`) | **Alta** | NFR-SEG-5, OWASP A03 |
| **SAST-02** | `exigirRol` y `ROLES` importados pero **sin usar** en el router de exámenes. | `api/src/.../routes/examenes.routes.js:2,4` | ESLint (`no-unused-vars`) | Media | NFR-SEG-4 |
| **SAST-03** | Método privado `#puedeEscribir` declarado y **nunca invocado** en el caso de uso de exámenes. | `api/src/application/usecase/ExamenUseCase.js:25` | ESLint (`no-unused-private-class-members`) | Media | NFR-SEG-4, RB-1 |
| **SAST-04** | Función `digitoVerificador` definida y **nunca llamada** en el modelo de paciente. | `api/src/domain/model/Paciente.js:4` | ESLint (`no-unused-vars`) | Media | RF-2.2, integridad de datos |
| **SAST-05** | Parámetro `expiraEn` recibido y **no utilizado** en el cierre de sesión. | `api/src/application/usecase/AuthUseCase.js:136` | ESLint (`no-unused-vars`) | Media | RF-1.2 |
| **SAST-06** | Consulta SQL construida por **concatenación** del valor del filtro, en vez de parámetro posicional. | `api/src/.../postgres/gatewaysPostgres.js` (filtro de auditoría) | Revisión manual (ESLint no lo detecta) | **Crítica** | NFR-SEG-5, OWASP A03 |
| **SAST-07** | Ausencia de la configuración `redact` en el logger y traza de depuración que registra el cuerpo de cada petición. | `api/src/infrastructure/config/logger.js`, `.../middleware/validacion.js:17` | Revisión manual | **Alta** | NFR-SEG-6, Ley 19.628 |
| **SCA-01** | Dependencia `lodash@4.17.15` con vulnerabilidad publicada de contaminación de prototipo e inyección de comandos. | `api/package.json` → `node_modules/lodash` | `npm audit` | **Alta** | NFR-SEG-6, OWASP A06, ISO/IEC 27001 A.8.8 |
| **A11Y-01** | Cuatro pares de color por debajo del contraste mínimo: texto secundario 2,15:1, mensaje de error 2,09:1, mensaje de éxito 1,62:1, mensaje de aviso 1,69:1. | `web/src/estilos.css` | Verificador de contraste propio | Media | NFR-USAB-1, WCAG 2.1 §1.4.3, Ley 20.422 |
| **A11Y-02** | El contenedor de mensajes de estado carece de `role` y de `aria-live`. | `web/src/componentes/Aviso.jsx` | Verificador propio + revisión manual | Media | NFR-USAB-3, WCAG 2.1 §4.1.3 |

**Resumen del análisis estático sobre la versión auditada:**

| Herramienta | Hallazgos | Severidad alta o crítica |
|---|---|---|
| ESLint (API) | 5 errores | 0 |
| ESLint (SPA) | 1 error | 1 |
| Revisión manual del código | 2 hallazgos | 2 |
| `npm audit` (dependencias de producción) | 1 vulnerabilidad | 1 |
| Verificador de contraste y ARIA | 5 incumplimientos | 0 |
| **Total** | **14 hallazgos** | **4** |

## 5.3 Contraste entre el análisis automático y la revisión manual

Este contraste es el aporte metodológico más importante de esta sección: **ninguna
herramienta encuentra todo**, y conocer el límite de cada una es lo que permite diseñar un
plan de pruebas que no deje huecos.

| Hallazgo | Detectado por | Lo detectó la revisión manual | Lectura del contraste |
|---|---|---|---|
| SAST-01 · `dangerouslySetInnerHTML` | ESLint (error directo) | Sí | **Coincide.** La herramienta señala la línea exacta y el motivo. Es el caso ideal: automatizable y sin ambigüedad. |
| SAST-06 · SQL concatenado | **No lo detectó ESLint** | Sí | **Divergencia importante.** `eslint-plugin-security` no reconoce una plantilla de cadena dentro de una consulta `pg` como inyección. Lo encontró la revisión manual y lo confirmó la prueba dinámica. SonarQube sí tiene una regla para este patrón, lo que justifica mantener dos herramientas SAST. |
| SAST-07 · Datos sensibles en el log | No lo detectó ninguna herramienta | Sí | **Divergencia.** Que un log registre un campo llamado `password` no es un error de sintaxis ni un patrón reconocible: requiere entender qué significa el dato. Lo detectó la prueba dinámica de CP-SEG-05 al buscar una contraseña sonda en la salida. |
| SAST-02 a SAST-05 · Código muerto | ESLint | Sí, **pero por otra vía** | **Hallazgo indirecto valioso.** ESLint no sabe que se eliminó un control de seguridad: solo ve un import sin usar. Pero cuatro importaciones de seguridad sin usar en el mismo módulo son el **síntoma** que conduce a la causa. El linter no diagnosticó el problema; sí señaló dónde mirar. |
| SCA-01 · Dependencia vulnerable | `npm audit` | No | **Solo automático.** Ninguna revisión manual razonable detecta una vulnerabilidad publicada en una dependencia transitiva. Aquí la herramienta es insustituible. |
| A11Y-01 · Contraste insuficiente | Verificador propio | Parcialmente | **Complementarios.** La inspección visual nota que "el texto se ve claro"; solo el cálculo entrega el número (2,09:1) que permite afirmar el incumplimiento de WCAG y defenderlo ante una auditoría. |
| A11Y-02 · Falta de `aria-live` | Verificador propio | Sí, con lector de pantalla | **Coincide**, pero con un matiz: la verificación estática encontró la ausencia del atributo; solo la prueba manual con lector de pantalla demuestra la **consecuencia** (la persona no recibe ninguna señal del error). |

**Falsos positivos y su tratamiento.** El análisis estático produjo cuatro advertencias de
`security/detect-non-literal-fs-filename` en el módulo de almacenamiento. La regla es
correcta en general, pero en un storage de documentos la ruta es dinámica por definición:
no se puede eliminar la advertencia cambiando el código.

Se optó por **desactivar la regla únicamente en ese archivo, con la justificación escrita
en el propio código** y con dos pruebas que verifican los controles que mitigan el riesgo
real (el nombre en disco lo genera el servidor y toda ruta se confina al directorio raíz).
La alternativa —silenciar la regla globalmente— habría ocultado futuros usos legítimamente
peligrosos en otros módulos.

**Conclusión metodológica.** De los 14 hallazgos, **6 los encontró solo la automatización**,
**2 los encontró solo la revisión manual** y **6 los encontraron ambas**. Un plan de
pruebas que confíe únicamente en herramientas habría perdido la inyección SQL y la fuga en
los logs: los dos hallazgos de mayor severidad. Un plan que confíe únicamente en revisión
manual habría perdido la dependencia vulnerable y los valores exactos de contraste.

---

# 6. Ejecución de pruebas

La ejecución se realizó sobre el ambiente QA en contenedores Docker (SPA, API y PostgreSQL)
y sobre el código fuente. Toda la evidencia se generó con **scripts versionados**
(`evidencias/capturar-evidencia.sh`, `verificar-contraste.mjs` y `medir-rendimiento.mjs`),
de modo que cualquier persona puede regenerarla y obtener el mismo resultado.

**Qué se auditó.** La versión **1.0** del software, tal como llegó a QA. Sobre ella se
ejecutaron los 34 casos. La versión **1.1** es el resultado de aplicar la propuesta de
mejora de la sección 8, y sobre ella se ejecutó la regresión (CP-REG-01).

## 6.1 Resumen de ejecución

### Versión 1.0 — software auditado

| Estado | Cantidad | Porcentaje |
|---|---|---|
| Aprobados | 11 | 32,4 % |
| Fallidos | 20 | 58,8 % |
| Observados | 2 | 5,9 % |
| Bloqueados | 0 | 0 % |
| No aplicable (CP-REG-01) | 1 | 2,9 % |
| **Total** | **34** | **100 %** |

CP-REG-01 es la prueba de regresión: por definición no aplica a la versión auditada, ya
que su objeto es verificar la versión corregida.

**Distribución por tipo de prueba:** funcionales (10), integración (5), seguridad (8),
análisis estático (1), dependencias (1), rendimiento (3), usabilidad (1), compatibilidad
(1), disponibilidad (1), calidad del proceso (2) y regresión (1).

**Métricas de la batería automatizada sobre la versión 1.0:**

| Métrica | Resultado |
|---|---|
| Pruebas automatizadas | **114 aprobadas / 18 fallidas** de 132 |
| Suites de prueba | 2 aprobadas / 4 fallidas de 6 |
| Escenarios BDD | **4 aprobados / 2 fallidos** de 6 |
| Errores de ESLint | 5 (API) + 1 (SPA) |
| Vulnerabilidades en dependencias de producción | **1 de severidad alta** |
| Pares de color conformes con WCAG | 4 de 8 |
| Tasa de error bajo carga | **58,5 %** a **100 %** según el escenario |

**Lectura del resumen.** Una tasa de aprobación del 32,4 % no es, por sí misma, el dato
relevante: 20 casos fallidos sobre 14 incidentes significa que varios defectos se
manifiestan en más de un caso, lo que es esperable cuando un control transversal está
roto. Lo decisivo es que **cinco de los incidentes son de criticidad CRÍTICA** y afectan
directamente la confidencialidad del historial clínico: un paciente puede escribir en la
ficha de un examen, un visitante anónimo puede registrarse como administrador, la consulta
de auditoría es inyectable, la descripción de un examen ejecuta código en el navegador de
quien la lee y el cierre de sesión no invalida la sesión. Cualquiera de los cinco, por sí
solo, impide la liberación.

### Versión 1.1 — tras la remediación (CP-REG-01)

| Estado | Cantidad | Porcentaje |
|---|---|---|
| Aprobados | 31 | 91,2 % |
| Fallidos | 0 | 0 % |
| Observados | 3 | 8,8 % |
| **Total** | **34** | **100 %** |

| Métrica | Resultado |
|---|---|
| Pruebas automatizadas | **132 aprobadas / 132** |
| Escenarios BDD | **6 aprobados / 6** (34 pasos) |
| Cobertura de líneas | **89,84 %** (734/817) |
| Cobertura de ramas | **76,21 %** (346/454) |
| Cobertura de funciones | **87,23 %** (205/235) |
| Errores de ESLint | **0** en API y SPA |
| Formato (Prettier) | **Conforme** |
| Vulnerabilidades en dependencias de producción | **0** |
| Pares de color conformes con WCAG | **8 de 8** |
| Tasa de error bajo carga | **0,00 %** |

Los casos en estado **observado** son CP-SEG-08 (escaneo DAST) y CP-COMPAT-01 (matriz de
navegadores) en ambas versiones, y CP-DIS-01 (disponibilidad mensual) en la v1.1. Su
justificación está en la sección 6.2; en todos los casos la limitación es del ambiente de
prueba y no del software. CP-DIS-01 **falló** en la v1.0 por un criterio que sí era
verificable, como se detalla más abajo.

## 6.2 Detalle de ejecución de casos

### Pruebas funcionales

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-FUN-01 | Inicio de sesión con credenciales válidas | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-FUN-02 | Credenciales inválidas y bloqueo por intentos | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-FUN-03 | Cierre de sesión y revocación del token | **Fallido** | Aprobado | Anexo 2.4 | **INC-10** | 12/10/2026 · Eder Valdivia |
| CP-FUN-04 | Autorregistro con rol por defecto | **Fallido** | Aprobado | Anexo 2.3 | **INC-11** | 12/10/2026 · Eder Valdivia |
| CP-FUN-05 | Normalización y validación del RUT | **Fallido** | Aprobado | Anexo 1.1 | **INC-01** | 12/10/2026 · Eder Valdivia |
| CP-FUN-06 | Registro, edición y baja de paciente | **Fallido** | Aprobado | Anexo 1.1 | **INC-01** | 12/10/2026 · Eder Valdivia |
| CP-FUN-07 | Registro y edición de examen médico | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-FUN-08 | Eliminación lógica con confirmación | **Fallido** | Aprobado | Anexo 2.6 | **INC-09** | 12/10/2026 · Eder Valdivia |
| CP-FUN-09 | Política de contraseñas en servidor | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-FUN-10 | Administración de usuarios y roles | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |

### Pruebas de integración

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-INT-01 | Adjuntar documento con referencia en BD | Aprobado | Aprobado | Anexo 2.7 | — | 12/10/2026 · Eder Valdivia |
| CP-INT-02 | Descarga por el titular, con auditoría | Aprobado | Aprobado | Anexo 2.7 | — | 12/10/2026 · Eder Valdivia |
| CP-INT-03 | Flujo escalonado paciente → exámenes | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-INT-04 | Auditoría y eliminación lógica | **Fallido** | Aprobado | Anexo 2.6 | **INC-09** | 12/10/2026 · Eder Valdivia |
| CP-INT-05 | Unicidad del RUT del paciente | **Fallido** | Aprobado | Anexo 2.5 | **INC-01** | 12/10/2026 · Eder Valdivia |

### Pruebas de seguridad

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-SEG-01 | RBAC aplicado en el backend | **Fallido** | Aprobado | Anexo 2.1 | **INC-13** | 12/10/2026 · Eder Valdivia |
| CP-SEG-02 | Acceso a datos de terceros (IDOR) | Aprobado | Aprobado | Anexo 2.2 | — | 12/10/2026 · Eder Valdivia |
| CP-SEG-03 | Inyección SQL, XSS y *mass assignment* | **Fallido** | Aprobado | Anexos 2.3, 2.8 | **INC-02, INC-04, INC-11** | 12/10/2026 · Eder Valdivia |
| CP-SEG-04 | TLS, bcrypt y cifrado en reposo | **Fallido** | Aprobado | Anexo 2.4 | **INC-03** | 12/10/2026 · Eder Valdivia |
| CP-SEG-05 | Logs sin credenciales ni datos clínicos | **Fallido** | Aprobado | Anexo 3.5 | **INC-05** | 12/10/2026 · Eder Valdivia |
| CP-SEG-06 | Cabeceras de seguridad HTTP | **Fallido** | Aprobado | Anexo 3.4 | **INC-06** | 12/10/2026 · Eder Valdivia |
| CP-SEG-07 | Validación de tipo y tamaño del documento | **Fallido** | Aprobado | Anexo 2.7 | **INC-12** | 12/10/2026 · Eder Valdivia |
| CP-SEG-08 | Escaneo dinámico con OWASP ZAP | Observado | Observado | — | — | 12/10/2026 · Eder Valdivia |

> **CP-SEG-08 (observado):** el escaneo de OWASP ZAP está configurado y versionado
> (`.zap/rules.tsv` y la etapa `dast` del pipeline), pero no se ejecutó en este ciclo
> porque la herramienta no está instalada en el equipo de QA. La verificación equivalente
> —presencia y valor de las cabeceras de seguridad, que es lo que el escaneo pasivo de ZAP
> comprueba— **sí se ejecutó** en CP-SEG-06 con resultado documentado. Es una limitación
> del ambiente, no un resultado del software; se declara como tal en lugar de presentarla
> como aprobada.

### Análisis estático y de dependencias

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-SAST-01 | Análisis estático del código | **Fallido** | Aprobado | Anexos 3.1, 3.2 | **INC-04** y síntomas de INC-13 | 12/10/2026 · Eder Valdivia |
| CP-SCA-01 | Vulnerabilidades en dependencias | **Fallido** | Aprobado | Anexo 3.3 | **INC-08** | 12/10/2026 · Eder Valdivia |

### Pruebas de rendimiento

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-PERF-01 | Vista principal < 2 s | **Fallido** | Aprobado | Anexo 4.1 | **INC-14** | 12/10/2026 · Eder Valdivia |
| CP-PERF-02 | CRUD simple < 300 ms | **Fallido** | Aprobado | Anexo 4.1 | **INC-14** | 12/10/2026 · Eder Valdivia |
| CP-PERF-03 | 200 usuarios concurrentes | **Fallido** | Aprobado | Anexo 4.1 | **INC-14** | 12/10/2026 · Eder Valdivia |

**Métricas de rendimiento obtenidas:**

| Escenario | Requisito | Umbral | v1.0 · p95 | v1.0 · errores | v1.1 · p95 | v1.1 · errores | Veredicto v1.1 |
|---|---|---|---|---|---|---|---|
| Listado de pacientes (vista principal) | NFR-PERF-2 | ≤ 2.000 ms | 311 ms | **58,50 %** | **341 ms** | **0,00 %** | Cumple |
| Exámenes de un paciente (CRUD simple) | NFR-PERF-1 | ≤ 300 ms | 35 ms | **100,00 %** | **221 ms** | **0,00 %** | Cumple |
| Healthcheck (línea base) | NFR-DIS-3 | ≤ 300 ms | 32 ms | **100,00 %** | **51 ms** | **0,00 %** | Cumple |

El dato que importa de esta tabla no es la latencia —que cumplía los umbrales con holgura en
ambas versiones— sino la **tasa de error**. En la versión 1.0, entre el 58,5 % y el 100 % de
las peticiones legítimas se rechazaron con HTTP 429.

Obsérvese la tercera fila: **el propio healthcheck quedó con el 100 % de error**. El endpoint
que existe para medir la disponibilidad fue bloqueado por un control de seguridad del mismo
sistema, de modo que el instrumento de medición de NFR-DIS-1 habría reportado una caída
inexistente. La causa de las tres filas se analiza en INC-14.

### Usabilidad, compatibilidad y disponibilidad

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-USA-01 | Contraste, ARIA y vista móvil | **Fallido** | Aprobado | Anexo 5.1 | **INC-07** | 12/10/2026 · Eder Valdivia |
| CP-COMPAT-01 | Navegadores modernos | Observado | Observado | — | — | 12/10/2026 · Eder Valdivia |
| CP-DIS-01 | Disponibilidad y migración segura | **Fallido** | Observado | Anexos 0.1, 4.1 | **INC-14** | 12/10/2026 · Eder Valdivia |

> **CP-COMPAT-01 (observado):** la construcción de producción de la SPA se genera sin
> errores y la hoja de estilos no emplea características ajenas a la línea base de los
> navegadores objetivo, pero **no se dispuso de las ocho combinaciones navegador/versión**
> requeridas (en particular Safari, que no está disponible en el equipo de QA). Se declara
> observado: la matriz completa queda pendiente para un ambiente con los cuatro
> navegadores.
>
> **CP-DIS-01 — fallido en la v1.0, observado en la v1.1.** El caso tiene varios criterios y
> conviene separarlos.
>
> En la **v1.0 falló** uno verificable: el healthcheck **no estaba exento** del límite de
> peticiones y, bajo la carga de 200 usuarios, registró el 100 % de error (anexo 4.1). El
> endpoint que existe para medir la disponibilidad fue bloqueado por un control de seguridad
> del propio sistema, de modo que el instrumento de medición de NFR-DIS-1 habría reportado
> una caída inexistente.
>
> En la **v1.1** se verificó todo lo que es verificable en un ciclo de prueba: el healthcheck
> informa estado, versión e instante; está exento del límite de peticiones; el apagado
> responde a `SIGTERM` de forma ordenada; y el esquema se aplica de forma idempotente sin
> pérdida de datos. Queda **observado** porque la **disponibilidad del 99,5 % mensual no es
> medible en un ciclo de QA**: requiere 30 días de observación continua. Declararla aprobada
> sería una afirmación sin evidencia.

### Calidad del proceso y regresión

| Caso | Descripción | v1.0 | v1.1 | Evidencia | Incidente | Fecha / ejecutor |
|---|---|---|---|---|---|---|
| CP-CAL-01 | Cobertura como puerta de calidad | Aprobado | Aprobado | Anexo 1.1 | — | 12/10/2026 · Eder Valdivia |
| CP-CAL-02 | Pipeline de integración continua | Aprobado | Aprobado | — | — | 12/10/2026 · Eder Valdivia |
| CP-REG-01 | Regresión sobre la versión corregida | N/A | Aprobado | Todos los anexos de v1.1 | — | 12/10/2026 · Eder Valdivia |

> **Nota sobre CP-CAL-01.** Durante la ejecución se detectó una **debilidad en el diseño de
> la propia batería de pruebas**: la prueba unitaria que verifica el factor de costo de
> bcrypt fija `BCRYPT_COST=12` en el entorno de prueba, por lo que **aprueba en ambas
> versiones** y no detecta que el valor por defecto del código era 8. El defecto se
> encontró inspeccionando los hashes en la base de datos (CP-SEG-04). Se documenta como
> hallazgo sobre el plan de pruebas, con su recomendación en la sección 8: una prueba que
> fija la configuración no puede verificar que la configuración por defecto sea segura.

## 6.3 Incidentes identificados y su criticidad

### Escala de criticidad utilizada

Alineada con ISO/IEC 29119 y con el impacto específico de este sistema, en el que la
información tratada es dato personal **sensible** de salud.

| Nivel | Descripción | Impacto | Tratamiento |
|---|---|---|---|
| **CRÍTICO** | Permite el acceso o la alteración no autorizada de información clínica, la suplantación de identidad, o impide por completo una funcionalidad esencial. | Muy alto: compromete la confidencialidad del historial clínico y expone a la organización a sanciones por brecha de datos. | Remediación **inmediata**. Bloquea la liberación. |
| **GRAVE** | Afecta la integridad, la confidencialidad o la trazabilidad de la información, o degrada un control de seguridad exigido por el ERS, aunque exista mitigación parcial. | Alto: pérdida de confianza en los datos o en la capacidad de probar lo ocurrido. | Corrección **urgente**. Bloquea la liberación. |
| **MODERADO** | Afecta funcionalidades secundarias, el rendimiento o la accesibilidad de parte de los usuarios, sin comprometer la confidencialidad. | Medio: el sistema opera, pero excluye usuarios o incumple un umbral declarado. | Próxima iteración, con plazo comprometido. |
| **LEVE** | Defecto de presentación, redacción o estética que no afecta la funcionalidad ni la seguridad. | Bajo. | Según disponibilidad. |

### Incidentes registrados

| ID | Caso que lo detectó | Descripción del incidente | Origen (por qué ocurrió) | Criticidad |
|---|---|---|---|---|
| **INC-11** | CP-FUN-04, CP-SEG-03 | El endpoint público de autorregistro **acepta el campo `rol`** enviado por el cliente. Un visitante anónimo se registró con rol `ADMIN` y obtuvo HTTP 201. | El esquema de validación no era estricto (aceptaba campos no declarados) y el caso de uso tomaba el rol de la petición en lugar de forzarlo. | **CRÍTICO** |
| **INC-13** | CP-SEG-01 | Un usuario con rol `PACIENTE` **creó, modificó y eliminó** exámenes médicos enviando peticiones directamente a la API (HTTP 201, 200 y 200 donde se esperaba 403). | El control de rol se eliminó del router y del caso de uso; la única barrera era que la interfaz ocultaba los botones. | **CRÍTICO** |
| **INC-02** | CP-SEG-03 | El filtro de la consulta de auditoría es **inyectable**. El payload `LOGIN' OR '1'='1` devolvió **9 registros** frente a los **3** de la consulta legítima. | El valor del filtro se concatenaba dentro de la cadena SQL en lugar de viajar como parámetro posicional. | **CRÍTICO** |
| **INC-04** | CP-SAST-01, CP-SEG-03 | La descripción del examen se renderiza con `dangerouslySetInnerHTML`, lo que desactiva el escape de React y permite **XSS almacenado**. | Se habilitó formato enriquecido en un campo de texto libre sin sanear la salida. | **CRÍTICO** |
| **INC-10** | CP-FUN-03 | Tras `POST /auth/logout`, el **mismo token siguió siendo aceptado** (HTTP 200 donde se esperaba 401). Además, el secreto de firma del JWT tenía un valor por defecto escrito en el código. | El cierre de sesión no registraba el token en la lista de revocación y la función del secreto devolvía un valor literal si faltaba la variable de entorno. | **CRÍTICO** |
| **INC-01** | CP-INT-05, CP-FUN-05, CP-FUN-06 | El sistema **aceptó una segunda ficha con el mismo RUT** escrito con puntos (`12.345.678-5` → HTTP 201). Como efecto colateral, la recarga de datos de prueba generó pacientes duplicados y rompió una consulta posterior. | El RUT se guardaba tal como lo escribía el usuario, sin normalizar, y la base de datos no tenía índice único sobre la columna. | **GRAVE** |
| **INC-03** | CP-SEG-04 | Las contraseñas se almacenan con bcrypt y **factor de costo 8** (`$2b$08$`), por debajo del mínimo de 12 que exige OWASP. | El factor se redujo para acelerar el login y se eliminó la verificación que impedía arrancar con un valor inseguro. | **GRAVE** |
| **INC-05** | CP-SEG-05 | La **contraseña aparece en claro** en los registros del servicio. Una traza de depuración registra el cuerpo completo de cada petición y el logger no enmascara ningún campo. | Se dejó una traza temporal en el middleware de validación y se eliminó la configuración `redact` del logger. | **GRAVE** |
| **INC-06** | CP-SEG-06 | **Las seis cabeceras de seguridad están ausentes** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), `X-Powered-By` revela el framework y la política CORS acepta cualquier origen con credenciales. | No se aplicó el middleware de cabeceras y se usó una configuración CORS permisiva "para no bloquear clientes durante el desarrollo". | **GRAVE** |
| **INC-08** | CP-SCA-01 | La dependencia `lodash@4.17.15` presenta una vulnerabilidad de severidad **alta** (contaminación de prototipo e inyección de comandos) y está en el árbol de **producción**. | Se incorporó una versión antigua de la librería y se usó `lodash.merge`, que es la función afectada. | **GRAVE** |
| **INC-09** | CP-FUN-08, CP-INT-04 | La eliminación de un examen es **física**: tras el borrado, la consulta directa a la base devolvió **0 filas**. El historial clínico se destruye de forma irreversible. | El adaptador ejecutaba `DELETE FROM examen` en lugar de marcar la baja lógica. | **GRAVE** |
| **INC-12** | CP-SEG-07 | Se **aceptó un ejecutable de Windows renombrado a `.pdf`** y declarado como `application/pdf` (HTTP 201 donde se esperaba 400). | Se eliminó la verificación de la firma binaria del archivo; la validación confiaba solo en el `Content-Type` que envía el cliente. | **GRAVE** |
| **INC-07** | CP-USA-01 | **Cuatro pares de color incumplen** el contraste mínimo de WCAG 2.1 AA: texto secundario 2,15:1, mensaje de error 2,09:1, éxito 1,62:1 y aviso 1,69:1 (mínimo exigido 4,5:1). Además, los mensajes de estado **no llevan `role` ni `aria-live`**, por lo que el lector de pantalla no los anuncia. | Se eligió una paleta de tonos claros sin verificar el contraste y se retiraron los atributos ARIA del contenedor de mensajes. | **MODERADO** |
| **INC-14** | CP-PERF-01, CP-PERF-02, CP-PERF-03 | Con 200 usuarios concurrentes, entre el **58,5 % y el 100 % de las peticiones legítimas** se rechazaron con HTTP 429, incluido el **healthcheck**. Las latencias cumplían los umbrales con holgura. | El límite general estaba fijado en 300 por minuto **por dirección IP** y el healthcheck no estaba exento. En un centro de salud los 200 usuarios comparten una IP pública (NAT), lo que les deja 1,5 peticiones por minuto a cada uno. | **MODERADO** |

### Distribución de los incidentes

| Criticidad | Cantidad | Incidentes |
|---|---|---|
| **CRÍTICO** | 5 | INC-02, INC-04, INC-10, INC-11, INC-13 |
| **GRAVE** | 7 | INC-01, INC-03, INC-05, INC-06, INC-08, INC-09, INC-12 |
| **MODERADO** | 2 | INC-07, INC-14 |
| **LEVE** | 0 | — |
| **Total** | **14** | |

### Observación sobre el origen de INC-14

Los catorce incidentes están documentados en `05_Defectos_Sembrados_v1.0.md` con su
ubicación exacta en el código, pero **INC-14 tiene un origen distinto a los otros trece**.

Los trece primeros se introdujeron deliberadamente en la versión auditada para que el plan
de pruebas los detectara. INC-14 **no**: era un defecto de dimensionamiento presente en el
diseño inicial del software, que apareció al ejecutar la prueba de carga. Se incorporó
después al script de generación para que la versión auditada lo reproduzca y la evidencia
sea regenerable.

Se destaca la diferencia porque el mérito no es el mismo. Los trece primeros demuestran que
el plan **detecta** defectos conocidos; INC-14 demuestra que **encuentra** los que nadie
puso ahí. Y además ilustra algo que ninguno de los otros muestra: **un control de seguridad
correcto en su intención puede incumplir un requisito si está mal dimensionado**. El
limitador de peticiones es una medida acertada contra el abuso automatizado; el error
estuvo en fijar su valor sin derivarlo de la concurrencia que el propio ERS exige. Ninguna
prueba funcional lo habría detectado, porque todas se ejecutan con un usuario a la vez.

### Consecuencia sobre la liberación

Los **5 incidentes CRÍTICOS** y los **7 GRAVES** constituyen defectos **bloqueantes**. La
versión 1.0 **no puede liberarse a producción**.

Más allá del conteo, hay un argumento que basta por sí solo: en la versión 1.0 **cualquier
persona con acceso al formulario de registro público podía obtener privilegios de
administrador** (INC-11) y, con ellos, leer el historial clínico completo de todos los
pacientes y ejecutar consultas arbitrarias contra la base de datos (INC-02). Eso no es un
defecto de software: es una brecha de datos personales sensibles en espera de ocurrir, con
los deberes de notificación que eso activa bajo la Ley 21.663.

---

# 7. Análisis ético y normativo de los resultados

## 7.1 Análisis ético

**Uso exclusivo de datos sintéticos.** Todas las pruebas se ejecutaron con datos
ficticios en un ambiente QA aislado. Ningún nombre, RUT, correo, teléfono ni antecedente
clínico corresponde a una persona real; los RUT son válidos en su dígito verificador pero
pertenecen a rangos no emitidos. Esta decisión no es una preferencia metodológica: los
datos de salud son **datos sensibles** y usarlos en un ambiente de pruebas —que por
definición tiene menos controles que producción— constituye tratamiento sin finalidad
legítima. La propia semilla de datos documenta este razonamiento en su encabezado, para
que quien la reutilice entienda por qué no debe reemplazarla por un volcado de producción.

**Veracidad del reporte y no ocultamiento.** Los resultados se documentan sin minimizar
ningún hallazgo. Cinco incidentes críticos y siete graves son un resultado adverso para el
producto, y se reportan de forma explícita porque ocultarlos tendría tres consecuencias:
sería una falta ética frente a los pacientes cuyos datos quedarían expuestos, trasladaría
un riesgo legal a la organización, y haría inútil el propio ejercicio de pruebas. Un
informe que declara "todo aprobado" sin evidencia no protege a nadie.

Esta exigencia se aplicó también **hacia dentro del propio trabajo**. Se reportan tres
hallazgos que afectan a nuestro propio entregable:

1. La verificación de contraste detectó que, en la **versión corregida**, el color del
   borde de los campos alcanzaba 1,59:1 sobre blanco, por debajo del 3:1 que exige
   WCAG 1.4.11. Era un defecto nuestro, en el código que presentábamos como correcto. Se
   corrigió y se dejó constancia del valor resultante (3,39:1).
2. La prueba unitaria del factor de costo de bcrypt **no detecta** el defecto que debería
   detectar, porque fija la variable de entorno en el propio test. Es una debilidad del
   plan de pruebas, no del software, y se documenta como tal (§6.2) en lugar de omitirla.
3. INC-14 es un defecto de nuestro propio diseño del limitador de peticiones, no un
   defecto sembrado. Se reporta con la misma criticidad que los demás.

**Divulgación responsable.** Las vulnerabilidades se comunican internamente al equipo de
desarrollo y a los responsables del producto, acompañadas de su remediación concreta, antes
de cualquier divulgación externa. En este informe se describe el *mecanismo* de cada
vulnerabilidad —lo necesario para corregirla y para que el lector entienda su impacto—
pero no se incluyen *exploits* listos para usar ni se divulgan detalles que faciliten su
explotación por terceros. La versión vulnerable del software queda marcada como material
de laboratorio, con la advertencia explícita de no desplegarla en una red pública.

**No maleficencia.** Todas las pruebas de seguridad se realizaron en un ambiente
controlado, sobre contenedores locales y datos sintéticos. No se ejecutaron escaneos
agresivos ni pruebas de carga contra un sistema productivo. La prueba de inyección SQL
—que podría haber alterado o destruido datos— se ejecutó con un payload de lectura
(`OR '1'='1`) y no con uno destructivo (`DROP TABLE`), aun cuando el segundo habría
demostrado el mismo punto: cuando basta la prueba menos dañina, se usa la menos dañina.

**Objetividad y ausencia de conflicto de interés.** La clasificación de criticidad sigue
una escala predefinida y escrita antes de la ejecución (§6.3), no la conveniencia del
resultado. Ningún incidente se reclasificó a la baja para mejorar las cifras del informe.
Que el 38 % de los casos haya fallado es el resultado de aplicar la escala, no de
elegirla.

**Reproducibilidad como principio ético.** Toda la evidencia se genera con scripts
versionados. Esto convierte las afirmaciones del informe en verificables: cualquiera puede
regenerar la evidencia y confirmar o refutar lo que aquí se declara. Una evidencia que solo
el autor puede producir no es evidencia, es testimonio.

**Mejora continua y no punición.** Los hallazgos se orientan a fortalecer el producto, no
a atribuir responsabilidad individual. El informe describe el **origen técnico** de cada
defecto —"el valor del filtro se concatenaba en la consulta"— y no a quién lo escribió.
Varias de las causas son, de hecho, decisiones que en su momento parecían razonables: bajar
el costo de bcrypt "para acelerar el login", abrir CORS "para no bloquear clientes durante
el desarrollo", agregar formato enriquecido a una descripción. Señalar eso es más útil que
señalar personas.

## 7.2 Análisis normativo

Cada incidente se vincula a continuación con la norma concreta que incumple y con la
consecuencia jurídica u organizativa que se deriva.

| Incidente | Norma o estándar incumplido | Implicancia |
|---|---|---|
| **INC-11** · Escalada de privilegios en el autorregistro | **OWASP A01** (Broken Access Control) · **RF-2.1**, **RB-2**, **NFR-SEG-4** · **Ley 19.628 art. 7 y 11** (deber de secreto y de seguridad del tratamiento) · **Ley 21.719** · **Ley 21.663** | Es el incumplimiento más grave del conjunto. Cualquier persona con acceso al formulario público podía obtener acceso completo a los datos de salud de todos los pacientes. Bajo la Ley 21.719 constituye una falta al deber de seguridad del tratamiento de datos sensibles, con el régimen sancionatorio asociado; bajo la Ley 21.663 activa el deber de gestión del incidente y su eventual notificación a la autoridad. |
| **INC-13** · Control de acceso solo en la interfaz | **OWASP A01** · **NFR-SEG-4** (que exige expresamente control de acceso **en el backend**) · **RB-1** | Incumple de forma directa y literal un requisito del ERS. Un paciente podía alterar su propio registro clínico, lo que destruye la integridad del historial y su valor probatorio. En un contexto clínico, un examen alterado puede derivar en una decisión médica equivocada. |
| **INC-02** · Inyección SQL en el filtro de auditoría | **OWASP A03** (Injection) · **NFR-SEG-5** · **Ley 19.628/21.719** · **Ley 21.663** · **ISO/IEC 27001 A.8.28** (codificación segura) | Permite leer o alterar cualquier dato de la base, incluido el propio registro de auditoría que debería probar lo ocurrido. Que el vector esté precisamente en la auditoría agrava el hallazgo: un atacante podría borrar la evidencia de su propio acceso, lo que inutiliza el control exigido por RF-5.1. |
| **INC-04** · XSS almacenado | **OWASP A03** · **NFR-SEG-5** · **Ley 19.628/21.719** (confidencialidad) | Un script almacenado en la descripción de un examen se ejecuta en el navegador de cualquier médico o paciente que lo consulte, con acceso a su sesión. Convierte el sistema clínico en el vehículo del ataque contra sus propios usuarios. |
| **INC-10** · Sesión no revocable y secreto por defecto | **OWASP A02** (Cryptographic Failures) y **A07** (Authentication Failures) · **RF-1.2** (cuyo criterio de aceptación exige que el logout invalide la sesión) · **NFR-SEG-9**, **NFR-SEG-13** | Dos problemas de distinta naturaleza. El logout inefectivo incumple el criterio de aceptación de RF-1.2 y deja ventanas de acceso tras el cierre de sesión. El secreto por defecto es más grave: un secreto conocido permite **firmar** tokens válidos y suplantar a cualquier usuario, incluido un administrador. |
| **INC-01** · Unicidad de RUT ausente | **ISO/IEC 25010** (integridad funcional) · **Ley 19.628 art. 6 y 9** (principio de calidad y exactitud del dato personal) · **RF-2.2** | El historial clínico de una persona queda fragmentado entre dos fichas. Un médico que consulte una de ellas verá un historial incompleto y tomará decisiones con información parcial. La Ley 19.628 obliga a que los datos personales sean exactos y actualizados; dos fichas para una persona incumple ese principio. |
| **INC-03** · bcrypt con factor de costo 8 | **ISO/IEC 27001 A.8.24** (uso de criptografía) · **NFR-SEG-2** · **Ley 19.628/21.719** (deber de seguridad) · OWASP Password Storage Cheat Sheet | El hashing existe, pero su parámetro lo hace insuficiente: de 12 a 8 el costo de un ataque de fuerza bruta offline se reduce unas 16 veces. Un volcado de la tabla de usuarios se convierte en una lista de contraseñas recuperables en tiempo razonable. Cumplir formalmente con "usar bcrypt" no equivale a cumplir el requisito. |
| **INC-05** · Credenciales en claro en los logs | **NFR-SEG-6** · **Ley 19.628/21.719** (principios de finalidad y minimización) · **ISO/IEC 27001 A.8.15** (registro de eventos) | Los logs se copian, se exportan a sistemas de observabilidad y los consulta personal de operaciones que no tiene relación con el tratamiento de datos clínicos. Una contraseña escrita en el log se propaga mucho más allá del servidor, hacia destinos que nadie evaluó al autorizar el tratamiento. |
| **INC-06** · Cabeceras de seguridad ausentes y CORS permisivo | **OWASP A05** (Security Misconfiguration) · **NFR-SEG-10** (propuesto), **NFR-SEG-1**, **NFR-SEG-5** | Sin Content-Security-Policy se pierde la mitigación de último recurso frente al XSS de INC-04: los dos incidentes se potencian mutuamente. Sin HSTS, la exigencia de TLS de NFR-SEG-1 queda sin refuerzo en el navegador. Con CORS abierto y credenciales, cualquier sitio web puede leer respuestas autenticadas desde el navegador de la víctima. |
| **INC-08** · Dependencia con vulnerabilidad conocida | **OWASP A06** (Vulnerable and Outdated Components) · **ISO/IEC 27001 A.8.8** (gestión de vulnerabilidades técnicas) · **NFR-SEG-6** | Una dependencia vulnerable es código ejecutándose en el servidor con los mismos privilegios que la aplicación, y con un aviso público que describe cómo explotarla. La Ley 21.663 exige gestionar los riesgos conocidos: una vulnerabilidad publicada y sin mitigar es, por definición, un riesgo conocido y no gestionado. |
| **INC-09** · Eliminación física del registro clínico | **RF-3.3** (cuyo criterio de aceptación exige eliminación **lógica**) · **ISO/IEC 27001 A.8.15** · **Ley 19.628/21.719** (trazabilidad del tratamiento) | Destruye el historial de forma irreversible y deja la auditoría apuntando a un registro inexistente. Ante un reclamo o una fiscalización, la organización no puede acreditar qué se eliminó ni quién lo hizo. Se pierde simultáneamente el dato y la prueba de su existencia. |
| **INC-12** · Documento validado solo por el tipo declarado | **OWASP A04** (Insecure Design) y **A08** (Data Integrity Failures) · **NFR-SEG-12** (propuesto) · **RF-4.3** | La plataforma clínica queda convertida en canal de distribución de un archivo malicioso. El paciente que descarga lo que cree ser su resultado de examen recibe un ejecutable. El daño reputacional y legal es mayor que el técnico: el vector de confianza es el propio centro de salud. |
| **INC-07** · Contraste insuficiente y mensajes no anunciados | **WCAG 2.1 §1.4.3** (contraste mínimo) y **§4.1.3** (mensajes de estado) · **NFR-USAB-1**, **NFR-USAB-3** · **Ley 20.422** (igualdad de oportunidades e inclusión) | Excluye a los usuarios con baja visión o ceguera, que son parte de la población objetivo que el propio ERS identifica. Una persona ciega completa el formulario, lo envía, falla y no recibe ninguna señal: para ella el sistema simplemente no responde. La Ley 20.422 obliga a asegurar la accesibilidad de los servicios. |
| **INC-14** · Límite de peticiones mal dimensionado | **NFR-PERF-3** (200 usuarios concurrentes) · **NFR-DIS-1** · **ISO/IEC 25010** (fiabilidad y adecuación funcional) | Un control de seguridad que rechaza entre el 58 % y el 100 % del tráfico legítimo incumple el requisito de concurrencia igual que lo haría una falla de capacidad. En un centro de salud, significa que el personal clínico no accede al historial del paciente que tiene delante. |

## 7.3 Conclusión normativa

El software en su **versión 1.0 no cumplía** los criterios de seguridad, integridad,
trazabilidad ni accesibilidad exigidos por el ERS y por la normativa chilena aplicable.
Tres de los incumplimientos tienen implicancias legales directas y no solo técnicas:

1. **INC-11 e INC-02** habilitaban el acceso no autorizado a datos personales sensibles de
   salud. Bajo la **Ley 19.628**, modernizada por la **Ley 21.719**, esto constituye una
   falta al deber de seguridad del tratamiento. Bajo la **Ley 21.663**, su explotación
   activaría el deber de gestionar el incidente y, según su alcance, de notificarlo a la
   autoridad competente.
2. **INC-09** eliminaba de forma irreversible el registro clínico y su rastro de auditoría,
   lo que impide acreditar el tratamiento realizado sobre un dato personal, obligación que
   la Ley 19.628 impone al responsable.
3. **INC-07** excluía a usuarios con discapacidad visual de un servicio de salud,
   contraviniendo la **Ley 20.422** y las pautas **WCAG 2.1 nivel AA** que el propio ERS
   incorpora en NFR-USAB-1.

**Controles que sí se verificaron como correctos en la versión auditada**, y que conviene
destacar porque constituyen la base sobre la cual se corrigió lo demás: el control de
acceso a datos de terceros (CP-SEG-02, ningún paciente accedió a la ficha de otro), la
política de contraseñas validada en el servidor (CP-FUN-09), el bloqueo por intentos
fallidos (CP-FUN-02), la administración de usuarios con sus salvaguardas (CP-FUN-10), la
auditoría de las acciones críticas (CP-INT-04) y el almacenamiento de documentos con
referencia en base de datos (CP-INT-01).

**Situación de la versión 1.1.** Tras aplicar la propuesta de mejora de la sección 8 y
re-ejecutar el ciclo completo (CP-REG-01), los catorce incidentes quedaron cerrados con
evidencia. La versión corregida **cumple** los requisitos verificables del ERS y la
normativa aplicable, con tres casos en estado observado cuya limitación es de ambiente de
prueba y no del software (§6.2).

---

# 8. Propuesta de mejora

Para cada incidente se indica la remediación aplicada, su fundamento y la evidencia que
acredita el cierre. El orden es el de ejecución: primero los bloqueantes por criticidad y,
dentro de cada nivel, los que habilitan la explotación de otros.

| # | ID | Criticidad | Remediación aplicada | Fundamento | Evidencia del cierre |
|---|---|---|---|---|---|
| 1 | **INC-11** | CRÍTICO | El esquema de registro se declara **estricto**, de modo que un campo no declarado hace fallar la petición con HTTP 400; el caso de uso **fuerza** el rol a `PACIENTE` y ya no lo recibe como parámetro. | Cierra OWASP A01. La defensa está en el esquema y no en una validación dispersa: ningún campo inesperado llega al dominio, hoy ni cuando se agregue un campo nuevo. | Anexo 2.3 v1.1: `POST /auth/registro` con `rol: ADMIN` → **HTTP 400**. Prueba automatizada que verifica que el usuario no se creó. |
| 2 | **INC-13** | CRÍTICO | Se restituye `exigirRol(ADMIN, MEDICO)` en las rutas de escritura **y** la verificación de rol en el caso de uso. | **Defensa en profundidad deliberada**: el router protege el punto de entrada HTTP y el caso de uso protege la regla de negocio. Si mañana se agrega otro punto de entrada, la regla sigue vigente. | Anexo 2.1 v1.1: `POST`, `PUT` y `DELETE` de exámenes como paciente → **HTTP 403**. Escenario BDD "Un paciente no puede registrar un examen" aprobado. |
| 3 | **INC-02** | CRÍTICO | Todas las condiciones de la consulta de auditoría usan **parámetros posicionales** (`$1`, `$2`, …). El texto del SQL se construye en el servidor y solo los **valores** viajan como parámetros. | Elimina la clase completa de vulnerabilidad, no el payload concreto: con parámetros posicionales el motor trata el valor como dato, cualquiera sea su contenido. | Anexo 2.8 v1.1: el payload `LOGIN' OR '1'='1` devuelve **0 registros** (se trata como texto literal), frente a los 9 de la versión auditada. |
| 4 | **INC-04** | CRÍTICO | Se elimina `dangerouslySetInnerHTML` y el texto se interpola normalmente, de modo que React lo escapa. Además, la regla de ESLint que **prohíbe** ese atributo queda activa como error. | No basta corregir la línea: hay que impedir que el patrón vuelva. La regla convierte la reintroducción del defecto en un error de construcción. | Anexo 3.2 v1.1: ESLint sobre la SPA → **0 problemas**. Anexo 2.3: el payload XSS se devuelve como texto en una respuesta JSON. |
| 5 | **INC-10** | CRÍTICO | El logout **registra el `jti` del token** en la lista de revocación y el middleware de autenticación consulta esa lista en cada petición. El secreto del JWT se lee solo del entorno y, si falta o tiene menos de 32 caracteres, **el servicio no arranca**. | Un JWT es autocontenido: sin lista de revocación seguiría válido hasta expirar. Y es preferible que el servicio no arranque antes que arrancar con un secreto conocido. | Anexo 2.4 v1.1: tras el logout, el mismo token → **HTTP 401**. Se verificó además que el arranque falla sin `JWT_SECRET`. |
| 6 | **INC-01** | GRAVE | El dominio **normaliza** el RUT a su forma canónica (`12345678-9`) y valida su dígito verificador por módulo 11 antes de persistir; la base de datos recupera el **índice único** sobre `paciente.rut` entre los registros vigentes, y el error de unicidad se traduce a HTTP 409 en lugar de un 500 opaco. | Normalizar en el dominio es lo que impide evadir la restricción cambiando el formato; el índice en la base es la segunda barrera para cuando algún otro camino escriba en la tabla. | Anexo 2.5 v1.1: `12345678-5` y `12.345.678-5` → ambos **HTTP 409**; el índice `paciente_rut_uk` aparece en la consulta a `pg_indexes`. |
| 7 | **INC-03** | GRAVE | El factor de costo de bcrypt se eleva a **12** y se restituye la verificación que **impide arrancar** con un valor inferior. Los hashes de los datos de prueba se regeneran. | 12 es el mínimo de la guía de almacenamiento de contraseñas de OWASP. La verificación en el arranque evita que una variable de entorno mal puesta reintroduzca el defecto en silencio. | Anexo 2.4 v1.1: todos los hashes de la base muestran prefijo **`$2b$12$`**; el factor observado es 12. |
| 8 | **INC-05** | GRAVE | Se retira la traza de depuración del middleware de validación y se restituye la configuración **`redact`** del logger, que enmascara `password`, `token`, `refreshToken`, `authorization` y `cookie`. El serializador registra método, URL e IP, pero **no el cuerpo**. | Las dos medidas son complementarias: quitar la traza resuelve el caso concreto, y `redact` protege de la próxima traza que alguien agregue sin pensarlo. | Anexo 3.5 v1.1: la contraseña sonda **no aparece** en ninguna línea del log. |
| 9 | **INC-06** | GRAVE | Se aplica el middleware de cabeceras con **CSP restrictiva** (`default-src 'self'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy`; se elimina `X-Powered-By`; y la política **CORS pasa a una lista explícita** de orígenes configurada por entorno. Las mismas cabeceras se declaran en nginx para los archivos estáticos. | La CSP es la mitigación de último recurso frente a un XSS que se escape de las demás defensas, por lo que debe existir aunque INC-04 ya esté corregido. | Anexo 3.4 v1.1: las seis cabeceras **presentes** con valores restrictivos; `X-Powered-By` ausente. |
| 10 | **INC-08** | GRAVE | Se **elimina la dependencia** `lodash` y el código que la usaba se reescribe con las construcciones nativas del lenguaje. | Antes de actualizar una dependencia conviene preguntarse si se necesita: una línea de código propio elimina un árbol de dependencias y su superficie de ataque permanente. | Anexo 3.3 v1.1: `npm audit --omit=dev` → **0 vulnerabilidades** en las 122 dependencias de producción. |
| 11 | **INC-09** | GRAVE | La eliminación vuelve a ser **lógica**: marca `eliminado_en` y las consultas de lectura excluyen los registros dados de baja mediante índices parciales. La respuesta declara explícitamente `logica: true`. | Conserva el valor probatorio del historial y mantiene coherente la referencia desde la auditoría. Los índices parciales evitan que la baja lógica degrade el rendimiento de las consultas. | Anexo 2.6 v1.1: tras el borrado, la consulta a la base devuelve el registro con `dado_de_baja = true`. Escenario BDD de baja lógica aprobado. |
| 12 | **INC-12** | GRAVE | Se restituye la verificación de la **firma binaria** del archivo contra el tipo declarado, además de la lista blanca de MIME, el tope de 10 MB y el saneado del nombre. El nombre en disco lo genera el servidor. | El `Content-Type` lo elige el cliente y por tanto no es confiable. Verificar los primeros bytes es lo que distingue un PDF de un ejecutable renombrado. | Anexo 2.7 v1.1: PDF real → **201**; ejecutable disfrazado → **400**; HTML → **400**; paciente → **403**. |
| 13 | **INC-07** | MODERADO | La paleta se recalcula para que **todos** los pares alcancen el mínimo de WCAG: texto secundario 7,09:1, error 6,37:1, éxito 5,82:1, aviso 6,61:1 y borde 3,39:1. Se restituyen `role="alert"`/`role="status"` y `aria-live` en el contenedor de mensajes, con `assertive` para errores y `polite` para el resto. | Los valores quedan **anotados junto a cada token** en la hoja de estilos, de modo que quien ajuste un color vea el umbral que debe respetar. El verificador de contraste queda versionado para comprobarlo. | Anexo 5.1 v1.1: **todos** los pares de color cumplen WCAG 2.1 AA; `role` y `aria-live` presentes. |
| 14 | **INC-14** | MODERADO | El límite general se **deriva del requisito**: 200 usuarios concurrentes (NFR-PERF-3) × 60 peticiones/minuto = 12.000, con margen a **15.000 por minuto**. El healthcheck queda **exento** del límite. El límite estricto del endpoint de autenticación (10 cada 15 minutos) se mantiene sin cambios. | El cálculo queda escrito en el código, de modo que al cambiar la concurrencia objetivo se sepa qué recalcular. Eximir el healthcheck evita que el monitoreo consuma la cuota de los usuarios y reporte caídas inexistentes. | Anexo 4.1 v1.1: **0,00 % de errores** con 200 usuarios concurrentes; p95 de 341 ms y 221 ms, dentro de los umbrales. |

## 8.1 Mejoras al plan de pruebas

La ejecución reveló limitaciones del propio plan, que se documentan con su corrección
propuesta.

| Hallazgo sobre el plan | Corrección propuesta |
|---|---|
| La prueba unitaria del factor de costo de bcrypt fija `BCRYPT_COST=12` en el entorno de prueba, por lo que **aprueba aunque el valor por defecto del código sea insegURO**. | Añadir una verificación del **valor por defecto** ejecutada en un proceso aislado, sin variables de entorno, y una comprobación en el arranque del servicio que falle si el factor es menor que 12 (esta última ya está implementada en la v1.1). |
| El análisis estático con ESLint **no detectó** la inyección SQL de INC-02. | Incorporar SonarQube como segunda herramienta SAST en el pipeline: su regla `S2077` reconoce la construcción dinámica de consultas. La configuración ya está versionada; falta ejecutarla con un servidor disponible. |
| Las pruebas automatizadas usan el adaptador en memoria, que **no ejecuta SQL**, por lo que una familia completa de defectos es invisible para ellas. | Añadir una suite de integración que se ejecute contra PostgreSQL real en el pipeline (el workflow ya levanta un servicio `postgres` para la etapa DAST; se puede reutilizar). |
| CP-SEG-08 (DAST) y CP-COMPAT-01 quedaron **observados** por falta de herramientas y navegadores en el equipo de QA. | Ejecutarlos en el pipeline, donde ZAP ya está configurado, y complementar la matriz de navegadores con un servicio de pruebas multi-navegador. |
| La disponibilidad del 99,5 % mensual **no es medible** en un ciclo de QA. | Instrumentar el healthcheck con un monitoreo externo y evaluar NFR-DIS-1 sobre una ventana de 30 días en el ambiente de preproducción. |

## 8.2 Priorización y verificación

**Orden de remediación aplicado:**

```
CRÍTICOS   INC-11 → INC-13 → INC-02 → INC-04 → INC-10
GRAVES     INC-01 → INC-03 → INC-05 → INC-06 → INC-08 → INC-09 → INC-12
MODERADOS  INC-07 → INC-14
```

Dentro de los críticos, el orden no es arbitrario: **INC-11 va primero** porque es el único
que un atacante puede explotar sin credenciales previas, de modo que es la puerta por la
que se accede a explotar los demás. **INC-13 va segundo** porque amplía el daño de
cualquier cuenta comprometida. **INC-04 e INC-06 se corrigieron en conjunto**, porque la
Content-Security-Policy es la mitigación de último recurso del XSS: corregir uno sin el
otro deja el sistema sin red de seguridad.

**Verificación.** Cada corrección se acompañó de la re-ejecución del caso que detectó el
incidente, y al cierre se ejecutó la batería completa (CP-REG-01) para confirmar que
ninguna corrección rompió un caso que antes aprobaba. El resultado está en §6.1: 132 de 132
pruebas y 6 de 6 escenarios BDD aprobados, con cero errores de análisis estático y cero
vulnerabilidades en las dependencias de producción.

Una corrección sin re-prueba no es una corrección: es una afirmación. Por eso cada fila de
la tabla anterior cita el anexo concreto que acredita su cierre.

---

# 9. Conclusiones

**Sobre el ejercicio de la EP02.** El ciclo de pruebas ejecutado sobre Cuidarte+ convirtió
el plan diseñado en la EP01 en evidencia auditable. Se diseñaron 34 casos que cubren el
**100 % de los 45 requisitos** del ERS —verificado con una matriz bidireccional, sin casos
huérfanos ni requisitos sin cobertura— y se ejecutaron sobre el software real desplegado en
contenedores, no sobre una descripción de él.

**Sobre los hallazgos.** La auditoría detectó **14 incidentes**: 5 críticos, 7 graves y 2
moderados. El dato relevante no es la cantidad sino su naturaleza: en la versión auditada,
un visitante anónimo podía registrarse como administrador y, con ese acceso, leer el
historial clínico completo de todos los pacientes y ejecutar consultas arbitrarias contra
la base de datos, incluida la tabla de auditoría que debería haber registrado su intrusión.
Esa combinación impedía la liberación con independencia de cualquier otra consideración.

**Sobre el método.** El resultado más transferible de este trabajo es la constatación de que
**ninguna técnica de prueba encuentra todo**:

- El análisis estático detectó el XSS de forma inmediata y precisa, pero **no vio** la
  inyección SQL ni la fuga de credenciales en los logs: los dos hallazgos más graves.
- Las pruebas automatizadas encontraron 18 fallos, pero **no podían** detectar la inyección
  SQL, porque se ejecutan contra un adaptador en memoria que no interpreta SQL.
- El análisis de dependencias encontró una vulnerabilidad que **ninguna revisión manual
  razonable** habría detectado.
- La prueba de carga encontró INC-14, un conflicto entre un control de seguridad y un
  requisito de rendimiento que **ninguna prueba funcional** podía revelar, porque solo
  aparece con 200 usuarios simultáneos.
- La verificación de contraste entregó el **número exacto** (2,09:1) que convierte una
  impresión visual en un incumplimiento normativo defendible.

De los 14 hallazgos, 6 provinieron solo de herramientas, 2 solo de la revisión manual y 6
de ambas. Un plan que hubiera elegido una sola técnica habría dejado pasar, en el mejor de
los casos, un tercio de los defectos.

**Sobre la relación entre seguridad y calidad.** El trabajo muestra que la separación entre
ambas es artificial. INC-09 (eliminación física) es simultáneamente un defecto funcional
—incumple el criterio de aceptación de RF-3.3— y un problema de cumplimiento, porque
destruye la trazabilidad que exige la Ley 19.628. INC-14 es un control de seguridad
correcto en su intención que **incumple** un requisito de rendimiento por estar mal
dimensionado. INC-07 es un problema de accesibilidad que es, a la vez, un incumplimiento de
la Ley 20.422. Tratar la seguridad como un anexo del aseguramiento de calidad habría dejado
estos tres hallazgos sin dueño.

**Sobre la autocrítica.** El ejercicio también detectó defectos en nuestro propio trabajo: un
contraste insuficiente en la versión que presentábamos como correcta, una prueba unitaria
que no puede detectar el defecto que pretende verificar, y un límite de peticiones mal
dimensionado en nuestro diseño inicial. Se reportan con la misma criticidad que el resto,
porque un informe de QA que se exime de su propio escrutinio pierde la autoridad para
exigírselo a otros.

**Veredicto.** La versión 1.0 de Cuidarte+ **no era apta para producción**: cinco
incidentes críticos y siete graves comprometían la confidencialidad, la integridad y la
trazabilidad de datos personales sensibles de salud, con implicancias directas bajo las
leyes 19.628/21.719, 21.663 y 20.422.

Aplicada la propuesta de mejora y re-ejecutado el ciclo completo, la versión 1.1 **cierra
los catorce incidentes con evidencia reproducible**: 132 de 132 pruebas automatizadas y 6
de 6 escenarios de comportamiento aprobados, 89,84 % de cobertura de líneas, cero errores
de análisis estático, cero vulnerabilidades en las dependencias de producción, los tres
umbrales de rendimiento cumplidos con 0 % de error bajo 200 usuarios concurrentes y la
totalidad de los pares de color conformes con WCAG 2.1 AA.

Con esa base, y dejando constancia de los tres casos observados por limitaciones del
ambiente de prueba (§6.2), **Cuidarte+ v1.1 está en condiciones de avanzar hacia
producción con un riesgo controlado**, condicionado a cerrar las cinco mejoras del plan de
pruebas enumeradas en §8.1 y a medir la disponibilidad mensual en preproducción.

---

# 10. Anexos

Toda la evidencia de este informe se generó con scripts versionados y es **reproducible**.
El procedimiento completo está en `04_Paso_a_Paso_Reproducir_EV2.md`.

```
EV2/evidencias/
├── capturar-evidencia.sh      Genera los 19 anexos de una versión
├── verificar-contraste.mjs    Calcula el contraste WCAG desde el código
├── medir-rendimiento.mjs      Mide latencia y tasa de error bajo carga
├── v1.0/                      Evidencia de la versión auditada
└── v1.1/                      Evidencia de la versión corregida
```

Cada archivo de evidencia lleva un encabezado con su título, el caso de prueba, el
requisito verificado, la fecha, el ejecutor y el comando que lo produjo.

## Índice de anexos

**Anexo 0 · Ambiente de pruebas**

| Anexo | Contenido | Caso |
|---|---|---|
| 0.1 | Estado de los contenedores y respuesta del healthcheck | Precondición de todos los casos |

**Anexo 1 · Pruebas automatizadas y calidad**

| Anexo | Contenido | Caso |
|---|---|---|
| 1.1 | Salida completa de la batería de pruebas con informe de cobertura | CP-CAL-01 y todos los casos automatizados |
| 1.2 | Resultado de los escenarios BDD en Gherkin | CP-SEG-01, CP-INT-04, reglas RB-1 a RB-3 |
| 1.3 | Construcción de producción de la SPA | CP-COMPAT-01 |

**Anexo 2 · Pruebas de seguridad dinámicas**

| Anexo | Contenido | Caso |
|---|---|---|
| 2.1 | Matriz de control de acceso por rol verificada por API | CP-SEG-01 |
| 2.2 | Intentos de acceso a información de otro paciente | CP-SEG-02 |
| 2.3 | Inyección SQL en campos validados, XSS almacenado y escalada de privilegios | CP-SEG-03 |
| 2.4 | Revocación del token en el logout y factor de costo de bcrypt en la base | CP-FUN-03, CP-SEG-04 |
| 2.5 | Unicidad del RUT y estado de la restricción en la base de datos | CP-INT-05 |
| 2.6 | Registro de auditoría y verificación de la eliminación lógica | CP-INT-04, CP-FUN-08 |
| 2.7 | Validación de documentos: PDF real, ejecutable disfrazado y HTML | CP-SEG-07, CP-INT-01, CP-INT-02 |
| 2.8 | Inyección SQL en el filtro de auditoría: revisión del código y prueba dinámica | CP-SEG-03 |

**Anexo 3 · Análisis estático y de dependencias**

| Anexo | Contenido | Caso |
|---|---|---|
| 3.1 | ESLint sobre la API, con reglas de seguridad | CP-SAST-01 |
| 3.2 | ESLint sobre la SPA, con reglas de accesibilidad | CP-SAST-01, CP-USA-01 |
| 3.3 | `npm audit` de dependencias de producción y de desarrollo, con resumen por severidad | CP-SCA-01 |
| 3.4 | Cabeceras de seguridad, verificadas una por una | CP-SEG-06 |
| 3.5 | Búsqueda de credenciales en los registros del servicio | CP-SEG-05 |

**Anexo 4 · Rendimiento**

| Anexo | Contenido | Caso |
|---|---|---|
| 4.1 | Latencia (p50, p95, p99) y tasa de error con 200 usuarios concurrentes | CP-PERF-01, CP-PERF-02, CP-PERF-03 |

**Anexo 5 · Usabilidad y accesibilidad**

| Anexo | Contenido | Caso |
|---|---|---|
| 5.1 | Relación de contraste de cada par de colores y verificación de `role`/`aria-live` | CP-USA-01 |

## Documentos complementarios

| Documento | Contenido |
|---|---|
| `02_Presentacion_EP02_Cuidarte+.md` | Guion de la defensa individual |
| `03_Requerimientos_Adicionales_ERS_v1.2.md` | Los 23 requisitos propuestos, con su justificación |
| `04_Paso_a_Paso_Reproducir_EV2.md` | Cómo levantar el ambiente y regenerar toda la evidencia |
| `05_Defectos_Sembrados_v1.0.md` | Mapa defecto → archivo → incidente → caso → norma |

## Código fuente entregado

| Ruta | Contenido |
|---|---|
| `EV2/codigo/cuidarte-plus-v1.0/` | Software auditado (material de laboratorio, no desplegar) |
| `EV2/codigo/cuidarte-plus-v1.1/` | Software corregido y verificado |
| `EV2/codigo/sembrar-defectos.py` | Genera la v1.0 a partir de la v1.1, de forma reproducible |

---

ISY1102 · Sección 003V · Caso B: Cuidarte+ · Evaluación Parcial N.º 2
Eder Valdivia · Marcelo Morales · 12 de octubre de 2026

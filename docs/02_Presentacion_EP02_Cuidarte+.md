# Caso B · Cuidarte+ — Defensa EP02

**Verificando la calidad, la seguridad y el cumplimiento normativo de un sistema de
exámenes médicos**

ISY1102 — Seguridad y Calidad en el Desarrollo de Software · Sección 003V
Defensa **individual** · 10 minutos de exposición + 5 de preguntas

> Guion de apoyo para construir las diapositivas. El orden de exposición lo define el
> docente al azar y la defensa es individual: **ambos integrantes deben dominar el
> contenido completo**, no solo la parte que cada uno trabajó.
>
> **Dato de calibración:** 14 diapositivas en 10 minutos son **43 segundos por
> diapositiva**. El guion está escrito para eso. Lo que está en *cursiva* es lo que se
> dice, no lo que se proyecta.

---

## Diapositiva 1 — Portada

**Caso B: Cuidarte+**
Verificando la calidad, la seguridad y el cumplimiento normativo

ISY1102 · Seguridad y Calidad en el Desarrollo de Software · Sección 003V
Integrante: [Nombre completo] · Carrera: Ingeniería en Informática
Docente: Mauricio Andrés Velásquez Silva · 12 de octubre de 2026

*Apertura (15 s): «Auditamos un sistema que administra exámenes médicos. Encontramos 14
defectos, cinco de ellos críticos. El más grave permitía que cualquier visitante del sitio
se registrara como administrador y leyera el historial clínico de todos los pacientes.»*

---

## Diapositiva 2 — Índice de la defensa

1. El sistema y por qué se prueba
2. Enfoque estratégico de las pruebas
3. Tipos de prueba: origen, justificación e impacto
4. Herramientas y por qué cada una
5. Ejecución: resumen y trazabilidad
6. Ejecución: hallazgos caso a caso
7. Análisis estático frente a la norma
8. Clasificación de los defectos: origen e impacto
9. Lo que ninguna herramienta encontró
10. Reflexiones éticas, normativas y legales
11. Recomendaciones y verificación del cierre
12. Conclusión y veredicto

---

## Diapositiva 3 — El sistema y por qué se prueba · IE2

- **Cuidarte+**: plataforma web para centros de salud — pacientes, exámenes médicos,
  documentos clínicos y auditoría.
- **Arquitectura (ERS §4):** React 19 (SPA) · API REST Node/Express · PostgreSQL 17 · JWT ·
  TLS · bcrypt · control de acceso por rol en el backend.
- **Cuatro roles:** administrador, médico, paciente y visitante anónimo.
- **Módulos críticos:** autenticación, control de acceso, exámenes, documentos y auditoría.

> **Por qué se prueba este sistema y no otro:** la información que administra es **dato
> personal sensible de salud**. Una falla aquí no produce una molestia operativa: expone el
> historial clínico de una persona.

*Mensaje (40 s): «Esa frase determina todo el plan. El umbral de exigencia no lo fijamos
nosotros: lo fija la naturaleza del dato. Por eso la Ley 19.628, modernizada por la 21.719,
clasifica los datos de salud como sensibles y les impone un deber de seguridad reforzado.»*

---

## Diapositiva 4 — Enfoque estratégico de las pruebas · IE2

- **Enfoque mixto:** automatizado para lo repetible (funcional, integración, reglas de
  negocio, carga, análisis estático); manual para lo que exige juicio (autorización,
  accesibilidad percibida, criptografía).
- **Etapas:** análisis del ERS → diseño de casos → ambiente QA en Docker → análisis
  estático → ejecución → clasificación → **remediación y regresión**.
- **Priorización por un solo criterio:** *todo lo que pueda exponer el historial clínico de
  un paciente a quien no debe verlo.*
- **Cobertura:** 34 casos → **100 % de los 45 requisitos** del ERS, verificado con matriz
  bidireccional (sin casos huérfanos ni requisitos sin cubrir).
- **Criterio de salida:** cero hallazgos críticos o graves abiertos; métricas en umbral con
  **0 % de error**; evidencia reproducible para cada caso.

*Mensaje (45 s): «Dos decisiones de estrategia que quiero destacar. La primera: toda la
evidencia se genera con scripts versionados, no con capturas de pantalla. Cualquiera puede
regenerarla y verificar lo que afirmamos. La segunda: el ciclo no termina en el hallazgo,
termina en la regresión que acredita el cierre.»*

---

## Diapositiva 5 — Tipos de prueba: origen, justificación e impacto · IE4

| Tipo | Origen (qué lo motiva) | Impacto si se omite |
|---|---|---|
| **Funcionales** | El ERS define 17 requisitos funcionales con criterios de aceptación | Se libera con flujos clínicos rotos |
| **Integración** | La consulta cruza paciente → examen → documento | Se accede al documento ajeno por otra ruta |
| **Seguridad — control de acceso** | El ERS exige RBAC **en el backend** (NFR-SEG-4) | Un paciente altera exámenes por API |
| **Seguridad — datos de terceros** | Las rutas exponen identificadores enumerables | Un paciente lee el historial de otro |
| **Seguridad — inyección** | Texto libre llega a SQL y al DOM | Exfiltración de datos clínicos |
| **Seguridad — criptografía** | El ERS exige bcrypt, TLS y cifrado en reposo | Contraseñas recuperables de un volcado |
| **Seguridad — sesión** | RF-1.2 exige que el logout **invalide** la sesión | Token robado sigue sirviendo |
| **Análisis estático (SAST)** | Hay defectos que no se manifiestan al ejecutar | Vectores en ramas nunca recorridas |
| **Dependencias (SCA)** | 122 paquetes de terceros en producción | Se despliega una CVE con exploit público |
| **Rendimiento y carga** | El ERS fija umbrales y 200 concurrentes | Degradación en el horario de mayor atención |
| **Usabilidad y accesibilidad** | El ERS señala a los **adultos mayores** | Exclusión de usuarios; Ley 20.422 |
| **Compatibilidad** | Dos últimas versiones de 4 navegadores | Fallos invisibles hasta que los reporta un usuario |
| **Disponibilidad** | Un centro de salud no puede quedarse sin historial | Indisponibilidad en atención clínica |
| **Calidad del proceso** | Sin puertas, los controles dependen de la disciplina | Se omiten bajo presión de entrega |
| **Regresión** | Cada corrección puede romper lo validado | Reintroducción de defectos ya cerrados |

*Mensaje (60 s — esta es la diapositiva del indicador de mayor peso): «Para cada tipo sé
decir de dónde nace en este caso concreto y qué pasaría si lo omitiéramos. Dos ejemplos. El
tipo "seguridad — datos de terceros" no nace de una buena práctica genérica: nace de que la
regla RB-1 del ERS dice que el paciente "solo tiene permisos de lectura", lo que responde
qué puede hacer pero no sobre qué datos. Literalmente interpretada, permitiría leer la
ficha de cualquiera. Y el tipo "rendimiento" no nace de querer un sistema rápido: nace de
que el ERS fija 200 usuarios concurrentes, y fue justamente ahí donde encontramos un
conflicto entre un control de seguridad y un requisito funcional.»*

---

## Diapositiva 6 — Herramientas y por qué cada una · IE2

| Herramienta | Para qué | Por qué esta y no otra |
|---|---|---|
| **Docker Compose** | Ambiente QA | Reconstruible desde cero; idéntico al ERS; aislado de producción |
| **Jest + Supertest** | Funcional, integración, API | Ejerce la API con sus middlewares reales, sin navegador, en segundos |
| **Cucumber (Gherkin en español)** | Reglas de negocio RB-1 a RB-3 | Las reglas quedan en lenguaje natural, validables por un stakeholder no técnico |
| **ESLint + plugin security** | SAST del backend | Integra la seguridad en el flujo diario, no en una revisión posterior |
| **ESLint + plugin jsx-a11y** | SAST de accesibilidad | Convierte NFR-USAB en puerta automatizada; **prohíbe** `dangerouslySetInnerHTML` |
| **SonarQube** | Quality Gate | Detecta la construcción dinámica de SQL, que ESLint **no** detecta |
| **npm audit + Snyk** | Dependencias | Dos fuentes, porque sus bases de avisos no coinciden |
| **OWASP ZAP** | DAST | Verifica cabeceras y fugas sobre la aplicación en ejecución |
| **Trivy** | Imagen de contenedor | Las CVE del sistema base también se despliegan |
| **JMeter + script propio** | Carga | JMeter es el artefacto formal; el script mide los mismos umbrales sin instalarlo |
| **Verificador de contraste propio** | Accesibilidad | Entrega el **número** (2,09:1) que convierte una impresión en un incumplimiento |
| **GitHub Actions** | Puertas de calidad | Nueve etapas; sin pipeline los controles dependen de que alguien se acuerde |

*Mensaje (40 s): «Dos herramientas las escribimos nosotros, y quiero justificar por qué. El
verificador de contraste lee los colores del código fuente, así que cubre estados que no
están en pantalla en el momento de auditar —un mensaje de error que no se mostró, Lighthouse
no lo audita—. Y el medidor de carga mide los mismos umbrales que el plan de JMeter sin
requerir su instalación, de modo que cualquiera puede reproducir nuestras cifras.»*

---

## Diapositiva 7 — Ejecución: resumen y trazabilidad · IE8

**34 casos ejecutados sobre el software real desplegado en contenedores.**

| Estado | v1.0 (auditada) | v1.1 (corregida) |
|---|---|---|
| Aprobados | 11 (32,4 %) | **31 (91,2 %)** |
| Fallidos | **19 (55,9 %)** | **0** |
| Observados | 3 (8,8 %) | 3 (8,8 %) |
| No aplicable | 1 | 0 |

| Métrica | v1.0 | v1.1 |
|---|---|---|
| Pruebas automatizadas | 114 / 132 | **132 / 132** |
| Escenarios BDD | 4 / 6 | **6 / 6** (34 pasos) |
| Cobertura de líneas | — | **89,84 %** |
| Errores de análisis estático | 6 | **0** |
| CVE en dependencias de producción | **1 alta** | **0** |
| Pares de color conformes con WCAG | 4 / 8 | **8 / 8** |
| Tasa de error bajo 200 concurrentes | **57,8 % – 100 %** | **0,00 %** |

**Trazabilidad:** requisito → caso → evidencia → corrección. Cada caso cita el anexo que lo
acredita, con fecha, ejecutor y el comando que lo generó.

*Mensaje (45 s): «19 casos fallidos sobre 14 incidentes significa que varios defectos se
manifiestan en más de un caso, lo que es esperable cuando un control transversal está roto.
Los tres casos observados son honestidad metodológica: el escaneo DAST, la matriz de
navegadores y la disponibilidad mensual no los pudimos ejecutar por limitaciones del
ambiente, y los declaramos observados en lugar de aprobados.»*

---

## Diapositiva 8 — Ejecución: hallazgos caso a caso · IE8

| Caso | Hallazgo concreto | v1.0 | v1.1 |
|---|---|---|---|
| CP-FUN-01/02 | Login, bloqueo por 5 intentos, sin enumeración de cuentas | Aprobado | Aprobado |
| **CP-FUN-03** | **Tras el logout el token sigue aceptado: HTTP 200 donde debe ser 401** | Fallido | Aprobado |
| **CP-FUN-04** | **Registro con `"rol":"ADMIN"` → HTTP 201. Escalada de privilegios** | Fallido | Aprobado |
| **CP-FUN-05/06** | **`12.345.678-5` se acepta como RUT distinto de `12345678-5`** | Fallido | Aprobado |
| **CP-FUN-08** | **El borrado es físico: la consulta a la base devuelve 0 filas** | Fallido | Aprobado |
| CP-INT-01/02/03 | Documento con referencia en BD; descarga auditada; flujo escalonado | Aprobado | Aprobado |
| **CP-SEG-01** | **Paciente crea, edita y borra exámenes por API: 201, 200, 200** | Fallido | Aprobado |
| CP-SEG-02 | Ningún paciente accedió a la ficha de otro (404 en todos los casos) | Aprobado | Aprobado |
| **CP-SEG-03** | **`LOGIN' OR '1'='1` devuelve 9 registros frente a 3 del filtro legítimo** | Fallido | Aprobado |
| **CP-SEG-04** | **bcrypt con factor 8 (`$2b$08$`), mínimo OWASP: 12** | Fallido | Aprobado |
| **CP-SEG-05** | **La contraseña aparece en claro en los logs del servicio** | Fallido | Aprobado |
| **CP-SEG-06** | **Las 6 cabeceras de seguridad ausentes; `X-Powered-By` presente** | Fallido | Aprobado |
| **CP-SEG-07** | **Ejecutable renombrado a `.pdf` aceptado: HTTP 201** | Fallido | Aprobado |
| **CP-SCA-01** | **`lodash@4.17.15`, severidad alta, en dependencias de producción** | Fallido | Aprobado |
| **CP-PERF-01/02/03** | **Latencia correcta, pero 58 %–100 % de peticiones rechazadas con 429** | Fallido | Aprobado |
| **CP-USA-01** | **Mensaje de error con contraste 2,09:1; sin `role` ni `aria-live`** | Fallido | Aprobado |
| CP-CAL-01/02 | Cobertura como puerta; pipeline de 9 etapas | Aprobado | Aprobado |

*Mensaje (50 s): «Quiero detenerme en CP-SEG-01, porque es el que mejor explica por qué
probamos por API y no por la interfaz. En el navegador, un paciente no ve ningún botón para
editar un examen: la interfaz los oculta correctamente. Enviamos la misma petición con curl
y el servidor respondió 201 Created. El control existía, pero existía en el lugar
equivocado. Un botón oculto no es un control de acceso.»*

---

## Diapositiva 9 — Análisis estático frente a la norma · IE6

| Hallazgo | Detectado por | Norma incumplida | Veredicto |
|---|---|---|---|
| `dangerouslySetInnerHTML` en la descripción del examen | ESLint (error directo) | **OWASP A03** · NFR-SEG-5 · Ley 19.628/21.719 | Incumple |
| SQL construido por concatenación | **Revisión manual** (ESLint no lo vio) | **OWASP A03** · NFR-SEG-5 · Ley 21.663 | Incumple |
| `lodash@4.17.15` con CVE de severidad alta | `npm audit` | **OWASP A06** · ISO 27001 A.8.8 | Incumple |
| bcrypt con factor 8 | Inspección de la base de datos | **ISO 27001 A.8.24** · NFR-SEG-2 | Incumple |
| Contraseña en claro en los logs | Prueba dinámica (sonda) | **Ley 19.628/21.719** · ISO 27001 A.8.15 | Incumple |
| Cabeceras de seguridad ausentes | Inspección HTTP | **OWASP A05** · NFR-SEG-10 | Incumple |
| Rol aceptado desde la petición | Prueba de API | **OWASP A01** · RF-2.1 · RB-2 | Incumple |
| Eliminación física del registro clínico | Consulta a la base | **RF-3.3** · Ley 19.628 (trazabilidad) | Incumple |
| Contraste 2,09:1 y mensajes no anunciados | Verificador propio | **WCAG 1.4.3 / 4.1.3** · **Ley 20.422** | Incumple |
| Límite de peticiones mal dimensionado | Prueba de carga | **NFR-PERF-3** · ISO 25010 | Incumple |
| Acceso a datos de terceros, política de contraseñas, auditoría, bloqueo por intentos | Pruebas de API | ISO 27001 · ISO 29119 | **Cumple** |

*Mensaje (45 s): «Cada hallazgo se contrasta con la norma concreta, no con una buena
práctica general. Y quiero ser preciso en una cosa: el análisis estático con ESLint **no
encontró** la inyección SQL. El plugin de seguridad no reconoce una plantilla de cadena
dentro de una consulta como vector de inyección. La encontró la revisión manual del código
y la confirmó la prueba dinámica. SonarQube sí tiene una regla para ese patrón, y por eso
el plan mantiene dos herramientas SAST y no una.»*

---

## Diapositiva 10 — Clasificación de los defectos: origen e impacto · IE4

**Escala:** CRÍTICO · GRAVE · MODERADO · LEVE, definida **antes** de ejecutar.
**Resultado: 5 críticos · 7 graves · 2 moderados · 0 leves.**

| ID | Defecto | Origen (por qué ocurrió) | Impacto | Criticidad |
|---|---|---|---|---|
| **INC-11** | Registro acepta el campo `rol` | Esquema no estricto; el caso de uso tomaba el rol de la petición | Un anónimo se vuelve administrador y lee todo historial | **CRÍTICO** |
| **INC-13** | Paciente escribe exámenes por API | Se quitó el control de rol del router y del caso de uso | Se altera el registro clínico; decisión médica con dato falso | **CRÍTICO** |
| **INC-02** | Filtro de auditoría inyectable | Valor concatenado en el SQL en vez de parámetro | Lectura/alteración de toda la base, incluida la auditoría | **CRÍTICO** |
| **INC-04** | XSS almacenado en la descripción | `dangerouslySetInnerHTML` para permitir formato | Script ejecuta en el navegador de médico y paciente | **CRÍTICO** |
| **INC-10** | Logout no revoca; secreto por defecto | No se registraba el `jti`; secreto literal en el código | Token robado sigue válido; se pueden **firmar** tokens | **CRÍTICO** |
| **INC-01** | RUT duplicado | Sin normalizar y sin índice único | Historial clínico fragmentado en dos fichas | **GRAVE** |
| **INC-03** | bcrypt factor 8 | Se bajó "para acelerar el login" | Fuerza bruta 16× más rápida sobre un volcado | **GRAVE** |
| **INC-05** | Contraseña en los logs | Traza de depuración + sin `redact` | La credencial se propaga a sistemas de observabilidad | **GRAVE** |
| **INC-06** | Sin cabeceras; CORS abierto | "Para no bloquear clientes en desarrollo" | Sin CSP se pierde la mitigación de último recurso del XSS | **GRAVE** |
| **INC-08** | Dependencia con CVE | Versión antigua incorporada | Código vulnerable con los privilegios de la app | **GRAVE** |
| **INC-09** | Borrado físico del examen | `DELETE` en vez de baja lógica | Historial destruido; auditoría apunta a la nada | **GRAVE** |
| **INC-12** | Documento validado por tipo declarado | Se quitó la verificación de firma binaria | El centro de salud distribuye un ejecutable | **GRAVE** |
| **INC-07** | Contraste y ARIA | Paleta elegida sin verificar; ARIA retirado | Excluye a usuarios con baja visión o ceguera | **MODERADO** |
| **INC-14** | Límite de peticiones | 300/min por IP, sin derivarlo de los 200 concurrentes | El personal clínico no accede al historial | **MODERADO** |

*Mensaje (55 s): «Observen la columna de origen. Varias de estas causas fueron decisiones
que en su momento parecían razonables: bajar el costo de bcrypt para acelerar el login,
abrir CORS para no bloquear a los clientes durante el desarrollo, permitir formato
enriquecido en una descripción. Ninguna fue malicia ni descuido evidente. Por eso el
informe describe el origen técnico y no a quién lo escribió: lo primero sirve para
prevenir, lo segundo no.»*

---

## Diapositiva 11 — Lo que ninguna herramienta encontró · IE6, IE4

**De los 14 hallazgos: 6 solo por automatización · 2 solo por revisión manual · 6 por ambas.**

| Técnica | Qué encontró | Qué **no** podía encontrar |
|---|---|---|
| **Análisis estático** | El XSS, de inmediato y con la línea exacta | La inyección SQL (el plugin no reconoce el patrón) y la fuga en logs (requiere entender el significado del dato) |
| **Pruebas automatizadas** | 18 de los 19 fallos | La inyección SQL: corren contra un adaptador en memoria que **no interpreta SQL** |
| **Análisis de dependencias** | La CVE de `lodash` | Nada del código propio |
| **Prueba de carga** | INC-14, el conflicto control/requisito | Solo aparece con 200 usuarios simultáneos; ninguna prueba funcional lo revela |
| **Verificador de contraste** | El número exacto: 2,09:1 | La **consecuencia**: que el lector de pantalla no anuncie el error se comprueba usándolo |
| **Revisión manual** | La inyección SQL y la fuga en logs | La CVE en una dependencia transitiva |

> **El código muerto como síntoma.** ESLint no sabe que se eliminó un control de seguridad:
> solo reportó cuatro importaciones sin usar (`exigirRol`, `ROLES`, `digitoVerificador`,
> `#puedeEscribir`). No diagnosticó el problema, pero señaló exactamente dónde mirar.

*Mensaje (45 s): «Si tuviera que resumir el aprendizaje técnico de esta evaluación en una
frase sería esta: un plan de pruebas que elija una sola técnica deja pasar, en el mejor de
los casos, un tercio de los defectos. Y el ejemplo más claro es nuestro propio caso: las
pruebas automatizadas, que son 132 y cubren el 89,8 % de las líneas, eran estructuralmente
incapaces de detectar la inyección SQL. No por mal diseño, sino porque corren contra un
doble en memoria. Eso no se arregla escribiendo más pruebas del mismo tipo.»*

---

## Diapositiva 12 — Reflexiones éticas, normativas y legales · IE6, IE10

**Ética aplicada, con una decisión concreta en cada punto:**

- **Datos sintéticos, sin excepción.** Ningún dato clínico real participó. Los RUT son
  válidos pero de rangos no emitidos. *En QA hay menos controles que en producción: usar
  datos reales ahí es tratamiento sin finalidad legítima.*
- **Veracidad, también sobre nuestro propio trabajo.** Reportamos tres defectos **nuestros**:
  un contraste insuficiente en la versión que presentábamos como correcta, una prueba
  unitaria que no detecta el defecto que pretende verificar, y un límite de peticiones mal
  dimensionado en nuestro diseño.
- **Divulgación responsable.** Describimos el mecanismo de cada vulnerabilidad —lo necesario
  para corregirla— pero **no incluimos exploits**. La versión vulnerable queda marcada como
  material de laboratorio, con advertencia de no desplegar.
- **No maleficencia.** La prueba de inyección usó un payload de **lectura** (`OR '1'='1`) y
  no uno destructivo (`DROP TABLE`), aunque el segundo demostraba lo mismo. *Cuando basta la
  prueba menos dañina, se usa la menos dañina.*
- **Objetividad.** La escala de criticidad se escribió **antes** de ejecutar. Ningún
  incidente se reclasificó a la baja para mejorar las cifras del informe.
- **Reproducibilidad como principio ético.** Toda la evidencia se regenera con scripts.
  *Una evidencia que solo su autor puede producir es testimonio, no prueba.*

**Consecuencias legales concretas de los hallazgos:**

| Hallazgo | Norma | Consecuencia |
|---|---|---|
| INC-11, INC-02 | **Ley 19.628 / 21.719** | Falta al deber de seguridad del tratamiento de datos sensibles |
| INC-11, INC-02 | **Ley 21.663** | Deber de gestionar el incidente y eventual notificación a la autoridad |
| INC-09 | **Ley 19.628** | Imposibilidad de acreditar el tratamiento realizado |
| INC-07 | **Ley 20.422** | Exclusión de personas con discapacidad de un servicio de salud |

*Mensaje (45 s): «Un punto que quiero defender: reportar nuestros propios defectos no es un
gesto de modestia, es una condición de credibilidad. Un informe de QA que se exime de su
propio escrutinio pierde la autoridad para exigírselo a otros. El contraste del borde de los
campos lo encontró nuestra propia herramienta, en nuestro propio código, en la versión que
íbamos a presentar como correcta. Lo corregimos y lo documentamos.»*

---

## Diapositiva 13 — Recomendaciones y verificación del cierre · IE10

**Orden de remediación aplicado, con su razón:**

```
CRÍTICOS   INC-11 → INC-13 → INC-02 → INC-04 → INC-10
GRAVES     INC-01 → INC-03 → INC-05 → INC-06 → INC-08 → INC-09 → INC-12
MODERADOS  INC-07 → INC-14
```

- **INC-11 primero:** es el único explotable **sin credenciales previas**; es la puerta por
  la que se accede a explotar los demás.
- **INC-04 e INC-06 en conjunto:** la Content-Security-Policy es la mitigación de último
  recurso del XSS. Corregir uno sin el otro deja el sistema sin red de seguridad.

| ID | Remediación | Evidencia del cierre |
|---|---|---|
| INC-11 | Esquema **estricto** + rol forzado en el servidor | `rol: ADMIN` → **400** |
| INC-13 | Rol exigido en el router **y** en el caso de uso (defensa en profundidad) | Paciente escribe → **403** |
| INC-02 | **Parámetros posicionales** en todas las consultas | Payload de tautología → **0 registros** |
| INC-04 | Sin `dangerouslySetInnerHTML` + regla ESLint que lo **prohíbe** | ESLint → **0 problemas** |
| INC-10 | Revocación por `jti` + el servicio **no arranca** sin secreto válido | Tras logout → **401** |
| INC-01 | RUT normalizado + **índice único** en la base | Ambos formatos → **409** |
| INC-03 | bcrypt a **12** + verificación que impide arrancar por debajo | Base muestra **`$2b$12$`** |
| INC-05 | Traza retirada + **`redact`** restituido | Contraseña **no aparece** en el log |
| INC-06 | Seis cabeceras + CSP restrictiva + CORS por lista explícita | Seis cabeceras **presentes** |
| INC-08 | **Dependencia eliminada**, código reescrito con el lenguaje nativo | `npm audit` → **0** |
| INC-09 | Baja **lógica** con índices parciales | Registro conservado con marca de baja |
| INC-12 | Verificación de **firma binaria** + lista blanca + tope de tamaño | Ejecutable disfrazado → **400** |
| INC-07 | Paleta recalculada (todos ≥ umbral) + `role` y `aria-live` | **8/8** pares conformes |
| INC-14 | Límite **derivado del requisito**: 200 × 60 = 12.000 → 15.000/min | **0,00 %** de error |

**Cinco mejoras al propio plan de pruebas** (§8.1 del informe): verificar el valor por
defecto de bcrypt en proceso aislado; incorporar SonarQube como segundo SAST; añadir una
suite de integración contra PostgreSQL real; ejecutar DAST y la matriz de navegadores en el
pipeline; medir la disponibilidad mensual en preproducción.

*Mensaje (40 s): «Una corrección sin re-prueba no es una corrección, es una afirmación. Por
eso cada fila cita el anexo que acredita su cierre, y al final ejecutamos la batería
completa para confirmar que ninguna corrección rompió algo que antes funcionaba: 132 de 132
y 6 de 6 escenarios.»*

---

## Diapositiva 14 — Conclusión y veredicto

- **Lo que funcionaba en la versión auditada:** el acceso a datos de terceros estaba
  correctamente controlado, la política de contraseñas se validaba en el servidor, el
  bloqueo por intentos operaba, la auditoría registraba las acciones críticas y los
  documentos se almacenaban con referencia en base de datos. Esa fue la base sobre la que
  se corrigió lo demás.
- **Lo que bloqueaba:** 5 defectos críticos y 7 graves. En particular, cualquier visitante
  podía obtener privilegios de administrador y, con ellos, leer todo historial clínico y
  ejecutar consultas arbitrarias contra la base —incluida la tabla de auditoría que debería
  haber registrado su intrusión.
- **Cobertura:** 34 casos → **100 % de los 45 requisitos**, matriz bidireccional, sin casos
  huérfanos.
- **Aporte adicional:** **23 requisitos propuestos** para cerrar vacíos del ERS. Nueve de
  los catorce incidentes nacen directamente de un vacío de especificación.
- **Veredicto:** la versión 1.0 **no era apta para producción**. La versión 1.1 cierra los
  catorce incidentes con evidencia reproducible y **está en condiciones de avanzar a
  producción con riesgo controlado**, condicionada a las cinco mejoras del plan y a medir la
  disponibilidad mensual en preproducción.

*Cierre (35 s): «Tres ideas para terminar. Primera: la seguridad no es un anexo del
aseguramiento de calidad. INC-09 es simultáneamente un defecto funcional y un problema de
cumplimiento legal; INC-14 es un control de seguridad que incumple un requisito de
rendimiento. Tratarlos por separado los habría dejado sin dueño. Segunda: ninguna técnica
encuentra todo, y conocer el límite de cada herramienta es parte del diseño del plan.
Tercera: lo que convirtió este trabajo en una auditoría y no en una opinión fue que toda la
evidencia es reproducible. Cualquiera puede ejecutar los scripts y verificar o refutar lo
que afirmamos.»*

---

## Anexo — Banco de preguntas y respuestas preparadas

### Sobre la estrategia

**¿Por qué 34 casos y no menos?**
Porque el criterio fue cobertura del 100 % del ERS verificada con matriz bidireccional, no
un número fijado de antemano. El ERS tiene 45 requisitos entre RF, NFR, reglas de negocio y
restricciones verificables. Algunos casos cubren varios requisitos y algunos requisitos
necesitan varios casos —NFR-PERF-3, por ejemplo, se verifica en tres—. El número salió de
la matriz.

**¿Cómo se garantiza que no hay casos huérfanos?**
La matriz es bidireccional: se recorre en los dos sentidos. De requisito a caso, para
detectar requisitos sin cubrir; de caso a requisito, para detectar casos que no verifican
nada. Ambos recorridos están en la sección 4.2 del informe.

**¿Qué estándares se usaron y para qué cada uno?**
ISO/IEC 25010 para el modelo de calidad del producto (de ahí los criterios de
mantenibilidad, fiabilidad e integridad funcional); ISO/IEC 27001 para los controles de
seguridad (A.8.8 gestión de vulnerabilidades, A.8.15 registro de eventos, A.8.24
criptografía, A.8.28 codificación segura); ISO/IEC 29119 para la documentación de pruebas y
el valor probatorio de la evidencia; OWASP Top 10 para clasificar las vulnerabilidades; y
WCAG 2.1 AA para los umbrales de accesibilidad.

**¿Cómo se priorizó?**
Con un criterio único: todo lo que pueda exponer el historial clínico de un paciente a quien
no debe verlo. De ahí que los módulos de autenticación, control de acceso, exámenes y
documentos se prueben antes y con más profundidad que, por ejemplo, la administración de
usuarios.

### Sobre el análisis estático

**¿Por qué ESLint y además SonarQube? ¿No es redundante?**
No: nuestra propia ejecución lo demostró. ESLint con el plugin de seguridad **no detectó**
la inyección SQL de INC-02, porque no reconoce una plantilla de cadena dentro de una
consulta `pg` como vector. SonarQube sí tiene una regla para ese patrón. Mantener dos
herramientas no es redundancia, es cobertura de reglas distintas.

**¿Qué defectos no eran evidentes en una revisión manual?**
La CVE de `lodash@4.17.15`. Ninguna revisión manual razonable detecta una vulnerabilidad
publicada en una dependencia; para eso existe el análisis de composición. También los
valores exactos de contraste: la inspección visual nota que "se ve claro", pero solo el
cálculo entrega el 2,09:1 que permite afirmar el incumplimiento de WCAG.

**¿Hubo falsos positivos? ¿Cómo se trataron?**
Cuatro advertencias de `security/detect-non-literal-fs-filename` en el módulo de
almacenamiento. La regla es correcta en general, pero en un storage de documentos la ruta
es dinámica por definición. La desactivamos **solo en ese archivo**, con la justificación
escrita en el propio código, y añadimos dos pruebas que verifican los controles que mitigan
el riesgo real: que el nombre en disco lo genera el servidor y que toda ruta se confina al
directorio raíz. Silenciarla globalmente habría ocultado usos legítimamente peligrosos en
otros módulos.

**¿Cuál es la limitación del análisis estático?**
No entiende el **significado** de los datos. Que un log registre un campo llamado
`password` no es un error de sintaxis ni un patrón reconocible: hay que saber qué es una
contraseña. Ese defecto lo encontró la prueba dinámica, buscando una contraseña sonda en la
salida del servicio.

### Sobre la documentación de hallazgos

**¿Cómo se estructuró cada hallazgo?**
Con seis campos: identificador, caso de prueba que lo detectó, descripción con el dato
observado, **origen** (por qué ocurrió técnicamente), criticidad según la escala predefinida
y norma afectada. A eso se suma la remediación y la evidencia de su cierre.

**¿Por qué 5 críticos y no otra cantidad?**
La escala se escribió antes de ejecutar y define CRÍTICO como lo que permite acceso o
alteración no autorizada de información clínica, suplantación de identidad, o impide por
completo una funcionalidad esencial. Los cinco cumplen ese criterio: INC-11 (escalada de
privilegios), INC-13 (escritura no autorizada), INC-02 (inyección SQL), INC-04 (XSS
almacenado) e INC-10 (sesión no revocable y secreto por defecto). Aplicar la escala dio
cinco; no elegimos el número.

**Dame un ejemplo completo de origen e impacto.**
INC-02. **Origen:** el valor del filtro de la consulta de auditoría se concatenaba dentro de
la cadena SQL en lugar de viajar como parámetro posicional. **Cómo se detectó:** comparamos
el filtro legítimo `accion=LOGIN`, que devolvió 3 registros, con el payload
`accion=LOGIN' OR '1'='1`, que devolvió 9. **Impacto:** permite leer o alterar cualquier
dato de la base. Lo que lo agrava es **dónde** está: en la auditoría. Un atacante podría
borrar la evidencia de su propio acceso, lo que inutiliza el control que exige RF-5.1.
**Remediación:** parámetros posicionales. **Verificación:** el mismo payload devuelve ahora
0 registros, porque se trata como texto literal.

### Sobre ética y normativa

**¿Qué implicancias éticas tiene el código que escribimos?**
Tres concretas en este caso. Primera: elegir la paleta de colores sin verificar el contraste
no es un descuido estético, excluye a usuarios con baja visión de un servicio de salud.
Segunda: dejar una traza de depuración que registra el cuerpo de las peticiones propaga
contraseñas a sistemas que nadie evaluó al autorizar el tratamiento. Tercera: bajar el
factor de bcrypt "para acelerar el login" traslada un riesgo del desarrollador al usuario,
que no participó en esa decisión ni la conoce.

**¿Qué leyes chilenas aplican y cómo?**
La **Ley 19.628**, modernizada por la **Ley 21.719**: los datos de salud son sensibles, con
deber de seguridad reforzado, principios de finalidad y minimización, y exigencia de
exactitud del dato —que INC-01 incumple al permitir dos fichas para una persona—. La **Ley
21.663** de ciberseguridad: obliga a gestionar los riesgos conocidos y a notificar
incidentes relevantes; una CVE publicada y sin mitigar es, por definición, un riesgo
conocido no gestionado. Y la **Ley 20.422**: obliga a asegurar la accesibilidad, que INC-07
incumple.

**¿Qué harían distinto si repitieran el trabajo?**
Tres cosas. Primera: ejecutar las pruebas de integración contra PostgreSQL real desde el
comienzo, no contra el doble en memoria; habríamos detectado la inyección SQL en la primera
ejecución en lugar de en la revisión manual. Segunda: escribir el verificador de contraste
**antes** de elegir la paleta, no después; nos habría ahorrado introducir un defecto propio.
Tercera: derivar los valores de todos los controles de seguridad desde los requisitos
numéricos del ERS; INC-14 existió porque fijamos un límite de peticiones sin consultar la
concurrencia que el propio ERS exigía.

**¿Por qué reportan defectos propios? ¿No debilita el informe?**
Al contrario. Un informe de QA que se exime de su propio escrutinio pierde la autoridad para
exigírselo a otros. Los tres defectos propios que reportamos —el contraste del borde, la
prueba unitaria que no detecta lo que pretende verificar, y el límite de peticiones— los
encontró nuestro propio instrumental. Que los hayamos documentado es evidencia de que el
instrumental funciona.

### Sobre la planificación y el proceso

**¿Qué fue lo más desafiante?**
Distinguir un control real de uno cosmético. En la interfaz, el sistema se comportaba
correctamente: un paciente no veía botones de edición. La única forma de descubrir que el
control vivía en el lugar equivocado fue dejar de usar la interfaz y enviar las peticiones
directamente a la API. Eso obligó a rediseñar varios casos para que se ejecutaran por API y
no por navegador.

**¿Cómo influyó la EP01 en este trabajo?**
La EP01 entregó el diseño con 6 casos y cobertura parcial de 6 de 25 requisitos. Los
ajustes están tabulados en la sección 1.7 del informe: agregar el campo tipo de prueba,
justificar el propósito de cada tipo con origen e impacto, cerrar la cobertura al 100 %,
incorporar análisis estático, ejecutar con evidencia, clasificar por criticidad, vincular
cada hallazgo a su norma, proponer remediaciones y verificar su cierre.

**¿Por qué dos versiones del software?**
Porque la EP02 exige detectar, clasificar y explicar defectos con evidencia. Para que esa
evidencia sea reproducible y comparable, la versión auditada se **genera** desde la
corregida con un script que aplica un conjunto de defectos documentados. Las pruebas son
**idénticas** en ambas versiones, de modo que los 19 fallos de la v1.0 son comparables uno a
uno con los 34 aprobados de la v1.1. Sin eso, la comparación sería entre dos cosas
distintas.

**¿Cómo se asegura que la evidencia no está maquillada?**
Porque no la escribimos: la generan scripts versionados que cualquiera puede ejecutar. Cada
archivo de evidencia lleva el comando que lo produjo. Si alguien ejecuta
`bash capturar-evidencia.sh v1.0` obtiene los mismos resultados que están en el informe, o
descubre que no coinciden. Esa es la diferencia entre evidencia y testimonio.

---

Caso B · Cuidarte+ — Defensa EP02 · ISY1102 · Sección 003V
Eder Valdivia · Marcelo Morales

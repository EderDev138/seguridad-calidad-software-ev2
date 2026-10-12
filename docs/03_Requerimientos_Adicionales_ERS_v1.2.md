# Requerimientos adicionales propuestos — Cuidarte+

## Anexo a la Especificación de Requerimientos de Software v1.1

**ISY1102 — Seguridad y Calidad en el Desarrollo de Software · Evaluación Parcial N.º 2**
**Caso B: Cuidarte+**

Propuesto por: Eder Valdivia · Marcelo Morales
Sección 003V · Docente: Mauricio Andrés Velásquez Silva
Fecha: 12 de octubre de 2026

---

## 1. Propósito de este documento

Durante el análisis del ERS v1.1 para construir el plan de pruebas se identificaron
**vacíos de especificación**: aspectos que el documento menciona sin cuantificar, controles
que son prerrequisito de otros ya exigidos, y criterios de calidad que no están declarados
y por tanto no son verificables.

Un requisito que no se puede verificar no se puede probar, y lo que no se prueba no se
puede afirmar. Este anexo propone **23 requerimientos adicionales** que cierran esos vacíos.

**Criterio aplicado para proponer un requisito.** Cada propuesta cumple las cuatro
condiciones siguientes:

1. **Es verificable:** define un umbral, una condición o un comportamiento observable. No
   se proponen enunciados como "el sistema debe ser seguro".
2. **Tiene un origen concreto:** nace de un vacío detectado en el ERS o de un incidente
   real encontrado durante la ejecución de la EP02.
3. **Está trazado:** se indica el requisito del ERS que complementa, el caso de prueba que
   lo verifica y la norma que lo respalda.
4. **Es implementable en el alcance del sistema:** no depende de decisiones ajenas al
   producto.

**Trazabilidad general:**

| Grupo | Cantidad | Rango de identificadores |
|---|---|---|
| Funcionales | 4 | RF-1.3, RF-1.4, RF-5.2, RF-6.1 |
| Reglas de negocio | 2 | RN-01, RN-02 |
| Seguridad | 7 | NFR-SEG-10 a NFR-SEG-16 |
| Calidad del producto y del proceso | 5 | NFR-CAL-1 a NFR-CAL-5 |
| Disponibilidad y observabilidad | 2 | NFR-DIS-3, NFR-DIS-4 |
| Usabilidad y accesibilidad | 2 | NFR-USAB-5, NFR-USAB-6 |
| Trazabilidad | 1 | NFR-TRAZ-1 |
| **Total** | **23** | |

---

## 2. Requisitos funcionales adicionales

### RF-1.3 · Bloqueo temporal de la cuenta por intentos fallidos

| Campo | Contenido |
|---|---|
| **Número de requisito** | RF-1.3 |
| **Nombre** | El sistema debe bloquear temporalmente una cuenta tras un número configurable de intentos de autenticación fallidos consecutivos. |
| **Tipo** | Requisito funcional |
| **Prioridad** | Alta / Esencial |
| **Complementa** | RF-1.1 (autenticación) |
| **Verificado por** | CP-FUN-02 |

**Origen.** El ERS exige autenticación con usuario y contraseña (RF-1.1) y una política de
contraseñas robusta (§2.4), pero **no establece ningún límite al número de intentos**. Una
política de 12 caracteres es irrelevante si un atacante puede probar millones de
combinaciones sin restricción.

**Especificación.**
- Tras **5 intentos fallidos consecutivos** (valor por defecto, configurable), la cuenta se
  bloquea durante **15 minutos** (configurable).
- Durante el bloqueo, el sistema responde con HTTP 429 e indica los segundos restantes,
  **incluso si las credenciales son correctas**.
- Un inicio de sesión exitoso reinicia el contador de intentos.
- Cada intento fallido se registra en auditoría con el nombre de usuario intentado, la
  dirección IP y el instante, **nunca con la contraseña**.

**Criterio de aceptación.** Cinco intentos fallidos seguidos de un intento con la
contraseña correcta devuelven HTTP 429. El registro de auditoría contiene cinco entradas
`LOGIN_FALLIDO` sin ninguna credencial.

**Fundamento normativo.** OWASP A07 (Identification and Authentication Failures);
Ley 19.628/21.719, deber de seguridad del tratamiento.

---

### RF-1.4 · Política de contraseñas validada en el servidor

| Campo | Contenido |
|---|---|
| **Número de requisito** | RF-1.4 |
| **Nombre** | El sistema debe validar la política de contraseñas en el servidor y comunicar al usuario todas las reglas incumplidas. |
| **Tipo** | Requisito funcional |
| **Prioridad** | Alta / Esencial |
| **Complementa** | ERS §2.4 (restricción de política de contraseñas) |
| **Verificado por** | CP-FUN-09 |

**Origen.** El ERS define la política en la sección de **restricciones** (§2.4) y no como
requisito funcional, por lo que no especifica **dónde** se valida ni **cómo** se comunica
el incumplimiento. Una validación que solo existe en el formulario del navegador no es un
control: se evade enviando la petición directamente a la API.

**Especificación.**
- La validación se ejecuta **siempre en el servidor**, con independencia del cliente.
- Reglas por defecto, todas configurables: mínimo **12 caracteres**, al menos una
  mayúscula, una minúscula, un número y un símbolo.
- Ante un incumplimiento, la respuesta enumera **todas** las reglas no cumplidas, no solo
  la primera.
- La interfaz muestra la política **antes** de que el usuario escriba, no como reproche
  posterior.

**Criterio de aceptación.** Una petición con contraseña `abc` enviada directamente a la API
devuelve HTTP 400 con el detalle de las cuatro reglas incumplidas.

**Fundamento normativo.** ERS §2.4; NFR-USAB-3 (mensajes de error amigables); OWASP
Authentication Cheat Sheet.

---

### RF-5.2 · Exportación del registro de auditoría

| Campo | Contenido |
|---|---|
| **Número de requisito** | RF-5.2 |
| **Nombre** | Un usuario administrador debe poder exportar el registro de auditoría para una revisión externa, y la exportación debe quedar a su vez registrada. |
| **Tipo** | Requisito funcional |
| **Prioridad** | Media |
| **Complementa** | RF-5.1 (auditoría de acciones críticas) |
| **Verificado por** | CP-INT-04 |

**Origen.** El ERS exige **generar** registros de auditoría (RF-5.1) pero no especifica cómo
se **entregan** ante una fiscalización. Un registro que solo se puede consultar de a 50
entradas en una pantalla no sirve como prueba de cumplimiento.

**Especificación.**
- La exportación admite filtros por acción, usuario, entidad y rango de fechas.
- Incluye un encabezado con el instante de generación, el usuario que la solicitó y el
  total de registros.
- Está restringida al rol **ADMIN**.
- La propia exportación genera una entrada de auditoría: acceder masivamente al registro de
  quién accedió a qué dato clínico es, en sí mismo, una acción crítica.

**Criterio de aceptación.** La exportación devuelve el encabezado con fecha, responsable y
total; un usuario con rol médico o paciente recibe HTTP 403.

**Fundamento normativo.** ISO/IEC 27001 A.8.15 (registro de eventos); Ley 19.628/21.719
(trazabilidad del tratamiento); Ley 21.663 (gestión de incidentes).

---

### RF-6.1 · Registro del consentimiento del titular de los datos

| Campo | Contenido |
|---|---|
| **Número de requisito** | RF-6.1 |
| **Nombre** | El sistema debe registrar el consentimiento informado del titular para el tratamiento de sus datos de salud, con su versión, instante y medio de obtención. |
| **Tipo** | Requisito funcional |
| **Prioridad** | Alta / Esencial |
| **Complementa** | NFR-SEG-8 (cumplimiento de protección de datos) |
| **Verificado por** | Caso de prueba a diseñar en el siguiente ciclo |

**Origen.** El ERS declara que el sistema "debe garantizar el cumplimiento de normativa de
protección de datos" (§1.2) y lo enuncia como NFR-SEG-8, pero **no especifica ningún
mecanismo** que lo implemente. El consentimiento es el fundamento de licitud del
tratamiento de datos sensibles: sin registro, la organización no puede acreditar que lo
obtuvo.

**Especificación.**
- Al registrar un paciente o al crear una cuenta, se registra el consentimiento con: titular,
  versión del texto aceptado, instante, medio (web, presencial) y finalidad.
- El titular puede **revocar** el consentimiento, lo que queda registrado sin eliminar el
  registro anterior.
- El sistema permite consultar el estado del consentimiento de un titular.
- El texto del consentimiento es versionado: un cambio en la finalidad del tratamiento
  requiere un consentimiento nuevo.

**Criterio de aceptación.** Para todo paciente registrado existe un registro de
consentimiento recuperable con su versión e instante; una revocación queda registrada sin
borrar el consentimiento previo.

**Fundamento normativo.** **Ley 21.719**, que moderniza la Ley 19.628 e incorpora de forma
expresa el consentimiento y los derechos del titular; principio de finalidad.

> **Nota de alcance.** Este requisito se propone pero **no se implementó ni se probó** en
> esta evaluación: excede el alcance acordado y requiere definiciones legales del cliente
> sobre el texto y las finalidades del tratamiento. Se documenta para que quede en el
> *backlog* con su fundamento, y no por omisión.

---

## 3. Reglas de negocio adicionales

### RN-01 · Unicidad e integridad del RUT del paciente

| Campo | Contenido |
|---|---|
| **Identificador** | RN-01 |
| **Enunciado** | No pueden coexistir dos fichas de paciente vigentes con el mismo RUT. El RUT se almacena en forma canónica y su dígito verificador se valida antes de persistir. |
| **Prioridad** | Alta / Esencial |
| **Complementa** | RF-2.2 (registro de paciente) |
| **Verificado por** | CP-INT-05, CP-FUN-05 |

**Origen.** El ERS define el RUT como "identificador en Chile" (§1.3) pero **no lo declara
único** ni exige validar su dígito verificador. Durante la EP02 esta omisión produjo el
incidente **INC-01**: el sistema aceptó una segunda ficha para la misma persona escribiendo
el RUT con puntos.

**Especificación.**
- **Forma canónica:** `NNNNNNNN-D`, sin puntos, con guion, dígito verificador en mayúscula.
  La normalización se aplica **antes** de cualquier comparación o escritura.
- **Validación del dígito verificador** por módulo 11. Un RUT con dígito incorrecto se
  rechaza con HTTP 400.
- **Unicidad en dos capas:** validación en el backend y restricción `UNIQUE` en la base de
  datos, acotada a los registros vigentes (`eliminado_en IS NULL`), de modo que un RUT dado
  de baja pueda reutilizarse.
- Un duplicado se comunica con **HTTP 409**, nunca con HTTP 500.

**Criterio de aceptación.** `12345678-5` y `12.345.678-5` se consideran el mismo RUT y el
segundo intento devuelve HTTP 409. El índice único existe en la base de datos.

**Fundamento normativo.** ISO/IEC 25010 (integridad funcional); **Ley 19.628 art. 6 y 9**,
principio de calidad y exactitud del dato personal. Dos fichas para una persona incumplen
ese principio y fragmentan su historial clínico.

---

### RN-02 · Un paciente accede únicamente a su propia información clínica

| Campo | Contenido |
|---|---|
| **Identificador** | RN-02 |
| **Enunciado** | Un usuario con rol paciente accede únicamente a la ficha, los exámenes y los documentos vinculados a su propia cuenta, con independencia del identificador que indique en la petición. |
| **Prioridad** | Alta / Esencial |
| **Complementa** | RB-1 (el paciente solo tiene permisos de lectura) |
| **Verificado por** | CP-SEG-02 |

**Origen.** La regla RB-1 del ERS establece que "un paciente solo tiene permisos de
lectura", lo que responde **qué operaciones** puede hacer pero no **sobre qué datos**.
Literalmente interpretada, RB-1 permitiría a un paciente leer el historial clínico de
cualquier otro: solo estaría leyendo. Esta regla cierra ese vacío.

**Especificación.**
- La autorización se evalúa sobre el **dato**, no solo sobre el rol: el servidor verifica
  que la ficha consultada esté vinculada a la cuenta del solicitante.
- La verificación se propaga por la cadena documento → examen → paciente, de modo que no
  exista una ruta alternativa de acceso.
- Ante un recurso ajeno se responde **HTTP 404 y no 403**, para no confirmar su existencia
  a quien no debe conocerla.
- El listado de pacientes devuelve a un paciente **únicamente su propia ficha**
  (minimización de datos).

**Criterio de aceptación.** Un paciente que solicita la ficha, los exámenes o un documento
de otro paciente recibe HTTP 404 en todos los casos. Su listado de pacientes contiene un
solo elemento.

**Fundamento normativo.** OWASP A01 (Broken Access Control); **Ley 19.628/21.719**, deber
de secreto y principio de minimización; NFR-SEG-4.

---

## 4. Requisitos no funcionales de seguridad

### NFR-SEG-10 · Cabeceras de seguridad HTTP

**Enunciado.** Toda respuesta HTTP del sistema, incluidas las de los archivos estáticos,
debe incluir las cabeceras de seguridad que mitigan inyección, *clickjacking*, *sniffing*
de contenido, degradación de transporte y fuga de referencia.

**Origen.** El ERS exige protección contra XSS (NFR-SEG-5) y TLS obligatorio (NFR-SEG-1),
pero no menciona los mecanismos del navegador que refuerzan ambas exigencias. Su ausencia
produjo el incidente **INC-06**.

**Especificación.**

| Cabecera | Valor mínimo exigido | Protege contra |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; object-src 'none'; frame-ancestors 'none'` | Inyección y XSS |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Degradación a HTTP |
| `X-Frame-Options` | `DENY` | *Clickjacking* |
| `X-Content-Type-Options` | `nosniff` | *Sniffing* de tipo de contenido |
| `Referrer-Policy` | `no-referrer` | Fuga de URL con identificadores |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` | Acceso a APIs del navegador |

Adicionalmente, la cabecera `X-Powered-By` **no debe estar presente**, y la política CORS
debe restringirse a una **lista explícita** de orígenes configurada por ambiente.

**Criterio de aceptación.** Un escaneo pasivo de OWASP ZAP no reporta ninguna alerta de
cabecera ausente. `X-Powered-By` no aparece en ninguna respuesta.
**Verificado por:** CP-SEG-06, CP-SEG-08.
**Fundamento:** OWASP A05 (Security Misconfiguration); NFR-SEG-1, NFR-SEG-5.

---

### NFR-SEG-11 · Limitación de peticiones dimensionada

**Enunciado.** El sistema debe limitar la tasa de peticiones para amortiguar el abuso
automatizado, y el límite debe **derivarse de la concurrencia objetivo** declarada en
NFR-PERF-3.

**Origen.** El ERS no menciona ningún límite de tasa. Al introducirlo sin dimensionarlo
apareció el incidente **INC-14**: un límite de 300 peticiones por minuto por IP rechazó
entre el 58 % y el 100 % del tráfico legítimo, porque en un centro de salud los 200
usuarios comparten una dirección IP pública.

**Especificación.**
- **Endpoints de autenticación:** límite estricto por IP (por defecto 10 cada 15 minutos),
  que no cuenta los intentos exitosos.
- **Resto de la API:** límite general derivado del requisito —concurrencia objetivo ×
  peticiones por minuto por usuario— con margen. Para 200 usuarios concurrentes y 60
  peticiones por minuto: **15.000 por minuto**.
- El **healthcheck queda exento**: el monitoreo de disponibilidad no debe consumir la cuota
  ni reportar caídas inexistentes.
- El cálculo que fundamenta el valor debe quedar documentado junto a la configuración.

**Criterio de aceptación.** Una prueba de carga con la concurrencia de NFR-PERF-3 presenta
**0 % de respuestas HTTP 429**. El límite de autenticación sigue bloqueando la fuerza bruta.
**Verificado por:** CP-PERF-03, CP-FUN-02.
**Fundamento:** OWASP A04; NFR-PERF-3; NFR-DIS-1.

---

### NFR-SEG-12 · Validación del contenido de los documentos clínicos

**Enunciado.** La aceptación de un documento debe validarse por lista blanca de tipo, por
**firma binaria del contenido** y por tamaño máximo. El tipo declarado por el cliente no se
considera confiable.

**Origen.** El ERS enumera los formatos permitidos (RF-4.3: PDF, DOC, PPT, JPG, PNG) pero
no especifica **cómo** se verifica el formato. Confiar en el `Content-Type` produjo el
incidente **INC-12**: se almacenó un ejecutable de Windows renombrado a `.pdf`.

**Especificación.**
- **Lista blanca** de tipos MIME admitidos; todo lo demás se rechaza.
- **Verificación de la firma binaria** (*magic number*) contra el tipo declarado.
- **Tamaño máximo de 10 MB** por documento, verificado en la recepción y en la base de
  datos.
- El **nombre en disco lo genera el servidor** (identificador aleatorio + extensión
  derivada del tipo validado); el nombre original se almacena saneado, sin componentes de
  ruta.
- La descarga se sirve con `Content-Disposition: attachment` y `X-Content-Type-Options:
  nosniff`, para que el navegador no renderice el archivo en el origen de la aplicación.

**Criterio de aceptación.** Un ejecutable declarado como `application/pdf` se rechaza con
HTTP 400. Un archivo de 11 MB se rechaza con HTTP 413.
**Verificado por:** CP-SEG-07, CP-INT-01.
**Fundamento:** OWASP A04 (Insecure Design) y A08 (Data Integrity Failures); RF-4.3; ERS
§2.4 ("los documentos deben estar fuertemente controlados por contener información
sensible").

---

### NFR-SEG-13 · Gestión de secretos fuera del código

**Enunciado.** Ningún secreto (credencial de base de datos, clave de firma de tokens, token
de servicio externo) debe estar escrito en el código ni versionado. El servicio debe
**negarse a arrancar** si falta un secreto obligatorio o si no cumple su longitud mínima.

**Origen.** El ERS no aborda la gestión de secretos. Un valor por defecto escrito en el
código produjo el incidente **INC-10**: con un secreto de firma conocido, cualquiera puede
firmar tokens válidos y suplantar a un administrador.

**Especificación.**
- Los secretos se entregan por **variable de entorno** o por un almacén de secretos.
- No existen valores por defecto para secretos: su ausencia **impide el arranque** con un
  mensaje que indique qué falta.
- La clave de firma de tokens tiene un mínimo de **32 caracteres**; las de acceso y de
  refresco son **distintas entre sí**.
- El repositorio incluye un archivo `.env.example` con los nombres de las variables y **sin
  valores reales**, y el `.env` está excluido del control de versiones.
- En integración continua, los secretos se entregan como *secrets* del repositorio.

**Criterio de aceptación.** El servicio no arranca sin `JWT_SECRET` ni con un secreto de
menos de 32 caracteres. Una búsqueda en el repositorio no encuentra ningún secreto.
**Verificado por:** CP-CAL-02, verificación de arranque en CP-SEG-04.
**Fundamento:** OWASP A02 (Cryptographic Failures) y A05; ISO/IEC 27001 A.8.24.

---

### NFR-SEG-14 · Puertas de calidad y seguridad obligatorias en integración continua

**Enunciado.** Ningún cambio puede integrarse a la rama principal sin pasar las puertas
automatizadas de formato, análisis estático, pruebas con cobertura, análisis de
dependencias, escaneo de la imagen de contenedor y escaneo dinámico.

**Origen.** El ERS no menciona el proceso de desarrollo. Sin puertas automatizadas, los
controles dependen de la disciplina individual y se omiten justamente cuando hay presión de
entrega, que es cuando más se necesitan.

**Especificación.** El pipeline debe ejecutar, en este orden —de la verificación más rápida
a la más costosa, para que el primer error llegue en segundos y no en minutos—:

| Etapa | Control | Falla si |
|---|---|---|
| 1 | Formato (Prettier) | Hay desviaciones de formato |
| 2 | Análisis estático (ESLint con reglas de seguridad y accesibilidad) | Hay cualquier error |
| 3 | Pruebas con cobertura | Alguna prueba falla o la cobertura baja del umbral |
| 4 | Escenarios de comportamiento (BDD) | Algún escenario falla |
| 5 | Dependencias (SCA) | Hay vulnerabilidades en producción, o altas/críticas en desarrollo |
| 6 | Análisis de calidad (SonarQube) | El Quality Gate no se aprueba |
| 7 | Construcción y escaneo de imagen (Trivy) | Hay vulnerabilidades críticas/altas del sistema base, o la imagen corre como root |
| 8 | Escaneo dinámico (OWASP ZAP) | Falla alguna regla vinculada a un requisito del ERS |
| 9 | Resumen | Cualquier etapa anterior falló |

**Criterio de aceptación.** Un cambio que introduce un incumplimiento en cualquier etapa
detiene el pipeline. El resumen final vincula cada control con el requisito que verifica.
**Verificado por:** CP-CAL-02.
**Fundamento:** ISO/IEC 29119; Ley 21.663 (gestión de riesgos de seguridad).

---

### NFR-SEG-15 · Minimización de datos personales en registros y ambientes no productivos

**Enunciado.** Los registros del sistema no deben contener credenciales, tokens ni datos
clínicos. Los ambientes no productivos deben operar exclusivamente con datos sintéticos.

**Origen.** El ERS exige "gestión de log segura" (NFR-SEG-6) sin especificar qué significa.
La falta de especificación produjo el incidente **INC-05**: la contraseña apareció en claro
en los registros del servicio.

**Especificación.**
- El registrador aplica **enmascaramiento** sobre `password`, `token`, `refreshToken`,
  `authorization`, `cookie` y cualquier campo marcado como sensible.
- **No se registra el cuerpo** de las peticiones: en este sistema el cuerpo contiene datos
  clínicos, y conservarlos en un log es tratarlos sin finalidad legítima.
- Se registran método, ruta, código de respuesta, duración e IP; nunca el contenido.
- Los ambientes de desarrollo, QA y preproducción usan **datos sintéticos**. Está prohibido
  cargar un volcado de producción.
- La auditoría puede registrar el nombre de usuario de un intento fallido, pero **nunca** la
  contraseña intentada.

**Criterio de aceptación.** Una contraseña conocida enviada al endpoint de autenticación no
aparece en ninguna línea del registro del servicio.
**Verificado por:** CP-SEG-05.
**Fundamento:** **Ley 19.628/21.719**, principios de finalidad y minimización; ISO/IEC
27001 A.8.15; NFR-SEG-6.

---

### NFR-SEG-16 · Inmutabilidad del registro de auditoría

**Enunciado.** El registro de auditoría debe ser de solo adición: ninguna operación del
sistema puede modificar ni eliminar una entrada existente.

**Origen.** El ERS exige generar registros de auditoría (RF-5.1) pero no exige su
**inmutabilidad**. Un registro que la propia aplicación puede alterar no tiene valor
probatorio: un atacante con acceso a la aplicación borraría la evidencia de su intrusión.

**Especificación.**
- El dominio no expone ninguna operación de actualización ni de borrado sobre la auditoría.
- En la base de datos se **revocan** los permisos de `UPDATE` y `DELETE` sobre la tabla al
  rol que usa la aplicación.
- La depuración de históricos, si es necesaria, se realiza con un rol administrativo
  distinto y queda registrada en los logs del motor de base de datos.
- Las entidades de negocio usan **eliminación lógica**, de modo que una entrada de auditoría
  nunca apunte a un registro inexistente.

**Criterio de aceptación.** Un intento de `UPDATE` o `DELETE` sobre la tabla de auditoría
con las credenciales de la aplicación es rechazado por el motor de base de datos.
**Verificado por:** CP-INT-04, CP-FUN-08.
**Fundamento:** ISO/IEC 27001 A.8.15; Ley 21.663 (trazabilidad de incidentes);
Ley 19.628/21.719 (acreditación del tratamiento).

---

## 5. Requisitos no funcionales de calidad

### NFR-CAL-1 · Cobertura de pruebas como puerta de calidad

**Enunciado.** La cobertura de pruebas automatizadas debe alcanzar un mínimo de **80 % de
líneas** y **70 % de ramas**, y el incumplimiento debe **detener la construcción**.

**Origen.** El ERS menciona "test básicos y cobertura de endpoints críticos" (§3.1.2) sin
definir un umbral medible. Un criterio sin número no es verificable.

**Especificación.**
- Umbrales: líneas ≥ 80 %, sentencias ≥ 80 %, funciones ≥ 80 %, ramas ≥ 70 %.
- Se **excluyen** de la medición el punto de arranque y los adaptadores que requieren
  infraestructura externa, cuya verificación corresponde a las pruebas de integración.
- La medición es una **puerta**: por debajo del umbral, la construcción falla.
- Se declara explícitamente que **100 % de cobertura no equivale a 100 % de calidad**: la
  cobertura mide qué líneas se ejecutaron, no la fuerza de las aserciones.

**Criterio de aceptación.** La construcción falla si la cobertura baja del umbral.
**Verificado por:** CP-CAL-01.
**Fundamento:** ISO/IEC 25010 (mantenibilidad, capacidad de ser probado); ISO/IEC 29119.

---

### NFR-CAL-2 · Fuerza de las pruebas verificada por pruebas de mutación

**Enunciado.** La fuerza de la batería de pruebas debe medirse con pruebas de mutación,
con un puntaje mínimo del **60 %** sobre la capa de casos de uso.

**Origen.** Complementa NFR-CAL-1. La cobertura indica qué líneas se ejecutaron, pero no si
las aserciones **detectarían un cambio** en la lógica. Una prueba que ejecuta una línea sin
verificar su resultado aporta cobertura y no aporta garantía.

**Especificación.**
- Las pruebas de mutación introducen cambios en el código y verifican que alguna prueba
  falle. Un mutante que **sobrevive** revela una aserción débil.
- Alcance inicial: la capa de casos de uso, donde reside la lógica de negocio.
- Umbral mínimo: **60 %** de mutantes detectados.
- Se ejecuta de forma periódica y no en cada cambio, por su costo computacional.

**Criterio de aceptación.** El informe de mutación reporta un puntaje ≥ 60 % en la capa de
casos de uso.
**Verificado por:** CP-CAL-01 (ampliado).
**Fundamento:** ISO/IEC 29119; ISO/IEC 25010 (capacidad de ser probado).

> **Nota de alcance.** La herramienta está declarada en el proyecto pero **no se ejecutó**
> en este ciclo. Se documenta como requisito con su umbral, y la ejecución queda pendiente.

---

### NFR-CAL-3 · Quality Gate de análisis estático

**Enunciado.** El análisis estático no debe reportar vulnerabilidades ni *bugs* de severidad
bloqueante o crítica, ni *security hotspots* sin revisar, y la duplicación de código no debe
exceder el 3 %.

**Origen.** El ERS no establece criterios de calidad del código. Sin un umbral declarado, la
deuda técnica crece sin que nadie pueda afirmar que se superó un límite.

**Especificación.**
- 0 vulnerabilidades y 0 *bugs* de severidad Blocker o Critical.
- 0 *security hotspots* sin revisar.
- Duplicación ≤ 3 % en el código nuevo.
- Cobertura del código nuevo ≥ 80 % (coherente con NFR-CAL-1).
- Los **falsos positivos** se documentan con su justificación en el propio código y se
  desactivan de forma **local**, nunca global.

**Criterio de aceptación.** El Quality Gate se aprueba. Cada regla desactivada tiene una
justificación escrita y pruebas que verifican el control que mitiga el riesgo real.
**Verificado por:** CP-SAST-01.
**Fundamento:** ISO/IEC 25010 (mantenibilidad); OWASP ASVS.

---

### NFR-CAL-4 · Cero vulnerabilidades conocidas en dependencias de producción

**Enunciado.** Las dependencias que se despliegan no deben presentar **ninguna**
vulnerabilidad conocida, de cualquier severidad. Las dependencias de desarrollo no deben
presentar vulnerabilidades de severidad alta o crítica.

**Origen.** El ERS enumera las dependencias principales del sistema (§4) pero no establece
ningún criterio sobre su seguridad. El 85 % del código que se despliega proviene de
terceros.

**Especificación.**
- **Producción:** umbral estricto, cualquier severidad bloquea. Ese código ejecuta en el
  servidor con los privilegios de la aplicación.
- **Desarrollo:** umbral alto/crítico. No se despliega, pero ejecuta en el pipeline.
- El análisis usa **dos fuentes** (`npm audit` y Snyk), porque sus bases de avisos no
  coinciden.
- Toda excepción se documenta con su fundamento, su mitigación y una fecha de revisión.
- Antes de actualizar una dependencia vulnerable se evalúa **eliminarla**: una línea de
  código propio suele ser preferible a un árbol de dependencias permanente.

**Criterio de aceptación.** `npm audit --omit=dev` reporta 0 vulnerabilidades.
**Verificado por:** CP-SCA-01.
**Fundamento:** OWASP A06; ISO/IEC 27001 A.8.8; Ley 21.663 (gestión de riesgos conocidos).

---

### NFR-CAL-5 · Formato y convenciones automatizadas

**Enunciado.** El formato del código y sus convenciones deben verificarse de forma
automática, y la complejidad de cada función debe mantenerse acotada.

**Origen.** El ERS no menciona estándares de codificación. Sin automatización, la discusión
de estilo consume el tiempo de revisión que debería dedicarse a la lógica.

**Especificación.**
- Formato aplicado por herramienta, verificado en el pipeline.
- Complejidad ciclomática ≤ 12 por función; profundidad de anidamiento ≤ 4.
- Prohibición de comparaciones no estrictas, de `var` y de escritura directa a consola
  (la salida va por el registrador estructurado).
- Las advertencias de complejidad se resuelven refactorizando, no elevando el umbral.

**Criterio de aceptación.** La verificación de formato y de convenciones no reporta
desviaciones.
**Verificado por:** CP-SAST-01, CP-CAL-02.
**Fundamento:** ISO/IEC 25010 (mantenibilidad, analizabilidad y modificabilidad).

---

## 6. Requisitos de disponibilidad y observabilidad

### NFR-DIS-3 · Healthcheck y observabilidad

**Enunciado.** El sistema debe exponer un endpoint de estado, no autenticado y exento de la
limitación de peticiones, que informe su estado operativo, su versión y el instante de la
consulta.

**Origen.** El ERS fija un objetivo de disponibilidad del 99,5 % mensual (NFR-DIS-1) pero
**no especifica cómo se mide**. Un objetivo sin instrumento de medición no es verificable.

**Especificación.**
- `GET /api/v1/salud` responde HTTP 200 con `estado`, `version` e `instante`.
- No requiere autenticación y **no consume** la cuota del limitador de peticiones.
- El contenedor declara su propio `HEALTHCHECK`, de modo que el orquestador conozca el
  estado real del servicio y no solo que el proceso existe.
- Los registros son **estructurados** (JSON) con instante en formato ISO, para que sean
  correlacionables con las entradas de auditoría.

**Criterio de aceptación.** El endpoint responde correctamente bajo la carga de NFR-PERF-3
sin devolver HTTP 429.
**Verificado por:** CP-DIS-01, CP-PERF-03.
**Fundamento:** NFR-DIS-1; ISO/IEC 25010 (fiabilidad).

---

### NFR-DIS-4 · Apagado ordenado y migraciones idempotentes

**Enunciado.** El servicio debe atender la señal de terminación cerrando ordenadamente, y
las migraciones de esquema deben ser idempotentes y reversibles.

**Origen.** El ERS exige "actualizaciones con ventana de mantenimiento y migración de datos
segura" (NFR-DIS-2) sin especificar qué garantiza esa seguridad.

**Especificación.**
- Ante `SIGTERM`, el servicio deja de aceptar conexiones nuevas, **termina las peticiones en
  curso**, cierra el pool de base de datos y finaliza. Con un tiempo máximo tras el cual se
  fuerza la salida.
- El esquema se aplica de forma **idempotente**: ejecutarlo dos veces produce el mismo
  resultado y no falla.
- Toda migración define su procedimiento de reversión antes de aplicarse.
- Se verifica la integridad de los datos antes y después de cada migración.

**Criterio de aceptación.** El esquema aplicado dos veces consecutivas no produce errores ni
duplica datos. Un `SIGTERM` durante una petición no la interrumpe.
**Verificado por:** CP-DIS-01.
**Fundamento:** NFR-DIS-2; ISO/IEC 25010 (fiabilidad, recuperabilidad).

---

## 7. Requisitos de usabilidad y accesibilidad

### NFR-USAB-5 · Conformidad verificable con WCAG 2.1 nivel AA

**Enunciado.** La interfaz debe cumplir el nivel **AA** de WCAG 2.1 en los criterios
aplicables, con umbrales verificables.

**Origen.** El ERS exige "contraste suficiente", "etiquetas ARIA en formularios" y
"elementos de UI con tamaño mínimo" (§3.1.1), pero **no cuantifica ninguno** de los tres.
"Suficiente" no es verificable. La falta de umbral produjo el incidente **INC-07**.

**Especificación.**

| Criterio WCAG | Umbral exigido |
|---|---|
| 1.4.3 Contraste mínimo | ≥ 4,5:1 para texto normal; ≥ 3:1 para texto grande |
| 1.4.11 Contraste de componentes | ≥ 3:1 para bordes de controles e iconos informativos |
| 2.5.5 Tamaño del objetivo | ≥ 48 × 48 px en los controles interactivos |
| 2.4.7 Foco visible | Indicador de foco visible en todo elemento enfocable |
| 4.1.3 Mensajes de estado | Anunciados mediante `role="alert"`/`role="status"` y `aria-live` |
| 1.4.1 Uso del color | La información nunca se transmite solo por color |
| 2.1.1 Teclado | Todo flujo completable únicamente con teclado |
| 2.4.1 Saltar bloques | Enlace de salto al contenido principal |

Dado que el ERS identifica a los **adultos mayores** como población objetivo, el tamaño
base del cuerpo de texto es de **17 px** y no el mínimo de 12 px que el ERS menciona:
12 px es legible pero incómodo para esa población.

**Criterio de aceptación.** La verificación de contraste no reporta ningún par por debajo
de su umbral; los mensajes de estado llevan `role` y `aria-live`; el flujo principal se
completa solo con teclado.
**Verificado por:** CP-USA-01.
**Fundamento:** **Ley 20.422** (igualdad de oportunidades e inclusión); WCAG 2.1 AA;
NFR-USAB-1, NFR-USAB-3.

---

### NFR-USAB-6 · Mensajes de error accionables

**Enunciado.** Todo mensaje de error debe indicar **qué ocurrió** y **qué hacer**, enumerar
todas las reglas incumplidas y no exponer detalle técnico interno.

**Origen.** El ERS exige "mensajes de errores amigables" (NFR-USAB-3) sin definir qué los
hace amigables. Un mensaje amable que no dice cómo corregir el problema no es útil.

**Especificación.**
- El mensaje identifica el problema en lenguaje natural y, cuando aplica, el campo afectado.
- Ante varias reglas incumplidas se enumeran **todas**, para que el usuario no deba
  reintentar una vez por regla.
- **No se expone** el *stack trace*, el detalle del motor de base de datos ni la versión
  del framework: esa información facilita la explotación (OWASP A05) y no ayuda al usuario.
  El detalle completo va al registro del servidor.
- Los errores se marcan con `aria-invalid` en el campo y se anuncian al lector de pantalla.

**Criterio de aceptación.** Una contraseña que incumple cuatro reglas devuelve las cuatro en
una sola respuesta. Ningún mensaje al cliente contiene detalle técnico interno.
**Verificado por:** CP-FUN-09, CP-USA-01.
**Fundamento:** NFR-USAB-3; OWASP A05; WCAG 2.1 §3.3.1 y §3.3.3.

---

## 8. Requisito de trazabilidad

### NFR-TRAZ-1 · Trazabilidad requisito → caso → evidencia → cambio

**Enunciado.** Debe existir trazabilidad bidireccional y verificable entre cada requisito,
el caso de prueba que lo verifica, la evidencia de su ejecución y el cambio de código que lo
implementa.

**Origen.** El ERS no establece requisitos de trazabilidad. Sin ella no es posible responder
a la pregunta que formula cualquier auditoría: *¿cómo sabe usted que este requisito se
cumple?*

**Especificación.**
- Cada requisito tiene **al menos un caso de prueba** que lo verifica, registrado en una
  matriz bidireccional.
- Cada caso de prueba referencia los requisitos que cubre; **no existen casos huérfanos**.
- Cada ejecución produce evidencia con su caso, requisito, fecha, ejecutor y el comando que
  la generó.
- La evidencia es **reproducible** mediante scripts versionados: una evidencia que solo su
  autor puede producir es testimonio, no prueba.
- Los casos automatizados nombran en su descripción el caso y el requisito que verifican, de
  modo que la salida de la batería sea legible como informe de cumplimiento.

**Criterio de aceptación.** La matriz de trazabilidad demuestra cobertura del 100 % en ambos
sentidos. Toda la evidencia se regenera ejecutando los scripts del repositorio.
**Verificado por:** CP-CAL-02 y la matriz de la sección 4.2 del informe.
**Fundamento:** ISO/IEC 29119 (documentación de pruebas); Ley 21.663 (acreditación de
controles); Ley 19.628/21.719 (acreditación del tratamiento).

---

## 9. Resumen de trazabilidad de los requisitos propuestos

| Requisito | Origen | Incidente relacionado | Caso que lo verifica | Estado |
|---|---|---|---|---|
| RF-1.3 Bloqueo por intentos fallidos | Vacío del ERS | — | CP-FUN-02 | Implementado y verificado |
| RF-1.4 Política de contraseñas en servidor | Restricción no especificada | — | CP-FUN-09 | Implementado y verificado |
| RF-5.2 Exportación de auditoría | Vacío del ERS | — | CP-INT-04 | Implementado y verificado |
| RF-6.1 Registro de consentimiento | Vacío normativo | — | — | **Propuesto, no implementado** |
| RN-01 Unicidad del RUT | Vacío del ERS | **INC-01** | CP-INT-05, CP-FUN-05 | Implementado y verificado |
| RN-02 Acceso del paciente a lo propio | Ambigüedad de RB-1 | — | CP-SEG-02 | Implementado y verificado |
| NFR-SEG-10 Cabeceras de seguridad | Vacío del ERS | **INC-06** | CP-SEG-06, CP-SEG-08 | Implementado y verificado |
| NFR-SEG-11 Limitación dimensionada | Vacío del ERS | **INC-14** | CP-PERF-03, CP-FUN-02 | Implementado y verificado |
| NFR-SEG-12 Validación de documentos | Vacío del ERS | **INC-12** | CP-SEG-07 | Implementado y verificado |
| NFR-SEG-13 Gestión de secretos | Vacío del ERS | **INC-10** | CP-CAL-02, CP-SEG-04 | Implementado y verificado |
| NFR-SEG-14 Puertas en CI | Vacío del ERS | — | CP-CAL-02 | Implementado |
| NFR-SEG-15 Minimización en logs | NFR-SEG-6 sin especificar | **INC-05** | CP-SEG-05 | Implementado y verificado |
| NFR-SEG-16 Inmutabilidad de auditoría | Vacío del ERS | **INC-09** | CP-INT-04, CP-FUN-08 | Implementado y verificado |
| NFR-CAL-1 Cobertura como puerta | §3.1.2 sin umbral | — | CP-CAL-01 | Implementado y verificado |
| NFR-CAL-2 Pruebas de mutación | Complementa NFR-CAL-1 | — | CP-CAL-01 | **Propuesto, no ejecutado** |
| NFR-CAL-3 Quality Gate de SAST | Vacío del ERS | **INC-02, INC-04** | CP-SAST-01 | Implementado (Sonar pendiente de ejecución) |
| NFR-CAL-4 Cero CVE en producción | Vacío del ERS | **INC-08** | CP-SCA-01 | Implementado y verificado |
| NFR-CAL-5 Formato y convenciones | Vacío del ERS | — | CP-SAST-01, CP-CAL-02 | Implementado y verificado |
| NFR-DIS-3 Healthcheck | NFR-DIS-1 sin instrumento | **INC-14** | CP-DIS-01, CP-PERF-03 | Implementado y verificado |
| NFR-DIS-4 Apagado y migraciones | NFR-DIS-2 sin especificar | — | CP-DIS-01 | Implementado y verificado |
| NFR-USAB-5 WCAG 2.1 AA verificable | §3.1.1 sin umbrales | **INC-07** | CP-USA-01 | Implementado y verificado |
| NFR-USAB-6 Mensajes accionables | NFR-USAB-3 sin especificar | — | CP-FUN-09, CP-USA-01 | Implementado y verificado |
| NFR-TRAZ-1 Trazabilidad | Vacío del ERS | — | CP-CAL-02, matriz §4.2 | Implementado y verificado |

**Resultado:** de los 23 requisitos propuestos, **21 se implementaron** en la versión 1.1 y
**20 se verificaron con evidencia**. Los dos no implementados (RF-6.1 consentimiento y
NFR-CAL-2 pruebas de mutación) se documentan con su fundamento y su limitación de alcance,
en lugar de omitirse.

**Nueve de los catorce incidentes** detectados en la EP02 tienen su origen directo en un
vacío de especificación del ERS: INC-01, INC-05, INC-06, INC-07, INC-08, INC-09, INC-10,
INC-12 e INC-14. Esa relación es el argumento central de este anexo: **un requisito que no
está especificado no se implementa, no se prueba y termina siendo un incidente.**

---

ISY1102 · Sección 003V · Caso B: Cuidarte+ · Anexo a la ERS v1.1
Eder Valdivia · Marcelo Morales · 12 de octubre de 2026

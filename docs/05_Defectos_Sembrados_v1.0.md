# Defectos de la versión auditada (v1.0) — mapa completo

**Caso B: Cuidarte+ · ISY1102 · Evaluación Parcial N.º 2**

---

## 1. Por qué existe este documento

La EP02 exige **detectar, clasificar y explicar** defectos con evidencia. Para que esa
evidencia sea reproducible y comparable, la versión auditada (v1.0) se **genera** a partir
de la versión corregida (v1.1) aplicando un conjunto de defectos conocidos, mediante el
script `codigo/sembrar-defectos.py`.

Esa decisión tiene tres consecuencias que ninguna otra forma de trabajo ofrece:

1. **Cada defecto tiene una ubicación exacta.** No se dice "hay un problema de seguridad":
   se dice qué línea de qué archivo, y por qué esa línea produce ese problema.
2. **Las pruebas son idénticas en ambas versiones.** El script no toca `api/tests/`. Por eso
   los 19 casos fallidos de la v1.0 son comparables **uno a uno** con los 34 aprobados de la
   v1.1. Si las pruebas difirieran, la comparación sería entre dos cosas distintas.
3. **Cualquiera puede regenerar la v1.0** y obtener los mismos hallazgos, lo que convierte
   las afirmaciones del informe en verificables.

Los defectos **no son arbitrarios**. Cada uno corresponde a un patrón documentado en el
OWASP Top 10, a un incumplimiento de la Ley 19.628/21.719, la Ley 21.663 o la Ley 20.422, o
a una desviación de un criterio de aceptación del propio ERS.

> ⚠️ **Advertencia.** La v1.0 es material de laboratorio: es deliberadamente vulnerable.
> Ejecútela solo en el ambiente QA local y no la exponga a una red pública.

---

## 2. Resumen

| Defecto | Incidente | Criticidad | Caso que lo detecta | Norma incumplida |
|---|---|---|---|---|
| Escalada de privilegios en el autorregistro | INC-11 | **CRÍTICO** | CP-FUN-04, CP-SEG-03 | OWASP A01 · RF-2.1 · RB-2 |
| Control de acceso solo en la interfaz | INC-13 | **CRÍTICO** | CP-SEG-01 | OWASP A01 · NFR-SEG-4 · RB-1 |
| Inyección SQL en el filtro de auditoría | INC-02 | **CRÍTICO** | CP-SEG-03 | OWASP A03 · NFR-SEG-5 · Ley 21.663 |
| XSS almacenado por renderizado sin escape | INC-04 | **CRÍTICO** | CP-SAST-01, CP-SEG-03 | OWASP A03 · NFR-SEG-5 |
| Sesión no revocable y secreto por defecto | INC-10 | **CRÍTICO** | CP-FUN-03 | OWASP A02/A07 · RF-1.2 · NFR-SEG-13 |
| Unicidad de RUT ausente | INC-01 | **GRAVE** | CP-INT-05, CP-FUN-05/06 | ISO 25010 · Ley 19.628 art. 6 y 9 |
| Factor de costo de bcrypt insuficiente | INC-03 | **GRAVE** | CP-SEG-04 | ISO 27001 A.8.24 · NFR-SEG-2 |
| Datos sensibles en los registros | INC-05 | **GRAVE** | CP-SEG-05 | NFR-SEG-6 · Ley 19.628/21.719 |
| Cabeceras de seguridad ausentes y CORS abierto | INC-06 | **GRAVE** | CP-SEG-06 | OWASP A05 · NFR-SEG-10 |
| Dependencia con vulnerabilidad conocida | INC-08 | **GRAVE** | CP-SCA-01 | OWASP A06 · ISO 27001 A.8.8 |
| Eliminación física en vez de lógica | INC-09 | **GRAVE** | CP-FUN-08, CP-INT-04 | RF-3.3 · ISO 27001 A.8.15 |
| Documentos validados solo por el tipo declarado | INC-12 | **GRAVE** | CP-SEG-07 | OWASP A04/A08 · NFR-SEG-12 |
| Contraste insuficiente y mensajes no anunciados | INC-07 | **MODERADO** | CP-USA-01 | WCAG 1.4.3 / 4.1.3 · Ley 20.422 |

| Límite de peticiones sin dimensionar | INC-14 | **MODERADO** | CP-PERF-01/02/03 | NFR-PERF-3 · NFR-DIS-1 · ISO 25010 |

**14 defectos** → 5 críticos, 7 graves, 2 moderados.

> **INC-14 tiene un origen distinto a los demás.** Los trece primeros se sembraron para que
> QA los encontrara. INC-14 **no**: era un defecto real del diseño inicial del software, que
> apareció al ejecutar la prueba de carga de la EP02. Se incorporó después al script para que
> la versión auditada lo reproduzca y la evidencia sea regenerable.
>
> Se destaca la diferencia porque el mérito no es el mismo: los trece primeros demuestran que
> el plan de pruebas **detecta** defectos conocidos; INC-14 demuestra que **encuentra** los
> que nadie puso ahí. Y es el único que ninguna prueba funcional podía revelar, porque solo
> se manifiesta con 200 usuarios simultáneos.

---

## 3. Detalle de cada defecto

### INC-11 · Escalada de privilegios en el autorregistro — CRÍTICO

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/entrypoints/rest/schema/esquemas.js` | `esquemaRegistro` deja de ser `.strict()` y declara un campo `rol` opcional |
| `api/src/application/usecase/AuthUseCase.js` | `registrar()` recibe `rol` del cuerpo y lo usa: `rol: rol ?? ROL_POR_DEFECTO` |

**Por qué ocurre.** El esquema permisivo deja pasar campos no declarados hasta el dominio, y
el caso de uso confía en el valor recibido en lugar de forzarlo. Son dos decisiones
independientes que, combinadas, producen el defecto: cualquiera de las dos por separado lo
habría impedido.

**Impacto.** Un **visitante anónimo**, sin credenciales previas, se registra con rol `ADMIN`
y obtiene acceso completo a los datos clínicos de todos los pacientes, a la administración de
usuarios y al registro de auditoría. Es el defecto de mayor impacto del conjunto, y el único
explotable sin ningún acceso previo.

**Evidencia observada.** `POST /auth/registro` con `{"rol":"ADMIN"}` → **HTTP 201**
(anexo 2.3 de la v1.0).

**Corrección en la v1.1.** El esquema vuelve a ser `.strict()`, de modo que un campo no
declarado produce HTTP 400, y el caso de uso **fuerza** `rol: ROL_POR_DEFECTO` sin recibirlo
como parámetro. Verificado: → **HTTP 400**.

---

### INC-13 · Control de acceso solo en la interfaz — CRÍTICO

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/entrypoints/rest/routes/examenes.routes.js` | `exigirRol(ADMIN, MEDICO)` se reemplaza por un middleware que solo invoca `next()` |
| `api/src/application/usecase/ExamenUseCase.js` | `#exigirEscritura()` deja de verificar el rol y solo comprueba que exista un actor |

**Por qué ocurre.** Se eliminó la verificación en **ambas** capas. La única barrera que
queda es que la SPA oculta los botones de escritura para el rol paciente, lo cual es una
decisión de presentación y no un control de seguridad.

**Impacto.** Un paciente —o cualquiera con un token de paciente— **crea, modifica y elimina**
exámenes médicos enviando peticiones directamente a la API. Se rompe la regla RB-1 y, más
grave, se destruye la integridad del historial clínico: un examen alterado puede derivar en
una decisión médica equivocada.

**Evidencia observada.** Con token de paciente: `POST /examenes` → **201**, `PUT` → **200**,
`DELETE` → **200**, donde se esperaba **403** en los tres casos (anexo 2.1). El escenario BDD
«Un paciente no puede registrar un examen» también falla.

**Corrección en la v1.1.** Se restituye `exigirRol` en el router **y** la verificación en el
caso de uso. Es **defensa en profundidad deliberada**: el router protege el punto de entrada
HTTP y el caso de uso protege la regla de negocio, de modo que si mañana se agrega otro punto
de entrada la regla siga vigente. Verificado: → **403** en los tres casos.

**Rastro que dejó el defecto.** ESLint reportó `exigirRol`, `ROLES` y `#puedeEscribir` como
declarados y no usados. El linter no sabe que se eliminó un control de seguridad, pero el
código muerto es el síntoma que conduce a la causa.

---

### INC-02 · Inyección SQL en el filtro de auditoría — CRÍTICO

**Archivo modificado**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/adapters/postgres/gatewaysPostgres.js` | En `AuditoriaGatewayPg.listar()`, la condición pasa de `accion = $N` con parámetro posicional a `accion = '${filtro.accion}'` concatenado |

**Por qué ocurre.** El valor recibido del cliente se incorpora al **texto** de la consulta,
de modo que el motor lo interpreta como SQL y no como dato.

**Impacto.** Permite leer o alterar cualquier información de la base, incluidos los datos
clínicos. Lo que lo agrava es **dónde** está: en la consulta de auditoría. Un atacante podría
borrar la evidencia de su propio acceso, lo que inutiliza el control que exige RF-5.1.

**Evidencia observada.** El filtro legítimo `accion=LOGIN` devolvió **3 registros**; el
payload `accion=LOGIN' OR '1'='1` devolvió **9** (anexo 2.8). La diferencia demuestra que la
condición inyectada se evaluó como SQL.

**Valor didáctico de este defecto.** Es el que mejor ilustra por qué un plan de pruebas
necesita varias técnicas:

- Las **pruebas automatizadas no podían detectarlo**: corren contra el adaptador en memoria,
  que no interpreta SQL. Los 132 casos pasan sobre este defecto sin verlo.
- El **análisis estático con ESLint no lo detectó**: `eslint-plugin-security` no reconoce una
  plantilla de cadena dentro de una consulta `pg` como vector de inyección.
- Lo encontró la **revisión manual del código** y lo confirmó la **prueba dinámica** contra
  PostgreSQL real.
- **SonarQube sí tiene una regla** para este patrón, lo que justifica mantener dos
  herramientas SAST.

**Corrección en la v1.1.** Todas las condiciones usan parámetros posicionales. El texto del
SQL se construye en el servidor y solo los **valores** viajan como parámetros, de modo que la
clase completa de vulnerabilidad desaparece, no solo este payload. Verificado: el mismo
payload devuelve **0 registros**.

---

### INC-04 · XSS almacenado por renderizado sin escape — CRÍTICO

**Archivo modificado**

| Archivo | Cambio |
|---|---|
| `web/src/componentes/Examenes.jsx` | La descripción del examen pasa de interpolarse como texto a renderizarse con `dangerouslySetInnerHTML` |

**Por qué ocurre.** React escapa todo el contenido interpolado por defecto. Ese atributo es
la **única** forma de perder esa protección, y se usó para permitir formato enriquecido en un
campo de texto libre sin sanear la salida.

**Impacto.** Cualquiera que pueda escribir una descripción de examen inyecta un script que se
ejecuta en el navegador de **todo** médico o paciente que consulte esa ficha. Con el token en
`sessionStorage`, el script puede exfiltrar la sesión y con ella el acceso a toda la
información clínica que esa sesión alcance.

**Evidencia observada.** ESLint reporta el error directamente, con la línea y el motivo:

```
web/src/componentes/Examenes.jsx
  199:13  error  Prohibido: dangerouslySetInnerHTML desactiva el escape de React
                 y abre un vector de XSS (NFR-SEG-5). Renderice texto plano
```

**Corrección en la v1.1.** Se elimina el atributo y el texto se interpola normalmente. Pero
la corrección no se detiene ahí: la **regla de ESLint que prohíbe el atributo queda activa
como error**, de modo que reintroducir el patrón rompe la construcción. Corregir la línea
resuelve el caso; la regla resuelve la clase.

---

### INC-10 · Sesión no revocable y secreto por defecto — CRÍTICO

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/security/token.js` | `secretoDeAcceso()` devuelve una constante literal si falta `JWT_SECRET`, y se elimina la validación de longitud mínima |
| `api/src/application/usecase/AuthUseCase.js` | `logout()` ya no invoca `sesiones.revocar(jti, expiraEn)` |

**Por qué ocurre.** Dos problemas de distinta naturaleza en el mismo incidente. Un JWT es
autocontenido: sin lista de revocación sigue siendo válido hasta expirar, por lo que el
"cierre de sesión" se limita a descartar el token en el navegador. Y un secreto con valor por
defecto escrito en el código es un secreto público.

**Impacto.** El logout inefectivo incumple el criterio de aceptación de RF-1.2 y deja
ventanas de acceso tras el cierre de sesión. El secreto por defecto es más grave: permite
**firmar** tokens válidos y suplantar a cualquier usuario, incluido un administrador, sin
necesidad de robar ninguna credencial.

**Evidencia observada.** Tras `POST /auth/logout`, el mismo token en `GET /auth/yo` devolvió
**HTTP 200** donde se esperaba **401** (anexo 2.4). El token no había expirado y seguía siendo
criptográficamente válido, de modo que el resultado mide exclusivamente la efectividad de la
revocación.

**Corrección en la v1.1.** El logout registra el `jti` del token en la lista de revocación y
el middleware de autenticación la consulta en cada petición. El secreto se lee solo del
entorno y, si falta o tiene menos de 32 caracteres, **el servicio no arranca**: es preferible
no arrancar que arrancar con un secreto conocido. Verificado: tras el logout → **401**.

**Rastro que dejó el defecto.** ESLint reportó el parámetro `expiraEn` como recibido y no
usado: la firma de la función seguía anunciando una capacidad que el cuerpo ya no ejercía.

---

### INC-01 · Unicidad de RUT ausente — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/domain/model/Paciente.js` | `normalizarRut()` deja de normalizar y de validar el dígito verificador; solo recorta espacios y pasa a mayúsculas |
| `api/src/infrastructure/adapters/postgres/schema.sql` | El índice `paciente_rut_uk` **UNIQUE** se degrada a índice normal |
| `api/src/infrastructure/adapters/postgres/schema.sql` | El `CHECK` de formato del RUT se relaja a una comprobación de longitud |

**Por qué ocurre.** El RUT se guarda tal como lo escribió el usuario, por lo que
`12.345.678-5` y `12345678-5` son cadenas distintas y la búsqueda de duplicados no los
relaciona. Y al eliminar el índice único, la base de datos tampoco frena el duplicado: se
pierden las dos capas de defensa simultáneamente.

**Impacto.** El historial clínico de una persona queda **fragmentado entre dos fichas**. Un
médico que consulte una de ellas verá antecedentes incompletos y tomará decisiones con
información parcial. La Ley 19.628 obliga a que los datos personales sean exactos; dos fichas
para una persona incumplen ese principio.

**Evidencia observada.** `POST /pacientes` con `12345678-5` → **409** (correcto, coincidencia
textual); con `12.345.678-5` → **201** (anexo 2.5). Es el mismo RUT.

**Efecto colateral observado durante la ejecución.** Al recargar los datos de prueba sobre un
volumen existente, la ausencia del índice único permitió insertar cinco pacientes duplicados,
y una consulta posterior falló con *"more than one row returned by a subquery used as an
expression"*. Un defecto de integridad rompió un proceso que nadie había relacionado con él.
Se documenta porque ilustra cómo este tipo de defecto se propaga.

**Corrección en la v1.1.** El dominio normaliza el RUT a su forma canónica y valida el dígito
verificador por módulo 11 **antes** de persistir; la base recupera el índice único acotado a
los registros vigentes; y la violación de unicidad se traduce a **HTTP 409** en lugar de un
HTTP 500 opaco. Verificado: ambos formatos → **409**.

---

### INC-03 · Factor de costo de bcrypt insuficiente — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/security/password.js` | `COSTO_BCRYPT` por defecto pasa de 12 a **8** y se elimina la verificación que impedía arrancar con un valor inseguro |
| `api/.env.example` y `.env.example` | `BCRYPT_COST=8` |
| `api/src/infrastructure/adapters/postgres/seed.sql` | Los hashes de los usuarios de prueba se regeneran con factor 8, para que el defecto sea observable en la base |

**Por qué ocurre.** El factor se redujo para acelerar el inicio de sesión. La decisión parece
razonable desde el rendimiento y es inaceptable desde la seguridad: cada punto menos
**duplica** la velocidad de un ataque de fuerza bruta offline. De 12 a 8, el ataque es unas
**16 veces más rápido**.

**Impacto.** Un volcado de la tabla de usuarios se convierte en una lista de contraseñas
recuperables en tiempo razonable. Cumplir formalmente con "usar bcrypt" (NFR-SEG-2) no
equivale a cumplir el requisito si el parámetro lo hace insuficiente.

**Evidencia observada.** La consulta a la base muestra el prefijo **`$2b$08$`** en los cinco
usuarios (anexo 2.4).

**Lo que este defecto reveló sobre el propio plan de pruebas.** La prueba unitaria que verifica
el factor de costo **aprueba en ambas versiones**, porque fija `BCRYPT_COST=12` en el entorno
de prueba. El defecto se encontró inspeccionando la base de datos, no ejecutando la batería.
Es una debilidad del diseño de la prueba —una prueba que fija la configuración no puede
verificar que la configuración por defecto sea segura— y se documenta como tal en §8.1 del
informe.

**Corrección en la v1.1.** El factor vuelve a **12**, mínimo de la guía de almacenamiento de
contraseñas de OWASP, y se restituye la verificación que **impide el arranque** con un valor
inferior. Verificado: todos los hashes muestran `$2b$12$`.

---

### INC-05 · Datos sensibles en los registros — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/config/logger.js` | Se elimina la configuración `redact`, que enmascaraba `password`, `token`, `authorization` y `cookie` |
| `api/src/infrastructure/entrypoints/rest/middleware/validacion.js` | Se agrega una traza de depuración que registra el cuerpo completo de cada petición |

**Por qué ocurre.** Los dos cambios juntos producen el incidente. La traza por sí sola no
habría filtrado nada, porque `redact` habría enmascarado el campo; y `redact` ausente sin una
traza que registre el cuerpo tampoco habría filtrado. Es un ejemplo de defecto que surge de la
**combinación** de dos cambios individualmente inocuos.

Esta es, además, la forma en que el problema aparece en la práctica: alguien agrega un log para
depurar un rechazo de validación y no lo retira.

**Impacto.** La contraseña queda escrita en claro en los registros del servicio. Los logs se
copian, se exportan a sistemas de observabilidad y los consulta personal de operaciones sin
relación con el tratamiento de datos clínicos. Una credencial escrita en el log se propaga
mucho más allá del servidor, hacia destinos que nadie evaluó al autorizar el tratamiento.

**Evidencia observada.** Tras enviar un intento de acceso con la contraseña sonda
`SondaDeAuditoria2026!`, el registro contiene (anexo 3.5):

```json
{"level":30,"ruta":"/api/v1/auth/login",
 "body":{"nombreUsuario":"medico1","password":"SondaDeAuditoria2026!"},
 "msg":"Peticion recibida"}
```

**Corrección en la v1.1.** Se retira la traza y se restituye `redact`. El serializador registra
método, URL, IP y código de respuesta, pero **no el cuerpo**: en este sistema el cuerpo contiene
datos clínicos, y conservarlos en un log es tratarlos sin finalidad legítima. Verificado: la
contraseña sonda **no aparece** en ninguna línea.

---

### INC-06 · Cabeceras de seguridad ausentes y CORS abierto — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/app.js` | Se deja de aplicar `cabecerasSeguridad()` y se mantiene activa la cabecera `X-Powered-By` |
| `api/src/infrastructure/entrypoints/rest/middleware/seguridad.js` | `corsRestringido()` se reemplaza por `corsAbierto()`, que acepta cualquier origen con credenciales |

**Por qué ocurre.** La configuración permisiva de CORS se introdujo "para no bloquear a los
clientes durante el desarrollo", que es la justificación habitual de este defecto. Y las
cabeceras quedaron pendientes con un comentario de tarea por hacer.

**Impacto.** Tres consecuencias, de distinto alcance:

1. Sin `Content-Security-Policy` se pierde la **mitigación de último recurso** frente al XSS
   de INC-04. Los dos incidentes se potencian: con CSP, el script inyectado habría sido
   bloqueado por el navegador aunque llegara al DOM.
2. Sin `Strict-Transport-Security`, la exigencia de TLS de NFR-SEG-1 queda sin refuerzo en el
   navegador, que puede degradar a HTTP.
3. Con CORS abierto y credenciales, **cualquier sitio web** puede leer respuestas autenticadas
   desde el navegador de la víctima.

**Evidencia observada.** Verificación cabecera por cabecera (anexo 3.4):

```
AUSENTE   Content-Security-Policy     <-- incumple NFR-SEG-10
AUSENTE   X-Content-Type-Options      <-- incumple NFR-SEG-10
AUSENTE   X-Frame-Options             <-- incumple NFR-SEG-10
AUSENTE   Strict-Transport-Security   <-- incumple NFR-SEG-10
AUSENTE   Referrer-Policy             <-- incumple NFR-SEG-10
AUSENTE   Permissions-Policy          <-- incumple NFR-SEG-10
PRESENTE  X-Powered-By                <-- revela el framework (OWASP A05)
```

**Corrección en la v1.1.** Se aplican las seis cabeceras con valores restrictivos (CSP
`default-src 'self'`), se elimina `X-Powered-By` y la política CORS pasa a una **lista
explícita** de orígenes configurada por ambiente. Las mismas cabeceras se declaran en nginx
para los archivos estáticos, porque el escaneo pasivo de ZAP las verifica en toda respuesta y
no solo en la API. Verificado: las seis **presentes**.

---

### INC-08 · Dependencia con vulnerabilidad conocida — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/package.json` | Se agrega `"lodash": "4.17.15"` a las dependencias de producción |
| `api/src/application/usecase/AuditoriaUseCase.js` | Se importa la librería y se usa `lodash.merge`, que es la función afectada por la vulnerabilidad |
| `api/package-lock.json` | Se sincroniza para que `npm ci` pueda construir la imagen |

**Por qué se usa la dependencia y no solo se declara.** Una dependencia declarada y no
utilizada podría descartarse como falso positivo al revisar el hallazgo. Usarla —y usar
precisamente la función vulnerable— hace que el riesgo sea real y no teórico.

**Impacto.** Una dependencia vulnerable es **código ejecutándose en el servidor** con los
mismos privilegios que la aplicación, y con un aviso público que describe cómo explotarla. La
contaminación de prototipo permite alterar el comportamiento de objetos del sistema y, según
el caso, derivar en denegación de servicio o ejecución de código.

**Evidencia observada.** `npm audit --omit=dev` (anexo 3.3):

```
lodash  <=4.17.23
Severity: high
Command Injection in lodash          — GHSA-35jh-r3h4-6jhm
Prototype Pollution in lodash        — GHSA-p6mc-m468-83gw
Regular Expression Denial of Service — GHSA-29mw-wpgm-hmr9
...
1 high severity vulnerability
```

**Corrección en la v1.1.** La dependencia se **elimina** y el código que la usaba se reescribe
con las construcciones nativas del lenguaje. Antes de actualizar una dependencia vulnerable
conviene preguntarse si se necesita: una línea de código propio elimina un árbol de
dependencias y su superficie de ataque permanente. Verificado: **0 vulnerabilidades** en las
122 dependencias de producción.

---

### INC-09 · Eliminación física en vez de lógica — GRAVE

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/adapters/postgres/gatewaysPostgres.js` | `ExamenGatewayPg.eliminar()` ejecuta `DELETE FROM examen` en vez de marcar `eliminado_en` |
| `api/src/infrastructure/adapters/memory/gatewaysMemoria.js` | El adaptador en memoria también borra físicamente, para que el defecto sea visible en las pruebas automatizadas |
| `api/src/application/usecase/ExamenUseCase.js` | La respuesta deja de declarar `logica: true` |

**Por qué ocurre.** El borrado físico es la implementación más simple y, a primera vista,
funciona: el examen desaparece del listado. El criterio de aceptación de RF-3.3 exige
explícitamente eliminación **lógica**, y esa exigencia es lo que la implementación simple
ignora.

**Impacto.** Se pierde el historial clínico de forma **irreversible** y la auditoría queda
apuntando a un registro inexistente. Ante un reclamo o una fiscalización, la organización no
puede acreditar qué se eliminó ni quién lo hizo: se pierden simultáneamente el dato y la
prueba de su existencia.

**Evidencia observada.** Tras el borrado, la consulta directa a la base (anexo 2.6):

```
 id | tipo | dado_de_baja
----+------+--------------
(0 rows)
```

Si la consulta no devuelve ninguna fila, la eliminación fue física.

**Corrección en la v1.1.** La eliminación vuelve a ser lógica: marca `eliminado_en` y las
consultas de lectura excluyen los registros dados de baja mediante **índices parciales**, de
modo que la baja lógica no degrade el rendimiento. La respuesta declara `logica: true`.
Verificado: el registro se conserva con `dado_de_baja = true`.

---

### INC-12 · Documentos validados solo por el tipo declarado — GRAVE

**Archivo modificado**

| Archivo | Cambio |
|---|---|
| `api/src/application/usecase/DocumentoUseCase.js` | Se elimina la verificación `firmaCoincide(contenido, mime)` y su importación |

**Por qué ocurre.** La validación confía en el `Content-Type` que envía el cliente. Ese valor
lo elige quien hace la petición, por lo que no es un dato de confianza: declarar
`application/pdf` es gratuito.

**Impacto.** Se almacena cualquier contenido con un nombre y un tipo falsos. El archivo queda
disponible para descarga desde una aplicación clínica, que pasa a servir de **canal de
distribución** de un ejecutable malicioso hacia el equipo del médico o del paciente. El daño
reputacional y legal supera al técnico: el vector de confianza es el propio centro de salud.

**Evidencia observada.** Se intentaron subir tres archivos al mismo examen (anexo 2.7):

```
ARCHIVO                                   OBTENIDO   ESPERADO
informe-valido.pdf (PDF real)             201        201
malicioso.pdf (ejecutable disfrazado)     201        400
pagina.html (tipo no permitido)           400        400
```

El segundo caso es el relevante: el archivo tiene cabecera `MZ` —un ejecutable de Windows— y
se declaró como `application/pdf`. La lista blanca de MIME lo aceptó porque el tipo declarado
estaba en la lista; solo la verificación de la firma binaria lo habría detenido.

**Corrección en la v1.1.** Se restituye la verificación de la **firma binaria** contra el tipo
declarado, además de la lista blanca, el tope de 10 MB y el saneado del nombre. El nombre en
disco lo genera el servidor. Verificado: ejecutable disfrazado → **400**.

---

### INC-07 · Contraste insuficiente y mensajes no anunciados — MODERADO

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `web/src/estilos.css` | `--texto-suave` pasa a `#a8b2bd`; los colores de estado se aclaran a `#f08c84`, `#7fd1a0` y `#e0b964` |
| `web/src/componentes/Aviso.jsx` | El contenedor de mensajes pierde `role="alert"`/`role="status"` y `aria-live` |
| `web/src/componentes/Aviso.jsx` | `RegionViva` pierde su `aria-live` |

**Por qué ocurre.** Se eligió una paleta de tonos claros sin verificar el contraste —estética
sobre legibilidad— y se retiraron atributos ARIA que no producen ningún efecto visible, por lo
que su ausencia pasa inadvertida para quien no usa lector de pantalla.

**Impacto.** Dos consecuencias para poblaciones distintas:

1. Una persona con **baja visión** no distingue el texto de su fondo. El caso más grave es el
   mensaje de error, con 2,09:1: es justamente la información que el usuario necesita leer para
   corregir su acción.
2. Una persona **ciega** no recibe ninguna señal de que la operación falló: completa el
   formulario, lo envía, falla, y para ella el sistema simplemente no responde.

El ERS identifica expresamente a los **adultos mayores** como población objetivo (§1.2), por lo
que la accesibilidad no es un extra: es un requisito funcional del producto.

**Evidencia observada.** Verificador de contraste (anexo 5.1):

```
ELEMENTO                              FRENTE    FONDO     RATIO    MINIMO  RESULTADO
Texto secundario y pistas de campo    #a8b2bd   #ffffff   2.15:1   4.5:1   INCUMPLE
Mensaje de error                      #f08c84   #fdecea   2.09:1   4.5:1   INCUMPLE
Mensaje de exito                      #7fd1a0   #e8f5ec   1.62:1   4.5:1   INCUMPLE
Mensaje de aviso                      #e0b964   #fdf3e2   1.69:1   4.5:1   INCUMPLE

role="alert" / role="status" : AUSENTE
aria-live                    : AUSENTE
```

**Corrección en la v1.1.** La paleta se recalcula para que **todos** los pares alcancen el
mínimo: texto secundario 7,09:1, error 6,37:1, éxito 5,82:1, aviso 6,61:1 y borde 3,39:1. Los
valores quedan **anotados junto a cada token** en la hoja de estilos, de modo que quien ajuste
un color vea el umbral que debe respetar. Se restituyen `role` y `aria-live`, con `assertive`
para errores y `polite` para el resto. Verificado: **8 de 8** pares conformes.

**Nota de transparencia.** Al ejecutar este verificador sobre la versión **corregida**
detectamos que el color del borde de los campos alcanzaba 1,59:1, por debajo del 3:1 que exige
WCAG 1.4.11 para el límite visual de un componente. Era un defecto nuestro, en el código que
presentábamos como correcto. Se corrigió a `#7e8d9f` (3,39:1) y se documenta aquí porque el
mismo criterio de veracidad que aplicamos al software auditado debe aplicarse a nuestro propio
trabajo.

---

### INC-14 · Límite de peticiones sin dimensionar — MODERADO

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `api/src/infrastructure/entrypoints/rest/middleware/seguridad.js` | El límite general vuelve a `300` por minuto, sin derivarlo de `LIMITE_GENERAL_POR_DEFECTO` |
| `api/src/infrastructure/entrypoints/rest/middleware/seguridad.js` | Se elimina la exención del healthcheck (`skip`) |
| `api/.env.example` y `.env.example` | `RATE_LIMIT_GENERAL=300` |

**Por qué ocurre.** El límite se fijó en un valor que parece generoso **para una persona** y
nunca se contrastó con la concurrencia que el propio ERS exige. Es un error de razonamiento,
no de implementación: el control está bien construido y bien ubicado; lo que falta es haber
derivado su valor del requisito.

**Impacto.** En un centro de salud, los 200 usuarios salen a internet por una **misma
dirección IP pública** (NAT). Un límite de 300 por minuto repartido entre 200 usuarios les
deja 1,5 peticiones por minuto a cada uno. El resultado es que el personal clínico no accede
al historial del paciente que tiene delante.

Además, al no eximir el healthcheck, el monitoreo de disponibilidad consume la cuota de los
usuarios reales y puede acabar reportando caídas inexistentes: el control de seguridad
interfiere con el instrumento que mide NFR-DIS-1.

**Evidencia observada.** Medición con 200 usuarios concurrentes (anexo 4.1):

```
ESCENARIO                                 UMBRAL    p95       ERRORES
Listado de pacientes (vista principal)    2000 ms   430 ms    57,83 %
Examenes de un paciente (CRUD simple)     300 ms     59 ms   100,00 %
```

Las latencias cumplían los umbrales **con holgura**. Un informe que solo mirara el p95
habría declarado los tres casos aprobados. Fue la tasa de error la que reveló el defecto, y
la inspección del código de estado confirmó que los rechazos eran HTTP 429 del propio
limitador.

**Corrección en la v1.1.** El límite se **deriva del requisito** y el cálculo queda escrito
en el código:

```
NFR-PERF-3  ->  200 usuarios concurrentes
Supuesto    ->  60 peticiones/minuto por usuario en su momento de mayor actividad
Limite      =   200 x 60 = 12.000 peticiones/minuto
Con margen  =   15.000 peticiones/minuto
```

El healthcheck queda exento, y el límite estricto del endpoint de autenticación (10 cada 15
minutos) se mantiene sin cambios: ahí un límite bajo **sí** es correcto, porque frena la
fuerza bruta y una persona legítima no inicia sesión diez veces en un cuarto de hora.

Verificado: **0,00 % de errores** con 200 usuarios concurrentes, p95 de 341 ms y 221 ms.

---

## 4. Cambios de entorno que no son defectos

El script aplica dos cambios adicionales que **no son defectos**, sino ajustes necesarios para
que las dos versiones convivan:

| Cambio | Archivo | Motivo |
|---|---|---|
| Nombre del proyecto Docker: `cuidarte-plus-v11` → `cuidarte-plus-v10` | `docker-compose.yml` | Sin esta separación, ambas versiones comparten contenedores, volúmenes y etiquetas de imagen. Construir una sobrescribe la otra y la evidencia deja de corresponder al código que se cree estar auditando. Lo detectamos cuando la v1.0 arrancaba con el código de la v1.1. |
| Versión: `1.1.0` → `1.0.0` | `api/package.json`, `web/package.json`, `.env.example` | Permite verificar, consultando el healthcheck, qué versión está efectivamente desplegada. |

---

## 5. Cómo regenerar la versión auditada

```bash
cd EV2/codigo
python sembrar-defectos.py
```

El script:

1. Copia `cuidarte-plus-v1.1` a `cuidarte-plus-v1.0`, **conservando** `node_modules` y el
   `.env` existentes, de modo que se pueda regenerar sin reinstalar dependencias ni
   reconfigurar el ambiente.
2. Aplica los 14 defectos mediante sustituciones exactas. Si un ancla no se encuentra —porque
   la v1.1 cambió— el script **falla de inmediato** indicando qué buscaba, en lugar de generar
   una v1.0 incompleta en silencio.
3. **Sincroniza `package-lock.json`**, porque INC-08 agrega una dependencia y sin esa
   sincronización `npm ci` no podría construir la imagen.
4. Ajusta el nombre del proyecto Docker y los números de versión.
5. Escribe `LEEME-VERSION-1.0.md` con la advertencia de que es material de laboratorio.
6. Enumera los cambios aplicados, archivo por archivo.

**Lo que el script no toca:** `api/tests/`. Las pruebas son idénticas en ambas versiones, y eso
es lo que hace comparables sus resultados.

---

ISY1102 · Sección 003V · Caso B: Cuidarte+
Eder Valdivia · Marcelo Morales · 12 de octubre de 2026

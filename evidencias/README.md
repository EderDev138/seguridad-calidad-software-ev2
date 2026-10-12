# Evidencia de la EV2 — Cuidarte+

Esta carpeta contiene la evidencia de ejecución del plan de pruebas y los **scripts que la
generan**.

## 1. Principio: evidencia reproducible, no capturas de pantalla

Toda la evidencia de esta entrega se produce ejecutando scripts versionados. La razón es
que una captura de pantalla solo acredita que alguien vio algo en un momento dado: no se
puede volver a producir, no se puede comparar entre versiones y no se puede verificar.

Una evidencia que solo su autor puede producir es **testimonio**. Una que cualquiera puede
regenerar es **prueba**. Esa distinción es la que exige ISO/IEC 29119 cuando pide que la
documentación de pruebas constituya prueba de cumplimiento ante una auditoría.

Consecuencia práctica: si usted ejecuta estos scripts y obtiene resultados distintos a los
documentados en el informe, **eso es un hallazgo** y conviene reportarlo.

## 2. Contenido

```
evidencias/
├── README.md                  Este documento
├── capturar-evidencia.sh      Genera los 19 anexos de una versión
├── verificar-contraste.mjs    Contraste WCAG calculado desde el código fuente
├── medir-rendimiento.mjs      Latencia y tasa de error bajo carga
├── v1.0/                      19 anexos de la versión auditada
└── v1.1/                      19 anexos de la versión corregida
```

## 3. Cómo regenerar la evidencia

Requiere el ambiente QA levantado y con datos cargados (ver
`../docs/04_Paso_a_Paso_Reproducir_EV2.md`).

```bash
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.1
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.0
```

El script ejecuta en orden: análisis estático, pruebas con cobertura, escenarios BDD,
análisis de dependencias, verificación de accesibilidad, construcción de la SPA y —si la
API responde— las comprobaciones dinámicas de seguridad, auditoría, documentos, logs y
rendimiento.

Si la API no está levantada, el script **genera la evidencia estática y avisa** qué omitió,
en lugar de abortar. Así una captura parcial sigue siendo útil.

## 4. Nomenclatura de los archivos

```
Anexo_<grupo>.<orden>_<CASO>_<descripcion-breve>.txt
```

| Grupo | Contenido |
|---|---|
| **0** | Ambiente de pruebas |
| **1** | Pruebas automatizadas y calidad del proceso |
| **2** | Pruebas de seguridad dinámicas |
| **3** | Análisis estático, dependencias, cabeceras y logs |
| **4** | Rendimiento y carga |
| **5** | Usabilidad y accesibilidad |

Ejemplos:

```
Anexo_2.1_CP-SEG-01_rbac-backend.txt
Anexo_3.3_CP-SCA-01_npm-audit.txt
Anexo_5.1_CP-USA-01_contraste-y-aria.txt
```

## 5. Encabezado de cada archivo

Cada anexo comienza con el mismo bloque, que permite usarlo como evidencia aislada del
resto del informe:

```
=====================================================================
EVIDENCIA · Cuidarte+ v1.1
---------------------------------------------------------------------
Titulo      : Control de acceso por rol aplicado en el backend
Caso        : CP-SEG-01
Requisito   : NFR-SEG-4, RB-1, RB-2, RB-3
Fecha        : 2026-10-12 16:21:58 -0300
Ejecutado por: Eder Valdivia
Comando      : curl con token de cada rol
=====================================================================
```

Los seis campos responden las preguntas que formula cualquier auditoría: **qué** se verificó,
**qué caso** lo verificó, **qué requisito** acredita, **cuándo**, **quién** y **cómo
reproducirlo**.

## 6. Índice de anexos

| Anexo | Verificación | Caso | Requisito |
|---|---|---|---|
| 0.1 | Estado de los contenedores y healthcheck | Precondición | ERS §4 |
| 1.1 | Pruebas automatizadas con cobertura | CP-CAL-01 y todos los automatizados | NFR-CAL-1 |
| 1.2 | Escenarios BDD en Gherkin | CP-SEG-01, CP-INT-04 | RB-1, RB-2, RB-3 |
| 1.3 | Construcción de producción de la SPA | CP-COMPAT-01 | NFR-COMPAT-1 |
| 2.1 | Control de acceso por rol, verificado por API | CP-SEG-01 | NFR-SEG-4, RB-1 a RB-3 |
| 2.2 | Acceso a información de otro paciente (IDOR) | CP-SEG-02 | RB-1, OWASP A01 |
| 2.3 | Inyección en campos validados y escalada de privilegios | CP-SEG-03 | NFR-SEG-5 |
| 2.4 | Revocación del token y factor de costo de bcrypt | CP-FUN-03, CP-SEG-04 | RF-1.2, NFR-SEG-2 |
| 2.5 | Unicidad del RUT y restricción en la base | CP-INT-05 | RN-01, ISO 25010 |
| 2.6 | Auditoría y verificación de la eliminación lógica | CP-INT-04, CP-FUN-08 | RF-5.1, RF-3.3 |
| 2.7 | Validación de documentos clínicos | CP-SEG-07 | NFR-SEG-12, RF-4.3 |
| 2.8 | Inyección SQL en el filtro de auditoría | CP-SEG-03 | NFR-SEG-5, OWASP A03 |
| 3.1 | ESLint sobre la API, con reglas de seguridad | CP-SAST-01 | NFR-SEG-5 |
| 3.2 | ESLint sobre la SPA, con reglas de accesibilidad | CP-SAST-01, CP-USA-01 | NFR-USAB-1 a 3 |
| 3.3 | Dependencias de producción y de desarrollo | CP-SCA-01 | NFR-CAL-4 |
| 3.4 | Cabeceras de seguridad, una por una | CP-SEG-06 | NFR-SEG-10 |
| 3.5 | Búsqueda de credenciales en los logs | CP-SEG-05 | NFR-SEG-6 |
| 4.1 | Latencia y tasa de error con 200 concurrentes | CP-PERF-01 a 03 | NFR-PERF-1 a 3 |
| 5.1 | Contraste WCAG y anuncio de mensajes | CP-USA-01 | WCAG 1.4.3 / 4.1.3 |

## 7. Los dos verificadores propios

### `verificar-contraste.mjs`

Calcula la relación de contraste WCAG de cada par de colores **leyendo la hoja de estilos**,
y comprueba la presencia de `role` y `aria-live` en el componente de mensajes.

```bash
node verificar-contraste.mjs ../codigo/cuidarte-plus-v1.1/web/src/estilos.css
```

**Por qué existe, si ya hay Lighthouse.** Lighthouse audita el DOM renderizado, por lo que
necesita el navegador, la aplicación levantada y que el elemento esté en pantalla en ese
momento: un mensaje de error que no se mostró no se audita. Este verificador revisa la
**fuente** de los colores, de modo que cubre todos los estados —error, éxito, aviso— aunque
ninguno esté visible, y entrega un número exacto que se puede citar en el informe.

Ambas técnicas son complementarias, no alternativas: este da el valor por token, Lighthouse
confirma el resultado sobre el DOM real.

Devuelve código de salida **1** si hay incumplimientos, de modo que sirve como puerta en CI.

### `medir-rendimiento.mjs`

Mide latencia (p50, p95, p99), tasa de error y rendimiento agregado bajo concurrencia
configurable.

```bash
node medir-rendimiento.mjs --usuarios 200 --iteraciones 3
```

**Relación con JMeter.** El artefacto formal del plan es
`api/jmeter/cuidarte-carga.jmx`, que mide los mismos umbrales con Apache JMeter y produce
el informe HTML que la industria usa como evidencia de carga. Este script cumple un
propósito complementario: mide **los mismos umbrales sin requerir esa instalación**, de modo
que cualquiera con Node pueda reproducir las cifras citadas en el informe.

**Por qué se evalúa sobre el p95 y no sobre el promedio.** El promedio esconde la cola. Un
servicio con promedio de 80 ms puede tener un 5 % de peticiones sobre 2 segundos, y es ese
5 % lo que el usuario percibe como "el sistema se cuelga".

**Por qué la tasa de error es tan importante como la latencia.** Fue precisamente la métrica
que reveló INC-14: las latencias cumplían los umbrales con holgura mientras entre el 58 % y
el 100 % de las peticiones se rechazaban con HTTP 429. Un informe que solo mirara el p95
habría declarado el caso aprobado.

## 8. Comparar las dos versiones

La forma más directa de leer la evidencia es contrastar el mismo anexo en ambas versiones:

```bash
diff v1.0/Anexo_2.1_CP-SEG-01_rbac-backend.txt \
     v1.1/Anexo_2.1_CP-SEG-01_rbac-backend.txt
```

Atajo para ver todos los hallazgos de la versión auditada:

```bash
grep -l "HALLAZGO" v1.0/*.txt
grep -h "HALLAZGO" v1.0/*.txt
```

Y para confirmar que la versión corregida los cerró:

```bash
grep -l "HALLAZGO" v1.1/*.txt    # no debe devolver ningún archivo
```

## 9. Limitaciones declaradas

Tres casos quedaron en estado **observado** por limitaciones del ambiente de prueba, no por
el comportamiento del software. Se declaran como tales en lugar de presentarlos como
aprobados:

| Caso | Limitación | Verificación equivalente que sí se ejecutó |
|---|---|---|
| CP-SEG-08 (DAST) | OWASP ZAP no está instalado en el equipo de QA | Anexo 3.4: presencia y valor de las cabeceras de seguridad, que es lo que el escaneo pasivo de ZAP comprueba |
| CP-COMPAT-01 | No se dispone de las 8 combinaciones navegador/versión (en particular Safari) | Anexo 1.3: la construcción de producción se genera sin errores y no se usan características fuera de la línea base |
| CP-DIS-01 | La disponibilidad del 99,5 % mensual requiere 30 días de observación | Anexo 0.1: healthcheck operativo, exento del límite de peticiones, apagado ordenado y esquema idempotente |

---

ISY1102 · Sección 003V · Caso B: Cuidarte+
Eder Valdivia · Marcelo Morales

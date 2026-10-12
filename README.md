# EV2 — Cuidarte+ · Evaluación Parcial N.º 2 (ISY1102)

Entregables de la **Evaluación Parcial N.º 2** de *Seguridad y Calidad en el Desarrollo de
Software*, sobre el **Caso B: Cuidarte+** (sistema de exámenes médicos).

**Eder Valdivia · Marcelo Morales** · Sección 003V · Docente: Mauricio Andrés Velásquez Silva

---

## 1. Qué se entrega

| Carpeta / archivo | Contenido |
|---|---|
| `docs/01_Informe_EP02_Cuidarte+.md` | **Informe de entrega** (grupal, 12 %). Documento principal. |
| `docs/02_Presentacion_EP02_Cuidarte+.md` | **Guion de la defensa** individual (28 %), 14 diapositivas + banco de preguntas. |
| `docs/03_Requerimientos_Adicionales_ERS_v1.2.md` | **23 requisitos adicionales** propuestos, con su justificación normativa. |
| `docs/04_Paso_a_Paso_Reproducir_EV2.md` | Cómo levantar el software y **regenerar toda la evidencia**. |
| `docs/05_Defectos_Sembrados_v1.0.md` | Mapa de los 14 defectos: archivo → incidente → caso → norma. |
| `entrega/*.docx` | Los cinco documentos en Word, con el formato de la pauta. |
| `codigo/cuidarte-plus-v1.0/` | Software **auditado** (material de laboratorio, no desplegar). |
| `codigo/cuidarte-plus-v1.1/` | Software **corregido y verificado**. |
| `codigo/sembrar-defectos.py` | Genera la v1.0 desde la v1.1, de forma reproducible. |
| `evidencias/` | 19 anexos por versión, con sus scripts generadores. |

> **Regla heredada de la EP01:** la EP01 se hereda y se ajusta; la EP02 se agrega encima. El
> informe conserva las secciones 1 a 4 de la EP01 —ajustadas según la tabla de §1.7— y añade
> el análisis estático, la ejecución con evidencia, el análisis ético-normativo, las
> propuestas de mejora, las conclusiones y los anexos.

---

## 2. Resultado de la auditoría

Se diseñaron **34 casos de prueba** que cubren el **100 % de los 45 requisitos** del ERS,
verificado con una matriz bidireccional, y se ejecutaron sobre el software real desplegado
en contenedores.

### 14 incidentes detectados

| Criticidad | Cantidad | Incidentes |
|---|---|---|
| **CRÍTICO** | 5 | Escalada de privilegios en el registro · Control de acceso solo en la interfaz · Inyección SQL · XSS almacenado · Sesión no revocable |
| **GRAVE** | 7 | RUT duplicado · bcrypt costo 8 · Credenciales en los logs · Cabeceras ausentes y CORS abierto · Dependencia con CVE · Eliminación física del registro clínico · Documento validado solo por tipo declarado |
| **MODERADO** | 2 | Contraste y ARIA insuficientes · Límite de peticiones mal dimensionado |

El de mayor impacto: en la versión auditada, **cualquier visitante del sitio podía
registrarse como administrador** y, con ese acceso, leer el historial clínico de todos los
pacientes y ejecutar consultas arbitrarias contra la base de datos, incluida la tabla de
auditoría que debería haber registrado su intrusión.

### Comparación entre versiones

| Métrica | v1.0 (auditada) | v1.1 (corregida) |
|---|---|---|
| Casos aprobados | 11 de 34 | **31 de 34** |
| Casos fallidos | 20 | **0** |
| Pruebas automatizadas | 114 / 132 | **132 / 132** |
| Escenarios BDD | 4 / 6 | **6 / 6** (34 pasos) |
| Cobertura de líneas | — | **89,84 %** |
| Errores de análisis estático | 6 | **0** |
| CVE en dependencias de producción | 1 alta | **0** |
| Pares de color conformes con WCAG | 4 / 8 | **8 / 8** |
| Tasa de error con 200 concurrentes | 58,5 % – 100 % | **0,00 %** |

**Veredicto.** La versión 1.0 **no era apta para producción**. La versión 1.1 cierra los
catorce incidentes con evidencia reproducible y está en condiciones de avanzar a producción
con riesgo controlado.

---

## 3. Arranque rápido

```bash
cd codigo/cuidarte-plus-v1.1
cp .env.example .env          # completar los tres secretos
docker compose up -d --build
docker compose --profile semilla run --rm semilla
```

| Recurso | URL |
|---|---|
| SPA | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Healthcheck | http://localhost:3000/api/v1/salud |

Usuarios de prueba (contraseña común `Cuidarte2026!`, válida **solo** en QA): `admin1`,
`medico1`, `medico2`, `paciente1`, `paciente2`.

Batería completa de calidad y seguridad:

```bash
cd codigo/cuidarte-plus-v1.1/api && npm install && npm run verify
```

El procedimiento detallado, con los resultados esperados de cada paso, está en
[`docs/04_Paso_a_Paso_Reproducir_EV2.md`](docs/04_Paso_a_Paso_Reproducir_EV2.md).

---

## 4. Arquitectura del software evaluado

Stack conforme al ERS §4: React en el cliente, Node.js/Express en el servidor y PostgreSQL
como base de datos.

```
cuidarte-plus/
├── api/                      Node.js 24 + Express 5 · arquitectura limpia
│   ├── src/domain/           Núcleo: modelos, puertos y errores de negocio
│   ├── src/application/      Casos de uso (reglas de negocio y autorización)
│   ├── src/infrastructure/   PostgreSQL, HTTP/REST, seguridad y storage
│   └── tests/                132 pruebas + 6 escenarios BDD en Gherkin
├── web/                      React 19 + Vite · SPA responsiva y accesible
├── .github/workflows/        Pipeline de 9 etapas con puertas de calidad
├── .zap/                     Reglas del escaneo dinámico
└── docker-compose.yml        Ambiente QA reproducible (api + web + PostgreSQL)
```

El flujo de dependencias apunta siempre **hacia el dominio**: la infraestructura implementa
los puertos que el dominio define. Eso permite ejecutar la misma lógica de negocio contra un
adaptador en memoria (pruebas unitarias y BDD) o contra PostgreSQL (integración y QA).

---

## 5. Las dos versiones y por qué existen

La EP02 evalúa la capacidad de **detectar, clasificar y explicar** defectos. Para que la
evidencia sea reproducible y comparable, el software se entrega en dos versiones:

| Versión | Rol en la evaluación |
|---|---|
| **v1.0 — auditada** | El software que QA recibe. Contiene 14 defectos documentados. Sobre ella se ejecutan las herramientas y se obtienen los hallazgos de las secciones 5 y 6 del informe. |
| **v1.1 — corregida** | El resultado de aplicar la propuesta de mejora (sección 8). Sobre ella se ejecuta la regresión (CP-REG-01) que acredita el cierre de cada incidente. |

La v1.0 se **genera** desde la v1.1 con `codigo/sembrar-defectos.py`. El script **no toca
`api/tests/`**: las pruebas son idénticas en ambas versiones, y eso es lo que hace que los
20 casos fallidos de la v1.0 sean comparables uno a uno con los 31 aprobados de la v1.1.

Cada defecto está documentado en
[`docs/05_Defectos_Sembrados_v1.0.md`](docs/05_Defectos_Sembrados_v1.0.md) con su archivo,
el incidente que origina, el caso de prueba que lo detecta y la norma que incumple.

> ⚠️ La v1.0 es **material de laboratorio**: es deliberadamente vulnerable y solo debe
> ejecutarse en el ambiente QA local descrito en la documentación. No debe desplegarse ni
> exponerse a una red pública.

---

## 6. Evidencia reproducible

Toda la evidencia se genera con scripts versionados, no con capturas de pantalla:

```bash
cd evidencias
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.1
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.0
```

| Script | Qué produce |
|---|---|
| `capturar-evidencia.sh` | Los 19 anexos de una versión, con su encabezado de trazabilidad |
| `verificar-contraste.mjs` | Relación de contraste WCAG de cada par de colores, leída del código |
| `medir-rendimiento.mjs` | Latencia (p50/p95/p99) y tasa de error bajo concurrencia configurable |

Una evidencia que solo su autor puede producir es testimonio; una que cualquiera puede
regenerar es prueba. Si al ejecutar estos scripts obtiene resultados distintos a los
documentados, eso es un hallazgo.

Detalle de la nomenclatura y el índice completo de anexos en
[`evidencias/README.md`](evidencias/README.md).

---

## 7. Trazabilidad del entregable

```
ERS Caso B v1.1 (45 requisitos)
        │
        ├─► docs/03_Requerimientos_Adicionales   23 requisitos propuestos
        │
        ├─► docs/01_Informe §4                   34 casos de prueba, con TIPO DE PRUEBA
        │        │
        │        ├─► codigo/…/api/tests/         132 pruebas + 6 escenarios BDD
        │        └─► evidencias/v1.0 y v1.1      19 anexos por versión
        │
        ├─► docs/01_Informe §4.2                 Matriz bidireccional: 45/45 cubiertos
        │
        └─► docs/01_Informe §6.3 y §8            14 incidentes → remediación → cierre verificado
```

Nueve de los catorce incidentes tienen su origen directo en un **vacío de especificación**
del ERS. Esa relación es el argumento del documento de requisitos adicionales: un requisito
que no está especificado no se implementa, no se prueba y termina siendo un incidente.

---

## 8. Entrega a AVA

Los documentos exportados a Word están en `entrega/`, con el formato de la pauta: Arial 12
en títulos, Arial 11 en cuerpo, interlineado 1,5, texto justificado y portada completa.

```bash
cd entrega && python exportar-a-word.py
```

La lista de verificación previa a la entrega está al final de
[`docs/04_Paso_a_Paso_Reproducir_EV2.md`](docs/04_Paso_a_Paso_Reproducir_EV2.md).

---

ISY1102 · Sección 003V · Caso B: Cuidarte+ · Evaluación Parcial N.º 2
Eder Valdivia · Marcelo Morales · 12 de octubre de 2026

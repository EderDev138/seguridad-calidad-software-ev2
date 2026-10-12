> ## ATENCION - ESTA ES LA VERSION 1.0 (AUDITADA)
>
> **Las cifras de este documento corresponden a la version 1.1 corregida.**
> Esta copia del software contiene 14 defectos deliberados y NO pasa las
> puertas de calidad que se describen mas abajo.
>
> El detalle de cada defecto esta en
> `EV2/docs/05_Defectos_Sembrados_v1.0.md`.
>
> No despliegue esta version ni la exponga a una red publica.

# Cuidarte+ — Sistema de exámenes médicos

Implementación del **Caso B** de ISY1102, conforme a la Especificación de Requerimientos de
Software v1.1 de CreaLab SpA.

**Stack (ERS §4):** React 19 + Vite · Node.js 24 + Express 5 · PostgreSQL 17 · Docker

---

## 1. Arranque rápido

```bash
cp .env.example .env     # y completar los tres secretos
docker compose up -d --build
docker compose --profile semilla run --rm semilla
```

| Recurso | URL |
|---|---|
| SPA | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Healthcheck | http://localhost:3000/api/v1/salud |

**Usuarios de prueba** (contraseña común `Cuidarte2026!`, válida **solo** en QA):

| Usuario | Rol |
|---|---|
| `admin1` | ADMIN |
| `medico1`, `medico2` | MEDICO |
| `paciente1`, `paciente2` | PACIENTE |

> El servicio **no arranca sin secretos**: es una decisión deliberada (NFR-SEG-13).
> Genere cada uno con:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

---

## 2. Arquitectura

La API sigue **arquitectura limpia**: el flujo de dependencias apunta siempre hacia el
dominio, y la infraestructura implementa los puertos que el dominio define.

```
api/src/
├── domain/                        Núcleo. No conoce Express ni PostgreSQL.
│   ├── model/                     Usuario, Paciente, Examen, Documento, Auditoría, roles
│   ├── gateway/                   Puertos de salida (contratos que la infraestructura implementa)
│   └── error/                     Errores de negocio con código estable
├── application/
│   └── usecase/                   Reglas de negocio y orquestación
└── infrastructure/                Detalles reemplazables
    ├── adapters/postgres/         Implementación real + esquema + semilla
    ├── adapters/memory/           Implementación en memoria para pruebas
    ├── entrypoints/rest/          Routers, middlewares y esquemas de validación
    ├── security/                  Hashing, política de contraseñas y tokens
    ├── storage/                   Storage interno de documentos
    └── config/                    Logger estructurado

web/src/
├── componentes/                   Acceso, Pacientes, Exámenes, Auditoría, Aviso
├── api.js                         Cliente de la API REST
├── App.jsx                        Sesión, navegación y flujo escalonado
└── estilos.css                    Paleta verificada contra WCAG 2.1 AA
```

**Por qué importa esta separación en una evaluación de calidad.** Permite ejecutar la
**misma lógica de negocio** contra el adaptador en memoria (pruebas unitarias y BDD, sin
base de datos) o contra PostgreSQL (integración y QA). Esa propiedad es la que hace que una
batería de 132 pruebas corra en poco más de un minuto y pueda usarse como puerta en cada
cambio.

Tiene, además, una **limitación que conviene conocer**: una familia de defectos —la
inyección SQL— es invisible para las pruebas que usan el adaptador en memoria, porque ese
adaptador no interpreta SQL. La auditoría de la EP02 lo confirmó, y por eso el plan de
pruebas incorpora análisis estático y pruebas dinámicas contra PostgreSQL real.

---

## 3. Endpoints

| Método | Ruta | Requisito | Roles |
|---|---|---|---|
| GET | `/api/v1/salud` | NFR-DIS-3 | público |
| POST | `/api/v1/auth/registro` | RF-2.1 | público |
| POST | `/api/v1/auth/login` | RF-1.1 | público |
| POST | `/api/v1/auth/refresh` | RF-1.2 | público |
| POST | `/api/v1/auth/logout` | RF-1.2 | autenticado |
| GET | `/api/v1/auth/yo` | — | autenticado |
| GET / POST / PUT / DELETE | `/api/v1/usuarios` | RF-2.5 a RF-2.7 | ADMIN |
| GET | `/api/v1/pacientes` | RF-2.4 | todos (filtrado por titularidad) |
| GET | `/api/v1/pacientes/:id` | RF-2.4 | todos (filtrado por titularidad) |
| POST / PUT / DELETE | `/api/v1/pacientes` | RF-2.2, RF-2.3 | ADMIN, MEDICO |
| GET | `/api/v1/pacientes/:id/examenes` | RF-4.1, NFR-USAB-4 | todos (filtrado) |
| GET | `/api/v1/examenes/:id` | RF-3.2 | todos (filtrado) |
| POST / PUT / DELETE | `/api/v1/examenes` | RF-3.1 a RF-3.3 | ADMIN, MEDICO |
| GET | `/api/v1/examenes/:id/documentos` | RF-4.2 | todos (filtrado) |
| POST | `/api/v1/examenes/:id/documentos` | RF-4.3, RF-4.4 | ADMIN, MEDICO |
| GET | `/api/v1/documentos/:id/descarga` | RF-4.2 | todos (filtrado) |
| DELETE | `/api/v1/documentos/:id` | RF-3.3 | ADMIN, MEDICO |
| GET | `/api/v1/auditoria` | RF-5.1 | ADMIN |
| GET | `/api/v1/auditoria/exportar` | RF-5.2 | ADMIN |

La **matriz completa de permisos** está documentada en
`api/src/infrastructure/entrypoints/rest/routes/index.js`: leer ese archivo debe bastar para
auditarla.

> **"Filtrado por titularidad"** significa que la autorización depende del **dato** y no solo
> del rol: un paciente accede únicamente a lo vinculado a su propia cuenta. Esa restricción
> no se puede expresar con un middleware de rol, por lo que la aplican los casos de uso. Ante
> un recurso ajeno se responde **404 y no 403**, para no confirmar su existencia a quien no
> debe conocerla.

---

## 4. Controles de seguridad implementados

| Control | Requisito | Dónde |
|---|---|---|
| Hashing bcrypt con factor ≥ 12, verificado en el arranque | NFR-SEG-2 | `security/password.js` |
| Política de contraseñas configurable, validada en servidor | RF-1.4 | `security/password.js` |
| Bloqueo temporal por intentos fallidos | RF-1.3 | `usecase/AuthUseCase.js` |
| JWT con algoritmo fijo y revocación efectiva en el logout | RF-1.2, NFR-SEG-9 | `security/token.js` |
| Secretos solo desde el entorno; sin ellos el servicio no arranca | NFR-SEG-13 | `security/token.js`, `server.js` |
| Control de acceso por rol en el router **y** en el caso de uso | NFR-SEG-4 | `middleware/autenticacion.js` + casos de uso |
| Verificación de titularidad del dato | RN-02, RB-1 | `usecase/PacienteUseCase.js` |
| Validación estricta de entradas con esquemas Zod | NFR-SEG-5 | `schema/esquemas.js` |
| Consultas exclusivamente con parámetros posicionales | NFR-SEG-5 | `adapters/postgres/` |
| Cabeceras de seguridad y CORS por lista explícita | NFR-SEG-10 | `middleware/seguridad.js` |
| Limitación de peticiones dimensionada desde NFR-PERF-3 | NFR-SEG-11 | `middleware/seguridad.js` |
| Validación de documentos por lista blanca y firma binaria | NFR-SEG-12 | `model/Documento.js` |
| Storage confinado, con nombre generado por el servidor | RF-4.4 | `storage/StorageLocal.js` |
| Logger con enmascaramiento de datos sensibles | NFR-SEG-6, NFR-SEG-15 | `config/logger.js` |
| Eliminación lógica en todas las entidades de negocio | RF-3.3 | esquema + adaptadores |
| Auditoría de solo adición, con `UPDATE`/`DELETE` revocados | RF-5.1, NFR-SEG-16 | `adapters/postgres/schema.sql` |
| Contenedor sin privilegios de root, con healthcheck | NFR-SEG-14, NFR-DIS-3 | `api/Dockerfile` |

---

## 5. Pruebas y puertas de calidad

```bash
cd api
npm test              # 132 pruebas
npm run test:cov      # con cobertura; falla si baja del umbral
npm run test:bdd      # 6 escenarios BDD en Gherkin (español)
npm run lint          # ESLint con reglas de seguridad
npm run format        # verificación de formato
npm run audit:deps    # dependencias, umbral alto
npm run verify        # todo lo anterior, en el orden del pipeline
```

```bash
cd web
npm run lint          # ESLint con reglas de accesibilidad
npm run build         # construcción de producción
npm run verify        # formato + lint + build + auditoría
```

**Estado verificado de esta versión:**

| Control | Resultado |
|---|---|
| Pruebas automatizadas | 132 / 132 |
| Escenarios BDD | 6 / 6 (34 pasos) |
| Cobertura de líneas | 89,84 % |
| Cobertura de ramas | 76,21 % |
| ESLint (API y SPA) | 0 problemas |
| Formato | conforme |
| Dependencias de producción | 0 vulnerabilidades |
| Contraste WCAG | 8 / 8 pares conformes |
| Rendimiento (200 concurrentes) | p95 341 ms y 221 ms · 0,00 % de errores |

### Estructura de las pruebas

```
api/tests/
├── soporte/entorno.js            Arma la app con gateways en memoria
├── unit/
│   ├── dominio.test.js           Invariantes del dominio (RUT, examen, documento, usuario)
│   ├── password.test.js          Política de contraseñas y hashing
│   └── infraestructura.test.js   Storage confinado, escape, logger, gateways
├── integration/
│   ├── autenticacion.test.js     RF-1, RF-2.1, cabeceras de seguridad
│   ├── accesoYRoles.test.js      RBAC, titularidad, inyección, documentos, auditoría
│   └── pacientesYExamenes.test.js  Ciclo de vida de pacientes y exámenes
└── bdd/
    ├── features/examenes.feature Escenarios en Gherkin (español)
    └── steps/examenes.steps.js   Definiciones de pasos
```

Los escenarios BDD están escritos en **lenguaje natural** para que un stakeholder no técnico
pueda validar las reglas de negocio RB-1 a RB-3 sin leer código.

---

## 6. Herramientas de análisis

```bash
# Análisis estático con SonarQube
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
cd api && npm run test:cov        # genera coverage/lcov.info
cd .. && npx sonarqube-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.token=SU_TOKEN

# Escaneo de la imagen de contenedor
docker compose build
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --scanners vuln --pkg-types os \
  --severity CRITICAL,HIGH --ignore-unfixed cuidarte-plus-v11-api

# Escaneo dinámico
docker run --rm --network host -v "$PWD":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:3000/api/v1/salud -I -c .zap/rules.tsv

# Carga con JMeter
cd api && jmeter -n -t jmeter/cuidarte-carga.jmx -l reportes/jmeter.jtl \
  -e -o reportes/jmeter-html -Jusuarios=200 -Jrampa=30 -Jiteraciones=3
```

El pipeline de `.github/workflows/calidad-y-seguridad.yml` ejecuta nueve etapas en cada
cambio y **detiene la integración** ante cualquier incumplimiento.

---

## 7. Variables de entorno

Las obligatorias no tienen valor por defecto: su ausencia impide el arranque (NFR-SEG-13).

| Variable | Obligatoria | Por defecto | Para qué |
|---|---|---|---|
| `DATABASE_URL` | **sí** | — | Conexión a PostgreSQL |
| `JWT_SECRET` | **sí** | — | Firma del token de acceso; mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | **sí** | — | Firma del token de refresco; distinto del anterior |
| `BCRYPT_COST` | no | 12 | Factor de costo; por debajo de 12 el servicio no arranca |
| `PASSWORD_LARGO_MINIMO` | no | 12 | Largo mínimo de la contraseña |
| `LOGIN_MAX_INTENTOS` | no | 5 | Intentos antes del bloqueo temporal |
| `LOGIN_MINUTOS_BLOQUEO` | no | 15 | Duración del bloqueo |
| `RATE_LIMIT_AUTH` | no | 10 | Límite en autenticación, cada 15 minutos |
| `RATE_LIMIT_GENERAL` | no | 15000 | Límite general por minuto; derivado de NFR-PERF-3 |
| `CORS_ORIGENES` | no | `http://localhost:5173` | Lista explícita de orígenes permitidos |
| `STORAGE_DIR` | no | `./storage-documentos` | Storage interno de documentos |
| `LOG_LEVEL` | no | `info` | Nivel del registro |

---

## 8. Datos de prueba

`api/src/infrastructure/adapters/postgres/seed.sql` carga 5 usuarios, 5 pacientes y 5
exámenes.

**Todos los datos son sintéticos.** Ningún nombre, RUT, correo, teléfono ni antecedente
clínico corresponde a una persona real; los RUT son válidos en su dígito verificador pero
pertenecen a rangos no emitidos.

Esto no es una preferencia metodológica. Los datos de salud son **datos sensibles** bajo la
Ley 19.628, modernizada por la Ley 21.719, y un ambiente de pruebas tiene por definición
menos controles que producción: cargar un volcado de producción en QA sería tratamiento sin
finalidad legítima. El propio archivo de semilla documenta este razonamiento, para que quien
lo reutilice entienda por qué no debe reemplazarlo.

---

## 9. Decisiones de diseño y sus limitaciones

| Decisión | Motivo | Limitación conocida |
|---|---|---|
| Arquitectura limpia con doble adaptador | La misma lógica se prueba con y sin base de datos | Los defectos de SQL son invisibles para las pruebas en memoria |
| Lista de revocación de tokens en memoria del proceso | Suficiente para una instancia de QA | Con varias instancias requiere Redis o una tabla compartida |
| Respuesta 404 ante recursos ajenos | No confirmar la existencia del dato a quien no debe conocerla | Dificulta distinguir "no existe" de "no autorizado" al depurar |
| Límite de peticiones por IP | Defensa en profundidad en la aplicación | En producción corresponde al borde (WAF o API gateway), donde hay identidad por usuario |
| ESLint 9 en la SPA en lugar de 10 | `eslint-plugin-jsx-a11y` aún no declara compatibilidad con 10 | Revisar cuando el plugin publique soporte |
| `pgcrypto` habilitado, cifrado de campos pendiente | La extensión queda disponible para NFR-SEG-3 | El cifrado por columna requiere definir la gestión de claves |

---

## 10. Documentación relacionada

| Documento | Contenido |
|---|---|
| `../../docs/01_Informe_EP02_Cuidarte+.md` | Informe de la auditoría |
| `../../docs/03_Requerimientos_Adicionales_ERS_v1.2.md` | Los 23 requisitos propuestos |
| `../../docs/04_Paso_a_Paso_Reproducir_EV2.md` | Cómo reproducir toda la evidencia |
| `../../docs/05_Defectos_Sembrados_v1.0.md` | Los defectos de la versión auditada |
| `../../evidencias/README.md` | Nomenclatura e índice de la evidencia |

---

ISY1102 · Sección 003V · Caso B: Cuidarte+ · versión 1.1
Eder Valdivia · Marcelo Morales

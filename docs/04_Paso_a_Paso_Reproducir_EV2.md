# Paso a paso — Reproducir la evidencia de la EV2

**Caso B: Cuidarte+ · ISY1102 · Evaluación Parcial N.º 2**

Este documento permite **regenerar desde cero** toda la evidencia citada en el informe. Si
los resultados que obtiene no coinciden con los documentados, eso es un hallazgo y conviene
reportarlo.

---

## 0. Requisitos previos

| Herramienta | Versión mínima | Para qué | Cómo verificar |
|---|---|---|---|
| **Node.js** | 22 (probado con 24) | Ejecutar la API, las pruebas y los scripts de evidencia | `node -v` |
| **npm** | 10 | Gestionar dependencias | `npm -v` |
| **Docker Desktop** | 24 | Levantar el ambiente QA (SPA + API + PostgreSQL) | `docker --version` |
| **Python** | 3.10 | Regenerar la versión con defectos | `python --version` |
| **Git Bash** (Windows) o Bash | — | Ejecutar el script de captura | `bash --version` |

Herramientas **opcionales**, para los casos que quedaron observados:

| Herramienta | Para qué | Caso |
|---|---|---|
| Apache JMeter 5.6 | Ejecutar el plan de carga formal | CP-PERF-01 a 03 |
| OWASP ZAP | Escaneo dinámico | CP-SEG-08 |
| SonarQube Community | Quality Gate de análisis estático | CP-SAST-01 |
| Trivy | Escaneo de las imágenes de contenedor | CP-CAL-02 |
| Navegadores Chrome, Firefox, Safari y Edge | Matriz de compatibilidad | CP-COMPAT-01 |

---

## 1. Estructura de la entrega

```
EV2/
├── README.md                                    Índice general
├── docs/
│   ├── 01_Informe_EP02_Cuidarte+.md             Informe de entrega
│   ├── 02_Presentacion_EP02_Cuidarte+.md        Guion de la defensa
│   ├── 03_Requerimientos_Adicionales_ERS_v1.2.md  23 requisitos propuestos
│   ├── 04_Paso_a_Paso_Reproducir_EV2.md         Este documento
│   └── 05_Defectos_Sembrados_v1.0.md            Mapa de los defectos auditados
├── codigo/
│   ├── cuidarte-plus-v1.0/                      Software auditado (laboratorio)
│   ├── cuidarte-plus-v1.1/                      Software corregido
│   └── sembrar-defectos.py                      Genera la v1.0 desde la v1.1
├── evidencias/
│   ├── capturar-evidencia.sh                    Genera los 19 anexos de una versión
│   ├── verificar-contraste.mjs                  Contraste WCAG desde el código
│   ├── medir-rendimiento.mjs                    Latencia y tasa de error bajo carga
│   ├── v1.0/                                    19 anexos de la versión auditada
│   └── v1.1/                                    19 anexos de la versión corregida
└── entrega/                                     Exportaciones a Word (no versionado)
```

> `entrega/` no está en el control de versiones: contiene los documentos exportados a Word,
> que son binarios regenerables desde `docs/`. La fuente de verdad de cada documento es su
> archivo `.md`.

---

## 2. Reproducir la evidencia de la versión corregida (v1.1)

### 2.1 Instalar dependencias

```bash
cd EV2/codigo/cuidarte-plus-v1.1/api
npm install
cd ../web
npm install
```

### 2.2 Configurar los secretos del ambiente

El ambiente **no arranca sin secretos**: es una decisión deliberada (NFR-SEG-13). Nunca se
versiona un `.env` con valores reales.

```bash
cd EV2/codigo/cuidarte-plus-v1.1
cp .env.example .env
```

Genere cada secreto con un valor distinto y péguelo en el `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Variables obligatorias: `POSTGRES_PASSWORD`, `JWT_SECRET` y `JWT_REFRESH_SECRET`.
`JWT_SECRET` y `JWT_REFRESH_SECRET` deben tener **al menos 32 caracteres** y ser distintos
entre sí.

### 2.3 Levantar el ambiente QA

```bash
docker compose up -d --build
docker compose ps
```

Los tres servicios deben aparecer en estado `healthy`:

```
SERVICE   STATUS
api       Up (healthy)
db        Up (healthy)
web       Up (healthy)
```

| Recurso | URL |
|---|---|
| SPA | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Healthcheck | http://localhost:3000/api/v1/salud |

### 2.4 Cargar los datos de prueba

```bash
docker compose --profile semilla run --rm semilla
```

Debe mostrar:

```
  entidad  | total
-----------+-------
 usuarios  |     5
 pacientes |     5
 examenes  |     5
```

**Usuarios de prueba** (contraseña común: `Cuidarte2026!`, válida solo en QA):

| Usuario | Rol | Observación |
|---|---|---|
| `admin1` | ADMIN | Acceso completo y auditoría |
| `medico1` | MEDICO | Registra pacientes y exámenes |
| `medico2` | MEDICO | Segundo médico, para probar RB-3 |
| `paciente1` | PACIENTE | Vinculado a la ficha RUT `12345678-5` |
| `paciente2` | PACIENTE | Vinculado a la ficha RUT `11111111-1` |

> Los dos pacientes existen **a propósito**: sin dos titularidades distintas no se puede
> probar CP-SEG-02 (que un paciente no acceda a la información de otro).

### 2.5 Ejecutar la captura completa de evidencia

```bash
cd EV2/evidencias
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.1
```

Genera 19 anexos en `evidencias/v1.1/`. Cada uno lleva un encabezado con su caso de prueba,
el requisito verificado, la fecha, el ejecutor y el comando que lo produjo.

### 2.6 Resultados esperados en la v1.1

| Anexo | Verificación | Resultado esperado |
|---|---|---|
| 1.1 | Pruebas y cobertura | **132 de 132** aprobadas; líneas 89,84 %; ramas 76,21 % |
| 1.2 | Escenarios BDD | **6 escenarios, 34 pasos**, todos aprobados |
| 2.1 | Control de acceso por rol | **403** en toda operación no autorizada |
| 2.2 | Acceso a datos de terceros | **404** en todo recurso ajeno; listado con 1 sola ficha |
| 2.3 | Inyección y escalada | `rol: ADMIN` → **400**; SQL en RUT → **400** |
| 2.4 | Sesión y criptografía | Tras logout → **401**; hashes `$2b$12$` |
| 2.5 | Unicidad del RUT | Ambos formatos → **409**; índice `paciente_rut_uk` presente |
| 2.6 | Auditoría y baja lógica | Registro conservado con `dado_de_baja = true` |
| 2.7 | Validación de documentos | PDF → **201**; ejecutable disfrazado → **400** |
| 2.8 | Inyección SQL en auditoría | Payload → **0 registros** (tratado como texto) |
| 3.1 / 3.2 | ESLint API y SPA | **0 problemas** en ambos |
| 3.3 | Dependencias | **0 vulnerabilidades** en producción |
| 3.4 | Cabeceras de seguridad | Las **6 presentes**; `X-Powered-By` ausente |
| 3.5 | Logs | La contraseña sonda **no aparece** |
| 4.1 | Rendimiento | p95 dentro de umbral y **0,00 % de errores** |
| 5.1 | Contraste y ARIA | **8 de 8** pares conformes; `role` y `aria-live` presentes |

---

## 3. Reproducir la evidencia de la versión auditada (v1.0)

> La versión 1.0 es **material de laboratorio**: es deliberadamente vulnerable. Ejecútela
> solo en el ambiente local descrito aquí y no la exponga a una red pública.

### 3.1 Regenerar la versión con defectos

La v1.0 se genera desde la v1.1 aplicando los defectos documentados. El script conserva
`node_modules` y el `.env` entre ejecuciones, de modo que se puede regenerar sin reinstalar.

```bash
cd EV2/codigo
python sembrar-defectos.py
```

La salida enumera los 13 defectos aplicados y los 37 cambios concretos, archivo por archivo.
El script además **sincroniza `package-lock.json`**, porque uno de los defectos agrega una
dependencia y sin esa sincronización `npm ci` no podría construir la imagen.

### 3.2 Instalar dependencias y configurar el ambiente

```bash
cd cuidarte-plus-v1.0/api
npm install
cd ../web
npm install

cd ..
cp .env.example .env
```

Complete los secretos igual que en el paso 2.2, con dos diferencias:

```
APP_VERSION=1.0.0
BCRYPT_COST=8
RATE_LIMIT_GENERAL=300
```

Esos tres valores reproducen el estado de configuración de la versión auditada y son
necesarios para que INC-03 e INC-14 se manifiesten.

> El proyecto de Docker de esta versión se llama `cuidarte-plus-v10`, distinto del
> `cuidarte-plus-v11` de la versión corregida. Sin esa separación ambas compartirían
> contenedores, volúmenes y etiquetas de imagen, y construir una sobrescribiría la otra:
> la evidencia dejaría de corresponder al código que se cree estar auditando.

### 3.3 Levantar el ambiente y cargar datos

```bash
# Detener primero la otra versión, para liberar los puertos 3000 y 5173
cd ../cuidarte-plus-v1.1 && docker compose down

cd ../cuidarte-plus-v1.0
docker compose up -d --build
docker compose --profile semilla run --rm semilla
```

> **Importante:** si el volumen de base de datos tiene datos de una ejecución anterior, la
> carga de la semilla **fallará** en esta versión. No es un error del procedimiento: es una
> consecuencia de INC-01. Sin restricción de unicidad sobre el RUT, la segunda carga crea
> pacientes duplicados y una consulta posterior falla con *"more than one row returned by a
> subquery"*. Para partir limpio:
>
> ```bash
> docker compose down -v && docker compose up -d && docker compose --profile semilla run --rm semilla
> ```
>
> Vale la pena observar este efecto: es un caso real de cómo un defecto de integridad rompe
> un proceso que nadie relacionó con él.

### 3.4 Ejecutar la captura de evidencia

```bash
cd ../../evidencias
EJECUTOR="Su Nombre" bash capturar-evidencia.sh v1.0
```

### 3.5 Resultados esperados en la v1.0 — los hallazgos

| Anexo | Verificación | Resultado esperado | Incidente |
|---|---|---|---|
| 1.1 | Pruebas | **18 fallidas** de 132 | varios |
| 1.2 | BDD | **2 escenarios fallidos** de 6 | INC-13 |
| 2.1 | Control de acceso | Paciente crea/edita/borra: **201, 200, 200** | **INC-13** |
| 2.3 | Escalada de privilegios | `rol: ADMIN` → **201** | **INC-11** |
| 2.4 | Sesión | Tras logout → **200**; hashes `$2b$08$` | **INC-10, INC-03** |
| 2.5 | Unicidad del RUT | `12.345.678-5` → **201** | **INC-01** |
| 2.6 | Baja lógica | La consulta devuelve **0 filas** | **INC-09** |
| 2.7 | Documentos | Ejecutable disfrazado → **201** | **INC-12** |
| 2.8 | Inyección SQL | Payload devuelve **9 registros** frente a 3 del filtro legítimo | **INC-02** |
| 3.1 | ESLint API | **5 errores** (código muerto de los controles retirados) | síntomas de INC-13 |
| 3.2 | ESLint SPA | **1 error**: `dangerouslySetInnerHTML` | **INC-04** |
| 3.3 | Dependencias | **1 vulnerabilidad alta** en producción | **INC-08** |
| 3.4 | Cabeceras | **6 ausentes**; `X-Powered-By` presente | **INC-06** |
| 3.5 | Logs | La contraseña **aparece en claro** | **INC-05** |
| 4.1 | Rendimiento | Latencia correcta, pero **57,83 % y 100 % de errores** | **INC-14** |
| 5.1 | Contraste | **4 pares incumplen**; `role` y `aria-live` ausentes | **INC-07** |

---

## 4. Ejecutar herramientas individuales

### 4.1 Pruebas, cobertura y análisis estático

```bash
cd EV2/codigo/cuidarte-plus-v1.1/api

npm test              # batería completa
npm run test:cov      # con informe de cobertura (falla si baja del umbral)
npm run test:bdd      # escenarios BDD en Gherkin
npm run lint          # ESLint con reglas de seguridad
npm run format        # verificación de formato
npm run audit:deps    # dependencias, umbral alto
npm run verify        # todo lo anterior, en el orden del pipeline
```

En la SPA:

```bash
cd ../web
npm run lint          # ESLint con reglas de accesibilidad
npm run build         # construcción de producción
npm run verify        # formato + lint + build + auditoría
```

### 4.2 Verificador de contraste WCAG

```bash
cd EV2/evidencias
node verificar-contraste.mjs ../codigo/cuidarte-plus-v1.1/web/src/estilos.css
node verificar-contraste.mjs ../codigo/cuidarte-plus-v1.0/web/src/estilos.css
```

Devuelve código de salida 1 si hay incumplimientos, de modo que sirve como puerta en CI.

### 4.3 Medición de rendimiento

Requiere el ambiente levantado y los datos cargados.

```bash
cd EV2/evidencias
node medir-rendimiento.mjs --usuarios 200 --iteraciones 3
node medir-rendimiento.mjs --usuarios 50 --iteraciones 5    # carga más liviana
```

### 4.4 Plan de carga con JMeter (artefacto formal)

```bash
cd EV2/codigo/cuidarte-plus-v1.1/api
mkdir -p reportes
jmeter -n -t jmeter/cuidarte-carga.jmx \
       -l reportes/jmeter.jtl -e -o reportes/jmeter-html \
       -Jusuarios=200 -Jrampa=30 -Jiteraciones=3
```

El informe HTML queda en `reportes/jmeter-html/index.html`. El plan incluye aserciones de
duración que corresponden a los umbrales del ERS (2.000 ms y 300 ms).

### 4.5 Escaneo dinámico con OWASP ZAP

```bash
cd EV2/codigo/cuidarte-plus-v1.1
docker run --rm --network host -v "$PWD":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:3000/api/v1/salud -I -c .zap/rules.tsv
```

Las reglas marcadas `FAIL` en `.zap/rules.tsv` son las que corresponden a un requisito del
ERS, de modo que el resultado del escaneo sea una verificación del requisito y no una lista
de avisos.

### 4.6 SonarQube

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
```

Abra http://localhost:9000 (usuario y clave iniciales `admin`/`admin`), genere un token en
*My Account → Security* y ejecute:

```bash
cd EV2/codigo/cuidarte-plus-v1.1/api
npm run test:cov                      # genera coverage/lcov.info, que Sonar consume

cd ..
npx sonarqube-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=SU_TOKEN
```

El token **nunca** va en el repositorio: se entrega por variable de entorno o como *secret*
de CI (NFR-SEG-13).

### 4.7 Escaneo de las imágenes de contenedor

```bash
cd EV2/codigo/cuidarte-plus-v1.1
docker compose build

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --scanners vuln --pkg-types os \
  --severity CRITICAL,HIGH --ignore-unfixed cuidarte-plus-v11-api

# Verificar que el contenedor no corre como root
docker run --rm --entrypoint sh cuidarte-plus-v11-api -c 'id -u'   # debe devolver != 0
```

---

## 5. Verificaciones manuales

Los siguientes casos requieren intervención humana y no pueden automatizarse por completo.

### 5.1 CP-FUN-08 · Confirmación antes de la baja

1. Entre a http://localhost:5173 como `medico1`.
2. Seleccione un paciente y abra sus exámenes.
3. Pulse **Dar de baja** en un examen.
4. **Verifique que aparece un diálogo de confirmación** y cancélelo; el examen debe seguir
   presente.
5. Repita y confirme. El examen desaparece del listado.
6. Verifique que el registro **se conserva** en la base de datos:

```bash
docker compose exec -T db psql -U cuidarte -d cuidarte -c \
  "SELECT id, tipo, eliminado_en IS NOT NULL AS dado_de_baja FROM examen ORDER BY id;"
```

### 5.2 CP-USA-01 · Accesibilidad percibida

**Navegación por teclado.** Desde la pantalla de acceso, recorra todo el flujo usando solo
`Tab`, `Shift+Tab`, `Enter` y `Espacio`:

- El primer `Tab` debe revelar el enlace **«Saltar al contenido principal»**.
- Todo elemento enfocable debe mostrar un indicador de foco visible.
- El flujo acceso → paciente → exámenes → documento debe completarse sin usar el ratón.

**Vista móvil.** En DevTools active la barra de dispositivos (`Ctrl+Shift+M`), seleccione
375 × 667 y verifique: sin desplazamiento horizontal, la navegación se apila en vertical,
los botones ocupan el ancho completo y ningún control mide menos de 48 × 48 px.

**Lector de pantalla.** Con el Narrador de Windows (`Ctrl+Win+Enter`) o VoiceOver, envíe el
formulario de acceso con una contraseña incorrecta y **verifique que el mensaje de error se
anuncia**. Es la diferencia entre la v1.0 y la v1.1 en este punto.

**Lighthouse.** En DevTools, pestaña Lighthouse, marque *Accessibility* y *Performance*, y
analice la carga de la página.

### 5.3 CP-COMPAT-01 · Matriz de navegadores

Ejecute el flujo acceso → paciente → exámenes → documento en cada combinación y registre
los errores de consola y las diferencias de maquetación.

| Navegador | Versión actual | Versión anterior |
|---|---|---|
| Chrome | | |
| Firefox | | |
| Safari | | |
| Edge | | |

### 5.4 CP-DIS-01 · Apagado ordenado e idempotencia

```bash
cd EV2/codigo/cuidarte-plus-v1.1

# El esquema debe poder aplicarse dos veces sin error ni duplicación
docker compose --profile semilla run --rm semilla
docker compose restart api && sleep 6
curl -s http://localhost:3000/api/v1/salud

# Apagado ordenado: no debe cortar peticiones en curso
docker compose stop api
docker compose logs api --tail 10 | grep -i "apagado\|liberados"
```

### 5.5 CP-SEG-04 · Verificación criptográfica

```bash
# Factor de costo de bcrypt almacenado
docker compose exec -T db psql -U cuidarte -d cuidarte -c \
  "SELECT nombre_usuario, substring(password_hash,1,7) AS prefijo FROM usuario;"

# Algoritmo declarado en el JWT (debe ser HS256, nunca 'none')
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"nombreUsuario":"medico1","password":"Cuidarte2026!"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")
echo "$TOKEN" | cut -d. -f1 | base64 -d

# El servicio debe negarse a arrancar sin secreto (NFR-SEG-13)
docker compose exec -T api sh -c 'unset JWT_SECRET; node src/server.js' 2>&1 | head -3
```

---

## 6. Limpieza

```bash
cd EV2/codigo/cuidarte-plus-v1.1
docker compose down -v        # -v elimina también los volúmenes de datos

cd ../cuidarte-plus-v1.0
docker compose down -v
```

Para liberar también las imágenes construidas:

```bash
docker image rm cuidarte-plus-v11-api cuidarte-plus-v11-web \
                cuidarte-plus-v10-api cuidarte-plus-v10-web
```

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `required variable POSTGRES_PASSWORD is missing` | No existe el `.env` o está incompleto | `cp .env.example .env` y completar los tres secretos |
| `JWT_SECRET ausente o demasiado corto` | El secreto tiene menos de 32 caracteres | Generarlo con el comando del paso 2.2. **Es el comportamiento esperado**: el servicio se niega a arrancar inseguro |
| La API queda en `Restarting` | `BCRYPT_COST` menor que 12 en la v1.1 | Correcto por diseño: la v1.1 no arranca con un factor inseguro. Use 12 o superior |
| `npm ci` falla al construir la imagen de la v1.0 | `package-lock.json` desincronizado | Volver a ejecutar `python sembrar-defectos.py`, que lo sincroniza |
| La semilla falla con *"more than one row returned by a subquery"* | Volumen con datos previos **en la v1.0** | Es el efecto de INC-01. `docker compose down -v` y repetir |
| Puerto 3000 o 5173 ocupado | La otra versión está levantada | `docker compose down` en la versión que no esté usando |
| Las subidas de documentos devuelven HTTP 000 | Ruta POSIX con el `curl` nativo de Windows | Ya resuelto en el script mediante `cygpath`. Si ocurre en un comando propio, convierta la ruta |
| Muchos HTTP 429 durante las pruebas | Límite de peticiones | En la v1.1 está dimensionado (15.000/min). En la v1.0 es INC-14, y es el resultado esperado |
| El script de evidencia omite las pruebas dinámicas | La API no responde | Verificar `docker compose ps` y el healthcheck |

---

## 8. Lista de verificación antes de entregar

- [ ] Ambiente de la v1.1 levantado, con datos cargados y healthcheck respondiendo
- [ ] `npm run verify` en `api` y en `web` termina sin errores
- [ ] 132 de 132 pruebas y 6 de 6 escenarios BDD aprobados
- [ ] Evidencia de la v1.1 regenerada: 19 anexos en `evidencias/v1.1/`
- [ ] Evidencia de la v1.0 regenerada: 19 anexos en `evidencias/v1.0/`
- [ ] Verificador de contraste: 8 de 8 pares conformes en la v1.1
- [ ] Medición de rendimiento: 0,00 % de errores con 200 usuarios concurrentes
- [ ] Informe exportado a Word o PDF con Arial 12 en títulos, Arial 11 en cuerpo,
      interlineado 1,5 y texto justificado
- [ ] Portada con el nombre completo de cada integrante, carrera, sección, docente y fecha
- [ ] Ningún archivo `.env` con valores reales en el repositorio
- [ ] Archivo subido **directamente a AVA**, no como enlace
- [ ] Diapositivas de la defensa subidas como material de apoyo

---

ISY1102 · Sección 003V · Caso B: Cuidarte+
Eder Valdivia · Marcelo Morales · 12 de octubre de 2026

#!/usr/bin/env bash
# =====================================================================
# Cuidarte+ · Captura automatizada de evidencia
#
# Ejecuta las herramientas del plan de pruebas sobre una version del software
# y guarda su salida con la nomenclatura del informe. El objetivo es que la
# evidencia sea REPRODUCIBLE: cualquiera puede volver a generarla y obtener el
# mismo resultado, en vez de depender de capturas de pantalla sueltas.
#
# Uso:
#   ./capturar-evidencia.sh v1.0        # version con defectos
#   ./capturar-evidencia.sh v1.1        # version corregida
#
# Requisitos: Node 22+, npm, Docker (para los pasos de ambiente).
# Los pasos que requieren la aplicacion levantada se omiten con un aviso si
# no responde, en vez de abortar la captura completa.
# =====================================================================
set -uo pipefail

VERSION="${1:-}"
if [[ "$VERSION" != "v1.0" && "$VERSION" != "v1.1" ]]; then
  echo "Uso: $0 [v1.0|v1.1]" >&2
  exit 1
fi

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROYECTO="$AQUI/../codigo/cuidarte-plus-$VERSION"
SALIDA="$AQUI/$VERSION"
API_URL="${API_URL:-http://localhost:3000/api/v1}"

if [[ ! -d "$PROYECTO" ]]; then
  echo "No existe el proyecto: $PROYECTO" >&2
  exit 1
fi

mkdir -p "$SALIDA"

# --- Encabezado comun de cada archivo de evidencia -------------------
encabezado() {
  local archivo="$1" titulo="$2" caso="$3" requisito="$4"
  {
    echo "====================================================================="
    echo "EVIDENCIA · Cuidarte+ $VERSION"
    echo "---------------------------------------------------------------------"
    echo "Titulo      : $titulo"
    echo "Caso        : $caso"
    echo "Requisito   : $requisito"
    echo "Fecha        : $(date '+%Y-%m-%d %H:%M:%S %z')"
    echo "Ejecutado por: ${EJECUTOR:-equipo QA Cuidarte+}"
    echo "Comando      : ${COMANDO:-ver abajo}"
    echo "====================================================================="
    echo
  } > "$archivo"
}

paso() {
  echo
  echo "### $1"
}

# =====================================================================
# 1. Analisis estatico del codigo propio (SAST) · CP-SAST-01
# =====================================================================
paso "CP-SAST-01 · ESLint sobre la API"
ARCHIVO="$SALIDA/Anexo_3.1_CP-SAST-01_eslint-api.txt"
COMANDO="npm run lint (api)" encabezado "$ARCHIVO" \
  "Analisis estatico del codigo de la API" "CP-SAST-01" "NFR-SEG-5, NFR-CAL-5, ISO/IEC 25010"
(cd "$PROYECTO/api" && npm run lint 2>&1) >> "$ARCHIVO"
echo "codigo de salida: $?" >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

paso "CP-SAST-01 · ESLint sobre la SPA (seguridad y accesibilidad)"
ARCHIVO="$SALIDA/Anexo_3.2_CP-SAST-01_eslint-web.txt"
COMANDO="npm run lint (web)" encabezado "$ARCHIVO" \
  "Analisis estatico del codigo de la SPA" "CP-SAST-01 / CP-USA-01" "NFR-SEG-5, NFR-USAB-1 a 3, WCAG 2.1"
(cd "$PROYECTO/web" && npm run lint 2>&1) >> "$ARCHIVO"
echo "codigo de salida: $?" >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# =====================================================================
# 2. Pruebas automatizadas y cobertura · NFR-CAL-1
# =====================================================================
paso "CP-CAL-01 · Pruebas y cobertura (Jest)"
ARCHIVO="$SALIDA/Anexo_1.1_CP-CAL-01_jest-cobertura.txt"
COMANDO="npm run test:cov (api)" encabezado "$ARCHIVO" \
  "Pruebas unitarias e integracion con cobertura" "CP-CAL-01 y todos los CP automatizados" "NFR-CAL-1"
(cd "$PROYECTO/api" && npm run test:cov 2>&1) >> "$ARCHIVO"
echo "codigo de salida: $?" >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# =====================================================================
# 3. Escenarios de comportamiento (BDD) · RB-1, RB-2, RB-3
# =====================================================================
paso "Escenarios BDD (Cucumber)"
ARCHIVO="$SALIDA/Anexo_1.2_BDD_cucumber.txt"
COMANDO="npm run test:bdd (api)" encabezado "$ARCHIVO" \
  "Escenarios de comportamiento en lenguaje natural" "CP-SEG-01, CP-INT-04" "RB-1, RB-2, RB-3, RF-3.3, RF-5.1"
(cd "$PROYECTO/api" && npm run test:bdd 2>&1) >> "$ARCHIVO"
echo "codigo de salida: $?" >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# =====================================================================
# 4. Analisis de dependencias (SCA) · CP-SCA-01, NFR-CAL-4
# =====================================================================
paso "CP-SCA-01 · Auditoria de dependencias"
ARCHIVO="$SALIDA/Anexo_3.3_CP-SCA-01_npm-audit.txt"
COMANDO="npm audit" encabezado "$ARCHIVO" \
  "Vulnerabilidades conocidas en dependencias de terceros" "CP-SCA-01" "NFR-CAL-4, NFR-SEG-6, ISO/IEC 27001"
{
  echo "--- API · solo dependencias de produccion (las que se despliegan) ---"
  (cd "$PROYECTO/api" && npm audit --omit=dev 2>&1)
  echo "codigo de salida: $?"
  echo
  echo "--- API · todas las dependencias, umbral alto ---"
  (cd "$PROYECTO/api" && npm audit --audit-level=high 2>&1)
  echo "codigo de salida: $?"
  echo
  echo "--- API · resumen por severidad ---"
  (cd "$PROYECTO/api" && npm audit --json 2>/dev/null |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(JSON.stringify(a.metadata.vulnerabilities));}catch{console.log('sin datos')}})")
  echo
  echo "--- SPA · solo dependencias de produccion ---"
  (cd "$PROYECTO/web" && npm audit --omit=dev 2>&1)
  echo "codigo de salida: $?"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"
# =====================================================================
# 4b. Accesibilidad: contraste y anuncio de mensajes · CP-USA-01
# =====================================================================
paso "CP-USA-01 · Contraste WCAG y anuncio de mensajes"
ARCHIVO="$SALIDA/Anexo_5.1_CP-USA-01_contraste-y-aria.txt"
COMANDO="node verificar-contraste.mjs" encabezado "$ARCHIVO" \
  "Contraste de color y anuncio de mensajes de estado" "CP-USA-01" \
  "NFR-USAB-1, NFR-USAB-3, WCAG 2.1 (1.4.3, 1.4.11, 4.1.3), Ley 20.422"
{
  node "$AQUI/verificar-contraste.mjs" "$PROYECTO/web/src/estilos.css" 2>&1
  echo
  echo "codigo de salida: $?  (1 = hay incumplimientos)"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"


# =====================================================================
# 5. Construccion de la SPA · verifica que el frontend compila
# =====================================================================
paso "Construccion de la SPA"
ARCHIVO="$SALIDA/Anexo_1.3_build-spa.txt"
COMANDO="npm run build (web)" encabezado "$ARCHIVO" \
  "Construccion de produccion de la SPA" "CP-COMPAT-01" "NFR-COMPAT-1"
(cd "$PROYECTO/web" && npm run build 2>&1) >> "$ARCHIVO"
echo "codigo de salida: $?" >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# =====================================================================
# 6. Pasos que requieren la aplicacion levantada
# =====================================================================
if ! curl -sf --max-time 5 "$API_URL/salud" > /dev/null 2>&1; then
  echo
  echo "AVISO: la API no responde en $API_URL."
  echo "       Se omiten las comprobaciones dinamicas (cabeceras, RBAC, IDOR)."
  echo "       Levante el ambiente con:  docker compose up -d --build"
  echo
  echo "Evidencia estatica generada en: $SALIDA"
  exit 0
fi

# --- Utilidades para hablar con la API -------------------------------
obtener_token() {
  curl -s -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"nombreUsuario\":\"$1\",\"password\":\"Cuidarte2026!\"}" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).token||'')}catch{console.log('')}})"
}

# Convierte una ruta a la forma que entiende el curl del sistema.
#
# En Git Bash sobre Windows, `curl` es un binario nativo que NO resuelve
# rutas estilo POSIX como /tmp/x: una subida multipart con
# `-F archivo=@/tmp/x` falla silenciosamente y devuelve HTTP 000.
# `cygpath -w` traduce la ruta; en Linux y macOS no existe y la ruta se
# usa tal cual.
ruta_curl() {
  if command -v cygpath > /dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

estado() {
  # $1 metodo, $2 ruta, $3 token, $4 cuerpo (opcional)
  if [[ -n "${4:-}" ]]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API_URL$2" \
      -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API_URL$2" -H "Authorization: Bearer $3"
  fi
}

# Crea un examen desechable y devuelve su id.
#
# Cada seccion trabaja sobre su propio examen. Sin esto, una seccion que logra
# eliminar un examen (justamente lo que ocurre en la v1.0, donde el control de
# acceso esta roto) dejaria sin datos a las secciones siguientes y sus
# resultados serian ruido en vez de evidencia.
examen_desechable() {
  curl -s -X POST "$API_URL/examenes"     -H "Authorization: Bearer $TOKEN_MEDICO" -H 'Content-Type: application/json'     -d "{\"pacienteId\":1,\"tipo\":\"$1\"}" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch{console.log('')}})"
}

TOKEN_ADMIN="$(obtener_token admin1)"
TOKEN_MEDICO="$(obtener_token medico1)"
TOKEN_PACIENTE="$(obtener_token paciente1)"

# --- 6.1 Estado del ambiente ----------------------------------------
paso "Estado del ambiente QA (Docker)"
ARCHIVO="$SALIDA/Anexo_0.1_ambiente-docker.txt"
COMANDO="docker compose ps" encabezado "$ARCHIVO" \
  "Ambiente QA reproducible levantado" "Precondicion de todos los casos" "ERS §4"
{
  (cd "$PROYECTO" && docker compose ps 2>&1)
  echo
  echo "--- Healthcheck del servicio (NFR-DIS-3) ---"
  curl -s "$API_URL/salud"
  echo
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.2 Cabeceras de seguridad -------------------------------------
paso "CP-SEG-06 · Cabeceras de seguridad HTTP"
ARCHIVO="$SALIDA/Anexo_3.4_CP-SEG-06_cabeceras-seguridad.txt"
COMANDO="curl -D - $API_URL/salud" encabezado "$ARCHIVO" \
  "Cabeceras de seguridad en las respuestas HTTP" "CP-SEG-06" "NFR-SEG-10, NFR-SEG-1, OWASP A05"
{
  echo "--- Respuesta completa de /salud ---"
  curl -s -D - -o /dev/null "$API_URL/salud"
  echo
  echo "--- Verificacion cabecera por cabecera ---"
  CABECERAS="$(curl -s -D - -o /dev/null "$API_URL/salud")"
  for esperada in "Content-Security-Policy" "X-Content-Type-Options" "X-Frame-Options" \
                  "Strict-Transport-Security" "Referrer-Policy" "Permissions-Policy"; do
    if grep -qi "^$esperada:" <<< "$CABECERAS"; then
      echo "PRESENTE  $esperada"
    else
      echo "AUSENTE   $esperada   <-- incumple NFR-SEG-10"
    fi
  done
  if grep -qi "^X-Powered-By:" <<< "$CABECERAS"; then
    echo "PRESENTE  X-Powered-By   <-- revela el framework (OWASP A05)"
  else
    echo "AUSENTE   X-Powered-By   (correcto: no revela el framework)"
  fi
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.3 Control de acceso por rol ----------------------------------
paso "CP-SEG-01 · Control de acceso por rol (RBAC en backend)"
ARCHIVO="$SALIDA/Anexo_2.1_CP-SEG-01_rbac-backend.txt"
COMANDO="curl con token de cada rol" encabezado "$ARCHIVO" \
  "El control de acceso se aplica en el backend" "CP-SEG-01" "NFR-SEG-4, RB-1, RB-2, RB-3"
ID_RBAC="$(examen_desechable 'Examen para probar permisos')"
{
  echo "Las peticiones se envian directamente a la API, sin pasar por la interfaz."
  echo "Si el control estuviera solo en el frontend, estas operaciones tendrian exito."
  echo
  echo "Se usa un examen creado solo para esta comprobacion (id=$ID_RBAC), de"
  echo "modo que su eventual eliminacion no afecte a las demas secciones."
  echo
  printf '%-58s %-10s %s\n' "OPERACION" "OBTENIDO" "ESPERADO"
  printf '%-58s %-10s %s\n' "POST /examenes como PACIENTE" \
    "$(estado POST /examenes "$TOKEN_PACIENTE" '{"pacienteId":1,"tipo":"Examen no autorizado"}')" "403"
  printf '%-58s %-10s %s\n' "PUT /examenes/$ID_RBAC como PACIENTE" \
    "$(estado PUT "/examenes/$ID_RBAC" "$TOKEN_PACIENTE" '{"estado":"COMPLETADO"}')" "403"
  printf '%-58s %-10s %s\n' "DELETE /examenes/$ID_RBAC como PACIENTE" \
    "$(estado DELETE "/examenes/$ID_RBAC" "$TOKEN_PACIENTE")" "403"
  printf '%-58s %-10s %s\n' "POST /pacientes como PACIENTE" \
    "$(estado POST /pacientes "$TOKEN_PACIENTE" '{"rut":"20347024-K","nombres":"X","apellidos":"Y"}')" "403"
  printf '%-58s %-10s %s\n' "GET /usuarios como PACIENTE" \
    "$(estado GET /usuarios "$TOKEN_PACIENTE")" "403"
  printf '%-58s %-10s %s\n' "GET /auditoria como PACIENTE" \
    "$(estado GET /auditoria "$TOKEN_PACIENTE")" "403"
  printf '%-58s %-10s %s\n' "GET /usuarios como MEDICO" \
    "$(estado GET /usuarios "$TOKEN_MEDICO")" "403"
  printf '%-58s %-10s %s\n' "GET /usuarios como ADMIN" \
    "$(estado GET /usuarios "$TOKEN_ADMIN")" "200"
  printf '%-58s %-10s %s\n' "GET /auditoria como ADMIN" \
    "$(estado GET /auditoria "$TOKEN_ADMIN")" "200"
  printf '%-58s %-10s %s\n' "POST /examenes como MEDICO" \
    "$(estado POST /examenes "$TOKEN_MEDICO" '{"pacienteId":1,"tipo":"Hemograma de control"}')" "201"
  echo
  echo "Sin token (acceso anonimo):"
  printf '%-58s %-10s %s\n' "GET /pacientes sin Authorization" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/pacientes")" "401"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.4 Acceso a datos de terceros (IDOR) --------------------------
paso "CP-SEG-02 · Acceso a datos de terceros (IDOR)"
ARCHIVO="$SALIDA/Anexo_2.2_CP-SEG-02_idor.txt"
COMANDO="curl con token de paciente1 sobre recursos de paciente2" encabezado "$ARCHIVO" \
  "Un paciente no accede a la informacion clinica de otro" "CP-SEG-02" "RB-1, NFR-SEG-4, OWASP A01, Ley 19.628"
{
  echo "paciente1 esta vinculado a la ficha id=1; paciente2 a la ficha id=2."
  echo
  printf '%-58s %-10s %s\n' "OPERACION" "OBTENIDO" "ESPERADO"
  printf '%-58s %-10s %s\n' "GET /pacientes/1 (su propia ficha)" \
    "$(estado GET /pacientes/1 "$TOKEN_PACIENTE")" "200"
  printf '%-58s %-10s %s\n' "GET /pacientes/2 (ficha ajena)" \
    "$(estado GET /pacientes/2 "$TOKEN_PACIENTE")" "404"
  printf '%-58s %-10s %s\n' "GET /pacientes/1/examenes (propios)" \
    "$(estado GET /pacientes/1/examenes "$TOKEN_PACIENTE")" "200"
  printf '%-58s %-10s %s\n' "GET /pacientes/2/examenes (ajenos)" \
    "$(estado GET /pacientes/2/examenes "$TOKEN_PACIENTE")" "404"
  echo
  echo "--- Contenido que recibe paciente1 al listar pacientes ---"
  echo "(debe contener UNICAMENTE su propia ficha: minimizacion de datos)"
  curl -s "$API_URL/pacientes" -H "Authorization: Bearer $TOKEN_PACIENTE"
  echo
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.5 Inyeccion y escalada de privilegios ------------------------
paso "CP-SEG-03 · Inyeccion y escalada de privilegios"
ARCHIVO="$SALIDA/Anexo_2.3_CP-SEG-03_inyeccion.txt"
COMANDO="curl con payloads de inyeccion" encabezado "$ARCHIVO" \
  "Resistencia a SQLi, XSS almacenado y mass assignment" "CP-SEG-03" "NFR-SEG-5, OWASP A01/A03"
{
  echo "--- SQL Injection en el campo RUT ---"
  printf 'POST /pacientes con rut="12345678-5'"'"'; DROP TABLE paciente;--"  ->  HTTP %s (esperado 400)\n' \
    "$(estado POST /pacientes "$TOKEN_MEDICO" '{"rut":"12345678-5'"'"'; DROP TABLE paciente;--","nombres":"Ana","apellidos":"Perez"}')"
  printf 'GET /pacientes (comprobar que la tabla sigue operativa)           ->  HTTP %s (esperado 200)\n' \
    "$(estado GET /pacientes "$TOKEN_MEDICO")"
  echo
  echo "--- Escalada de privilegios por mass assignment ---"
  printf 'POST /auth/registro con {"rol":"ADMIN"}  ->  HTTP %s (esperado 400)\n' \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/registro" \
      -H 'Content-Type: application/json' \
      -d '{"nombreUsuario":"intruso.qa","email":"intruso@cuidarte.test","password":"Cuidarte2026!","rol":"ADMIN"}')"
  echo
  echo "--- XSS almacenado: se guarda un payload y se recupera ---"
  RESP_XSS="$(curl -s -X POST "$API_URL/examenes" \
    -H "Authorization: Bearer $TOKEN_MEDICO" -H 'Content-Type: application/json' \
    -d '{"pacienteId":1,"tipo":"Prueba XSS","descripcion":"<script>alert(1)</script>"}')"
  echo "Respuesta al crear:"
  echo "$RESP_XSS"
  echo
  echo "El valor se devuelve como dato JSON y no como documento HTML."
  echo "Content-Type de la respuesta:"
  curl -s -D - -o /dev/null "$API_URL/pacientes/1/examenes" -H "Authorization: Bearer $TOKEN_MEDICO" |
    grep -i '^content-type:'
  echo
  echo "La defensa de renderizado esta en la SPA: se verifica que el codigo"
  echo "(se busca el uso del atributo, con su llave de apertura: mencionarlo en"
  echo " un comentario no cuenta como uso)"
  echo "fuente del frontend no use dangerouslySetInnerHTML."
  if grep -rn 'dangerouslySetInnerHTML={' "$PROYECTO/web/src" 2>/dev/null; then
    echo "HALLAZGO: se encontro dangerouslySetInnerHTML  <-- vector de XSS (NFR-SEG-5)"
  else
    echo "Correcto: no se usa dangerouslySetInnerHTML en el frontend."
  fi
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.5b Inyeccion SQL en el filtro de auditoria -------------------
paso "CP-SEG-03b · Inyeccion SQL en el filtro de auditoria"
ARCHIVO="$SALIDA/Anexo_2.8_CP-SEG-03_inyeccion-sql.txt"
COMANDO="revision del codigo + payload contra /auditoria" encabezado "$ARCHIVO"   "Inyeccion SQL en el parametro de filtro de la auditoria" "CP-SEG-03" "NFR-SEG-5, OWASP A03, Ley 21.663"
{
  echo "Este hallazgo ilustra por que un plan de pruebas necesita VARIAS"
  echo "tecnicas: las pruebas unitarias corren contra el adaptador en memoria,"
  echo "que no ejecuta SQL, de modo que no pueden detectarlo. Solo aparece en"
  echo "la revision del codigo y en la prueba dinamica contra PostgreSQL."
  echo
  echo "--- 1. Revision del codigo (SAST / revision manual) ---"
  echo "La firma de la inyeccion es una interpolacion dentro de las comillas"
  echo "simples del SQL. Con parametros posicionales (\$1, \$2) eso no existe."
  echo "Se busca interpolacion de variables dentro de cadenas SQL:"
  if grep -rn "= '\${" "$PROYECTO/api/src/infrastructure/adapters/postgres/" 2>/dev/null; then
    echo
    echo "HALLAZGO: la condicion se construye concatenando el valor recibido."
    echo "Lo correcto es un parametro posicional (\$1, \$2, ...)."
  else
    echo "  (sin coincidencias)"
  fi
  echo
  echo "Consultas que SI usan parametros posicionales:"
  grep -rc "valores.push" "$PROYECTO/api/src/infrastructure/adapters/postgres/gatewaysPostgres.js" 2>/dev/null |
    sed "s/^/  usos de parametros posicionales: /"
  echo
  echo "--- 2. Prueba dinamica contra el servicio en ejecucion ---"
  echo "Peticion legitima (filtro por una accion existente):"
  printf '  GET /auditoria?accion=LOGIN  ->  HTTP %s
'     "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auditoria?accion=LOGIN" -H "Authorization: Bearer $TOKEN_ADMIN")"
  curl -s "$API_URL/auditoria?accion=LOGIN" -H "Authorization: Bearer $TOKEN_ADMIN" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log('  registros devueltos: '+j.length)}catch{console.log('  respuesta: '+s.slice(0,120))}})"
  echo
  echo "Payload de inyeccion (tautologia que deberia ser tratada como texto):"
  PAYLOAD="LOGIN%27%20OR%20%271%27%3D%271"
  printf "  GET /auditoria?accion=LOGIN' OR '1'='1  ->  HTTP %s
"     "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auditoria?accion=$PAYLOAD" -H "Authorization: Bearer $TOKEN_ADMIN")"
  RESP_SQLI="$(curl -s "$API_URL/auditoria?accion=$PAYLOAD" -H "Authorization: Bearer $TOKEN_ADMIN")"
  CANT_SQLI="$(node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(Array.isArray(j)?j.length:-1)}catch{console.log(-1)}})" <<< "$RESP_SQLI")"
  echo "  registros devueltos con el payload: $CANT_SQLI"
  echo
  if [[ "$CANT_SQLI" -gt 0 ]]; then
    echo "HALLAZGO CONFIRMADO: el payload altero la consulta y devolvio filas"
    echo "que el filtro legitimo no habria devuelto. La condicion inyectada se"
    echo "evaluo como SQL, no como texto. Vector de inyeccion explotable."
  else
    echo "Correcto: el payload se trato como un valor literal. La consulta no"
    echo "devolvio registros porque no existe ninguna accion con ese nombre,"
    echo "que es exactamente el comportamiento esperado de un parametro"
    echo "posicional."
  fi
  echo
  echo "Respuesta (primeros 300 caracteres):"
  echo "${RESP_SQLI:0:300}"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.6 Autenticacion, sesion y criptografia -----------------------
paso "CP-FUN-03 / CP-SEG-04 · Sesion y criptografia"
ARCHIVO="$SALIDA/Anexo_2.4_CP-SEG-04_sesion-y-criptografia.txt"
COMANDO="curl sobre /auth + consulta a la base" encabezado "$ARCHIVO" \
  "Revocacion de token y hashing de contrasenas" "CP-FUN-03, CP-SEG-04" "RF-1.2, NFR-SEG-2, NFR-SEG-9"
{
  echo "--- Revocacion de token en el logout (RF-1.2) ---"
  TOKEN_TMP="$(obtener_token medico1)"
  printf 'GET /auth/yo con token recien emitido  ->  HTTP %s (esperado 200)\n' \
    "$(estado GET /auth/yo "$TOKEN_TMP")"
  printf 'POST /auth/logout                      ->  HTTP %s (esperado 200)\n' \
    "$(estado POST /auth/logout "$TOKEN_TMP")"
  TRAS_LOGOUT="$(estado GET /auth/yo "$TOKEN_TMP")"
  printf 'GET /auth/yo con el MISMO token        ->  HTTP %s (esperado 401)\n' \
    "$TRAS_LOGOUT"
  echo
  echo "El token sigue siendo criptograficamente valido y no ha expirado, de"
  echo "modo que este resultado mide unicamente si la revocacion es efectiva."
  if [[ "$TRAS_LOGOUT" == "401" ]]; then
    echo "Correcto: la revocacion opera en el servidor y no solo en el cliente."
  else
    echo "HALLAZGO: el token SIGUE SIENDO ACEPTADO despues del logout."
    echo "El cierre de sesion solo descarta el token en el navegador; quien lo"
    echo "haya interceptado conserva el acceso hasta que expire. Incumple RF-1.2."
  fi
  echo
  echo "--- Algoritmo declarado en la cabecera del JWT ---"
  echo "$TOKEN_TMP" | cut -d. -f1 | base64 -d 2>/dev/null || true
  echo
  echo
  echo "--- Factor de costo de bcrypt en la base de datos (NFR-SEG-2) ---"
  (cd "$PROYECTO" && docker compose exec -T db psql -U "${POSTGRES_USER:-cuidarte}" \
    -d "${POSTGRES_DB:-cuidarte}" -c \
    "SELECT nombre_usuario, substring(password_hash,1,7) AS prefijo_y_costo, length(password_hash) AS largo FROM usuario ORDER BY id;" 2>&1)
  echo
  echo "Lectura: el prefijo \$2b\$NN indica el factor de costo. NFR-SEG-2 y"
  echo "OWASP exigen un minimo de 12. Ninguna contrasena aparece en claro."
  COSTO_OBSERVADO="$(cd "$PROYECTO" && docker compose exec -T db psql \
    -U "${POSTGRES_USER:-cuidarte}" -d "${POSTGRES_DB:-cuidarte}" -tAc \
    "SELECT DISTINCT substring(password_hash,5,2) FROM usuario;" 2>/dev/null |
    tr -d '[:space:]')"
  echo
  echo "Factor de costo observado en la base: $COSTO_OBSERVADO"
  if [[ "$COSTO_OBSERVADO" =~ ^(1[2-9]|[2-9][0-9])$ ]]; then
    echo "Correcto: el factor cumple el minimo exigido por NFR-SEG-2."
  else
    echo "HALLAZGO: el factor de costo es $COSTO_OBSERVADO, bajo el minimo 12."
    echo "Cada punto menos duplica la velocidad de un ataque de fuerza bruta"
    echo "offline; de 12 a 8 el ataque es unas 16 veces mas rapido."
    echo "Incumple NFR-SEG-2 e ISO/IEC 27001 A.8.24."
  fi
  echo
  echo "--- Verificacion de que la respuesta de login no filtra el hash ---"
  curl -s -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
    -d '{"nombreUsuario":"medico1","password":"Cuidarte2026!"}' |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=s.includes('\$2')?'HALLAZGO: la respuesta contiene un hash':'Correcto: la respuesta no contiene el hash';console.log(t)})"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.7 Unicidad de RUT --------------------------------------------
paso "CP-INT-05 · Unicidad del RUT del paciente"
ARCHIVO="$SALIDA/Anexo_2.5_CP-INT-05_rut-unico.txt"
COMANDO="curl POST /pacientes con RUT repetido" encabezado "$ARCHIVO" \
  "No se admiten dos pacientes con el mismo RUT" "CP-INT-05" "Integridad de datos, ISO/IEC 25010"
{
  echo "El paciente con RUT 12345678-5 ya existe en el ambiente."
  echo
  printf 'POST /pacientes con rut="12345678-5"    ->  HTTP %s (esperado 409)\n' \
    "$(estado POST /pacientes "$TOKEN_MEDICO" '{"rut":"12345678-5","nombres":"Otra","apellidos":"Persona"}')"
  printf 'POST /pacientes con rut="12.345.678-5"  ->  HTTP %s (esperado 409)\n' \
    "$(estado POST /pacientes "$TOKEN_MEDICO" '{"rut":"12.345.678-5","nombres":"Otra","apellidos":"Persona"}')"
  echo
  echo "El segundo caso es el mismo RUT escrito con puntos. Si el sistema"
  echo "respondiera 201, la restriccion de unicidad se podria evadir solo"
  echo "cambiando el formato de entrada."
  echo
  echo "--- Estado de la restriccion en la base de datos ---"
  (cd "$PROYECTO" && docker compose exec -T db psql -U "${POSTGRES_USER:-cuidarte}" \
    -d "${POSTGRES_DB:-cuidarte}" -c \
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='paciente';" 2>&1)
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.8 Auditoria y eliminacion logica -----------------------------
paso "CP-INT-04 · Auditoria y eliminacion logica"
ARCHIVO="$SALIDA/Anexo_2.6_CP-INT-04_auditoria-y-baja-logica.txt"
COMANDO="curl + consulta a la base" encabezado "$ARCHIVO" \
  "Registro de acciones criticas y baja logica" "CP-INT-04" "RF-3.3, RF-5.1, ISO/IEC 27001"
{
  echo "--- Ultimos registros de auditoria (RF-5.1) ---"
  curl -s "$API_URL/auditoria?limite=12" -H "Authorization: Bearer $TOKEN_ADMIN" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{for(const r of JSON.parse(s))console.log([r.creadoEn,r.accion,'usuario='+r.usuarioId,(r.entidad||'')+(r.entidadId?'#'+r.entidadId:'')].join('  '));}catch(e){console.log(s)}})"
  echo
  echo "--- Eliminacion logica de un examen (RF-3.3) ---"
  ID_EXAMEN="$(curl -s -X POST "$API_URL/examenes" -H "Authorization: Bearer $TOKEN_MEDICO" \
    -H 'Content-Type: application/json' -d '{"pacienteId":1,"tipo":"Examen para dar de baja"}' |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch{console.log('')}})")"
  echo "Examen creado con id=$ID_EXAMEN"
  printf 'DELETE /examenes/%s  ->  HTTP %s (esperado 200)\n' "$ID_EXAMEN" \
    "$(estado DELETE "/examenes/$ID_EXAMEN" "$TOKEN_MEDICO")"
  printf 'GET /examenes/%s (ya no debe estar activo)  ->  HTTP %s (esperado 404)\n' "$ID_EXAMEN" \
    "$(estado GET "/examenes/$ID_EXAMEN" "$TOKEN_MEDICO")"
  echo
  echo "El registro debe SEGUIR EXISTIENDO en la base, con su marca de baja:"
  (cd "$PROYECTO" && docker compose exec -T db psql -U "${POSTGRES_USER:-cuidarte}" \
    -d "${POSTGRES_DB:-cuidarte}" -c \
    "SELECT id, tipo, eliminado_en IS NOT NULL AS dado_de_baja FROM examen WHERE id = $ID_EXAMEN;" 2>&1)
  echo "Si la consulta no devuelve ninguna fila, la eliminacion fue FISICA y"
  echo "se incumple el criterio de aceptacion de RF-3.3."
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.9 Documentos clinicos ----------------------------------------
paso "CP-SEG-07 · Validacion de documentos clinicos"
ARCHIVO="$SALIDA/Anexo_2.7_CP-SEG-07_validacion-documentos.txt"
COMANDO="curl multipart con archivos de prueba" encabezado "$ARCHIVO" \
  "Solo se aceptan documentos de tipo permitido y contenido coherente" "CP-SEG-07" "NFR-SEG-12, RF-4.3, OWASP A04"
ID_DOCS="$(examen_desechable 'Examen para probar documentos')"
TMP="$(mktemp -d)"
printf '%%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%%%EOF\n' > "$TMP/informe-valido.pdf"
printf 'MZ\x90\x00\x03\x00\x00\x00ejecutable-de-windows' > "$TMP/malicioso.pdf"
printf '<html><script>alert(1)</script></html>' > "$TMP/pagina.html"
PDF_VALIDO="$(ruta_curl "$TMP/informe-valido.pdf")"
PDF_FALSO="$(ruta_curl "$TMP/malicioso.pdf")"
HTML_PRUEBA="$(ruta_curl "$TMP/pagina.html")"
{
  echo "Se intentan subir tres archivos al examen id=$ID_DOCS:"
  echo "  1. Un PDF real."
  echo "  2. Un ejecutable de Windows renombrado a .pdf y declarado como PDF."
  echo "  3. Un documento HTML con script."
  echo
  printf '%-56s %-10s %s\n' "ARCHIVO" "OBTENIDO" "ESPERADO"
  printf '%-56s %-10s %s\n' "informe-valido.pdf (PDF real)" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/examenes/$ID_DOCS/documentos" \
      -H "Authorization: Bearer $TOKEN_MEDICO" \
      -F "archivo=@$PDF_VALIDO;type=application/pdf")" "201"
  printf '%-56s %-10s %s\n' "malicioso.pdf (ejecutable disfrazado)" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/examenes/$ID_DOCS/documentos" \
      -H "Authorization: Bearer $TOKEN_MEDICO" \
      -F "archivo=@$PDF_FALSO;type=application/pdf")" "400"
  printf '%-56s %-10s %s\n' "pagina.html (tipo no permitido)" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/examenes/$ID_DOCS/documentos" \
      -H "Authorization: Bearer $TOKEN_MEDICO" \
      -F "archivo=@$HTML_PRUEBA;type=text/html")" "400"
  echo
  echo "El segundo caso es el relevante: el cliente DECLARA application/pdf."
  echo "Si el sistema solo confiara en ese dato, aceptaria el ejecutable."
  echo
  echo "--- Un paciente no puede adjuntar documentos (RB-1) ---"
  printf 'POST /examenes/%s/documentos como PACIENTE  ->  HTTP %s (esperado 403)\n' "$ID_DOCS" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/examenes/$ID_DOCS/documentos" \
      -H "Authorization: Bearer $TOKEN_PACIENTE" \
      -F "archivo=@$PDF_VALIDO;type=application/pdf")"
} >> "$ARCHIVO"
rm -rf "$TMP"
echo "  -> $(basename "$ARCHIVO")"

# --- 6.10 Logs del servicio -----------------------------------------
paso "CP-SEG-05 · Los logs no filtran datos sensibles"
ARCHIVO="$SALIDA/Anexo_3.5_CP-SEG-05_logs-sin-datos-sensibles.txt"
COMANDO="docker compose logs api" encabezado "$ARCHIVO" \
  "El registro del servicio no contiene credenciales ni datos clinicos" "CP-SEG-05" "NFR-SEG-6, NFR-SEG-15, Ley 19.628/21.719"
{
  echo "Se provoca un intento de acceso con una contrasena conocida y se busca"
  echo "esa contrasena en los logs del servicio."
  echo
  CLAVE_SONDA="SondaDeAuditoria2026!"
  curl -s -o /dev/null -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
    -d "{\"nombreUsuario\":\"medico1\",\"password\":\"$CLAVE_SONDA\"}"
  sleep 2
  LOGS="$(cd "$PROYECTO" && docker compose logs api --tail 200 2>&1)"
  if grep -q "$CLAVE_SONDA" <<< "$LOGS"; then
    echo "HALLAZGO: la contrasena aparece EN CLARO en los logs."
    echo "Incumple NFR-SEG-6 y el deber de seguridad del tratamiento de datos."
    echo
    echo "Lineas afectadas:"
    grep -n "$CLAVE_SONDA" <<< "$LOGS" | head -5
  else
    echo "Correcto: la contrasena NO aparece en los logs."
  fi
  echo
  echo "--- Ultimas lineas del log (para inspeccion) ---"
  tail -20 <<< "$LOGS"
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

echo
# --- 6.11 Rendimiento y carga ---------------------------------------
paso "CP-PERF-01 a CP-PERF-03 · Rendimiento y carga"
ARCHIVO="$SALIDA/Anexo_4.1_CP-PERF_rendimiento-y-carga.txt"
COMANDO="node medir-rendimiento.mjs --usuarios 200 --iteraciones 3" encabezado "$ARCHIVO" \
  "Latencia y tasa de error con 200 usuarios concurrentes" \
  "CP-PERF-01, CP-PERF-02, CP-PERF-03" "NFR-PERF-1, NFR-PERF-2, NFR-PERF-3"
{
  node "$AQUI/medir-rendimiento.mjs" --usuarios "${CARGA_USUARIOS:-200}" \
    --iteraciones "${CARGA_ITERACIONES:-3}" --url "$API_URL" 2>&1
  echo
  echo "Nota: el artefacto formal del plan es api/jmeter/cuidarte-carga.jmx,"
  echo "que mide los mismos umbrales con Apache JMeter. Este script produce"
  echo "las cifras citadas en el informe sin requerir esa instalacion."
} >> "$ARCHIVO"
echo "  -> $(basename "$ARCHIVO")"

echo "====================================================================="
echo "Evidencia de $VERSION generada en:"
echo "  $SALIDA"
echo "====================================================================="
ls -1 "$SALIDA"

#!/usr/bin/env python3
"""
Cuidarte+ · Generador de la version 1.0 (con defectos) a partir de la v1.1.

PARA QUE EXISTE ESTE SCRIPT
---------------------------
La EP02 exige detectar, clasificar y explicar defectos con evidencia real. Para
que esa evidencia sea reproducible y no una captura de pantalla aislada, la
version auditada (v1.0) se GENERA a partir de la version corregida (v1.1)
aplicando un conjunto de defectos conocidos y documentados.

Asi se consigue que:
  * Cada defecto tenga una ubicacion exacta en el codigo.
  * Las PRUEBAS sean identicas en ambas versiones, de modo que los fallos de la
    v1.0 sean comparables uno a uno con los exitos de la v1.1.
  * Cualquiera pueda regenerar la v1.0 y obtener los mismos hallazgos.

Los defectos NO son arbitrarios: son los que aparecen de forma habitual en
aplicaciones web reales y los que el OWASP Top 10, la Ley 19.628/21.719 y las
WCAG 2.1 permiten calificar como incumplimiento.

ADVERTENCIA
-----------
La v1.0 es material de laboratorio: es deliberadamente vulnerable y solo debe
ejecutarse en el ambiente QA local. No debe desplegarse ni exponerse a una red
publica.

USO
---
    python sembrar-defectos.py

Lee  codigo/cuidarte-plus-v1.1/  y escribe  codigo/cuidarte-plus-v1.0/.
"""

from __future__ import annotations

import io
import os
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ORIGEN = AQUI / "cuidarte-plus-v1.1"
DESTINO = AQUI / "cuidarte-plus-v1.0"

# Carpetas y archivos que no se copian: son artefactos o secretos locales.
EXCLUIDOS = {
    "node_modules",
    "coverage",
    "dist",
    "reportes",
    "storage-documentos",
    ".env",
    ".stryker-tmp",
}

# Hashes bcrypt de la contrasena de prueba "Cuidarte2026!" con FACTOR DE COSTO 8.
# Se generaron con:  node -e "require('bcryptjs').hash('Cuidarte2026!',8).then(console.log)"
# Reemplazan a los de costo 12 de la v1.1 para que el defecto sea visible al
# inspeccionar la base de datos (caso CP-SEG-04).
HASHES_COSTO_8 = {
    "admin1": "$2b$08$1cHIgM8IrPpwfWA.YpC3/OOhZVrfXliVOJDe/Nbnp.oUqGkeHFf/S",
    "medico1": "$2b$08$SpjL/.OqqvIo41a/C56s7OBa0MthE5iNBPPGCRvicedjgZ.jc1DBu",
    "medico2": "$2b$08$4OnLlapIrfYLimlQkRZAduzZvp68OP8H.m3PnHBvF7zQDUsMhaO96",
    "paciente1": "$2b$08$/8WrqW56fu8IOdEG0jU1fe19HAmn326mpzLYmjgDUHwVS6TJmZZz6",
    "paciente2": "$2b$08$UZU9onlJzQSMXHGiQa0OSutaYM9ezUe8rPYXvtk6g9cGc6XpYG3g6",
}

SALTO = chr(10)

aplicados: list[tuple[str, str, str]] = []


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def leer(ruta_relativa: str) -> str:
    return io.open(DESTINO / ruta_relativa, encoding="utf-8").read()


def escribir(ruta_relativa: str, contenido: str) -> None:
    io.open(DESTINO / ruta_relativa, "w", encoding="utf-8", newline="\n").write(contenido)


def sustituir(incidente: str, ruta_relativa: str, viejo: str, nuevo: str, descripcion: str) -> None:
    """Aplica una sustitucion unica y falla de inmediato si el ancla cambio."""
    texto = leer(ruta_relativa)
    if viejo not in texto:
        print(f"ERROR [{incidente}] ancla no encontrada en {ruta_relativa}", file=sys.stderr)
        print(f"       se buscaba: {viejo[:90]!r}", file=sys.stderr)
        sys.exit(1)
    escribir(ruta_relativa, texto.replace(viejo, nuevo, 1))
    aplicados.append((incidente, ruta_relativa, descripcion))


def copiar_arbol() -> None:
    """Regenera el arbol de la v1.0 conservando las dependencias instaladas.

    `node_modules` se aparta antes de borrar y se restaura despues: asi el
    script se puede volver a ejecutar sin reinstalar cientos de paquetes, lo
    que importa porque la v1.0 se regenera cada vez que se ajusta un defecto.
    """
    apartados: list[tuple[Path, Path]] = []
    env_local: str | None = None
    if DESTINO.exists():
        # El .env del ambiente QA se conserva: contiene los secretos locales y
        # regenerarlo obligaria a volver a configurar el ambiente cada vez.
        if (DESTINO / ".env").is_file():
            env_local = io.open(DESTINO / ".env", encoding="utf-8").read()
        reserva = AQUI / ".reserva-node-modules"
        if reserva.exists():
            shutil.rmtree(reserva)
        for paquete in ("api", "web"):
            origen_nm = DESTINO / paquete / "node_modules"
            if origen_nm.is_dir():
                destino_nm = reserva / paquete / "node_modules"
                destino_nm.parent.mkdir(parents=True, exist_ok=True)
                os.rename(origen_nm, destino_nm)
                apartados.append((destino_nm, DESTINO / paquete / "node_modules"))
        shutil.rmtree(DESTINO)

    def ignorar(_directorio: str, nombres: list[str]) -> set[str]:
        return {n for n in nombres if n in EXCLUIDOS}

    shutil.copytree(ORIGEN, DESTINO, ignore=ignorar)

    if env_local is not None:
        io.open(DESTINO / ".env", "w", encoding="utf-8", newline='\n').write(env_local)
        print("Archivo .env del ambiente QA conservado")

    for guardado, final in apartados:
        final.parent.mkdir(parents=True, exist_ok=True)
        os.rename(guardado, final)
    if apartados:
        reserva = AQUI / ".reserva-node-modules"
        if reserva.exists():
            shutil.rmtree(reserva)
        print(f"Dependencias conservadas: {len(apartados)} directorio(s) node_modules")

    print(f"Copiado {ORIGEN.name} -> {DESTINO.name}")


# ---------------------------------------------------------------------------
# INC-01 · Unicidad de RUT ausente  (GRAVE)
#
# Origen: la comparacion de RUT se hace sobre el texto tal como lo escribio el
# usuario, sin normalizar, y la base de datos no tiene restriccion unica.
# Impacto: se crean fichas clinicas duplicadas para la misma persona. Los
# examenes quedan repartidos entre dos fichas y el historial clinico deja de
# ser confiable.
# Norma: integridad funcional (ISO/IEC 25010); exactitud del dato personal
# (Ley 19.628 art. 6, principio de calidad de los datos).
# Caso que lo detecta: CP-INT-05.
# ---------------------------------------------------------------------------
def inc_01_rut_duplicado() -> None:
    ruta = "api/src/domain/model/Paciente.js"
    sustituir(
        "INC-01",
        ruta,
        """export function normalizarRut(rut) {
  if (typeof rut !== 'string') {
    throw new DatosInvalidos('El RUT es obligatorio');
  }
  const limpio = rut.replace(/[.\\s]/g, '').toUpperCase();
  const match = /^(\\d{7,8})-?([\\dK])$/.exec(limpio);
  if (!match) {
    throw new DatosInvalidos(`Formato de RUT invalido: ${rut}`);
  }
  const [, cuerpo, dv] = match;
  if (digitoVerificador(cuerpo) !== dv) {
    throw new DatosInvalidos(`El digito verificador del RUT ${rut} no es valido`);
  }
  return `${cuerpo}-${dv}`;
}""",
        """export function normalizarRut(rut) {
  if (typeof rut !== 'string') {
    throw new DatosInvalidos('El RUT es obligatorio');
  }
  // Se guarda el RUT tal como lo escribio el usuario, solo recortando espacios.
  return rut.trim().toUpperCase();
}""",
        "normalizarRut deja de normalizar: '12.345.678-5' y '12345678-5' se "
        "consideran RUT distintos y tampoco se valida el digito verificador",
    )

    # Sin el indice unico, la base tampoco frena el duplicado: se pierde la
    # defensa en profundidad y queda una sola capa (que ya esta rota).
    sustituir(
        "INC-01",
        "api/src/infrastructure/adapters/postgres/schema.sql",
        """CREATE UNIQUE INDEX IF NOT EXISTS paciente_rut_uk
    ON paciente (rut) WHERE eliminado_en IS NULL;""",
        """-- TODO: agregar la restriccion de unicidad del RUT.
CREATE INDEX IF NOT EXISTS paciente_rut_idx
    ON paciente (rut) WHERE eliminado_en IS NULL;""",
        "el indice unico de paciente.rut se degrada a indice normal: la base de "
        "datos ya no impide el duplicado",
    )

    # Tambien se relaja el CHECK de formato, porque con RUT sin normalizar los
    # valores con puntos ya no cumplirian la expresion regular.
    sustituir(
        "INC-01",
        "api/src/infrastructure/adapters/postgres/schema.sql",
        """    CONSTRAINT paciente_rut_formato CHECK (rut ~ '^[0-9]{7,8}-[0-9K]$')""",
        """    CONSTRAINT paciente_rut_formato CHECK (length(rut) BETWEEN 8 AND 12)""",
        "el CHECK de formato del RUT se relaja a una simple comprobacion de largo",
    )


# ---------------------------------------------------------------------------
# INC-02 · Inyeccion SQL en el filtro de auditoria  (CRITICO)
#
# Origen: el valor del filtro `accion` se concatena dentro de la consulta en
# vez de viajar como parametro posicional.
# Impacto: un administrador comprometido —o cualquiera que logre un token de
# administrador— puede leer o alterar toda la base, incluidos los datos
# clinicos y el propio registro de auditoria que deberia probar lo ocurrido.
# Norma: OWASP A03 (Injection); NFR-SEG-5; Ley 21.663 (deber de gestion de
# incidentes); Ley 19.628/21.719 (deber de seguridad del tratamiento).
# Caso que lo detecta: CP-SEG-03 (y el analisis estatico de SonarQube).
#
# Nota didactica: este defecto NO lo detectan las pruebas unitarias, porque
# estas corren contra el adaptador en memoria, que no ejecuta SQL. Solo
# aparece en el analisis estatico, en la revision manual y en la prueba
# dinamica contra PostgreSQL. Es el ejemplo de por que un plan de pruebas
# necesita varias tecnicas y no solo cobertura de pruebas.
# ---------------------------------------------------------------------------
def inc_02_inyeccion_sql() -> None:
    sustituir(
        "INC-02",
        "api/src/infrastructure/adapters/postgres/gatewaysPostgres.js",
        """    if (filtro.accion) {
      valores.push(filtro.accion);
      condiciones.push(`accion = $${valores.length}`);
    }""",
        """    if (filtro.accion) {
      // Se arma la condicion concatenando el valor recibido.
      condiciones.push(`accion = '${filtro.accion}'`);
    }""",
        "el filtro `accion` de /auditoria se concatena en la consulta SQL en vez "
        "de usar un parametro posicional",
    )


# ---------------------------------------------------------------------------
# INC-03 · Factor de costo de bcrypt insuficiente  (GRAVE)
#
# Origen: el factor de costo se fijo en 8, por debajo del minimo de 12 que
# recomienda la guia de almacenamiento de contrasenas de OWASP.
# Impacto: cada reduccion de un punto en el factor DUPLICA la velocidad de un
# ataque de fuerza bruta offline. De 12 a 8 el ataque es unas 16 veces mas
# rapido, de modo que un volcado de la tabla de usuarios se vuelve explotable.
# Norma: NFR-SEG-2; ISO/IEC 27001 A.8.24 (uso de criptografia);
# Ley 19.628/21.719 (deber de seguridad del tratamiento).
# Caso que lo detecta: CP-SEG-04 (y la prueba unitaria de password.test.js).
# ---------------------------------------------------------------------------
def inc_03_bcrypt_debil() -> None:
    sustituir(
        "INC-03",
        "api/src/infrastructure/security/password.js",
        """export const COSTO_BCRYPT = Number(process.env.BCRYPT_COST ?? 12);

/** Minimo absoluto aceptado; por debajo de esto el arranque falla. */
const COSTO_MINIMO_ACEPTADO = 12;

if (COSTO_BCRYPT < COSTO_MINIMO_ACEPTADO) {
  throw new Error(
    `BCRYPT_COST=${COSTO_BCRYPT} es inseguro. Minimo exigido por NFR-SEG-2: ${COSTO_MINIMO_ACEPTADO}`,
  );
}""",
        """// Se baja el costo para acelerar el login y las pruebas.
export const COSTO_BCRYPT = Number(process.env.BCRYPT_COST ?? 8);""",
        "el factor de costo de bcrypt baja de 12 a 8 y se elimina la verificacion "
        "que impedia arrancar con un valor inseguro",
    )

    # El ambiente y los datos de prueba se alinean con el defecto, para que sea
    # observable al inspeccionar la base de datos.
    sustituir(
        "INC-03",
        "api/.env.example",
        "BCRYPT_COST=12",
        "BCRYPT_COST=8",
        "el valor por defecto del ambiente pasa a 8",
    )
    sustituir(
        "INC-03",
        ".env.example",
        "BCRYPT_COST=12",
        "BCRYPT_COST=8",
        "el ambiente de docker compose usa costo 8",
    )

    semilla = leer("api/src/infrastructure/adapters/postgres/seed.sql")
    hashes_v11 = {
        "admin1": "$2b$12$Tss50kI6xDBW7qmG4SQ4D.rDkZaXdQZvaIwu/Tqeb4zYkZmYWfvsK",
        "medico1": "$2b$12$SRaq4hCGAC3yDMvyk9OU2.cr2RBF28UoLFVSV9HQCA5wqWGuSDgfy",
        "medico2": "$2b$12$N31fsTNvMIV6jNiGrHshYeKv5cSTcY2I7Oc7lAuyagdl2SMO/bT8W",
        "paciente1": "$2b$12$IaHhW3fxYqI2MPKbcY7Hmu7HFpTeGTo/2DL0Tu29MbU/DthWYU.JK",
        "paciente2": "$2b$12$KIB9249wter6xRR/kaOn1etqCfJhPf4LaPkiGPkGlWtC.UylyZMqO",
    }
    for usuario, hash_v11 in hashes_v11.items():
        if hash_v11 not in semilla:
            print(f"ERROR [INC-03] no se encontro el hash de {usuario} en seed.sql", file=sys.stderr)
            sys.exit(1)
        semilla = semilla.replace(hash_v11, HASHES_COSTO_8[usuario], 1)
    semilla = semilla.replace(
        "-- Los hashes son bcrypt con factor de costo 12 (NFR-SEG-2). Esta credencial",
        "-- Los hashes son bcrypt con factor de costo 8. Esta credencial",
        1,
    )
    escribir("api/src/infrastructure/adapters/postgres/seed.sql", semilla)
    aplicados.append(
        (
            "INC-03",
            "api/src/infrastructure/adapters/postgres/seed.sql",
            "los hashes de los usuarios de prueba se regeneran con costo 8",
        )
    )


# ---------------------------------------------------------------------------
# INC-04 · XSS almacenado por renderizado sin escape  (CRITICO)
#
# Origen: la descripcion del examen se inserta en el DOM con
# `dangerouslySetInnerHTML`, lo que desactiva el escape automatico de React.
# Impacto: cualquier medico (o cualquiera que logre escribir una descripcion)
# puede inyectar un script que se ejecuta en el navegador de quien consulte la
# ficha. Con el token en sessionStorage, el script puede exfiltrar la sesion y
# con ella toda la informacion clinica a la que esa sesion tenga acceso.
# Norma: OWASP A03 (Injection); NFR-SEG-5; Ley 19.628/21.719 (confidencialidad
# de datos sensibles de salud); Ley 21.663 (gestion y notificacion del
# incidente).
# Caso que lo detecta: CP-SEG-03 y CP-SAST-01 (ESLint lo marca como error).
# ---------------------------------------------------------------------------
def inc_04_xss_almacenado() -> None:
    sustituir(
        "INC-04",
        "web/src/componentes/Examenes.jsx",
        """          {/* Interpolacion de texto: React escapa el contenido, de modo que un
              valor con etiquetas HTML se muestra literal y no se ejecuta. */}
          <p style={{ margin: '0 0 0.6rem', color: 'var(--texto-suave)' }}>
            {examen.descripcion || 'Sin descripcion registrada.'}
          </p>""",
        """          {/* Se permite formato enriquecido en la descripcion del examen. */}
          <p
            style={{ margin: '0 0 0.6rem', color: 'var(--texto-suave)' }}
            dangerouslySetInnerHTML={{
              __html: examen.descripcion || 'Sin descripcion registrada.',
            }}
          />""",
        "la descripcion del examen se renderiza con dangerouslySetInnerHTML, "
        "desactivando el escape de React",
    )


# ---------------------------------------------------------------------------
# INC-05 · Datos sensibles en los registros del servicio  (GRAVE)
#
# Origen: el logger no enmascara ningun campo y, ademas, se registra el cuerpo
# completo de cada peticion.
# Impacto: las contrasenas en claro y los datos clinicos quedan escritos en los
# logs. Los logs se copian, se envian a sistemas de observabilidad y los
# consultan personas que no tienen por que acceder a esa informacion; el
# incidente se propaga mucho mas alla del servidor.
# Norma: NFR-SEG-6; Ley 19.628/21.719 (principios de finalidad y
# minimizacion); ISO/IEC 27001 A.8.15 (registro de eventos).
# Caso que lo detecta: CP-SEG-05.
# ---------------------------------------------------------------------------
def inc_05_logs_con_datos_sensibles() -> None:
    sustituir(
        "INC-05",
        "api/src/infrastructure/config/logger.js",
        """export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordActual',
      'req.body.refreshToken',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  // Formato ISO para que los registros sean correlacionables con la auditoria.
  timestamp: pino.stdTimeFunctions.isoTime,
});""",
        """export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  // Formato ISO para que los registros sean correlacionables con la auditoria.
  timestamp: pino.stdTimeFunctions.isoTime,
});""",
        "se elimina la configuracion `redact`: ningun campo se enmascara en el log",
    )

    # Traza de depuracion olvidada en el middleware de validacion. Es la forma
    # habitual en que este defecto llega a produccion: alguien agrega un log
    # para depurar un 400 y no lo retira. Con `redact` configurado, el campo
    # quedaria enmascarado; al haberlo eliminado, la contrasena se escribe en
    # claro. Los dos cambios juntos son lo que produce el incidente.
    sustituir(
        "INC-05",
        "api/src/infrastructure/entrypoints/rest/middleware/validacion.js",
        """export function validar(esquema, origen = 'body') {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen]);""",
        """export function validar(esquema, origen = 'body') {
  return (req, _res, next) => {
    // Traza temporal para depurar los rechazos de validacion.
    logger.info({ ruta: req.originalUrl, [origen]: req[origen] }, 'Peticion recibida');

    const resultado = esquema.safeParse(req[origen]);""",
        "una traza de depuracion registra el cuerpo completo de cada peticion, "
        "incluida la contrasena del login",
    )

    sustituir(
        "INC-05",
        "api/src/infrastructure/entrypoints/rest/middleware/validacion.js",
        """import { DatosInvalidos } from '../../../../domain/error/errors.js';""",
        """import { DatosInvalidos } from '../../../../domain/error/errors.js';
import { logger } from '../../../config/logger.js';""",
        "se importa el logger en el middleware de validacion",
    )


# ---------------------------------------------------------------------------
# INC-06 · Cabeceras de seguridad ausentes y CORS permisivo  (GRAVE)
#
# Origen: no se aplican las cabeceras de seguridad y la politica CORS acepta
# cualquier origen con credenciales.
# Impacto: sin Content-Security-Policy la aplicacion pierde la mitigacion de
# ultimo recurso frente al XSS de INC-04; sin X-Frame-Options es encuadrable
# (clickjacking); con CORS abierto cualquier sitio puede leer respuestas
# autenticadas desde el navegador de la victima.
# Norma: NFR-SEG-10 (propuesto); NFR-SEG-5; OWASP A05 (Security
# Misconfiguration).
# Caso que lo detecta: CP-SEG-06 y el escaneo DAST con OWASP ZAP.
# ---------------------------------------------------------------------------
def inc_06_sin_cabeceras_seguridad() -> None:
    sustituir(
        "INC-06",
        "api/src/app.js",
        """  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  // No revelar el framework en las respuestas (OWASP A05).
  app.disable('x-powered-by');""",
        """  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));""",
        "se deja activa la cabecera X-Powered-By, que revela el framework",
    )

    sustituir(
        "INC-06",
        "api/src/app.js",
        """  app.use(cabecerasSeguridad());
  app.use(corsRestringido());""",
        """  // TODO: revisar las cabeceras de seguridad antes de pasar a produccion.
  app.use(corsAbierto());""",
        "no se aplican las cabeceras de seguridad (CSP, HSTS, X-Frame-Options, "
        "X-Content-Type-Options, Referrer-Policy, Permissions-Policy)",
    )

    sustituir(
        "INC-06",
        "api/src/app.js",
        """import {
  cabecerasSeguridad,
  corsRestringido,
  limitadorGeneral,
} from './infrastructure/entrypoints/rest/middleware/seguridad.js';""",
        """import {
  corsAbierto,
  limitadorGeneral,
} from './infrastructure/entrypoints/rest/middleware/seguridad.js';""",
        "se deja de importar el middleware de cabeceras de seguridad",
    )

    sustituir(
        "INC-06",
        "api/src/infrastructure/entrypoints/rest/middleware/seguridad.js",
        """export function corsRestringido() {
  const permitidos = (process.env.CORS_ORIGENES ?? 'http://localhost:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

  return cors({
    origin(origen, callback) {
      // Sin cabecera Origin (curl, Postman, health checks) se permite.
      if (!origen || permitidos.includes(origen)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origen}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}""",
        """export function corsAbierto() {
  // Se acepta cualquier origen para no bloquear a los clientes durante el
  // desarrollo.
  return cors({ origin: true, credentials: true });
}""",
        "la politica CORS acepta cualquier origen con credenciales",
    )


# ---------------------------------------------------------------------------
# INC-07 · Accesibilidad: contraste insuficiente y errores no anunciados
#          (MODERADO)
#
# Origen: la paleta de estados usa tonos claros que no alcanzan la relacion de
# contraste minima, y los avisos se insertan en el DOM sin `role` ni
# `aria-live`.
# Impacto: una persona con baja vision no distingue el mensaje de error del
# fondo, y una persona ciega no recibe ninguna senal de que la operacion fallo:
# completa el formulario, lo envia y queda sin informacion. El ERS senala
# expresamente a los adultos mayores como usuarios objetivo.
# Norma: WCAG 2.1 criterios 1.4.3 (contraste minimo) y 4.1.3 (mensajes de
# estado); NFR-USAB-1 y NFR-USAB-3; Ley 20.422 (inclusion de personas con
# discapacidad).
# Caso que lo detecta: CP-USA-01 (Lighthouse / revision manual).
# ---------------------------------------------------------------------------
def inc_07_accesibilidad() -> None:
    sustituir(
        "INC-07",
        "web/src/estilos.css",
        """  --texto: #1c2733; /* 13.6:1  */
  --texto-suave: #4a5a6a; /*  6.5:1  */""",
        """  --texto: #1c2733;
  --texto-suave: #a8b2bd;""",
        "el color de texto secundario pasa a #a8b2bd (contraste 1.9:1 sobre "
        "blanco, muy por debajo del minimo 4.5:1)",
    )

    sustituir(
        "INC-07",
        "web/src/estilos.css",
        """  --error: #a3281f; /*  6.1:1  */
  --error-fondo: #fdecea;
  --exito: #1c6b3a; /*  5.4:1  */
  --exito-fondo: #e8f5ec;
  --aviso: #7a4d00; /*  6.2:1  */
  --aviso-fondo: #fdf3e2;""",
        """  --error: #f08c84;
  --error-fondo: #fdecea;
  --exito: #7fd1a0;
  --exito-fondo: #e8f5ec;
  --aviso: #e0b964;
  --aviso-fondo: #fdf3e2;""",
        "los colores de estado se aclaran: el error queda en 2.2:1 sobre su "
        "fondo, incumpliendo WCAG 1.4.3",
    )

    sustituir(
        "INC-07",
        "web/src/componentes/Aviso.jsx",
        """  return (
    <div
      className={`aviso aviso--${tipo}`}
      role={tipo === 'error' ? 'alert' : 'status'}
      aria-live={tipo === 'error' ? 'assertive' : 'polite'}
    >""",
        """  return (
    <div className={`aviso aviso--${tipo}`}>""",
        "el contenedor de avisos pierde `role` y `aria-live`: el lector de "
        "pantalla no anuncia los errores (WCAG 4.1.3)",
    )

    sustituir(
        "INC-07",
        "web/src/componentes/Aviso.jsx",
        """export function RegionViva({ texto }) {
  return (
    <p aria-live="polite" className="campo__pista" style={{ minHeight: '1.4em' }}>
      {texto}
    </p>
  );
}""",
        """export function RegionViva({ texto }) {
  return (
    <p className="campo__pista" style={{ minHeight: '1.4em' }}>
      {texto}
    </p>
  );
}""",
        "la region viva deja de ser viva: los cambios de estado no se anuncian",
    )


# ---------------------------------------------------------------------------
# INC-08 · Dependencia de terceros con vulnerabilidad conocida  (GRAVE)
#
# Origen: se incorporo `lodash@4.17.15`, version con vulnerabilidad publicada
# de contaminacion de prototipo (CVE-2020-8203 y relacionadas).
# Impacto: una dependencia vulnerable es codigo ejecutandose en el servidor con
# los mismos privilegios que la aplicacion. La contaminacion de prototipo
# permite alterar el comportamiento de objetos del sistema y, segun el caso,
# derivar en denegacion de servicio o ejecucion de codigo.
# Norma: NFR-CAL-4 (propuesto); NFR-SEG-6; OWASP A06 (Vulnerable and Outdated
# Components); ISO/IEC 27001 A.8.8 (gestion de vulnerabilidades tecnicas).
# Caso que lo detecta: CP-SCA-01 (`npm audit` / Snyk).
# ---------------------------------------------------------------------------
def inc_08_dependencia_vulnerable() -> None:
    sustituir(
        "INC-08",
        "api/package.json",
        """    "jsonwebtoken": "9.0.3",""",
        """    "jsonwebtoken": "9.0.3",
    "lodash": "4.17.15",""",
        "se agrega lodash 4.17.15, con vulnerabilidad conocida de contaminacion "
        "de prototipo (CVE-2020-8203)",
    )

    # La dependencia se usa de verdad: una dependencia declarada y no usada
    # podria descartarse como falso positivo al revisar el hallazgo.
    sustituir(
        "INC-08",
        "api/src/application/usecase/AuditoriaUseCase.js",
        """import { ROLES } from '../../domain/model/roles.js';
import { NoAutorizado } from '../../domain/error/errors.js';""",
        """import lodash from 'lodash';
import { ROLES } from '../../domain/model/roles.js';
import { NoAutorizado } from '../../domain/error/errors.js';""",
        "la dependencia vulnerable se importa en el caso de uso de auditoria",
    )

    sustituir(
        "INC-08",
        "api/src/application/usecase/AuditoriaUseCase.js",
        """    const limite = Math.min(Number(filtro?.limite ?? 100), 500);
    return this.auditoria.listar({ ...filtro, limite });""",
        """    const limite = Math.min(Number(filtro?.limite ?? 100), 500);
    return this.auditoria.listar(lodash.merge({}, filtro, { limite }));""",
        "se usa lodash.merge, que es justamente la funcion afectada por la "
        "vulnerabilidad de contaminacion de prototipo",
    )


# ---------------------------------------------------------------------------
# INC-09 · Eliminacion fisica en vez de logica  (GRAVE)
#
# Origen: el borrado del examen ejecuta DELETE y destruye el registro.
# Impacto: se pierde el historial clinico de forma irreversible y la auditoria
# queda apuntando a un registro inexistente, de modo que ya no es posible
# reconstruir que se elimino ni verificarlo ante un reclamo del paciente.
# Norma: criterio de aceptacion de RF-3.3 (eliminacion logica previa
# confirmacion); ISO/IEC 27001 A.8.15; Ley 19.628/21.719 (trazabilidad del
# tratamiento).
# Caso que lo detecta: CP-INT-04 y el escenario BDD de baja logica.
# ---------------------------------------------------------------------------
def inc_09_eliminacion_fisica() -> None:
    sustituir(
        "INC-09",
        "api/src/infrastructure/adapters/postgres/gatewaysPostgres.js",
        """  /** Baja LOGICA: el registro permanece para auditoria (RF-3.3). */
  async eliminar(id) {
    const { rowCount } = await this.pool.query(
      `UPDATE examen SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return rowCount > 0;
  }""",
        """  async eliminar(id) {
    const { rowCount } = await this.pool.query(`DELETE FROM examen WHERE id = $1`, [id]);
    return rowCount > 0;
  }""",
        "ExamenGatewayPg.eliminar ejecuta DELETE y destruye el registro",
    )

    sustituir(
        "INC-09",
        "api/src/infrastructure/adapters/memory/gatewaysMemoria.js",
        """  async eliminar(id) {
    return this.base.marcarEliminado(id);
  }

  /** Solo para pruebas: permite comprobar que la baja fue logica y no fisica. */
  obtenerIncluyendoEliminados(id) {""",
        """  async eliminar(id) {
    return this.base.items.delete(Number(id));
  }

  /** Solo para pruebas: permite comprobar que la baja fue logica y no fisica. */
  obtenerIncluyendoEliminados(id) {""",
        "el adaptador en memoria tambien borra fisicamente, para que el defecto "
        "sea visible en las pruebas",
    )

    sustituir(
        "INC-09",
        "api/src/application/usecase/ExamenUseCase.js",
        """    return { eliminado: true, logica: true };""",
        """    return { eliminado: true };""",
        "la respuesta deja de declarar que la baja fue logica",
    )


# ---------------------------------------------------------------------------
# INC-10 · Sesion no revocable y secreto por defecto  (CRITICO)
#
# Origen: el cierre de sesion no registra el token como revocado, y el servicio
# arranca con un secreto de firma por defecto si falta la variable de entorno.
# Impacto: un token robado sigue siendo valido hasta expirar, aunque la persona
# haya cerrado sesion; y con un secreto por defecto conocido, cualquiera puede
# FIRMAR tokens validos y suplantar a un administrador.
# Norma: RF-1.2 (logout invalida la sesion); NFR-SEG-9; NFR-SEG-13 (gestion de
# secretos); OWASP A02 (Cryptographic Failures) y A07 (Identification and
# Authentication Failures).
# Caso que lo detecta: CP-FUN-03.
# ---------------------------------------------------------------------------
def inc_10_sesion_no_revocable() -> None:
    sustituir(
        "INC-10",
        "api/src/infrastructure/security/token.js",
        """function secretoDeAcceso() {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      'JWT_SECRET ausente o demasiado corto (minimo 32 caracteres). ' +
        'Definalo como variable de entorno; no debe estar en el codigo (NFR-SEG-13).',
    );
  }
  return secreto;
}""",
        """// Valor por defecto para que el servicio pueda arrancar sin configuracion.
const SECRETO_POR_DEFECTO = 'cuidarte-plus-secreto-de-desarrollo';

function secretoDeAcceso() {
  return process.env.JWT_SECRET ?? SECRETO_POR_DEFECTO;
}""",
        "el secreto de firma del JWT tiene un valor por defecto escrito en el "
        "codigo y no se valida su longitud",
    )

    sustituir(
        "INC-10",
        "api/src/application/usecase/AuthUseCase.js",
        """    if (!jti) {
      throw new DatosInvalidos('El token no contiene identificador de sesion (jti)');
    }
    await this.sesiones.revocar(jti, expiraEn);
    await this.auditoria.registrar({""",
        """    if (!jti) {
      throw new DatosInvalidos('El token no contiene identificador de sesion (jti)');
    }
    // El cliente descarta el token al cerrar sesion.
    await this.auditoria.registrar({""",
        "el logout no registra el token en la lista de revocacion: la sesion "
        "sigue siendo valida hasta que el token expire",
    )


# ---------------------------------------------------------------------------
# INC-11 · Escalada de privilegios en el autorregistro  (CRITICO)
#
# Origen: el esquema de validacion acepta campos no declarados y el caso de uso
# toma el rol que venga en la peticion.
# Impacto: cualquier visitante anonimo puede registrarse como ADMIN enviando un
# campo extra, y con ello obtener acceso completo a los datos clinicos de todos
# los pacientes y al registro de auditoria. Es el defecto de mayor impacto del
# conjunto.
# Norma: OWASP A01 (Broken Access Control); RF-2.1 (rol paciente por defecto);
# RB-2; NFR-SEG-4; Ley 19.628/21.719 (acceso no autorizado a datos sensibles).
# Caso que lo detecta: CP-FUN-04.
# ---------------------------------------------------------------------------
def inc_11_escalada_de_privilegios() -> None:
    sustituir(
        "INC-11",
        "api/src/infrastructure/entrypoints/rest/schema/esquemas.js",
        """export const esquemaRegistro = z
  .object({
    nombreUsuario: texto(60).regex(
      /^[a-zA-Z0-9._-]+$/,
      'Solo se permiten letras, numeros, punto, guion y guion bajo',
    ),
    email: z.string().email().max(160),
    password,
  })
  .strict();""",
        """export const esquemaRegistro = z.object({
  nombreUsuario: texto(60).regex(
    /^[a-zA-Z0-9._-]+$/,
    'Solo se permiten letras, numeros, punto, guion y guion bajo',
  ),
  email: z.string().email().max(160),
  password,
  // Permite indicar el rol al registrarse.
  rol: z.enum(ROLES_VALIDOS).optional(),
});""",
        "el esquema de registro deja de ser estricto y acepta un campo `rol` "
        "enviado por el cliente",
    )

    sustituir(
        "INC-11",
        "api/src/application/usecase/AuthUseCase.js",
        """  async registrar({ nombreUsuario, email, password }, contexto = {}) {
    this.password.validarPolitica(password);""",
        """  async registrar({ nombreUsuario, email, password, rol }, contexto = {}) {
    this.password.validarPolitica(password);""",
        "el caso de uso recibe el rol desde la peticion",
    )

    sustituir(
        "INC-11",
        "api/src/application/usecase/AuthUseCase.js",
        """      passwordHash: await this.password.hashear(password),
      rol: ROL_POR_DEFECTO,
    }).validar();""",
        """      passwordHash: await this.password.hashear(password),
      rol: rol ?? ROL_POR_DEFECTO,
    }).validar();""",
        "el rol del nuevo usuario se toma de la peticion en vez de forzarse a "
        "PACIENTE: permite registrarse como ADMIN",
    )


# ---------------------------------------------------------------------------
# INC-12 · Validacion de documentos solo por el tipo declarado  (GRAVE)
#
# Origen: se confia en el `Content-Type` que envia el cliente y no se verifica
# la firma binaria del archivo.
# Impacto: se puede almacenar cualquier contenido con un nombre y un tipo
# falsos. El archivo queda disponible para descarga desde una aplicacion
# clinica, que pasa a servir de canal de distribucion de un ejecutable
# malicioso hacia el equipo del medico o del paciente.
# Norma: NFR-SEG-12 (propuesto); RF-4.3 (formatos permitidos); OWASP A04
# (Insecure Design) y A08 (Software and Data Integrity Failures).
# Caso que lo detecta: CP-SEG-07.
# ---------------------------------------------------------------------------
def inc_12_documento_sin_verificar() -> None:
    sustituir(
        "INC-12",
        "api/src/application/usecase/DocumentoUseCase.js",
        """    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
      throw new DatosInvalidos('El documento esta vacio');
    }
    if (!firmaCoincide(contenido, mime)) {
      throw new DatosInvalidos(
        `El contenido del archivo no corresponde al tipo declarado (${mime})`,
      );
    }""",
        """    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
      throw new DatosInvalidos('El documento esta vacio');
    }""",
        "se elimina la verificacion de la firma binaria: basta con que el cliente "
        "declare un tipo permitido",
    )

    sustituir(
        "INC-12",
        "api/src/application/usecase/DocumentoUseCase.js",
        """import { Documento, firmaCoincide } from '../../domain/model/Documento.js';""",
        """import { Documento } from '../../domain/model/Documento.js';""",
        "se deja de importar la funcion de verificacion de firma",
    )


# ---------------------------------------------------------------------------
# INC-13 · Control de acceso solo en la interfaz  (CRITICO)
#
# Origen: las rutas de escritura de examenes no exigen rol y el caso de uso
# tampoco lo verifica; la unica barrera es que la SPA oculta los botones.
# Impacto: un paciente —o cualquiera con un token de paciente— puede crear,
# modificar y eliminar examenes de la ficha a la que tiene acceso enviando la
# peticion directamente a la API. Se rompe la regla de negocio RB-1 y la
# integridad del historial clinico.
# Norma: NFR-SEG-4 (control de acceso por rol EN EL BACKEND); RB-1; OWASP A01
# (Broken Access Control).
# Caso que lo detecta: CP-SEG-01 y el escenario BDD de permisos.
# ---------------------------------------------------------------------------
def inc_13_rbac_solo_en_frontend() -> None:
    sustituir(
        "INC-13",
        "api/src/infrastructure/entrypoints/rest/routes/examenes.routes.js",
        """  const soloClinico = exigirRol(ROLES.ADMIN, ROLES.MEDICO);""",
        """  // La interfaz solo muestra las acciones de escritura al personal clinico.
  const soloClinico = (_req, _res, next) => next();""",
        "el middleware de rol en las rutas de escritura de examenes se reemplaza "
        "por un paso-through",
    )

    sustituir(
        "INC-13",
        "api/src/application/usecase/ExamenUseCase.js",
        """  #exigirEscritura(actor) {
    if (!ExamenUseCase.#puedeEscribir(actor)) {
      throw new NoAutorizado('Un paciente solo tiene permisos de lectura (RB-1)');
    }
  }""",
        """  #exigirEscritura(actor) {
    // La verificacion de permisos se resuelve en la capa de rutas.
    if (!actor) {
      throw new NoAutorizado();
    }
  }""",
        "el caso de uso deja de verificar el rol: se pierde la defensa en "
        "profundidad y el paciente puede escribir",
    )


# ---------------------------------------------------------------------------
# INC-14 · Limite de peticiones sin dimensionar  (MODERADO)
#
# ORIGEN DISTINTO AL DE LOS DEMAS DEFECTOS. Los trece anteriores se sembraron
# para que QA los encontrara. Este NO: era un defecto real del diseno inicial
# del software, que aparecio al ejecutar la prueba de carga de la EP02. Se
# incorpora aqui para que la version auditada lo reproduzca y la evidencia sea
# regenerable; su merito no es haberlo plantado, sino haberlo encontrado.
#
# Origen: el limite general se fijo en 300 peticiones por minuto por IP, un
# valor que parece generoso para una persona y que nunca se contrasto con la
# concurrencia que el propio ERS exige (NFR-PERF-3: 200 usuarios).
# Impacto: en un centro de salud los 200 usuarios salen a internet por una
# misma IP publica (NAT), de modo que el limite les deja 1,5 peticiones por
# minuto a cada uno. La medicion registro entre 57,83 % y 100 % de peticiones
# legitimas rechazadas con HTTP 429, con latencias que cumplian los umbrales
# con holgura. Un control de seguridad mal dimensionado incumple un requisito
# de rendimiento igual que lo haria una falla de capacidad.
# Norma: NFR-PERF-3; NFR-DIS-1; ISO/IEC 25010 (adecuacion funcional).
# Caso que lo detecta: CP-PERF-01, CP-PERF-02, CP-PERF-03.
# ---------------------------------------------------------------------------
def inc_14_limite_sin_dimensionar() -> None:
    sustituir(
        "INC-14",
        "api/src/infrastructure/entrypoints/rest/middleware/seguridad.js",
        "    limit: Number(process.env.RATE_LIMIT_GENERAL ?? LIMITE_GENERAL_POR_DEFECTO),",
        "    limit: Number(process.env.RATE_LIMIT_GENERAL ?? 300),",
        "el limite general vuelve a 300 peticiones por minuto, sin derivarlo de "
        "la concurrencia objetivo del ERS",
    )

    # El healthcheck deja de estar exento: el monitoreo de disponibilidad
    # consume la cuota de los usuarios y puede reportar caidas inexistentes.
    sustituir(
        "INC-14",
        "api/src/infrastructure/entrypoints/rest/middleware/seguridad.js",
        """    skip: (req) => req.path === '/salud' || req.originalUrl.endsWith('/api/v1/salud'),
""",
        "",
        "el healthcheck deja de estar exento del limite de peticiones",
    )

    for ruta_env in ("api/.env.example", ".env.example"):
        texto = leer(ruta_env)
        if "RATE_LIMIT_GENERAL=15000" in texto:
            escribir(ruta_env, texto.replace("RATE_LIMIT_GENERAL=15000", "RATE_LIMIT_GENERAL=300", 1))
            aplicados.append(
                ("INC-14", ruta_env, "el ambiente usa el limite sin dimensionar (300/min)")
            )


# ---------------------------------------------------------------------------
# Sincronizacion del archivo de bloqueo de dependencias
#
# INC-08 agrega una dependencia a package.json. El package-lock.json copiado de
# la v1.1 no la contiene, y `npm ci` exige que ambos archivos esten en sincro:
# sin este paso, la imagen Docker de la v1.0 no se puede construir.
#
# Se usa `--package-lock-only`, que recalcula el lock sin descargar paquetes.
# ---------------------------------------------------------------------------
def sincronizar_lock() -> None:
    import subprocess

    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        print("  AVISO: no se encontro npm. Ejecute manualmente en api/:")
        print("         npm install --package-lock-only")
        return

    api = DESTINO / "api"
    resultado = subprocess.run(
        [npm, "install", "--package-lock-only", "--no-audit", "--no-fund"],
        cwd=api,
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        print("  AVISO: no se pudo regenerar package-lock.json:")
        print("        ", (resultado.stderr or resultado.stdout).strip().splitlines()[-1:])
        return
    aplicados.append(
        (
            "INC-08",
            "api/package-lock.json",
            "el archivo de bloqueo se recalcula para incluir la dependencia "
            "vulnerable, de modo que `npm ci` y la imagen Docker funcionen",
        )
    )
    print("  package-lock.json de la API sincronizado")


# ---------------------------------------------------------------------------
# Marcas en la documentacion de la version
# ---------------------------------------------------------------------------
def marcar_version() -> None:
    for ruta in ("api/package.json", "web/package.json"):
        texto = leer(ruta)
        escribir(ruta, texto.replace('"version": "1.1.0"', '"version": "1.0.0"', 1))

    texto = leer(".env.example")
    escribir(".env.example", texto.replace("APP_VERSION=1.1.0", "APP_VERSION=1.0.0", 1))

    # Nombre de proyecto propio de esta version. No es un defecto: aisla los
    # contenedores, volumenes e imagenes de las dos versiones, de modo que
    # construir una no sobrescriba la otra.
    sustituir(
        "ENTORNO",
        "docker-compose.yml",
        "name: cuidarte-plus-v11",
        "name: cuidarte-plus-v10",
        "el proyecto de docker compose se llama cuidarte-plus-v10, para no "
        "compartir contenedores ni imagenes con la version corregida",
    )

    aviso = """# ####################################################################
# ATENCION · VERSION 1.0 — MATERIAL DE LABORATORIO
#
# Esta copia del software contiene DEFECTOS SEMBRADOS a proposito. Es la
# version que QA audita en la EP02 y la que produce los hallazgos de las
# secciones 5 y 6 del informe.
#
# NO debe desplegarse ni exponerse a una red publica. Ejecutela unicamente
# en el ambiente QA local descrito en la documentacion.
#
# El detalle de cada defecto, con su archivo, incidente, caso de prueba y
# norma afectada, esta en:
#     EV2/docs/05_Defectos_Sembrados_v1.0.md
#
# Esta version se genera automaticamente con:
#     python EV2/codigo/sembrar-defectos.py
# ####################################################################

"""
    # El README copiado describe la version corregida (132 pruebas en verde,
    # cero hallazgos). Dejarlo tal cual en la v1.0 seria enganoso, asi que se
    # le antepone una advertencia.
    readme = leer("README.md")
    advertencia = SALTO.join([
        "> ## ATENCION - ESTA ES LA VERSION 1.0 (AUDITADA)",
        ">",
        "> **Las cifras de este documento corresponden a la version 1.1 corregida.**",
        "> Esta copia del software contiene 14 defectos deliberados y NO pasa las",
        "> puertas de calidad que se describen mas abajo.",
        ">",
        "> El detalle de cada defecto esta en",
        "> `EV2/docs/05_Defectos_Sembrados_v1.0.md`.",
        ">",
        "> No despliegue esta version ni la exponga a una red publica.",
        "",
        "",
    ])
    if not readme.startswith("> ## ATENCION"):
        escribir("README.md", advertencia + readme)
        aplicados.append(
            ("ENTORNO", "README.md", "se antepone la advertencia de version auditada")
        )

    io.open(DESTINO / "LEEME-VERSION-1.0.md", "w", encoding="utf-8", newline="\n").write(
        aviso.replace("# ", "").replace("#", "").strip() + "\n"
    )


# ---------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------
DEFECTOS = [
    ("INC-01", "Unicidad de RUT ausente", "GRAVE", inc_01_rut_duplicado),
    ("INC-02", "Inyeccion SQL en el filtro de auditoria", "CRITICO", inc_02_inyeccion_sql),
    ("INC-03", "Factor de costo de bcrypt insuficiente", "GRAVE", inc_03_bcrypt_debil),
    ("INC-04", "XSS almacenado por renderizado sin escape", "CRITICO", inc_04_xss_almacenado),
    ("INC-05", "Datos sensibles en los registros", "GRAVE", inc_05_logs_con_datos_sensibles),
    ("INC-06", "Cabeceras de seguridad ausentes y CORS permisivo", "GRAVE", inc_06_sin_cabeceras_seguridad),
    ("INC-07", "Contraste insuficiente y errores no anunciados", "MODERADO", inc_07_accesibilidad),
    ("INC-08", "Dependencia con vulnerabilidad conocida", "GRAVE", inc_08_dependencia_vulnerable),
    ("INC-09", "Eliminacion fisica en vez de logica", "GRAVE", inc_09_eliminacion_fisica),
    ("INC-10", "Sesion no revocable y secreto por defecto", "CRITICO", inc_10_sesion_no_revocable),
    ("INC-11", "Escalada de privilegios en el autorregistro", "CRITICO", inc_11_escalada_de_privilegios),
    ("INC-12", "Documentos validados solo por el tipo declarado", "GRAVE", inc_12_documento_sin_verificar),
    ("INC-13", "Control de acceso solo en la interfaz", "CRITICO", inc_13_rbac_solo_en_frontend),
    ("INC-14", "Limite de peticiones sin dimensionar", "MODERADO", inc_14_limite_sin_dimensionar),
]


def main() -> None:
    if not ORIGEN.is_dir():
        print(f"No existe la version de origen: {ORIGEN}", file=sys.stderr)
        sys.exit(1)

    print("=" * 72)
    print("Cuidarte+ · generacion de la version 1.0 (con defectos sembrados)")
    print("=" * 72)
    copiar_arbol()
    print()

    for incidente, titulo, criticidad, funcion in DEFECTOS:
        print(f"[{incidente}] {titulo}  ({criticidad})")
        funcion()

    print()
    print("Sincronizando el archivo de bloqueo de dependencias...")
    sincronizar_lock()

    marcar_version()

    print()
    print("-" * 72)
    print(f"Cambios aplicados: {len(aplicados)}")
    print("-" * 72)
    for incidente, ruta, descripcion in aplicados:
        print(f"  {incidente}  {ruta}")
        print(f"          {descripcion}")
    print()
    print(f"Version 1.0 generada en: {DESTINO}")
    print()
    print("Siguiente paso: instalar dependencias y ejecutar las herramientas.")
    print("  cd cuidarte-plus-v1.0/api && npm install")
    print("  cd cuidarte-plus-v1.0/web && npm install")
    print("  cd ../../evidencias && bash capturar-evidencia.sh v1.0")


if __name__ == "__main__":
    os.chdir(AQUI)
    main()

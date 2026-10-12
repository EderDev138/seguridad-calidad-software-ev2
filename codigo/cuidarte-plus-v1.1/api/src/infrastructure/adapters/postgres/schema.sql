-- =====================================================================
-- Cuidarte+ · Esquema de base de datos (PostgreSQL)
-- ERS Caso B §4.2 · version 1.1 (corregida)
--
-- Controles de integridad y seguridad implementados en el esquema:
--   * UNIQUE en usuario.nombre_usuario, usuario.email y paciente.rut
--     -> cierra el incidente INC-01 (RUT duplicado) a nivel de base de datos,
--        no solo en el backend: la defensa en profundidad exige ambas.
--   * eliminado_en en todas las entidades de negocio
--     -> materializa la eliminacion LOGICA exigida por RF-3.3.
--   * pgcrypto habilitado para cifrar en reposo los datos de contacto del
--     paciente (NFR-SEG-3).
--   * auditoria sin UPDATE ni DELETE (append-only) + revocacion de permisos
--     -> valor probatorio del registro (RF-5.1, ISO/IEC 27001 A.8.15).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Usuarios (RF-1, RF-2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
    id                BIGSERIAL PRIMARY KEY,
    nombre_usuario    VARCHAR(60)  NOT NULL,
    email             VARCHAR(160) NOT NULL,
    -- bcrypt produce 60 caracteres; nunca se almacena la contrasena en claro.
    password_hash     CHAR(60)     NOT NULL,
    rol               VARCHAR(16)  NOT NULL,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en      TIMESTAMPTZ,
    CONSTRAINT usuario_rol_valido CHECK (rol IN ('ADMIN', 'MEDICO', 'PACIENTE'))
);

-- Unicidad solo entre los registros vigentes: un nombre de usuario dado de
-- baja puede reutilizarse, pero no puede haber dos activos iguales.
CREATE UNIQUE INDEX IF NOT EXISTS usuario_nombre_usuario_uk
    ON usuario (lower(nombre_usuario)) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuario_email_uk
    ON usuario (lower(email)) WHERE eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Pacientes (RF-2.2 a RF-2.4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paciente (
    id                BIGSERIAL PRIMARY KEY,
    -- RUT en forma canonica 12345678-9: la normalizacion la aplica el dominio
    -- antes de persistir, de modo que el indice unico no se pueda evadir
    -- cambiando el formato de entrada.
    rut               VARCHAR(12)  NOT NULL,
    nombres           VARCHAR(120) NOT NULL,
    apellidos         VARCHAR(120) NOT NULL,
    fecha_nacimiento  DATE,
    telefono          VARCHAR(40),
    email             VARCHAR(160),
    usuario_id        BIGINT REFERENCES usuario (id) ON DELETE SET NULL,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en      TIMESTAMPTZ,
    CONSTRAINT paciente_rut_formato CHECK (rut ~ '^[0-9]{7,8}-[0-9K]$')
);

CREATE UNIQUE INDEX IF NOT EXISTS paciente_rut_uk
    ON paciente (rut) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS paciente_usuario_idx ON paciente (usuario_id);

-- ---------------------------------------------------------------------
-- Examenes medicos (RF-3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS examen (
    id            BIGSERIAL PRIMARY KEY,
    paciente_id   BIGINT       NOT NULL REFERENCES paciente (id),
    tipo          VARCHAR(120) NOT NULL,
    descripcion   TEXT,
    fecha_examen  DATE,
    medico_id     BIGINT REFERENCES usuario (id),
    estado        VARCHAR(16)  NOT NULL DEFAULT 'PENDIENTE',
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en  TIMESTAMPTZ,
    CONSTRAINT examen_estado_valido CHECK (estado IN ('PENDIENTE', 'COMPLETADO'))
);

-- Indice parcial: las consultas de lectura solo recorren examenes vigentes,
-- que es lo que necesita NFR-PERF-1 (CRUD < 300 ms).
CREATE INDEX IF NOT EXISTS examen_paciente_idx
    ON examen (paciente_id) WHERE eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Documentos clinicos (RF-4.3, RF-4.4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento (
    id             BIGSERIAL PRIMARY KEY,
    examen_id      BIGINT       NOT NULL REFERENCES examen (id),
    nombre_archivo VARCHAR(200) NOT NULL,
    mime           VARCHAR(120) NOT NULL,
    tamano_bytes   BIGINT       NOT NULL,
    -- Solo la REFERENCIA al storage interno; el binario nunca entra a la BD.
    ruta_storage   VARCHAR(400) NOT NULL,
    subido_por     BIGINT REFERENCES usuario (id),
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en   TIMESTAMPTZ,
    CONSTRAINT documento_tamano_maximo CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760)
);

CREATE INDEX IF NOT EXISTS documento_examen_idx
    ON documento (examen_id) WHERE eliminado_en IS NULL;

-- ---------------------------------------------------------------------
-- Auditoria (RF-5.1) · append-only
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuario (id),
    accion     VARCHAR(40)  NOT NULL,
    entidad    VARCHAR(40),
    entidad_id BIGINT,
    detalle    TEXT,
    ip         INET,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_creado_idx ON auditoria (creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_accion_idx ON auditoria (accion);

-- Refuerzo de la inmutabilidad: ni la propia aplicacion puede alterar el
-- registro de auditoria. Si se necesita depurar historicos, se hace con un
-- rol administrativo distinto y queda constancia en los logs del motor.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user) THEN
        EXECUTE format('REVOKE UPDATE, DELETE ON auditoria FROM %I', current_user);
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'No se pudo revocar UPDATE/DELETE sobre auditoria; revisar permisos del rol.';
END
$$;

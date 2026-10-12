-- =====================================================================
-- Cuidarte+ · Datos de prueba para el ambiente QA
--
-- IMPORTANTE — uso de datos sinteticos (principio etico y legal):
--
-- Todos los datos de este archivo son FICTICIOS. Ningun nombre, RUT, correo,
-- telefono ni antecedente clinico corresponde a una persona real. Esto es una
-- exigencia del plan de pruebas y no una preferencia:
--
--   * Ley 19.628 (modernizada por la Ley 21.719): los datos de salud son
--     datos sensibles. Usar datos clinicos reales en un ambiente de pruebas
--     constituye tratamiento sin finalidad legitima.
--   * Principio de minimizacion: en QA no se necesita un dato real para
--     verificar una regla de negocio.
--   * Principio de no maleficencia: una filtracion desde QA, que tiene menos
--     controles que produccion, dañaria a titulares reales.
--
-- Los RUT son validos en su digito verificador (modulo 11) pero no estan
-- asignados a ninguna persona: se eligieron de rangos no emitidos.
--
-- CONTRASENA DE TODOS LOS USUARIOS DE PRUEBA: Cuidarte2026!
-- Los hashes son bcrypt con factor de costo 12 (NFR-SEG-2). Esta credencial
-- es publica a proposito y SOLO valida en el ambiente QA local; nunca debe
-- existir en un ambiente productivo.
--
-- Ejecucion:
--   docker compose --profile semilla run --rm semilla
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Usuarios (RF-2)
-- ---------------------------------------------------------------------
INSERT INTO usuario (nombre_usuario, email, password_hash, rol, activo)
VALUES
    ('admin1',     'admin1@cuidarte.test',     '$2b$12$Tss50kI6xDBW7qmG4SQ4D.rDkZaXdQZvaIwu/Tqeb4zYkZmYWfvsK', 'ADMIN',    TRUE),
    ('medico1',    'medico1@cuidarte.test',    '$2b$12$SRaq4hCGAC3yDMvyk9OU2.cr2RBF28UoLFVSV9HQCA5wqWGuSDgfy', 'MEDICO',   TRUE),
    ('medico2',    'medico2@cuidarte.test',    '$2b$12$N31fsTNvMIV6jNiGrHshYeKv5cSTcY2I7Oc7lAuyagdl2SMO/bT8W', 'MEDICO',   TRUE),
    ('paciente1',  'paciente1@cuidarte.test',  '$2b$12$IaHhW3fxYqI2MPKbcY7Hmu7HFpTeGTo/2DL0Tu29MbU/DthWYU.JK', 'PACIENTE', TRUE),
    ('paciente2',  'paciente2@cuidarte.test',  '$2b$12$KIB9249wter6xRR/kaOn1etqCfJhPf4LaPkiGPkGlWtC.UylyZMqO', 'PACIENTE', TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Pacientes (RF-2.2)
--
-- Los RUT se almacenan en forma canonica (sin puntos, con guion), que es la
-- forma que produce la normalizacion del dominio. Guardarlos asi es lo que
-- permite que el indice unico detecte duplicados escritos con otro formato.
-- ---------------------------------------------------------------------
INSERT INTO paciente (rut, nombres, apellidos, fecha_nacimiento, telefono, email, usuario_id)
VALUES
    ('12345678-5', 'Ana Maria',  'Perez Soto',     '1948-04-22', '+56911111111', 'ana.perez@cuidarte.test',
        (SELECT id FROM usuario WHERE nombre_usuario = 'paciente1')),
    ('11111111-1', 'Bruno',      'Soto Lagos',     '1955-11-03', '+56922222222', 'bruno.soto@cuidarte.test',
        (SELECT id FROM usuario WHERE nombre_usuario = 'paciente2')),
    ('20347024-K', 'Carla',      'Rojas Munoz',    '1972-06-15', '+56933333333', NULL, NULL),
    ('9876543-3',  'Domingo',    'Vera Castillo',  '1940-01-30', '+56944444444', NULL, NULL),
    ('14365420-6', 'Elena',      'Mora Figueroa',  '1983-09-09', NULL,           NULL, NULL)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Examenes medicos (RF-3.1)
-- ---------------------------------------------------------------------
INSERT INTO examen (paciente_id, tipo, descripcion, fecha_examen, medico_id, estado)
VALUES
    ((SELECT id FROM paciente WHERE rut = '12345678-5'), 'Hemograma completo',
        'Control anual. Resultados dentro de rango de referencia.', '2026-09-15',
        (SELECT id FROM usuario WHERE nombre_usuario = 'medico1'), 'COMPLETADO'),
    ((SELECT id FROM paciente WHERE rut = '12345678-5'), 'Perfil lipidico',
        'Seguimiento de colesterol. Pendiente de informe.', '2026-10-05',
        (SELECT id FROM usuario WHERE nombre_usuario = 'medico1'), 'PENDIENTE'),
    ((SELECT id FROM paciente WHERE rut = '11111111-1'), 'Radiografia de torax',
        'Control preventivo.', '2026-10-01',
        (SELECT id FROM usuario WHERE nombre_usuario = 'medico2'), 'COMPLETADO'),
    ((SELECT id FROM paciente WHERE rut = '20347024-K'), 'Ecografia abdominal',
        'Derivada de consulta de urgencia.', '2026-10-08',
        (SELECT id FROM usuario WHERE nombre_usuario = 'medico1'), 'PENDIENTE'),
    ((SELECT id FROM paciente WHERE rut = '9876543-3'), 'Electrocardiograma',
        'Evaluacion cardiologica de rutina.', '2026-09-28',
        (SELECT id FROM usuario WHERE nombre_usuario = 'medico2'), 'COMPLETADO')
ON CONFLICT DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- Verificacion de la carga
-- ---------------------------------------------------------------------
SELECT 'usuarios'  AS entidad, count(*) AS total FROM usuario  WHERE eliminado_en IS NULL
UNION ALL
SELECT 'pacientes' AS entidad, count(*) AS total FROM paciente WHERE eliminado_en IS NULL
UNION ALL
SELECT 'examenes'  AS entidad, count(*) AS total FROM examen   WHERE eliminado_en IS NULL;

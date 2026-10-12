import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StorageLocal, StorageMemoria } from '../../src/infrastructure/storage/StorageLocal.js';
import { escaparHtml } from '../../src/infrastructure/entrypoints/rest/middleware/validacion.js';
import { opcionesLogHttp } from '../../src/infrastructure/config/logger.js';
import { extraerBearer } from '../../src/infrastructure/security/token.js';
import { crearGatewaysEnMemoria } from '../../src/infrastructure/adapters/memory/gatewaysMemoria.js';

/**
 * Pruebas de los componentes de infraestructura que implementan controles de
 * seguridad propios, no derivados del dominio:
 *  - StorageLocal: confinamiento de rutas (anti path traversal) y permisos.
 *  - escaparHtml: escape de salida (defensa en profundidad contra XSS).
 *  - logger: que el log no filtre datos personales ni credenciales.
 */

describe('CP-SEG-07 · StorageLocal · confinamiento del storage interno (RF-4.4)', () => {
  let raiz;
  let storage;

  beforeEach(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'cuidarte-storage-'));
    storage = new StorageLocal(raiz);
    await storage.inicializar();
  });

  afterEach(async () => {
    await fs.rm(raiz, { recursive: true, force: true });
  });

  test('guarda el archivo y devuelve una referencia relativa', async () => {
    const referencia = await storage.guardar(Buffer.from('%PDF-1.4 contenido'), {
      examenId: 42,
      mime: 'application/pdf',
    });

    expect(referencia).toMatch(/^examen-42\/[0-9a-f-]{36}\.pdf$/);
    // La referencia usa barras normales incluso en Windows, para que el valor
    // almacenado en la base sea independiente del sistema operativo.
    expect(referencia).not.toContain('\\');
  });

  test('el nombre en disco lo genera el servidor: el del usuario no se usa', async () => {
    const referencia = await storage.guardar(Buffer.from('%PDF-1.4'), {
      examenId: 1,
      mime: 'application/pdf',
      nombreArchivo: '../../../etc/passwd',
    });

    expect(referencia).not.toContain('passwd');
    expect(referencia).not.toContain('..');
  });

  test('lee de vuelta exactamente el contenido guardado', async () => {
    const original = Buffer.from('%PDF-1.4 informe clinico');
    const referencia = await storage.guardar(original, { examenId: 7, mime: 'application/pdf' });

    expect(await storage.leer(referencia)).toEqual(original);
  });

  test('rechaza una referencia que intenta salir del directorio raiz', async () => {
    // Simula una referencia manipulada en la base de datos. El guard debe
    // impedir la lectura aunque el valor venga de la propia BD.
    await expect(storage.leer('../../../etc/passwd')).rejects.toThrow(
      /fuera del directorio permitido/,
    );
    await expect(storage.leer('examen-1/../../../secreto')).rejects.toThrow(
      /fuera del directorio permitido/,
    );
  });

  test('elimina el archivo y la eliminacion es idempotente', async () => {
    const referencia = await storage.guardar(Buffer.from('%PDF-1.4'), {
      examenId: 3,
      mime: 'application/pdf',
    });

    await storage.eliminar(referencia);
    await expect(storage.leer(referencia)).rejects.toThrow();
    // Volver a eliminar no debe fallar (force: true).
    await expect(storage.eliminar(referencia)).resolves.toBeUndefined();
  });

  test('usa extension .bin ante un MIME no mapeado', async () => {
    const referencia = await storage.guardar(Buffer.from('datos'), {
      examenId: 9,
      mime: 'application/desconocido',
    });
    expect(referencia.endsWith('.bin')).toBe(true);
  });
});

describe('StorageMemoria · doble de prueba del storage', () => {
  test('guarda, lee y elimina en memoria', async () => {
    const storage = new StorageMemoria();
    await storage.inicializar();

    const referencia = await storage.guardar(Buffer.from('contenido'), { examenId: 1 });
    expect(await storage.leer(referencia)).toEqual(Buffer.from('contenido'));

    await storage.eliminar(referencia);
    await expect(storage.leer(referencia)).rejects.toThrow(/no encontrado/);
  });
});

describe('escaparHtml · escape de salida (NFR-SEG-5, defensa en profundidad)', () => {
  test('neutraliza los caracteres con significado en HTML', () => {
    expect(escaparHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaparHtml('a & b')).toBe('a &amp; b');
    expect(escaparHtml('dice "hola"')).toBe('dice &quot;hola&quot;');
    expect(escaparHtml("O'Higgins")).toBe('O&#39;Higgins');
  });

  test('deja el texto sin caracteres especiales intacto', () => {
    expect(escaparHtml('Hemograma completo')).toBe('Hemograma completo');
  });

  test('trata null y undefined como cadena vacia', () => {
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(undefined)).toBe('');
  });
});

describe('Logger HTTP · el registro no filtra datos sensibles (NFR-SEG-6, NFR-SEG-15)', () => {
  test('el serializador de peticion registra metodo, url e ip, pero no el cuerpo', () => {
    const serializado = opcionesLogHttp.serializers.req({
      method: 'POST',
      url: '/api/v1/auth/login',
      body: { nombreUsuario: 'medico1', password: 'SuperSecreta1!' },
      raw: { ip: '10.0.0.5' },
    });

    expect(serializado).toEqual({ metodo: 'POST', url: '/api/v1/auth/login', ip: '10.0.0.5' });
    // El assert decisivo: la contrasena no aparece en ninguna parte del log.
    expect(JSON.stringify(serializado)).not.toContain('SuperSecreta1!');
    expect(serializado.body).toBeUndefined();
  });

  test('el serializador de respuesta registra solo el status', () => {
    expect(opcionesLogHttp.serializers.res({ statusCode: 201 })).toEqual({ status: 201 });
  });

  test('el nivel de log se eleva segun el resultado de la peticion', () => {
    const nivel = (status, error) =>
      opcionesLogHttp.customLogLevel({}, { statusCode: status }, error);

    expect(nivel(200)).toBe('info');
    expect(nivel(201)).toBe('info');
    expect(nivel(400)).toBe('warn');
    expect(nivel(403)).toBe('warn');
    expect(nivel(500)).toBe('error');
    expect(nivel(200, new Error('fallo'))).toBe('error');
  });
});

describe('extraerBearer · lectura de la cabecera Authorization', () => {
  test('extrae el token con distintas capitalizaciones y espacios', () => {
    expect(extraerBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extraerBearer('bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extraerBearer('  Bearer   abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  test('devuelve null ante una cabecera ausente o con otro esquema', () => {
    expect(extraerBearer(undefined)).toBeNull();
    expect(extraerBearer('')).toBeNull();
    expect(extraerBearer('Basic dXN1YXJpbzpjbGF2ZQ==')).toBeNull();
    expect(extraerBearer({ token: 'x' })).toBeNull();
  });
});

describe('Gateways en memoria · la baja logica oculta sin destruir', () => {
  let gateways;

  beforeEach(() => {
    gateways = crearGatewaysEnMemoria();
  });

  test('un usuario eliminado desaparece de las consultas pero conserva su marca', async () => {
    const usuario = await gateways.usuarioGateway.crear({
      nombreUsuario: 'temporal',
      email: 'temporal@cuidarte.test',
      passwordHash: '$2b$12$x',
      rol: 'MEDICO',
      activo: true,
      eliminadoEn: null,
    });

    expect(await gateways.usuarioGateway.obtenerPorId(usuario.id)).not.toBeNull();
    expect(await gateways.usuarioGateway.eliminar(usuario.id)).toBe(true);

    expect(await gateways.usuarioGateway.obtenerPorId(usuario.id)).toBeNull();
    expect(await gateways.usuarioGateway.obtenerPorNombreUsuario('temporal')).toBeNull();
    expect(await gateways.usuarioGateway.obtenerPorEmail('temporal@cuidarte.test')).toBeNull();
    expect(await gateways.usuarioGateway.listar()).toHaveLength(0);
    // Eliminar dos veces no vuelve a tener efecto.
    expect(await gateways.usuarioGateway.eliminar(usuario.id)).toBe(false);
  });

  test('la busqueda por email es insensible a mayusculas', async () => {
    await gateways.usuarioGateway.crear({
      nombreUsuario: 'medico1',
      email: 'Medico1@Cuidarte.TEST',
      passwordHash: '$2b$12$x',
      rol: 'MEDICO',
      activo: true,
      eliminadoEn: null,
    });

    expect(await gateways.usuarioGateway.obtenerPorEmail('medico1@cuidarte.test')).not.toBeNull();
  });

  test('actualizar un registro inexistente devuelve null en vez de crearlo', async () => {
    expect(await gateways.usuarioGateway.actualizar({ id: 999, rol: 'ADMIN' })).toBeNull();
    expect(await gateways.pacienteGateway.actualizar({ id: 999, rut: '12345678-5' })).toBeNull();
    expect(await gateways.examenGateway.actualizar({ id: 999, tipo: 'Rx' })).toBeNull();
  });

  test('los documentos se listan por examen y respetan la baja logica', async () => {
    const documento = await gateways.documentoGateway.crear({
      examenId: 5,
      nombreArchivo: 'informe.pdf',
      mime: 'application/pdf',
      tamanoBytes: 100,
      rutaStorage: 'x/y',
      eliminadoEn: null,
    });

    expect(await gateways.documentoGateway.listarPorExamen(5)).toHaveLength(1);
    expect(await gateways.documentoGateway.listarPorExamen(6)).toHaveLength(0);

    await gateways.documentoGateway.eliminar(documento.id);
    expect(await gateways.documentoGateway.listarPorExamen(5)).toHaveLength(0);
    expect(await gateways.documentoGateway.obtenerPorId(documento.id)).toBeNull();
  });

  test('el paciente se puede recuperar por RUT y por cuenta vinculada', async () => {
    const paciente = await gateways.pacienteGateway.crear({
      rut: '12345678-5',
      nombres: 'Ana',
      apellidos: 'Perez',
      usuarioId: 31,
      eliminadoEn: null,
    });

    expect((await gateways.pacienteGateway.obtenerPorRut('12345678-5')).id).toBe(paciente.id);
    expect((await gateways.pacienteGateway.obtenerPorUsuarioId(31)).id).toBe(paciente.id);
    expect(await gateways.pacienteGateway.obtenerPorUsuarioId(99)).toBeNull();

    await gateways.pacienteGateway.eliminar(paciente.id);
    expect(await gateways.pacienteGateway.obtenerPorRut('12345678-5')).toBeNull();
  });

  test('la auditoria filtra por accion y por usuario, y respeta el limite', async () => {
    await gateways.auditoriaGateway.registrar({ usuarioId: 1, accion: 'LOGIN' });
    await gateways.auditoriaGateway.registrar({ usuarioId: 2, accion: 'LOGIN' });
    await gateways.auditoriaGateway.registrar({ usuarioId: 1, accion: 'LOGOUT' });

    expect(await gateways.auditoriaGateway.listar({ accion: 'LOGIN' })).toHaveLength(2);
    expect(await gateways.auditoriaGateway.listar({ usuarioId: 1 })).toHaveLength(2);
    expect(await gateways.auditoriaGateway.listar({ limite: 1 })).toHaveLength(1);
  });

  test('la lista de revocacion recuerda los tokens cerrados (RF-1.2)', async () => {
    expect(await gateways.sesionGateway.estaRevocado('jti-1')).toBe(false);
    await gateways.sesionGateway.revocar('jti-1', 1_900_000_000);
    expect(await gateways.sesionGateway.estaRevocado('jti-1')).toBe(true);
  });
});

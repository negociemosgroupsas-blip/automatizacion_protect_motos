/**
 * PROTECT MOTOS — Conector de SOAT (histórico)
 * Publicar como Aplicación web (Implementar > Nueva implementación > Aplicación web).
 * Ejecutar como: "Yo".  Quién tiene acceso: "Cualquier usuario".
 *
 * Lo usa el módulo SOAT del CRM (modulos/soat.html). Acciones:
 *   datos            -> devuelve { ok, soat: [...], gestiones: [...] }
 *   registrarGestion -> anota "Mensaje de renovación enviado", "Renovó" o "No renovará"
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-SOAT-2026';
var SHEET_ID = '1wHUsGVjzOIjHgsTsi1Nj1z_EQlLyR3evXwFduVv0viU';
var HOJA_SOAT = 'Soat';
var HOJA_GESTIONES = 'Gestiones';

// Encabezados obligatorios de la hoja Soat (fila 1). El orden no importa; mayúsculas y tildes tampoco.
var ENCABEZADOS_SOAT = [
  'Fecha', 'Cliente', 'Cédula', 'Placa', 'Tipo vehículo', 'Cilindraje',
  'Fecha inicio', 'Fecha vencimiento', 'Valor SOAT', 'Ganancia', 'Forma de pago'
];
// Opcional: si existe una columna "Celular" también se entrega.

var ENCABEZADOS_GESTIONES = [
  'Fecha de gestión', 'Clave', 'Cédula', 'Cliente', 'Placa', 'Acción', 'Registrado por'
];

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var callback = params.callback;
  var salida;

  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos' || accion === 'soat') {
        salida = accionDatos();
      } else if (accion === 'registrarGestion') {
        salida = accionRegistrarGestion(params);
      } else {
        salida = { ok: false, error: 'Acción desconocida: ' + accion };
      }
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }

  return responder(salida, callback);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== ACCIÓN: DATOS ====================
function accionDatos() {
  return { ok: true, soat: leerSoat(), gestiones: leerGestiones() };
}

function leerSoat() {
  var hoja = hojaSoat();
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(1, 1, ultimaFila, hoja.getLastColumn()).getValues();
  var idx = mapaEncabezados(datos[0]);

  var resultado = [];
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var placa = texto(fila, idx['placa']).toUpperCase().replace(/\s+/g, '');
    var cliente = texto(fila, idx['cliente']);
    if (!placa && !cliente) continue; // fila vacía

    resultado.push({
      cliente: cliente,
      cedula: texto(fila, idx['cedula']),
      placa: placa,
      tipo: texto(fila, idx['tipo vehiculo']).toUpperCase(),
      cilindraje: texto(fila, idx['cilindraje']),
      celular: idx['celular'] !== undefined ? texto(fila, idx['celular']).replace(/\D/g, '') : '',
      fecha: formatoFecha(fila[idx['fecha']]),
      fechaISO: formatoISO(fila[idx['fecha']]),
      inicio: formatoFecha(fila[idx['fecha inicio']]),
      inicioISO: formatoISO(fila[idx['fecha inicio']]),
      vence: formatoFecha(fila[idx['fecha vencimiento']]),
      venceISO: formatoISO(fila[idx['fecha vencimiento']]),
      valor: numero(fila, idx['valor soat']),
      ganancia: numero(fila, idx['ganancia']),
      forma: texto(fila, idx['forma de pago'])
    });
  }
  return resultado;
}

function leerGestiones() {
  var hoja = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_GESTIONES);
  if (!hoja) return [];
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 7).getValues();
  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var clave = String(fila[1] || '').trim();
    if (!clave) continue;
    resultado.push({
      fecha: formatoFecha(fila[0]),
      fechaISO: formatoISO(fila[0]),
      clave: clave,
      cedula: String(fila[2] || ''),
      cliente: String(fila[3] || ''),
      placa: String(fila[4] || ''),
      accion: String(fila[5] || ''),
      registradoPor: String(fila[6] || '')
    });
  }
  return resultado;
}

// ==================== ACCIÓN: REGISTRAR GESTIÓN ====================
function accionRegistrarGestion(params) {
  var clave = String(params.clave || '').trim();
  var accion = String(params.accion || '').trim();
  if (!clave) return { ok: false, error: 'Falta la clave del SOAT (placa|vencimiento).' };
  if (!accion) return { ok: false, error: 'Falta la acción.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hoja = ss.getSheetByName(HOJA_GESTIONES);
    if (!hoja) {
      hoja = ss.insertSheet(HOJA_GESTIONES);
      hoja.appendRow(ENCABEZADOS_GESTIONES);
    }
    hoja.appendRow([
      new Date(), clave,
      String(params.cedula || '').trim(),
      String(params.cliente || '').trim(),
      String(params.placa || '').trim(),
      accion,
      String(params.registradoPor || '').trim()
    ]);
    return { ok: true, mensaje: 'Gestión registrada correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar la gestión: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== UTILIDADES ====================
function hojaSoat() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var hoja = ss.getSheetByName(HOJA_SOAT);
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '". Revisa que se llame exactamente así.');
  }
  return hoja;
}

// Normaliza un encabezado: minúsculas, sin tildes, sin caracteres raros.
function normalizar(t) {
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9# ]/g, '')
    .trim();
}

function mapaEncabezados(filaEncabezados) {
  var idx = {};
  for (var i = 0; i < filaEncabezados.length; i++) {
    idx[normalizar(filaEncabezados[i])] = i;
  }
  var faltan = [];
  for (var k = 0; k < ENCABEZADOS_SOAT.length; k++) {
    if (idx[normalizar(ENCABEZADOS_SOAT[k])] === undefined) faltan.push(ENCABEZADOS_SOAT[k]);
  }
  if (faltan.length) {
    throw new Error('Faltan encabezados en la hoja "' + HOJA_SOAT + '": ' + faltan.join(', '));
  }
  return idx;
}

function texto(fila, i) {
  return String(fila[i] === undefined || fila[i] === null ? '' : fila[i]).trim();
}

function numero(fila, i) {
  var v = fila[i];
  if (typeof v === 'number') return v;
  var limpio = String(v || '').replace(/[^0-9.\-]/g, '');
  return Number(limpio || 0);
}

function formatoFecha(v) {
  if (!v) return '';
  var f = (v instanceof Date) ? v : new Date(v);
  if (isNaN(f.getTime())) return '';
  return f.getDate() + '/' + (f.getMonth() + 1) + '/' + f.getFullYear();
}

function formatoISO(v) {
  if (!v) return '';
  var f = (v instanceof Date) ? v : new Date(v);
  if (isNaN(f.getTime())) return '';
  var mes = ('0' + (f.getMonth() + 1)).slice(-2);
  var dia = ('0' + f.getDate()).slice(-2);
  return f.getFullYear() + '-' + mes + '-' + dia;
}

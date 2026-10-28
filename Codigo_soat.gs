/**
 * PROTECT MOTOS — Conector de SOAT (histórico)
 * Publicar como Aplicación web (Implementar > Nueva implementación > Aplicación web).
 * Ejecutar como: "Yo".  Quién tiene acceso: "Cualquier usuario".
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-SOAT-2026';
var SHEET_ID = '1wHUsGVjzOIjHgsTsi1Nj1z_EQlLyR3evXwFduVv0viU';
var HOJA_SOAT = 'Soat';

// Encabezados esperados (fila 1). El orden en la hoja no importa, pero los nombres sí.
var ENCABEZADOS_SOAT = [
  'Fecha', '#', 'Cliente', 'Cédula', 'Placa', 'Tipo vehículo', 'Cilindraje',
  'Fecha inicio', 'Fecha vencimiento', 'Valor SOAT', 'Ganancia',
  'Total consignado', 'Forma de pago'
];

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var callback = params.callback;
  var salida;

  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido. El panel envió: "' + (params.token || '(vacío)') + '"' };
    } else {
      var accion = params.action || 'soat';
      if (accion === 'soat' || accion === 'datos') {
        salida = accionSoat();
      } else if (accion === 'registrarSoat') {
        salida = accionRegistrarSoat(params);
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

// ==================== ACCIÓN: LEER SOAT ====================
function accionSoat() {
  var hoja = hojaSoat();
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return { ok: true, soat: [] };

  var datos = hoja.getRange(1, 1, ultimaFila, hoja.getLastColumn()).getValues();
  var idx = mapaEncabezados(datos[0]);

  var resultado = [];
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var placa = texto(fila, idx['placa']).toUpperCase().replace(/\s+/g, '');
    var cliente = texto(fila, idx['cliente']);
    if (!placa && !cliente) continue; // fila vacía

    resultado.push({
      fecha: formatoFecha(valor(fila, idx['fecha'])),
      fechaISO: formatoISO(valor(fila, idx['fecha'])),
      numero: texto(fila, idx['#']),
      cliente: cliente,
      cedula: texto(fila, idx['cedula']),
      placa: placa,
      tipo: texto(fila, idx['tipo vehiculo']).toUpperCase(),
      cilindraje: texto(fila, idx['cilindraje']),
      inicio: formatoFecha(valor(fila, idx['fecha inicio'])),
      inicioISO: formatoISO(valor(fila, idx['fecha inicio'])),
      vencimiento: formatoFecha(valor(fila, idx['fecha vencimiento'])),
      vencimientoISO: formatoISO(valor(fila, idx['fecha vencimiento'])),
      valorSoat: numero(fila, idx['valor soat']),
      ganancia: numero(fila, idx['ganancia']),
      totalConsignado: numero(fila, idx['total consignado']),
      formaPago: texto(fila, idx['forma de pago'])
    });
  }
  return { ok: true, soat: resultado };
}

// ==================== ACCIÓN: REGISTRAR SOAT ====================
function accionRegistrarSoat(params) {
  var placa = String(params.placa || '').trim().toUpperCase().replace(/\s+/g, '');
  var cliente = String(params.cliente || '').trim();
  var cedula = String(params.cedula || '').trim();
  var inicio = parsearFecha(String(params.inicio || '').trim());
  var vencimiento = parsearFecha(String(params.vencimiento || '').trim());
  var valorSoat = Number(params.valorSoat || 0);
  var ganancia = Number(params.ganancia || 0);

  if (!placa) return { ok: false, error: 'Falta la placa.' };
  if (!cliente) return { ok: false, error: 'Falta el cliente.' };
  if (!inicio) return { ok: false, error: 'Falta la fecha de inicio.' };
  if (!vencimiento) return { ok: false, error: 'Falta la fecha de vencimiento.' };
  if (!valorSoat || valorSoat <= 0) return { ok: false, error: 'El valor del SOAT debe ser mayor a 0.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var hoja = hojaSoat();
    var ultimaFila = hoja.getLastRow();
    var datos = hoja.getRange(1, 1, Math.max(ultimaFila, 1), hoja.getLastColumn()).getValues();
    var idx = mapaEncabezados(datos[0]);

    // Evitar duplicado: misma placa con el mismo inicio de vigencia.
    for (var i = 1; i < datos.length; i++) {
      var placaFila = texto(datos[i], idx['placa']).toUpperCase().replace(/\s+/g, '');
      if (placaFila === placa && formatoISO(valor(datos[i], idx['fecha inicio'])) === formatoISO(inicio)) {
        return { ok: false, error: 'Ya existe un SOAT para ' + placa + ' con esa fecha de inicio.' };
      }
    }

    var consecutivo = 0;
    for (var j = 1; j < datos.length; j++) {
      var n = Number(valor(datos[j], idx['#']));
      if (n > consecutivo) consecutivo = n;
    }

    var nueva = [];
    for (var c = 0; c < datos[0].length; c++) nueva.push('');
    poner(nueva, idx['fecha'], new Date());
    poner(nueva, idx['#'], consecutivo + 1);
    poner(nueva, idx['cliente'], cliente);
    poner(nueva, idx['cedula'], cedula);
    poner(nueva, idx['placa'], placa);
    poner(nueva, idx['tipo vehiculo'], String(params.tipo || '').trim().toUpperCase());
    poner(nueva, idx['cilindraje'], String(params.cilindraje || '').trim());
    poner(nueva, idx['fecha inicio'], inicio);
    poner(nueva, idx['fecha vencimiento'], vencimiento);
    poner(nueva, idx['valor soat'], valorSoat);
    poner(nueva, idx['ganancia'], ganancia);
    poner(nueva, idx['total consignado'], valorSoat + ganancia);
    poner(nueva, idx['forma de pago'], String(params.formaPago || '').trim());

    hoja.appendRow(nueva);
    return { ok: true, mensaje: 'SOAT registrado correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar el SOAT: ' + err.message };
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

// Normaliza un encabezado: minúsculas, sin tildes ni espacios extra.
function normalizar(t) {
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

function valor(fila, i) { return fila[i]; }
function texto(fila, i) { return String(fila[i] === undefined || fila[i] === null ? '' : fila[i]).trim(); }
function numero(fila, i) {
  var v = fila[i];
  if (typeof v === 'number') return v;
  var limpio = String(v || '').replace(/[^0-9.\-]/g, '');
  return Number(limpio || 0);
}
function poner(fila, i, v) { if (i !== undefined) fila[i] = v; }

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

function parsearFecha(t) {
  if (!t) return null;
  var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var es = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (es) return new Date(Number(es[3]), Number(es[2]) - 1, Number(es[1]));
  var f = new Date(t);
  return isNaN(f.getTime()) ? null : f;
}

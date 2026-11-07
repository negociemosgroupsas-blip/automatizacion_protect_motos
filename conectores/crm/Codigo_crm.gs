/**
 * PROTECT MOTOS — Conector del CRM (lectura + comisiones)
 *
 * Proyecto de Apps Script NUEVO e independiente: no modifica ni reemplaza el conector de Cobros,
 * ni el de Conciliación, ni el de Contratos. Lee la hoja y entrega los datos al Inicio del CRM
 * (gráficas, alertas, buscador y comisiones). Lo ÚNICO que escribe son las pestañas nuevas «Comisiones_Config» y «Comisiones_Historico»
 * (decisiones, observaciones e informes de comisiones guardados). Nunca modifica Protect ni Pagos.
 *
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-CRM-2026';   // si lo cambias, cámbialo igual en la pestaña «Conexiones» del CRM (se pega junto a la URL)
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var HOJA_SEGUIMIENTO = 'Protect';
var HOJA_PAGOS = 'Pagos';
var FILA_INICIO_DATOS = 2; // fila 1 = encabezados

var COL = {
  ASESOR: 2,
  CEDULA: 5,
  CLIENTE: 8,
  FECHA: 11,        // Fecha de firma
  FIN: 12,           // Fecha de vencimiento de la póliza
  PLACA: 13,
  CONTRATO: 14,      // N° de contrato (clave única)
  VALOR_PROTECT: 15, // Valor total financiado
  VALOR_CUOTA: 17,
  PLAZO: 18,
  COMISION: 19,      // Valor de la comisión (columna S)
  FORMA: 20,         // CONTADO | FINANCIADO
  FECHA_NAC: 6,      // Fecha de nacimiento del cliente (columna F)
  EDAD: 7,           // Edad del cliente al firmar (columna G)
  MES: 9,            // Mes del contrato (columna I)
  ANIO: 10,          // Año del contrato (columna J)
  RC: 21,            // Responsabilidad Civil: SI | NO (columna U)
  AP: 23,            // Asistencias: SI | NO (columna W)
  CELULAR: 31,
  CORREO: 32,
  DIRECCION: 33,
  ESTADO_CLIENTE: 44 // ACTIVO | CANCELADO | FINALIZADO (columna AR)
};

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var salida;
  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') {
        salida = accionDatos();
      } else if (accion === 'guardarClave') {
        salida = accionGuardarClave(params);
      } else if (accion === 'listarReportes') {
        salida = accionListarReportes();
      } else if (accion === 'verReporte') {
        salida = accionVerReporte(params);
      } else if (accion === 'ping') {
        salida = { ok: true, mensaje: 'Conector del CRM activo', version: 'crm-3' };
      } else {
        salida = { ok: false, error: 'Acción no disponible: ' + accion };
      }
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

// Solo para guardar informes de comisiones en el histórico (el contenido es grande y no cabe en una URL).
function doPost(e) {
  var salida;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    if (body.token !== TOKEN) salida = { ok: false, error: 'Token inválido.' };
    else if (body.action === 'guardarReporte') salida = accionGuardarReporte(body);
    else salida = { ok: false, error: 'Acción desconocida: ' + body.action };
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, null);
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
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var hojaSeg = hojaSeguimiento(ss);
  var hojaPagos = ss.getSheetByName(HOJA_PAGOS);
  return { ok: true, contratos: leerContratos(hojaSeg), pagos: leerPagos(hojaPagos), gestiones: [], comisionesCfg: leerConfigComisiones(ss) };
}

function leerContratos(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_INICIO_DATOS) return [];

  var ultimaCol = hoja.getLastColumn();
  var datos = hoja.getRange(FILA_INICIO_DATOS, 1, ultimaFila - FILA_INICIO_DATOS + 1, ultimaCol).getValues();

  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[COL.CONTRATO - 1] || '').trim();
    var cliente = String(fila[COL.CLIENTE - 1] || '').trim();
    if (!contrato && !cliente) continue; // fila vacía

    resultado.push({
      asesor: String(fila[COL.ASESOR - 1] || ''),
      cedula: String(fila[COL.CEDULA - 1] || ''),
      cliente: cliente,
      fechaFirma: formatoFecha(fila[COL.FECHA - 1]),
      fechaFirmaISO: formatoISO(fila[COL.FECHA - 1]),
      fin: formatoFecha(fila[COL.FIN - 1]),
      finISO: formatoISO(fila[COL.FIN - 1]),
      placa: String(fila[COL.PLACA - 1] || ''),
      contrato: contrato,
      valorProtect: Number(fila[COL.VALOR_PROTECT - 1] || 0),
      valorCuota: Number(fila[COL.VALOR_CUOTA - 1] || 0),
      plazo: Number(fila[COL.PLAZO - 1] || 0),
      forma: String(fila[COL.FORMA - 1] || '').trim().toUpperCase(),
      celular: String(fila[COL.CELULAR - 1] || ''),
      correo: String(fila[COL.CORREO - 1] || ''),
      direccion: String(fila[COL.DIRECCION - 1] || ''),
      edad: Number(fila[COL.EDAD - 1]) || 0,
      fechaNacISO: formatoISO(fila[COL.FECHA_NAC - 1]),
      mes: valorMesAnio(fila[COL.MES - 1], 'mes'),
      anio: valorMesAnio(fila[COL.ANIO - 1], 'anio'),
      comision: Number(fila[COL.COMISION - 1]) || 0,
      rc: String(fila[COL.RC - 1] || '').trim().toUpperCase(),
      ap: String(fila[COL.AP - 1] || '').trim().toUpperCase(),
      estado: String(fila[COL.ESTADO_CLIENTE - 1] || '').trim().toUpperCase()
    });
  }
  return resultado;
}

function leerPagos(hoja) {
  if (!hoja) return [];
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 8).getValues();
  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[1] || '').trim();
    if (!contrato) continue;
    resultado.push({
      fechaPago: formatoFecha(fila[0]),
      fechaPagoISO: formatoISO(fila[0]),
      contrato: contrato,
      cedula: String(fila[2] || ''),
      cliente: String(fila[3] || ''),
      cuota: String(fila[4] || ''),
      valorPagado: Number(fila[5] || 0),
      nota: String(fila[6] || ''),
      registradoPor: String(fila[7] || '')
    });
  }
  return resultado;
}

function hojaSeguimiento(ss) {
  var hoja = ss.getSheetByName(HOJA_SEGUIMIENTO);
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + HOJA_SEGUIMIENTO + '". Revisa que se llame exactamente así.');
  }
  return hoja;
}

function formatoFecha(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  return fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear();
}

// Mes/año tal como están en la hoja; si la celda es una fecha, se devuelve su mes (1-12) o su año.

function valorMesAnio(valor, tipo) {
  if (valor instanceof Date) return String(tipo === 'mes' ? valor.getMonth() + 1 : valor.getFullYear());
  return String(valor === null || valor === undefined ? '' : valor).trim();
}

function formatoISO(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  var dia = ('0' + fecha.getDate()).slice(-2);
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}


// ==================== COMISIONES: decisiones y observaciones ====================
// Pestaña «Comisiones_Config» (se crea sola): Clave | Valor (JSON) | Actualizado | Registrado por
//   caso:<contrato>            → decisión sobre un caso especial (se paga o no, valor, nota)
//   obs:<AAAA-MM>:<asesor>      → observación escrita en el informe de ese asesor y mes
//   cfg:<nombre>               → ajustes del informe de Kelli (valor por SOAT, etc.)
var HOJA_CONFIG = 'Comisiones_Config';

function hojaConfig(ss) {
  var h = ss.getSheetByName(HOJA_CONFIG);
  if (!h) {
    h = ss.insertSheet(HOJA_CONFIG);
    h.getRange(1, 1, 1, 4).setValues([['Clave', 'Valor', 'Actualizado', 'Registrado por']]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function leerConfigComisiones(ss) {
  var h = ss.getSheetByName(HOJA_CONFIG);
  var out = {};
  if (!h || h.getLastRow() < 2) return out;
  var datos = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < datos.length; i++) {
    var k = String(datos[i][0] || '').trim();
    if (k) out[k] = String(datos[i][1] || '');
  }
  return out;
}

function accionGuardarClave(params) {
  var clave = String(params.clave || '').trim();
  if (!/^(caso|obs|cfg):/.test(clave)) return { ok: false, error: 'Clave no válida.' };
  var valor = String(params.valor === undefined ? '' : params.valor);
  if (valor.length > 2000) return { ok: false, error: 'El texto es demasiado largo.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var h = hojaConfig(ss);
    var ultima = h.getLastRow(), fila = 0;
    if (ultima >= 2) {
      var claves = h.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < claves.length; i++) { if (String(claves[i][0]).trim() === clave) { fila = i + 2; break; } }
    }
    if (!fila) fila = ultima + 1;
    h.getRange(fila, 1, 1, 4).setValues([[clave, valor, new Date(), String(params.por || '')]]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}


// ==================== HISTÓRICO DE INFORMES DE COMISIONES ====================
// Pestaña «Comisiones_Historico» (se crea sola). Cada guardado agrega una fila nueva (versión 1, 2, 3…): nada se borra.
var HOJA_HIST = 'Comisiones_Historico';
function hojaHistorico(ss) {
  var h = ss.getSheetByName(HOJA_HIST);
  if (!h) {
    h = ss.insertSheet(HOJA_HIST);
    h.getRange(1, 1, 1, 9).setValues([['Clave', 'Mes', 'Año', 'Informe', 'Total a pagar', 'Versión', 'Guardado el', 'Guardado por', 'Datos (no editar)']]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function accionGuardarReporte(b) {
  var tipo = String(b.tipo || ''), mes = Number(b.mes), anio = Number(b.anio), total = Number(b.total) || 0;
  if (tipo !== 'general' && tipo !== 'kelli') return { ok: false, error: 'Tipo de informe no válido.' };
  if (!(mes >= 1 && mes <= 12) || !(anio >= 2000 && anio <= 2100)) return { ok: false, error: 'Mes o año no válido.' };
  var datos = String(b.datos || '');
  if (!datos || datos.length > 45000) return { ok: false, error: 'El informe está vacío o es demasiado grande.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var h = hojaHistorico(SpreadsheetApp.openById(SHEET_ID));
    var clave = anio + '-' + ('0' + mes).slice(-2) + '|' + tipo, version = 1, n = h.getLastRow();
    if (n >= 2) {
      var cl = h.getRange(2, 1, n - 1, 1).getValues();
      for (var i = 0; i < cl.length; i++) if (String(cl[i][0]) === clave) version++;
    }
    h.appendRow([clave, mes, anio, tipo, total, version, new Date(), String(b.por || ''), datos]);
    return { ok: true, version: version };
  } finally { lock.releaseLock(); }
}

function accionListarReportes() {
  var h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_HIST), out = [];
  if (!h || h.getLastRow() < 2) return { ok: true, reportes: out };
  var d = h.getRange(2, 1, h.getLastRow() - 1, 8).getValues();
  for (var i = 0; i < d.length; i++) {
    if (!d[i][0]) continue;
    out.push({ fila: i + 2, mes: Number(d[i][1]), anio: Number(d[i][2]), tipo: String(d[i][3]), total: Number(d[i][4]) || 0, version: Number(d[i][5]) || 1,
      guardado: (d[i][6] instanceof Date) ? Utilities.formatDate(d[i][6], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(d[i][6]), por: String(d[i][7]) });
  }
  return { ok: true, reportes: out };
}

function accionVerReporte(p) {
  var fila = Number(p.fila), h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_HIST);
  if (!h || !(fila >= 2) || fila > h.getLastRow()) return { ok: false, error: 'No se encontró el informe guardado.' };
  return { ok: true, datos: String(h.getRange(fila, 9).getValue()) };
}

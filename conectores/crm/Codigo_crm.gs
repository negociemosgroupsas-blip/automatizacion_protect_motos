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
      } else if (accion === 'erp_protect') {
        salida = accionErpProtect();
      } else if (accion === 'renov_gestiones') {
        salida = accionRenovGestiones();
      } else if (accion === 'cotRen_moto') {
        salida = accionCotRenMoto(params);
      } else if (accion === 'cotRen_listar') {
        salida = accionCotRenListar();
      } else if (accion === 'cotRen_guardar') {
        salida = accionCotRenGuardar(params);
      } else if (accion === 'cotRen_estado') {
        salida = accionCotRenEstado(params);
      } else if (accion === 'ping') {
        salida = { ok: true, mensaje: 'Conector del CRM activo', version: 'crm-6' };
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


// ==================== COTIZACIONES DE RENOVACIÓN (nuevo, solo agrega) ====================
// Pestaña «Cotizaciones Renovación» (se crea sola). Cada cotización es UNA fila con ID único;
// un mismo cliente puede tener varias. Nunca modifica Protect, Pagos ni ninguna otra pestaña.
var HOJA_COT = 'Cotizaciones Renovación';
var COT_ENC = ['ID cotización','Fecha cotización','Nombre cliente','Cédula','Placa','Marca / Referencia',
  'Valor factura anterior','Valor Fasecolda actual','Valor cotizado contado','Valor cotizado financiado','Plazo (meses)',
  'Estado','Fecha aceptación','Aseguradora','Forma de pago','RC (Sí/No)','AP (Sí/No)','Valor final contratado','Observaciones','Contrato'];
var COT_ESTADOS = ['Pendiente','Aceptó renovación','No aceptó renovación'];

function hojaCot(ss) {
  var h = ss.getSheetByName(HOJA_COT);
  if (h) return h;
  h = ss.insertSheet(HOJA_COT);
  var n = COT_ENC.length;
  var enc = h.getRange(1, 1, 1, n);
  enc.setValues([COT_ENC]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B1F4B')
     .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  h.setRowHeight(1, 42);
  h.setFrozenRows(1);
  h.getRange('B2:B').setNumberFormat('dd/MM/yyyy HH:mm');
  h.getRange('M2:M').setNumberFormat('dd/MM/yyyy HH:mm');
  h.getRange('G2:J').setNumberFormat('"$"#,##0');
  h.getRange('R2:R').setNumberFormat('"$"#,##0');
  h.getRange('D2:D').setNumberFormat('@');
  var anchos = [150,120,200,110,90,200,125,125,125,135,80,150,120,120,100,75,75,130,260,110];
  for (var i = 0; i < anchos.length; i++) h.setColumnWidth(i + 1, anchos[i]);
  // Listas desplegables
  h.getRange('L2:L').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(COT_ESTADOS, true).setAllowInvalid(false).build());
  h.getRange('N2:N').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Protect Motos','OMS','Sura'], true).setAllowInvalid(true).build());
  h.getRange('O2:O').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Contado','Financiado'], true).setAllowInvalid(false).build());
  h.getRange('P2:Q').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Sí','No'], true).setAllowInvalid(false).build());
  // Colores por estado
  var rg = [h.getRange('L2:L')];
  h.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pendiente').setBackground('#FFF3C4').setFontColor('#7A5B00').setRanges(rg).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Aceptó renovación').setBackground('#D7F5DF').setFontColor('#0B6B2B').setRanges(rg).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('No aceptó renovación').setBackground('#FAD4D4').setFontColor('#9B1C1C').setRanges(rg).build()
  ]);
  // Filtro y protección de encabezados (solo advierte: no bloquea a quien edita)
  h.getRange(1, 1, 1, n).createFilter();
  h.getRange(1, 1, 1, n).protect().setDescription('Encabezados de Cotizaciones Renovación').setWarningOnly(true);
  return h;
}

function fechaCotTxt(v) {
  return (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(v || '');
}

function accionCotRenMoto(p) {
  // Datos de la moto del cliente, tomados de Protect (valor factura = columna AA, marca AB, referencia AC)
  var contrato = String(p.contrato || '').trim();
  if (!contrato) return { ok: false, error: 'Falta el contrato.' };
  var hoja = hojaSeguimiento(SpreadsheetApp.openById(SHEET_ID));
  var ult = hoja.getLastRow();
  if (ult < FILA_INICIO_DATOS) return { ok: true, encontrado: false };
  var datos = hoja.getRange(FILA_INICIO_DATOS, 1, ult - FILA_INICIO_DATOS + 1, 33).getValues();
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    if (String(f[COL.CONTRATO - 1] || '').trim() === contrato) {
      return { ok: true, encontrado: true,
        cliente: String(f[COL.CLIENTE - 1] || ''), cedula: String(f[COL.CEDULA - 1] || ''),
        placa: String(f[COL.PLACA - 1] || ''), celular: String(f[COL.CELULAR - 1] || ''),
        valorMoto: Number(String(f[26] || '').replace(/[^0-9.-]/g, '')) || 0,
        marca: String(f[27] || ''), referencia: String(f[28] || '') };
    }
  }
  return { ok: true, encontrado: false };
}

function accionCotRenListar() {
  var h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_COT), out = [];
  if (!h || h.getLastRow() < 2) return { ok: true, cotizaciones: out };
  var d = h.getRange(2, 1, h.getLastRow() - 1, COT_ENC.length).getValues();
  for (var i = 0; i < d.length; i++) {
    if (!d[i][0]) continue;
    out.push({ id: String(d[i][0]), fecha: fechaCotTxt(d[i][1]), nombre: String(d[i][2]), cedula: String(d[i][3]), placa: String(d[i][4]),
      moto: String(d[i][5]), factura: Number(d[i][6]) || 0, fasecolda: Number(d[i][7]) || 0, contado: Number(d[i][8]) || 0,
      financiado: Number(d[i][9]) || 0, plazo: Number(d[i][10]) || 0, estado: String(d[i][11]), fechaAcep: fechaCotTxt(d[i][12]),
      aseguradora: String(d[i][13]), forma: String(d[i][14]), rc: String(d[i][15]), ap: String(d[i][16]),
      valorFinal: Number(d[i][17]) || 0, obs: String(d[i][18]), contrato: String(d[i][19]) });
  }
  return { ok: true, cotizaciones: out };
}

function accionCotRenGuardar(p) {
  var nombre = String(p.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre del cliente.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var h = hojaCot(SpreadsheetApp.openById(SHEET_ID));
    var ahora = new Date(), tz = Session.getScriptTimeZone();
    var pref = 'COT-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd') + '-';
    var n = h.getLastRow(), seq = 1;
    if (n >= 2) {
      var ids = h.getRange(2, 1, n - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var id = String(ids[i][0]);
        if (id.indexOf(pref) === 0) { var k = parseInt(id.slice(pref.length), 10) || 0; if (k >= seq) seq = k + 1; }
      }
    }
    var id2 = pref + ('00' + seq).slice(-3);
    var num = function (v) { return Number(String(v || '').replace(/[^0-9.-]/g, '')) || 0; };
    var fila = n + 1;
    h.getRange(fila, 1, 1, COT_ENC.length).setValues([[id2, ahora, nombre, "'" + String(p.cedula || ''), String(p.placa || ''),
      String(p.moto || ''), num(p.factura), num(p.fasecolda), num(p.contado), num(p.financiado), num(p.plazo),
      'Pendiente', '', '', '', '', '', '', String(p.obs || '').slice(0, 900), String(p.contrato || '')]]);
    h.getRange(fila, 4).setNumberFormat('@').setValue(String(p.cedula || ''));
    return { ok: true, id: id2 };
  } finally { lock.releaseLock(); }
}

function accionCotRenEstado(p) {
  var id = String(p.id || '').trim(), estado = String(p.estado || '').trim();
  if (COT_ESTADOS.indexOf(estado) < 0) return { ok: false, error: 'Estado no válido.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_COT);
    if (!h || h.getLastRow() < 2) return { ok: false, error: 'No hay cotizaciones guardadas.' };
    var ids = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues(), fila = 0;
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { fila = i + 2; break; }
    if (!fila) return { ok: false, error: 'No se encontró la cotización ' + id + '.' };
    var num = function (v) { return Number(String(v || '').replace(/[^0-9.-]/g, '')) || 0; };
    h.getRange(fila, 12).setValue(estado);
    if (estado === 'Aceptó renovación') {
      h.getRange(fila, 13, 1, 7).setValues([[new Date(), String(p.aseguradora || ''), String(p.forma || ''),
        String(p.rc || ''), String(p.ap || ''), num(p.valorFinal), String(p.obs || '')]]);
      if (num(p.plazo) > 0) h.getRange(fila, 11).setValue(num(p.plazo));
    } else if (estado === 'No aceptó renovación') {
      h.getRange(fila, 13).setValue(new Date());
      h.getRange(fila, 19).setValue(String(p.obs || ''));
    } else {
      h.getRange(fila, 13).clearContent();
    }
    return { ok: true, id: id, estado: estado };
  } finally { lock.releaseLock(); }
}


// ==================== RENOVACIONES: gestiones para el Inicio (nuevo, solo lee) ====================
// Devuelve de la hoja «Gestiones» únicamente las filas de renovación (mensaje enviado, aceptada, no aceptada, vencida, seguimientos).
function accionRenovGestiones() {
  var h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Gestiones'), out = [];
  if (!h || h.getLastRow() < 2) return { ok: true, gestiones: out };
  var d = h.getRange(2, 1, h.getLastRow() - 1, 6).getValues();
  for (var i = 0; i < d.length; i++) {
    var acc = String(d[i][4] || '');
    if (!/renovaci/i.test(acc)) continue;
    var contrato = String(d[i][1] || '').trim();
    if (!contrato) continue;
    out.push({ fechaISO: formatoISO(d[i][0]), contrato: contrato, cliente: String(d[i][3] || ''), accion: acc });
  }
  return { ok: true, gestiones: out };
}


// ==================== CRUCE SEMANAL ERP: lectura de Protect para el cruce semanal (nuevo, SOLO LEE) ====================
// Devuelve, por cada fila de la hoja Protect: fila, asesor, cédula, cliente, placa, contrato, valor de la columna P y estado.
// No escribe nada y no modifica ninguna hoja.
function numeroErp_(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var t = String(v === null || v === undefined ? '' : v).replace(/[$\s]/g, '');
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  var n = Number(t);
  return isNaN(n) ? null : n;
}

function accionErpProtect() {
  var hoja = hojaSeguimiento(SpreadsheetApp.openById(SHEET_ID));
  var ult = hoja.getLastRow(), out = [];
  var ancho = Math.min(Math.max(hoja.getLastColumn(), 16), 44);
  var encP = '';
  try {
    var t = hoja.getRange(1, 16, 2, 1).getDisplayValues();
    encP = String(t[1][0] || t[0][0] || '');
  } catch (e) {}
  if (ult < 2) return { ok: true, filas: out, encabezadoP: encP };
  var datos = hoja.getRange(2, 1, ult - 1, ancho).getValues();
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var ced = String(f[4] === null || f[4] === undefined ? '' : f[4]).trim();
    var cli = String(f[7] || '').trim();
    var ctr = String(f[13] || '').trim();
    if (!/\d/.test(ced) && !cli && !ctr) continue;
    if (!/\d/.test(ced)) continue;          // fila de títulos o sin cédula
    out.push({ fila: i + 2, asesor: String(f[1] || '').trim(), cedula: ced, cliente: cli, placa: String(f[12] || '').trim(),
      contrato: ctr, valorP: numeroErp_(f[15]), estado: ancho >= 44 ? String(f[43] || '').trim().toUpperCase() : '' });
  }
  return { ok: true, filas: out, encabezadoP: encP };
}

/**
 * PROTECT MOTOS — Pantalla web de la conciliación (Conciliacion_Dugo.html)
 *
 * IMPORTANTE: este archivo define doGet(), que ya existe en Codigo_cobros.gs.
 * Por eso debe ir en un proyecto de Apps Script APARTE (junto con
 * Conciliacion_Consolidados.gs y Conciliacion_Dugo.html), nunca en el de cobros.
 * Así no se toca el conector de cobros ni el de contratos.
 *
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Solo yo  (recomendado: la pantalla ve datos de pagos)
 */

// Clave para usar la conciliación desde el HTML local (Conciliacion_Dugo_Local.html)
var CONC_TOKEN = 'PM-CONC-3e97c3a8bb5298ef9d192391';

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'conciliar') return CONC_respuestaJsonp(params);
  if (params.action === 'ajustar') return CONC_respuestaAjuste(params);
  if (params.action === 'asignar') return CONC_respuestaAsignar(params);
  if (params.action === 'asignarlote') return CONC_respuestaAsignarLote(params);
  return HtmlService.createHtmlOutputFromFile('Conciliacion_Dugo')
    .setTitle('Conciliación Dugo Motos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Llamada desde la pantalla. Calcula, escribe la hoja "Conciliacion_Dugo" y devuelve los resultados.
 * @param {number|string} tolerancia pesos de diferencia aceptados (por defecto CONC_TOLERANCIA)
 */
function CONC_apiConciliar(tolerancia) {
  var tol = Number(tolerancia);
  if (tolerancia === '' || tolerancia === null || tolerancia === undefined || isNaN(tol) || tol < 0) {
    tol = CONC_TOLERANCIA;
  }

  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  var out = CONC_procesar(ss, tol);

  return {
    tolerancia: tol,
    hoja: CONC_HOJA_RESULTADO,
    hojaHistorial: CONC_HOJA_HISTORIAL,
    resumen: out.res.resumen,
    filas: out.res.filas,
    hist: out.hist,
    atipicos: out.atipicos,
    columnas: out.columnas,
    estadoEnHoja: out.estadoEnHoja,
    version: 'v9',
    acciones: ['conciliar', 'ajustar', 'asignar', 'asignarlote'], // la pantalla usa esto para avisar si el código publicado está desactualizado
    diag: out.diag,
    generado: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  };
}

/** Respuesta JSONP para el HTML local. Exige el token. */
function CONC_respuestaJsonp(params) {
  var salida;
  try {
    if (params.token !== CONC_TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      salida = { ok: true, data: CONC_apiConciliar(params.tolerancia) };
    }
  } catch (err) {
    salida = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var cb = params.callback;
  if (cb && /^[A-Za-z_$][\w$.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(salida) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/** Ajuste manual (Consolidado / Falta / Quitar) desde el HTML local. Exige el token. */
function CONC_respuestaAjuste(params) {
  var salida;
  try {
    if (params.token !== CONC_TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var r = CONC_apiAjustar(params.clave, params.decision, params.nota, params.cedula, params.cliente, params.contrato);
      salida = { ok: true, data: r };
    }
  } catch (err) {
    salida = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var cb = params.callback;
  if (cb && /^[A-Za-z_$][\w$.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(salida) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/** Guarda la decisión en la hoja "Ajustes_Manuales". decision: 'Consolidado' | 'Falta' | 'Nota' | 'Quitar'. */
function CONC_apiAjustar(clave, decision, nota, cedula, cliente, contrato) {
  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  return CONC_guardarAjuste(ss, { clave: clave, decision: decision, nota: nota, cedula: cedula, cliente: cliente, contrato: contrato });
}

/** Asignación manual de un pago a un contrato (personas con varios contratos). Exige el token. */
function CONC_respuestaAsignar(params) {
  var salida;
  try {
    if (params.token !== CONC_TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      salida = { ok: true, data: CONC_apiAsignar(params.clavePago, params.contrato, params.cedula, params.cliente, params.c, params.d) };
    }
  } catch (err) {
    salida = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var cb = params.callback;
  if (cb && /^[A-Za-z_$][\w$.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(salida) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/** contrato: número de contrato, 'NINGUNO' (no es un pago) o 'AUTO' (volver a la asignación automática). */
function CONC_apiAsignar(clavePago, contrato, cedula, cliente, c, d) {
  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  return CONC_guardarAsignacion(ss, { clavePago: clavePago, contrato: contrato, cedula: cedula, cliente: cliente, c: c, d: d });
}

/** Varias asignaciones de pagos a contratos en una sola llamada (tarjeta de persona con varios contratos). Exige el token. */
function CONC_respuestaAsignarLote(params) {
  var salida;
  try {
    if (params.token !== CONC_TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var lista = JSON.parse(params.lote || '[]');
      salida = { ok: true, data: CONC_guardarAsignaciones(SpreadsheetApp.openById(CONC_SHEET_ID), lista) };
    }
  } catch (err) {
    salida = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var cb = params.callback;
  if (cb && /^[A-Za-z_$][\w$.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(salida) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

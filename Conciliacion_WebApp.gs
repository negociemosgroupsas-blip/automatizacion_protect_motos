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
  var hojaProtect = CONC_buscarHoja(ss, CONC_HOJA_PROTECT);
  var hojaCons = CONC_buscarHoja(ss, CONC_HOJA_CONSOLIDADOS);

  var res = CONC_calcular(CONC_leerProtect(hojaProtect), CONC_leerConsolidados(hojaCons), tol);
  CONC_escribirResultado(ss, res);

  return {
    tolerancia: tol,
    hoja: CONC_HOJA_RESULTADO,
    resumen: res.resumen,
    filas: res.filas,
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

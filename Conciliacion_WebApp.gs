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

function doGet() {
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
  var hojaProtect = ss.getSheetByName(CONC_HOJA_PROTECT);
  var hojaCons = ss.getSheetByName(CONC_HOJA_CONSOLIDADOS);
  if (!hojaProtect) throw new Error('No se encontró la hoja "' + CONC_HOJA_PROTECT + '".');
  if (!hojaCons) throw new Error('No se encontró la hoja "' + CONC_HOJA_CONSOLIDADOS + '".');

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

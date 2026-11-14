/**
 * PROTECT MOTOS — CONECTOR ÚNICO (un solo Apps Script para todo el sistema)  ·  versión unico-1
 *
 * Reúne, sin cambiarlos, los conectores de Cobros, CRM, Clientes OMS, SOAT, Contratos y Conciliación.
 * Cada uno conserva su clave (token), sus acciones y sus respuestas: el sistema web sigue llamando igual,
 * solo que ahora TODOS los módulos usan la MISMA URL. El enrutador mira la clave y entrega la petición al conector correcto.
 *
 * ARCHIVO GENERADO por conectores/unico/construir.py — no lo edite a mano; si algún conector cambia, vuelva a generarlo.
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 * Primera vez: ejecute la función AUTORIZAR_TODO una vez para dar los permisos (hojas y Drive).
 */
var UNICO_VERSION = 'unico-1';

// ========================================================================
// MÓDULO: PM_Cobros  (origen: conectores/cobros/Codigo_cobros.gs)
// ========================================================================
var PM_Cobros = (function () {
/**
 * PROTECT MOTOS — Conector de Cobros
 * Publicar como Aplicación web (Implementar > Nueva implementación > Aplicación web).
 * Acceso: "Cualquier usuario" (para que el HTML por file:// pueda llamarlo por JSONP).
 * Ejecutar como: "Yo" (el dueño de la hoja).
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-COBROS-2026';
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var HOJA_SEGUIMIENTO = 'Protect';
var HOJA_PAGOS = 'Pagos';
var HOJA_GESTIONES = 'Gestiones';

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
  FORMA: 20,         // CONTADO | FINANCIADO
  CELULAR: 31,
  CORREO: 32,
  DIRECCION: 33,
  ESTADO_CLIENTE: 44 // ACTIVO | CANCELADO | FINALIZADO (columna AR)
};

var FILA_INICIO_DATOS = 2; // fila 1 = encabezados

// Encabezados exactos de la hoja "Pagos" (columnas A-H)
var ENCABEZADOS_PAGOS = [
  'Fecha de pago', 'N° contrato', 'Cédula', 'Cliente',
  'N° de cuota', 'Valor pagado', 'Comprobante / nota', 'Registrado por'
];

// Encabezados exactos de la hoja "Gestiones" (columnas A-F)
var ENCABEZADOS_GESTIONES = [
  'Fecha de gestión', 'N° contrato', 'Cédula', 'Cliente', 'Acción', 'Registrado por'
];

// Carpeta de Drive donde se guardan las capturas de los comprobantes de
// pago. Se crea sola la primera vez que se sube un comprobante.
var CARPETA_COMPROBANTES = 'Comprobantes de pago';

// ==================== PUNTO DE ENTRADA (GET) ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var callback = params.callback;
  var salida;

  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') {
        salida = accionDatos();
      } else if (accion === 'registrarPago') {
        salida = accionRegistrarPago(params);
      } else if (accion === 'estado') {
        salida = accionCambiarEstado(params);
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

// ==================== PUNTO DE ENTRADA (POST) ====================
// Solo se usa para subir la imagen del comprobante de pago: por su tamaño
// no cabe en una URL de GET/JSONP como las demás acciones.
function doPost(e) {
  var salida;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    if (body.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else if (body.action === 'subirComprobante') {
      salida = accionSubirComprobante(body);
    } else {
      salida = { ok: false, error: 'Acción desconocida: ' + body.action };
    }
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
  var hojaGestiones = ss.getSheetByName(HOJA_GESTIONES);

  var contratos = leerContratos(hojaSeg);
  var pagos = leerPagos(hojaPagos);
  var gestiones = leerGestiones(hojaGestiones);

  return { ok: true, contratos: contratos, pagos: pagos, gestiones: gestiones };
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

function leerGestiones(hoja) {
  if (!hoja) return [];
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 6).getValues();
  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[1] || '').trim();
    if (!contrato) continue;
    resultado.push({
      fechaGestion: formatoFecha(fila[0]),
      fechaGestionISO: formatoISO(fila[0]),
      contrato: contrato,
      cedula: String(fila[2] || ''),
      cliente: String(fila[3] || ''),
      accion: String(fila[4] || ''),
      registradoPor: String(fila[5] || '')
    });
  }
  return resultado;
}

// ==================== ACCIÓN: REGISTRAR GESTIÓN DE COBRO ====================
// Marca que hoy ya se contactó al cliente ("YA COBRÉ HOY"). No cambia el
// estado del cliente ni registra ningún pago — solo queda el registro de
// que se hizo la gestión, para que no vuelva a salir en la lista de hoy.
function accionRegistrarGestion(params) {
  var contrato = String(params.contrato || '').trim();
  var cedula = String(params.cedula || '').trim();
  var cliente = String(params.cliente || '').trim();
  var registradoPor = String(params.registradoPor || '').trim();
  var accion = String(params.accion || '').trim() || 'Cobro realizado';

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaGestiones = ss.getSheetByName(HOJA_GESTIONES);
    if (!hojaGestiones) {
      hojaGestiones = ss.insertSheet(HOJA_GESTIONES);
      hojaGestiones.appendRow(ENCABEZADOS_GESTIONES);
    }

    hojaGestiones.appendRow([new Date(), contrato, cedula, cliente, accion, registradoPor]);

    return { ok: true, mensaje: 'Gestión registrada correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar la gestión: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== ACCIÓN: REGISTRAR PAGO ====================
function accionRegistrarPago(params) {
  var contrato = String(params.contrato || '').trim();
  var cedula = String(params.cedula || '').trim();
  var cliente = String(params.cliente || '').trim();
  var cuota = String(params.cuota || '').trim();
  var valor = Number(params.valor || 0);
  var nota = String(params.nota || '').trim();
  var registradoPor = String(params.registradoPor || '').trim();
  var fechaTexto = String(params.fecha || '').trim(); // esperado d/m/aaaa o yyyy-mm-dd

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  if (!cuota) return { ok: false, error: 'Falta el número de cuota.' };
  if (!valor || valor <= 0) return { ok: false, error: 'El valor pagado debe ser mayor a 0.' };

  var fechaPago = parsearFecha(fechaTexto) || new Date();

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaPagos = ss.getSheetByName(HOJA_PAGOS);
    if (!hojaPagos) {
      hojaPagos = ss.insertSheet(HOJA_PAGOS);
      hojaPagos.appendRow(ENCABEZADOS_PAGOS);
    }

    hojaPagos.appendRow([fechaPago, contrato, cedula, cliente, cuota, valor, nota, registradoPor]);

    // Si con este pago el cliente financiado completó todas las cuotas, marcar FINALIZADO.
    var finalizado = false;
    var hojaSeg = hojaSeguimiento(ss);
    var infoContrato = buscarFilaContrato(hojaSeg, contrato);
    if (infoContrato) {
      var forma = String(infoContrato.fila[COL.FORMA - 1] || '').trim().toUpperCase();
      var plazo = Number(infoContrato.fila[COL.PLAZO - 1] || 0);
      var estadoActual = String(infoContrato.fila[COL.ESTADO_CLIENTE - 1] || '').trim().toUpperCase();

      if (forma === 'FINANCIADO' && estadoActual === 'ACTIVO' && plazo > 0) {
        // La cuota 1 se paga al firmar y nunca queda registrada en "Pagos",
        // así que se suma como ya pagada al comparar contra el plazo.
        var cuotasPagadas = contarCuotasPagadas(hojaPagos, contrato, plazo) + 1;
        if (cuotasPagadas >= plazo) {
          hojaSeg.getRange(infoContrato.numeroFila, COL.ESTADO_CLIENTE).setValue('FINALIZADO');
          finalizado = true;
        }
      }
    }

    return { ok: true, mensaje: 'Pago registrado correctamente.', finalizado: finalizado };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar el pago: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function contarCuotasPagadas(hojaPagos, contrato, plazo) {
  var ultimaFila = hojaPagos.getLastRow();
  if (ultimaFila < 2) return 0;
  var datos = hojaPagos.getRange(2, 1, ultimaFila - 1, 8).getValues();
  var pagadas = {};
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][1] || '').trim() !== contrato) continue;
    var numeros = extraerNumerosCuota(String(datos[i][4] || ''));
    for (var j = 0; j < numeros.length; j++) {
      if (numeros[j] >= 1 && numeros[j] <= plazo) pagadas[numeros[j]] = true;
    }
  }
  return Object.keys(pagadas).length;
}

function extraerNumerosCuota(texto) {
  var numeros = [];
  texto = texto.replace(/,/g, ' ');
  var partes = texto.split(/\s+/).filter(function (p) { return p !== ''; });
  for (var i = 0; i < partes.length; i++) {
    var parte = partes[i];
    var rango = parte.match(/^(\d+)-(\d+)$/);
    if (rango) {
      var a = parseInt(rango[1], 10), b = parseInt(rango[2], 10);
      for (var n = a; n <= b; n++) numeros.push(n);
    } else {
      // Cualquier otro separador que haya quedado (punto, guiones
      // encadenados, punto y coma...) — ej. si Sheets convirtió "3,4" en
      // el número 3.4 — se toma cada número que aparezca como una cuota
      // individual, sin importar qué caracter quedó entre ellos.
      var sueltos = parte.match(/\d+/g);
      if (sueltos) sueltos.forEach(function (s) { numeros.push(parseInt(s, 10)); });
    }
  }
  // soporte para "4 a 6"
  var rangoTexto = texto.match(/^(\d+)\s*a\s*(\d+)$/i);
  if (rangoTexto) {
    var x = parseInt(rangoTexto[1], 10), y = parseInt(rangoTexto[2], 10);
    numeros = [];
    for (var k = x; k <= y; k++) numeros.push(k);
  }
  return numeros;
}

// ==================== ACCIÓN: SUBIR COMPROBANTE ====================
// Recibe la imagen en base64, la guarda en Drive (carpeta "Comprobantes de
// pago", se crea sola la primera vez) y devuelve el enlace. No toca la hoja
// "Pagos" — el enlace se agrega después, al registrar el pago.
function accionSubirComprobante(body) {
  var contrato = String(body.contrato || '').trim();
  var cedula = String(body.cedula || '').trim();
  var cliente = String(body.cliente || '').trim();
  var cuota = String(body.cuota || '').trim();
  var fecha = String(body.fecha || '').trim(); // d/m/aaaa o yyyy-mm-dd, como la escribió el usuario
  var nombreArchivo = String(body.nombreArchivo || '').trim() || 'comprobante';
  var tipoMime = String(body.tipoMime || '').trim() || 'image/jpeg';
  var datosBase64 = body.datosBase64;

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  if (!datosBase64) return { ok: false, error: 'No se recibió ninguna imagen.' };

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var bytes = Utilities.base64Decode(datosBase64);
    // Dentro de la carpeta del cliente ya no hace falta repetir la cédula
    // en cada archivo: con la cuota y la fecha basta.
    var extension = (nombreArchivo.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    var partesNombre = [];
    if (cuota) partesNombre.push('Cuota ' + cuota);
    var fechaFormateada = formatoFechaParaNombre(fecha);
    if (fechaFormateada) partesNombre.push(fechaFormateada);
    if (partesNombre.length === 0) partesNombre.push('comprobante');
    var nombreFinal = partesNombre.join(' - ') + extension;
    var blob = Utilities.newBlob(bytes, tipoMime, nombreFinal);

    var carpetaCliente = obtenerCarpetaCliente(cedula || contrato, cliente);
    var archivo = carpetaCliente.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view' };
  } catch (err) {
    return { ok: false, error: 'No se pudo subir el comprobante: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function obtenerCarpetaComprobantes() {
  var carpetas = DriveApp.getFoldersByName(CARPETA_COMPROBANTES);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(CARPETA_COMPROBANTES);
}

// Subcarpeta de un cliente dentro de "Comprobantes de pago", identificada
// por su cédula (o el contrato si no hay cédula). Se busca por el prefijo
// "clave - " para que, aunque el nombre del cliente cambie o esté escrito
// distinto, siga cayendo en la misma carpeta ya creada.
function obtenerCarpetaCliente(clave, cliente) {
  var carpetaRaiz = obtenerCarpetaComprobantes();
  var prefijo = clave + ' - ';
  var subcarpetas = carpetaRaiz.getFolders();
  while (subcarpetas.hasNext()) {
    var sub = subcarpetas.next();
    if (sub.getName().indexOf(prefijo) === 0) return sub;
  }
  var nombreCarpeta = clave + ' - ' + (cliente || 'Cliente');
  return carpetaRaiz.createFolder(nombreCarpeta);
}

// Función de prueba: selecciónala en el desplegable de funciones del editor
// y dale "Ejecutar" para forzar que Google pida el permiso de Drive la
// primera vez (crea un archivo de prueba en la carpeta "Comprobantes de
// pago", que puedes borrar después). No la usa el panel ni se ejecuta sola.
function pruebaDrive() {
  var resultado = accionSubirComprobante({
    contrato: 'PRUEBA',
    nombreArchivo: 'prueba.txt',
    tipoMime: 'text/plain',
    datosBase64: Utilities.base64Encode('contenido de prueba')
  });
  Logger.log(resultado);
}

// ==================== ACCIÓN: CAMBIAR ESTADO ====================
function accionCambiarEstado(params) {
  var contrato = String(params.contrato || '').trim();
  var nuevoEstado = String(params.nuevoEstado || '').trim().toUpperCase();

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  var estadosValidos = ['ACTIVO', 'CANCELADO', 'FINALIZADO'];
  if (estadosValidos.indexOf(nuevoEstado) === -1) {
    return { ok: false, error: 'Estado inválido: ' + nuevoEstado };
  }

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaSeg = hojaSeguimiento(ss);
    var info = buscarFilaContrato(hojaSeg, contrato);
    if (!info) {
      return { ok: false, error: 'No se encontró el contrato ' + contrato };
    }
    hojaSeg.getRange(info.numeroFila, COL.ESTADO_CLIENTE).setValue(nuevoEstado);
    return { ok: true, mensaje: 'Estado actualizado a ' + nuevoEstado + '.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo cambiar el estado: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== UTILIDADES ====================
function hojaSeguimiento(ss) {
  var hoja = ss.getSheetByName(HOJA_SEGUIMIENTO);
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + HOJA_SEGUIMIENTO + '". Revisa que se llame exactamente así.');
  }
  return hoja;
}

function buscarFilaContrato(hoja, contrato) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_INICIO_DATOS) return null;
  var valores = hoja.getRange(FILA_INICIO_DATOS, COL.CONTRATO, ultimaFila - FILA_INICIO_DATOS + 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0] || '').trim() === contrato) {
      var numeroFila = FILA_INICIO_DATOS + i;
      var filaCompleta = hoja.getRange(numeroFila, 1, 1, hoja.getLastColumn()).getValues()[0];
      return { numeroFila: numeroFila, fila: filaCompleta };
    }
  }
  return null;
}

function formatoFecha(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  return fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear();
}

function formatoISO(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  var dia = ('0' + fecha.getDate()).slice(-2);
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

function parsearFecha(texto) {
  if (!texto) return null;
  // yyyy-mm-dd
  var isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  // d/m/aaaa
  var esMatch = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (esMatch) {
    return new Date(Number(esMatch[3]), Number(esMatch[2]) - 1, Number(esMatch[1]));
  }
  var fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// dd-mm-aaaa, para usar en nombres de archivo (sin "/" que no es válido ahí).
function formatoFechaParaNombre(texto) {
  var fecha = parsearFecha(texto);
  if (!fecha) return '';
  var dia = ('0' + fecha.getDate()).slice(-2);
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  return dia + '-' + mes + '-' + fecha.getFullYear();
}

  return { doGet:doGet, doPost:doPost, pruebaDrive:pruebaDrive };
})();

// ========================================================================
// MÓDULO: PM_CRM  (origen: conectores/crm/Codigo_crm.gs)
// ========================================================================
var PM_CRM = (function () {
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
      'Pendiente', '', '', '', '', '', '', '', String(p.contrato || '')]]);
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

  return { doGet:doGet, doPost:doPost };
})();

// ========================================================================
// MÓDULO: PM_OMS  (origen: conectores/oms/Codigo_oms.gs)
// ========================================================================
var PM_OMS = (function () {
/**
 * PROTECT MOTOS — Conector de Clientes OMS (igual que el de Cobros, pero para el Google Sheet «Historico polizas»)
 *
 * CÓMO CREARLO (una sola vez):
 *   1) Abre el Google Sheet de clientes OMS ("Historico polizas").
 *   2) Menú Extensiones > Apps Script. Borra lo que haya y pega TODO este archivo. Guarda.
 *      (Si el Sheet se llama distinto a «Historico polizas», cambia SHEET_NOMBRE o pega su ID en SHEET_ID.)
 *   3) Implementar > Nueva implementación > Aplicación web.  Ejecutar como: Yo.  Quién tiene acceso: Cualquier usuario.
 *   4) Copia la URL que termina en /exec y pégala en el botón «Clientes OMS» del CRM.
 *
 * Pagos y comprobantes: se guardan en la pestaña «Pagos_OMS» (se crea sola) y las imágenes en la carpeta «Comprobantes de pago OMS» de su Drive.
 *
 * Lee la hoja de clientes (columnas: Nombre completo, Cedula, Vehiculo, Valor a pagar, Celular, Compra, Fecha inicio,
 * Fecha fin, Estado). NO cobra: sirve para avisar la renovación al año. Guarda los avisos (mensaje enviado, renovó,
 * no renovará) en la pestaña «Gestiones_OMS» (se crea sola). No toca ninguna otra hoja.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-OMS-2026';
var SHEET_ID = '';                 // ID del Google Sheet (lo que está en su URL entre /d/ y /edit). Si lo dejas vacío, se busca por nombre (SHEET_NOMBRE).
var SHEET_NOMBRE = 'Historico polizas'; // nombre exacto del Google Sheet de clientes OMS
var HOJA_CLIENTES = 'Clientes OMS'; // nombre de la pestaña de clientes; si no existe se usa la que tenga las columnas Cedula y Fecha fin (o la primera)
var HOJA_GESTIONES = 'Gestiones_OMS';
var FILA_ENCABEZADOS = 1;          // fila donde están los títulos
var PLAZO_POR_DEFECTO = 12;        // cuotas de un cliente FINANCIADO si la hoja no trae plazo (se calcula con Fecha inicio y Fecha fin)

// Columnas: se buscan por el NOMBRE del título (sin importar mayúsculas ni tildes). pos = columna por defecto (A=1).
var COLS = [
  { clave: 'cliente',  pos: 1, nombres: ['nombre completo', 'nombre', 'cliente'] },
  { clave: 'cedula',   pos: 2, nombres: ['cedula', 'documento', 'cc'] },
  { clave: 'vehiculo', pos: 3, nombres: ['vehiculo', 'moto', 'placa'] },
  { clave: 'valor',    pos: 4, nombres: ['valor a pagar', 'valor cuota', 'valor'] },
  { clave: 'celular',  pos: 5, nombres: ['celular', 'telefono', 'whatsapp'] },
  { clave: 'forma',    pos: 6, nombres: ['compra', 'forma de pago', 'forma'] },
  { clave: 'inicio',   pos: 7, nombres: ['fecha inicio', 'fecha inicial', 'inicio'] },
  { clave: 'fin',      pos: 8, nombres: ['fecha fin', 'fecha final', 'fecha vencimiento', 'vencimiento', 'fin'] },
  { clave: 'estado',   pos: 9, nombres: ['estado', 'estado del cliente'] }
];
// Columnas opcionales (si algún día las agregas, se leen solas): no hay posición por defecto.
var COLS_OPC = [
  { clave: 'contrato', nombres: ['contrato', 'n contrato', 'numero de contrato'] },
  { clave: 'plazo',    nombres: ['plazo', 'cuotas', 'numero de cuotas'] },
  { clave: 'correo',   nombres: ['correo', 'email', 'correo electronico'] },
  { clave: 'asesor',   nombres: ['asesor'] },
  { clave: 'marca',    nombres: ['marca', 'marca de la moto'] },
  { clave: 'aseguradora', nombres: ['aseguradora', 'compania de seguros', 'compania aseguradora', 'seguro'] },
  { clave: 'direccion',nombres: ['direccion'] }
];

var ENCABEZADOS_GESTIONES = ['Fecha de gestión', 'Referencia', 'Cédula', 'Cliente', 'Acción', 'Registrado por'];
var HOJA_PAGOS = 'Pagos_OMS';
var ENCABEZADOS_PAGOS = ['Fecha de pago', 'Referencia', 'Cédula', 'Cliente', 'Concepto', 'Valor pagado', 'Nota', 'Registrado por', 'Comprobante', 'Carpeta'];
var CARPETA_COMPROBANTES = 'Comprobantes de pago OMS';   // solo se usa si no se puede encontrar la carpeta donde está la hoja
// Los comprobantes se guardan en la MISMA carpeta donde está la hoja «Historico polizas» (por ejemplo ...\11.Polizas OMS sura\SURA),
// dentro de una subcarpeta con la cédula del cliente (se usa la que ya exista; si no, se crea).
// Si quiere otra carpeta, pegue aquí su ID (lo que va después de /folders/ en la URL de la carpeta). Déjelo vacío para usar la de la hoja.
var CARPETA_DESTINO_ID = '';

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var salida;
  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') salida = accionDatos();
      else if (accion === 'estado') salida = accionCambiarEstado(params);
      else if (accion === 'registrarGestion') salida = accionRegistrarGestion(params);
      else if (accion === 'agregar') salida = accionAgregar(params);
      else if (accion === 'registrarPago') salida = accionRegistrarPago(params);
      else if (accion === 'ping') salida = { ok: true, mensaje: 'Conector de Clientes OMS activo', version: 'oms-7' };
      else salida = { ok: false, error: 'Acción desconocida: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

// Solo para subir la imagen del comprobante (no cabe en una URL de GET).
function doPost(e) {
  var salida;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    if (body.token !== TOKEN) salida = { ok: false, error: 'Token inválido.' };
    else if (body.action === 'subirComprobante') salida = accionSubirComprobante(body);
    else salida = { ok: false, error: 'Acción desconocida: ' + body.action };
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, null);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ==================== DATOS ====================
// Abre el Google Sheet de clientes OMS. Una aplicación web NO puede usar "la hoja activa", así que se busca de este orden:
//   1) por el ID de SHEET_ID (lo más seguro);  2) por el nombre SHEET_NOMBRE en tu Drive (el más reciente).
function abrirSS() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  var archivos = DriveApp.getFilesByName(SHEET_NOMBRE), mejor = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    if (!mejor || f.getLastUpdated() > mejor.getLastUpdated()) mejor = f;
  }
  if (!mejor) throw new Error('No encontré el Google Sheet "' + SHEET_NOMBRE + '". Pega su ID en SHEET_ID (está en la URL del Sheet, entre /d/ y /edit).');
  return SpreadsheetApp.openById(mejor.getId());
}

function accionDatos() {
  var ss = abrirSS();
  var hoja = hojaClientes(ss);
  return { ok: true, contratos: leerClientes(hoja).lista, pagos: leerPagos(ss.getSheetByName(HOJA_PAGOS)), gestiones: leerGestiones(ss.getSheetByName(HOJA_GESTIONES)) };
}

// Devuelve cada cliente con el mismo formato que usa el módulo de Cobros.
function leerClientes(hoja) {
  var ultimaFila = hoja.getLastRow(), ultimaCol = hoja.getLastColumn();
  if (ultimaFila <= FILA_ENCABEZADOS || ultimaCol < 1) return { lista: [], mapa: {} };
  var enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ultimaCol).getDisplayValues()[0];
  var idx = indicesColumnas(enc);
  var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ultimaFila - FILA_ENCABEZADOS, ultimaCol).getValues();
  var lista = [], mapa = {}, usados = {};
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var g = function (k) { return idx[k] >= 0 ? f[idx[k]] : ''; };
    var cliente = texto(g('cliente')), cedula = texto(g('cedula'));
    if (!cliente && !cedula) continue;
    var inicio = aFecha(g('inicio')), fin = aFecha(g('fin'));
    var forma = normalizarForma(g('forma'));
    var valor = moneda(g('valor'));
    var plazo = Number(numero(g('plazo'))) || 0;
    if (forma === 'FINANCIADO' && !plazo) plazo = plazoPorFechas(inicio, fin);
    // Referencia única del cliente (equivale al "N° de contrato" de Cobros): la columna Contrato si existe; si no, cédula + fecha de inicio
    var ref = texto(g('contrato'));
    if (!ref) ref = (cedula || 'SIN-CEDULA') + '-' + (inicio ? iso(inicio).replace(/-/g, '') : 'F' + (FILA_ENCABEZADOS + 1 + i));
    if (usados[ref]) { usados[ref]++; ref = ref + '-' + usados[ref]; } else { usados[ref] = 1; }
    var reg = {
      asesor: texto(g('asesor')), marca: texto(g('marca')), aseguradora: texto(g('aseguradora')),
      cedula: cedula, cliente: cliente,
      fechaFirma: fmt(inicio), fechaFirmaISO: iso(inicio),
      fin: fmt(fin), finISO: iso(fin),
      placa: texto(g('vehiculo')),
      contrato: ref,
      valorProtect: forma === 'FINANCIADO' ? valor * (plazo || 1) : valor,
      valorCuota: forma === 'FINANCIADO' ? valor : 0,
      plazo: forma === 'FINANCIADO' ? plazo : 0,
      forma: forma,
      celular: texto(g('celular')), correo: texto(g('correo')), direccion: texto(g('direccion')),
      estado: texto(g('estado')).toUpperCase(),
      fila: FILA_ENCABEZADOS + 1 + i
    };
    lista.push(reg); mapa[ref] = reg;
  }
  return { lista: lista, mapa: mapa, idx: idx };
}

function leerGestiones(hoja) {
  if (!hoja) return [];
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var d = hoja.getRange(2, 1, n - 1, 6).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var ref = texto(d[i][1]);
    if (!ref) continue;
    out.push({ fechaGestion: fmt(aFecha(d[i][0])), fechaGestionISO: iso(aFecha(d[i][0])), contrato: ref, cedula: texto(d[i][2]), cliente: texto(d[i][3]),
      accion: texto(d[i][4]), registradoPor: texto(d[i][5]) });
  }
  return out;
}

// ==================== GESTIÓN DE COBRO ====================
function accionRegistrarGestion(p) {
  var ref = texto(p.contrato);
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS();
    var hoja = ss.getSheetByName(HOJA_GESTIONES);
    if (!hoja) { hoja = ss.insertSheet(HOJA_GESTIONES); hoja.appendRow(ENCABEZADOS_GESTIONES); hoja.getRange(1, 1, 1, ENCABEZADOS_GESTIONES.length).setFontWeight('bold'); }
    hoja.appendRow([new Date(), ref, texto(p.cedula), texto(p.cliente), texto(p.accion) || 'Cobro realizado', texto(p.registradoPor)]);
    return { ok: true, mensaje: 'Gestión registrada correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar la gestión: ' + err.message };
  } finally { lock.releaseLock(); }
}


// ==================== AGREGAR UNA FILA NUEVA DESDE EL CRM ====================
// Escribe al final de la hoja, copia el formato de la última fila y, si una columna tiene fórmula en la fila anterior
// (por ejemplo el consecutivo o un total), copia esa fórmula en la fila nueva.
function ultimaFilaConDatos(hoja, col0) {
  var n = hoja.getLastRow();
  if (n <= FILA_ENCABEZADOS) return FILA_ENCABEZADOS;
  var v = hoja.getRange(FILA_ENCABEZADOS + 1, col0 + 1, n - FILA_ENCABEZADOS, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (texto(v[i][0]) !== '') return FILA_ENCABEZADOS + 1 + i;
  return FILA_ENCABEZADOS;
}
function mismaFecha(a, b) { return a && b && iso(a) === iso(b); }
function sumarAnio(d) { return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()); }
function aNumeroSiPuede(v) { var t = texto(v).replace(/[^0-9]/g, ''); return t && t.length <= 15 ? Number(t) : texto(v); }

function accionAgregar(p) {
  var d;
  try { d = JSON.parse(p.fila || '{}'); } catch (e) { return { ok: false, error: 'No se pudieron leer los datos del formulario.' }; }
  var cliente = texto(d.cliente), ced = texto(d.cedula), veh = texto(d.vehiculo), ini = aFecha(d.inicio), valor = numero(d.valor);
  if (!cliente) return { ok: false, error: 'Falta el nombre del cliente.' };
  if (!ced) return { ok: false, error: 'Falta la cédula.' };
  if (!veh) return { ok: false, error: 'Falta el vehículo.' };
  if (!ini) return { ok: false, error: 'Falta la fecha de inicio.' };
  if (!valor) return { ok: false, error: 'Falta el valor a pagar.' };
  var fin = aFecha(d.fin) || sumarAnio(ini), compra = /financ/i.test(texto(d.compra)) ? 'FINANCIADO' : 'Contado', estadoTxt = texto(d.estado) || 'Activo';
  estadoTxt = estadoTxt.charAt(0).toUpperCase() + estadoTxt.slice(1).toLowerCase();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = hojaClientes(abrirSS());
    var ncol = hoja.getLastColumn(), enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ncol).getDisplayValues()[0], idx = indicesColumnas(enc);
    var ult = ultimaFilaConDatos(hoja, idx.cliente);
    if (!d.forzar && ult > FILA_ENCABEZADOS) {
      var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ult - FILA_ENCABEZADOS, ncol).getValues(), kc = String(ced).replace(/\D/g, ''), kv = normalizar(veh);
      for (var i = 0; i < datos.length; i++) {
        if (String(datos[i][idx.cedula]).replace(/\D/g, '') === kc && normalizar(datos[i][idx.vehiculo]) === kv && mismaFecha(aFecha(datos[i][idx.inicio]), ini))
          return { ok: false, duplicado: true, error: 'Ya hay un cliente con esa cédula, ese vehículo y esa fecha de inicio (fila ' + (FILA_ENCABEZADOS + 1 + i) + ').' };
      }
    }
    var nueva = ult + 1;
    if (ult > FILA_ENCABEZADOS) hoja.getRange(ult, 1, 1, ncol).copyTo(hoja.getRange(nueva, 1, 1, ncol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    var val = { cliente: cliente, cedula: aNumeroSiPuede(ced), vehiculo: veh, valor: valor, celular: aNumeroSiPuede(d.celular), forma: compra, inicio: ini, fin: fin, estado: estadoTxt, asesor: texto(d.asesor), aseguradora: texto(d.aseguradora) };
    var asignada = {}, omitidos = [];
    ['cliente', 'cedula', 'vehiculo', 'valor', 'celular', 'forma', 'inicio', 'fin', 'estado', 'asesor', 'aseguradora'].forEach(function (k) {
      var col = idx[k]; if (col === undefined || col < 0) return;
      var v = val[k]; if (v === undefined || v === '' || v === null) return;
      if (!coincideNombre(enc, [k])) { omitidos.push(k); return; }   // no se escribe en una columna que no se reconoce por su título
      hoja.getRange(nueva, col + 1).setValue(v); asignada[col] = true;
    });
    if (ult > FILA_ENCABEZADOS) for (var j = 0; j < ncol; j++) {
      if (asignada[j]) continue;
      var f = hoja.getRange(ult, j + 1).getFormulaR1C1();
      if (f) hoja.getRange(nueva, j + 1).setFormulaR1C1(f);
    }
    SpreadsheetApp.flush();
    return { ok: true, mensaje: 'Cliente guardado en la hoja (fila ' + nueva + ').', fila: nueva, omitidos: omitidos };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar: ' + err.message };
  } finally { lock.releaseLock(); }
}

// ==================== ESTADO ====================
function accionCambiarEstado(p) {
  var ref = texto(p.contrato), nuevo = texto(p.nuevoEstado).toUpperCase();
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (['ACTIVO', 'CANCELADO', 'FINALIZADO'].indexOf(nuevo) === -1) return { ok: false, error: 'Estado inválido: ' + nuevo };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = hojaClientes(abrirSS()), info = leerClientes(hoja), c = info.mapa[ref];
    if (!c) return { ok: false, error: 'No se encontró el cliente ' + ref };
    escribirEstado(hoja, info.idx, c.fila, nuevo);
    return { ok: true, mensaje: 'Estado actualizado a ' + nuevo + '.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo cambiar el estado: ' + err.message };
  } finally { lock.releaseLock(); }
}

function escribirEstado(hoja, idx, fila, estado) {
  var col = idx.estado >= 0 ? idx.estado + 1 : 9;
  hoja.getRange(fila, col).setValue(estado.charAt(0) + estado.slice(1).toLowerCase());   // Activo / Cancelado / Finalizado, como lo escribes en la hoja
}

// ==================== UTILIDADES ====================
function hojaClientes(ss) {
  var h = ss.getSheetByName(HOJA_CLIENTES);
  if (h) return h;
  var clave = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); }, hojas = ss.getSheets(), i;
  for (i = 0; i < hojas.length; i++) if (clave(hojas[i].getName()) === clave(HOJA_CLIENTES)) return hojas[i];
  for (i = 0; i < hojas.length; i++) {
    if (hojas[i].getName() === HOJA_GESTIONES || hojas[i].getLastColumn() < 3) continue;
    var enc = hojas[i].getRange(FILA_ENCABEZADOS, 1, 1, hojas[i].getLastColumn()).getDisplayValues()[0].map(normalizar);
    if (enc.indexOf('cedula') >= 0 && (enc.indexOf('fecha fin') >= 0 || enc.indexOf('fecha final') >= 0)) return hojas[i];
  }
  return hojas[0];
}

function normalizar(t) { return String(t === null || t === undefined ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

function coincideNombre(enc, claves) {
  var norm = enc.map(normalizar), todos = COLS.concat(COLS_OPC).filter(function (c) { return claves.indexOf(c.clave) >= 0; })[0];
  if (!todos) return false;
  for (var n = 0; n < todos.nombres.length; n++) { var b = normalizar(todos.nombres[n]); for (var i = 0; i < norm.length; i++) if (norm[i] === b) return true; }
  return false;
}

function indicesColumnas(enc) {
  var norm = enc.map(normalizar), idx = {};
  var buscar = function (c, porDefecto) {
    for (var n = 0; n < c.nombres.length; n++) { var b = normalizar(c.nombres[n]); for (var i = 0; i < norm.length; i++) if (norm[i] === b) return i; }
    for (var n2 = 0; n2 < c.nombres.length; n2++) { var b2 = normalizar(c.nombres[n2]); if (b2.length < 5) continue; for (var j = 0; j < norm.length; j++) if (norm[j].indexOf(b2) === 0) return j; }   // «Aseguradora SOAT», «Asesor comercial»…
    return porDefecto;
  };
  COLS.forEach(function (c) { idx[c.clave] = buscar(c, c.pos - 1); });
  COLS_OPC.forEach(function (c) { idx[c.clave] = buscar(c, -1); });
  return idx;
}

function normalizarForma(v) { var t = normalizar(v); return /financ|credito|cuota/.test(t) ? 'FINANCIADO' : (/contado/.test(t) ? 'CONTADO' : texto(v).toUpperCase()); }
function plazoPorFechas(ini, fin) { if (!ini || !fin) return PLAZO_POR_DEFECTO; var m = (fin.getFullYear() - ini.getFullYear()) * 12 + (fin.getMonth() - ini.getMonth()); return m >= 1 && m <= 60 ? m : PLAZO_POR_DEFECTO; }
// Un valor como 865.765 (con punto de miles que Sheets leyó como decimal) se corrige a 865765
function moneda(v) {
  var n = numero(v);
  if (typeof v === 'number' && n > 0 && n < 5000 && n !== Math.round(n) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6) return Math.round(n * 1000);
  return n;
}
function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function numero(v) {
  if (typeof v === 'number') return v;
  var t = texto(v).replace(/[^0-9,.-]/g, '');
  if (!t) return 0;
  if (t.indexOf(',') > -1 && t.indexOf('.') > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t) || /^-?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  else t = t.replace(',', '.');
  var n = parseFloat(t); return isNaN(n) ? 0 : n;
}
function aFecha(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var t = texto(v), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) { var a = +m[3]; if (a < 100) a += 2000; var dd = +m[1], mm = +m[2]; if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; } var d = new Date(a, mm - 1, dd); return isNaN(d.getTime()) ? null : d; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function fmt(d) { return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function iso(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : ''; }
function parsearFecha(t) { return aFecha(t) || (function () { var f = new Date(t); return isNaN(f.getTime()) ? null : f; })(); }
function fechaParaNombre(t) { var f = parsearFecha(t); return f ? ('0' + f.getDate()).slice(-2) + '-' + ('0' + (f.getMonth() + 1)).slice(-2) + '-' + f.getFullYear() : ''; }


// ==================== PAGOS Y COMPROBANTES ====================
function leerPagos(hoja) {
  if (!hoja || hoja.getLastRow() < 2) return [];
  var d = hoja.getRange(2, 1, hoja.getLastRow() - 1, 10).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var ref = texto(d[i][1]);
    if (!ref) continue;
    out.push({ fechaPago: fmt(aFecha(d[i][0])), fechaPagoISO: iso(aFecha(d[i][0])), contrato: ref, cedula: texto(d[i][2]), cliente: texto(d[i][3]),
      concepto: texto(d[i][4]), valorPagado: Number(d[i][5]) || 0, nota: texto(d[i][6]), registradoPor: texto(d[i][7]), comprobante: texto(d[i][8]), carpeta: texto(d[i][9]) });
  }
  return out;
}

function accionRegistrarPago(p) {
  var ref = texto(p.contrato), valor = Number(p.valor) || 0;
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (valor <= 0) return { ok: false, error: 'El valor pagado debe ser mayor a 0.' };
  var fecha = parsearFecha(texto(p.fecha)) || new Date();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS(), hoja = ss.getSheetByName(HOJA_PAGOS);
    if (!hoja) { hoja = ss.insertSheet(HOJA_PAGOS); hoja.getRange(1, 1, 1, ENCABEZADOS_PAGOS.length).setValues([ENCABEZADOS_PAGOS]).setFontWeight('bold'); hoja.setFrozenRows(1); }
    if (!texto(hoja.getRange(1, 10).getValue())) hoja.getRange(1, 10).setValue('Carpeta').setFontWeight('bold');
    hoja.appendRow([fecha, ref, texto(p.cedula), texto(p.cliente), texto(p.concepto), valor, texto(p.nota), texto(p.registradoPor), texto(p.comprobante), texto(p.carpeta)]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar el pago: ' + err.message };
  } finally { lock.releaseLock(); }
}

function accionSubirComprobante(b) {
  var ref = texto(b.contrato), ced = texto(b.cedula), cliente = texto(b.cliente), concepto = texto(b.concepto);
  var nombreArchivo = texto(b.nombreArchivo) || 'comprobante', tipo = texto(b.tipoMime) || 'image/jpeg';
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (!b.datosBase64) return { ok: false, error: 'No se recibió ningún archivo.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ext = (nombreArchivo.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    var partes = []; if (concepto) partes.push(concepto); var f = fechaParaNombre(texto(b.fecha)); if (f) partes.push(f);
    var nombre = (partes.length ? partes.join(' - ') : 'comprobante') + ext;
    var blob = Utilities.newBlob(Utilities.base64Decode(b.datosBase64), tipo, nombre);
    var carp = carpetaCliente(ced || ref, cliente), archivo = carp.createFile(blob), ruta = '';
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { var pad = carp.getParents(); ruta = (pad.hasNext() ? pad.next().getName() + ' / ' : '') + carp.getName() + ' / ' + archivo.getName(); } catch (e2) { ruta = carp.getName() + ' / ' + archivo.getName(); }
    return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view', carpetaUrl: carp.getUrl(), ruta: ruta };
  } catch (err) {
    return { ok: false, error: 'No se pudo subir el comprobante: ' + err.message };
  } finally { lock.releaseLock(); }
}

function carpetaBase() {
  if (CARPETA_DESTINO_ID) return DriveApp.getFolderById(CARPETA_DESTINO_ID);
  try {
    var padres = DriveApp.getFileById(abrirSS().getId()).getParents();
    if (padres.hasNext()) return padres.next();           // la carpeta donde está la hoja (SURA)
  } catch (e) {}
  var raiz = DriveApp.getFoldersByName(CARPETA_COMPROBANTES);
  return raiz.hasNext() ? raiz.next() : DriveApp.createFolder(CARPETA_COMPROBANTES);
}

function carpetaCliente(clave, nombre) {
  var base = carpetaBase(), nom = String(clave).replace(/[\\\/:*?"<>|]/g, ' ').trim();
  var existentes = base.getFoldersByName(nom);
  if (existentes.hasNext()) return existentes.next();     // la carpeta de la cédula que ya tiene
  return base.createFolder(nom);
}

// Ejecútela UNA vez desde el editor (▶) para aceptar los permisos de Drive y Sheets que necesitan los comprobantes.
function autorizarPermisos() {
  abrirSS();
  DriveApp.getRootFolder();
  LockService.getScriptLock();
  return 'Permisos listos';
}

  return { doGet:doGet, doPost:doPost, autorizarPermisos:autorizarPermisos };
})();

// ========================================================================
// MÓDULO: PM_SOAT  (origen: conectores/soat/Codigo_soat.gs)
// ========================================================================
var PM_SOAT = (function () {
/**
 * PROTECT MOTOS — Conector de SOAT
 *
 * Proyecto de Apps Script NUEVO e independiente (no toca Cobros, Conciliación, Contratos ni el CRM).
 * Lee la hoja "Soat" del mismo Google Sheet y guarda las gestiones de renovación en una hoja propia
 * llamada "Gestiones_Soat" (la crea sola la primera vez). No modifica la hoja "Soat".
 *
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-SOAT-2026';   // si lo cambias, cámbialo igual en el módulo SOAT del CRM
var SHEET_ID = '';                 // ID del Google Sheet «Historico Soat» (lo que está en su URL entre /d/ y /edit). Vacío = se busca por nombre en tu Drive.
var SHEET_NOMBRE = 'Historico Soat'; // nombre exacto del Google Sheet de SOAT
var HOJA_SOAT = 'Soat';
var HOJA_GESTIONES = 'Gestiones_Soat';
var FILA_ENCABEZADOS = 1;     // fila donde están los títulos de la hoja Soat

// Columnas por defecto (A..N) por si los títulos cambian. Se buscan primero por el nombre del título.
var COLS = [
  { clave: 'fecha',       pos: 1,  nombres: ['fecha', 'fecha venta', 'fecha de venta'] },
  { clave: 'num',         pos: 2,  nombres: ['#', 'n', 'no', 'numero'] },
  { clave: 'cliente',     pos: 3,  nombres: ['cliente', 'nombre', 'nombre del cliente'] },
  { clave: 'cedula',      pos: 4,  nombres: ['cedula', 'documento', 'cc'] },
  { clave: 'placa',       pos: 5,  nombres: ['placa'] },
  { clave: 'tipo',        pos: 6,  nombres: ['tipo vehiculo', 'tipo de vehiculo', 'tipo'] },
  { clave: 'cilindraje',  pos: 7,  nombres: ['cilindraje'] },
  { clave: 'inicio',      pos: 8,  nombres: ['fecha inicio', 'fecha inicial', 'inicio'] },
  { clave: 'vence',       pos: 9,  nombres: ['fecha vencimiento', 'fecha venc', 'vencimiento', 'fecha vence', 'vence'] },
  { clave: 'valor',       pos: 10, nombres: ['valor soat', 'valor'] },
  { clave: 'ganancia',    pos: 11, nombres: ['ganancia'] },
  { clave: 'total',       pos: 12, nombres: ['total consignado', 'total a consignar', 'total'] },
  { clave: 'forma',       pos: 13, nombres: ['forma de pago', 'forma pago', 'pago'] },
  { clave: 'celular',     pos: 14, nombres: ['celular', 'telefono', 'cel', 'whatsapp'] }
];

var ENCABEZADOS_GESTIONES = ['Fecha de gestión', 'Clave SOAT', 'Cédula', 'Cliente', 'Placa', 'Acción', 'Registrado por'];

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var salida;
  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') salida = accionDatos();
      else if (accion === 'registrarGestion') salida = accionRegistrarGestion(params);
      else if (accion === 'agregar') salida = accionAgregar(params);
      else if (accion === 'ping') salida = { ok: true, mensaje: 'Conector de SOAT activo', version: 'soat-2' };
      else salida = { ok: false, error: 'Acción no disponible: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Abre el Google Sheet de SOAT: por su ID (SHEET_ID) o, si está vacío, buscándolo por nombre en tu Drive.
function abrirSS() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  var archivos = DriveApp.getFilesByName(SHEET_NOMBRE), mejor = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    if (!mejor || f.getLastUpdated() > mejor.getLastUpdated()) mejor = f;
  }
  if (!mejor) throw new Error('No encontré el Google Sheet "' + SHEET_NOMBRE + '". Pega su ID en SHEET_ID (está en la URL del Sheet, entre /d/ y /edit).');
  return SpreadsheetApp.openById(mejor.getId());
}

// ==================== DATOS ====================
function accionDatos() {
  var ss = abrirSS();
  var hoja = buscarHoja(ss, HOJA_SOAT);
  if (!hoja) throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '". Revisa que se llame exactamente así.');
  return { ok: true, soat: leerSoat(hoja), gestiones: leerGestiones(ss.getSheetByName(HOJA_GESTIONES)) };
}

function leerSoat(hoja) {
  var ultimaFila = hoja.getLastRow(), ultimaCol = hoja.getLastColumn();
  if (ultimaFila <= FILA_ENCABEZADOS || ultimaCol < 1) return [];
  var encabezados = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ultimaCol).getDisplayValues()[0];
  var idx = {};
  COLS.forEach(function (c) { idx[c.clave] = posicionColumna(encabezados, c); });
  var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ultimaFila - FILA_ENCABEZADOS, ultimaCol).getValues();
  var out = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var get = function (k) { return idx[k] >= 0 ? f[idx[k]] : ''; };
    var placa = limpiarPlaca(get('placa')), cliente = texto(get('cliente'));
    if (!placa && !cliente) continue;
    var vence = aFecha(get('vence')), inicio = aFecha(get('inicio'));
    out.push({
      fila: FILA_ENCABEZADOS + 1 + i,
      fecha: fmt(aFecha(get('fecha'))), fechaISO: iso(aFecha(get('fecha'))),
      num: texto(get('num')),
      cliente: cliente, cedula: texto(get('cedula')), placa: placa,
      tipo: texto(get('tipo')).toUpperCase(), cilindraje: texto(get('cilindraje')),
      inicio: fmt(inicio), inicioISO: iso(inicio),
      vence: fmt(vence), venceISO: iso(vence),
      valor: numero(get('valor')), ganancia: numero(get('ganancia')), total: numero(get('total')),
      forma: texto(get('forma')), celular: texto(get('celular'))
    });
  }
  return out;
}

function leerGestiones(hoja) {
  if (!hoja) return [];
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var d = hoja.getRange(2, 1, n - 1, 7).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var clave = texto(d[i][1]);
    if (!clave) continue;
    out.push({ fecha: fmt(aFecha(d[i][0])), fechaISO: iso(aFecha(d[i][0])), clave: clave, cedula: texto(d[i][2]),
      cliente: texto(d[i][3]), placa: texto(d[i][4]), accion: texto(d[i][5]), registradoPor: texto(d[i][6]) });
  }
  return out;
}

// ==================== REGISTRAR GESTIÓN ====================
// Guarda en "Gestiones_Soat" que se le escribió al cliente, que renovó o que no renovará.
function accionRegistrarGestion(p) {
  var clave = texto(p.clave);
  if (!clave) return { ok: false, error: 'Falta la clave del SOAT.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS();
    var hoja = ss.getSheetByName(HOJA_GESTIONES);
    if (!hoja) {
      hoja = ss.insertSheet(HOJA_GESTIONES);
      hoja.appendRow(ENCABEZADOS_GESTIONES);
      hoja.getRange(1, 1, 1, ENCABEZADOS_GESTIONES.length).setFontWeight('bold');
    }
    hoja.appendRow([new Date(), clave, texto(p.cedula), texto(p.cliente), texto(p.placa), texto(p.accion) || 'Mensaje de renovación enviado', texto(p.registradoPor)]);
    return { ok: true, mensaje: 'Gestión registrada.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}


// ==================== AGREGAR UNA FILA NUEVA DESDE EL CRM ====================
// Escribe al final de la hoja, copia el formato de la última fila y, si una columna tiene fórmula en la fila anterior
// (por ejemplo el consecutivo o un total), copia esa fórmula en la fila nueva.
function ultimaFilaConDatos(hoja, col0) {
  var n = hoja.getLastRow();
  if (n <= FILA_ENCABEZADOS) return FILA_ENCABEZADOS;
  var v = hoja.getRange(FILA_ENCABEZADOS + 1, col0 + 1, n - FILA_ENCABEZADOS, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (texto(v[i][0]) !== '') return FILA_ENCABEZADOS + 1 + i;
  return FILA_ENCABEZADOS;
}
function mismaFecha(a, b) { return a && b && iso(a) === iso(b); }
function sumarAnio(d) { return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()); }
function aNumeroSiPuede(v) { var t = texto(v).replace(/[^0-9]/g, ''); return t && t.length <= 15 ? Number(t) : texto(v); }

function accionAgregar(p) {
  var d;
  try { d = JSON.parse(p.fila || '{}'); } catch (e) { return { ok: false, error: 'No se pudieron leer los datos del formulario.' }; }
  var cliente = texto(d.cliente), placa = limpiarPlaca(d.placa), ini = aFecha(d.inicio), venta = aFecha(d.fecha) || new Date(), valor = numero(d.valor);
  if (!cliente) return { ok: false, error: 'Falta el nombre del cliente.' };
  if (!placa) return { ok: false, error: 'Falta la placa.' };
  if (!ini) return { ok: false, error: 'Falta la fecha de inicio.' };
  var ven = aFecha(d.vence) || sumarAnio(ini);
  if (!valor) return { ok: false, error: 'Falta el valor del SOAT.' };
  var ganancia = numero(d.ganancia), total = d.total !== undefined && d.total !== '' ? numero(d.total) : valor + ganancia;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = buscarHoja(abrirSS(), HOJA_SOAT);
    if (!hoja) throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '".');
    var ncol = hoja.getLastColumn(), enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ncol).getDisplayValues()[0], idx = {};
    COLS.forEach(function (c) { idx[c.clave] = posicionColumna(enc, c); });
    var ult = ultimaFilaConDatos(hoja, idx.placa >= 0 ? idx.placa : idx.cliente);
    if (!d.forzar && ult > FILA_ENCABEZADOS) {
      var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ult - FILA_ENCABEZADOS, ncol).getValues();
      for (var i = 0; i < datos.length; i++) {
        if (limpiarPlaca(datos[i][idx.placa]) === placa && mismaFecha(aFecha(datos[i][idx.inicio]), ini))
          return { ok: false, duplicado: true, error: 'Ya hay un SOAT de la placa ' + placa + ' con esa fecha de inicio (fila ' + (FILA_ENCABEZADOS + 1 + i) + ').' };
      }
    }
    var nueva = ult + 1;
    if (ult > FILA_ENCABEZADOS) hoja.getRange(ult, 1, 1, ncol).copyTo(hoja.getRange(nueva, 1, 1, ncol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    var val = { fecha: venta, cliente: cliente, cedula: aNumeroSiPuede(d.cedula), placa: placa, tipo: texto(d.tipo).toUpperCase(), cilindraje: numero(d.cilindraje) || texto(d.cilindraje),
      inicio: ini, vence: ven, valor: valor, ganancia: ganancia, total: total, forma: texto(d.forma), celular: aNumeroSiPuede(d.celular) };
    var asignada = {}, omitidos = [];
    COLS.forEach(function (c) {
      var col = idx[c.clave]; if (col < 0 || c.clave === 'num') return;
      var v = val[c.clave]; if (v === undefined || v === '' || v === null) return;
      if (!coincideNombre(enc, c)) { omitidos.push(c.nombres[0]); return; }   // no se escribe en una columna que no se reconoce por su título
      hoja.getRange(nueva, col + 1).setValue(v); asignada[col] = true;
    });
    // consecutivo (#): si la fila anterior tiene fórmula se copia; si no, máximo + 1
    if (idx.num >= 0) {
      var fnum = ult > FILA_ENCABEZADOS ? hoja.getRange(ult, idx.num + 1).getFormulaR1C1() : '';
      if (fnum) hoja.getRange(nueva, idx.num + 1).setFormulaR1C1(fnum);
      else { var nums = ult > FILA_ENCABEZADOS ? hoja.getRange(FILA_ENCABEZADOS + 1, idx.num + 1, ult - FILA_ENCABEZADOS, 1).getValues() : [], mx = 0; nums.forEach(function (r) { var n = Number(r[0]); if (n > mx) mx = n; }); hoja.getRange(nueva, idx.num + 1).setValue(mx + 1); }
      asignada[idx.num] = true;
    }
    // el resto de columnas: si la fila anterior tenía una fórmula, se copia
    if (ult > FILA_ENCABEZADOS) for (var j = 0; j < ncol; j++) {
      if (asignada[j]) continue;
      var f = hoja.getRange(ult, j + 1).getFormulaR1C1();
      if (f) hoja.getRange(nueva, j + 1).setFormulaR1C1(f);
    }
    SpreadsheetApp.flush();
    return { ok: true, mensaje: 'SOAT guardado en la hoja (fila ' + nueva + ').', fila: nueva, omitidos: omitidos };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar: ' + err.message };
  } finally { lock.releaseLock(); }
}

// ==================== UTILIDADES ====================
function buscarHoja(ss, nombre) {
  var exacta = ss.getSheetByName(nombre);
  if (exacta) return exacta;
  var clave = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) if (clave(hojas[i].getName()) === clave(nombre)) return hojas[i];
  return null;
}

function normalizar(t) {
  return String(t === null || t === undefined ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim();
}

// ¿El título de alguna columna coincide con el nombre esperado? (sin usar la posición por defecto)
function coincideNombre(encabezados, col) {
  var norm = encabezados.map(normalizar);
  for (var n = 0; n < col.nombres.length; n++) {
    var b = normalizar(col.nombres[n]);
    for (var i = 0; i < norm.length; i++) if (norm[i] === b || (b.length >= 4 && norm[i].indexOf(b) === 0)) return true;
  }
  return false;
}

function posicionColumna(encabezados, col) {
  var norm = encabezados.map(normalizar);
  for (var n = 0; n < col.nombres.length; n++) {
    var buscado = normalizar(col.nombres[n]);
    for (var i = 0; i < norm.length; i++) if (norm[i] === buscado) return i;
  }
  for (var n2 = 0; n2 < col.nombres.length; n2++) {
    var b = normalizar(col.nombres[n2]);
    if (b.length < 4) continue;
    for (var j = 0; j < norm.length; j++) if (norm[j].indexOf(b) === 0) return j;
  }
  return col.pos - 1;
}

function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function limpiarPlaca(v) { return texto(v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function numero(v) {
  if (typeof v === 'number') return v;
  var t = texto(v).replace(/[^0-9,.-]/g, '');
  if (!t) return 0;
  if (t.indexOf(',') > -1 && t.indexOf('.') > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(',', '.');
  var n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

// Acepta fechas de Google Sheets o textos dd/mm/aaaa (formato Colombia)
function aFecha(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var t = texto(v), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    var a = +m[3]; if (a < 100) a += 2000;
    var dd = +m[1], mm = +m[2];
    if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; }   // texto tipo 9-18-2027 (mes-día-año)
    var d = new Date(a, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function fmt(d) { return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function iso(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : ''; }

  return { doGet:doGet };
})();

// ========================================================================
// MÓDULO: PM_Contratos  (origen: conectores/contratos/Codigo_conector.gs)
// ========================================================================
var PM_Contratos = (function () {
/**
 * PROTECT MOTOS · Conector (v9 — anti-duplicados + Fasecolda + número del precobro)
 * ------------------------------------------------------------------
 * Archivo: "Seguimiento Protec Motos 2026 ACTUAL"
 * Pestaña principal de clientes: "Protect"  (títulos fila 2, datos desde fila 3)
 *
 * v7:  no duplica contratos (busca por N° de contrato) + LockService.
 * v8:  base de datos propia de códigos Fasecolda, en la pestaña "Codigos Fasecolda".
 *      - action=fase_list  -> devuelve todos los códigos guardados.
 *      - action=fase_save  -> guarda / actualiza un código (marca, línea, cilindraje, modelo, tipo).
 *      (Lo demás queda EXACTAMENTE igual; no se tocan los guardados de contratos, RC ni AP.)
 *
 * v9:  action=poner_numero -> pone el número del PRECOBRO (que solo usted sabe) al frente de cada cliente en la hoja de
 *      Accidentes Personales (columna A) o de Responsabilidad Civil (columna B), buscando por cédula. No borra nada ni
 *      crea filas: solo escribe en celdas vacías (o reemplaza si usted lo confirma).
 *
 * Corre  diagnostico()  una vez para verificar.
 */

var TOKEN     = 'PM-9K3ZQ-2026';
var SHEET_ID  = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';   // "Seguimiento Protec Motos 2026 ACTUAL"
var NOMBRE_PESTANA = 'Protect';
var GID       = null;
var SHEET2_ID = '1x8yZENs-5gGhT64CPStTuBa_YHQtCM89W5o7t0hSNB8';  // Responsabilidad Civil
var SHEET3_ID = '1RopIZryAegrNvSdLQK5KdLjDA_sqvme4SMG11g8b4ck';  // Accidentes Personales
var HOJA_FASECOLDA = 'Codigos Fasecolda';                        // base de datos propia de Fasecolda

function doGet(e) {
  var cb = (e && e.parameter) ? e.parameter.callback : null;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);                                  // seguro anti-encimado
    var accion = (e && e.parameter) ? (e.parameter.action || '') : '';

    // ===== BASE DE FASECOLDA =====
    if (accion === 'fase_list') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, { ok:true, rows: faseList_() });
    }
    if (accion === 'fase_save') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, faseSave_(e.parameter));
    }

    // ===== NÚMERO DEL PRECOBRO EN LAS HOJAS DE AP / RC =====
    if (accion === 'poner_numero') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, ponerNumero_(e.parameter));
    }

    // ===== GUARDAR CONTRATO (igual que v7) =====
    if (accion === 'save') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });

      var sh  = getSheet_();
      var row = JSON.parse(e.parameter.row);
      var contrato = String(row[13] || '').trim();         // col N (#CONTRATO) = índice 13

      // --- ANTI-DUPLICADO: si el contrato ya está, no lo vuelve a pegar ---
      var yaFila = contrato ? buscarContrato_(sh, contrato) : 0;
      if (yaFila > 0) {
        return out_(cb, { ok:true, fila:yaFila, duplicado:true });
      }

      // 1) Protect (siempre)
      var fila = lastRowByCol_(sh, 14) + 1;
      sh.getRange(fila, 1, 1, row.length).setValues([row]);
      var res = { ok:true, fila:fila };

      // 2) Responsabilidad Civil (solo CON RC)
      if (e.parameter.rc === 'SI' && e.parameter.rcRow) {
        try {
          var rc  = JSON.parse(e.parameter.rcRow);
          var sh2 = SpreadsheetApp.openById(SHEET2_ID).getSheets()[0];
          var f2  = lastRowByCol_(sh2, 5) + 1;             // col E = Nombre completo
          sh2.getRange(f2, 1, 1, rc.length).setValues([rc]);
          res.fila2 = f2;
        } catch (e2) { res.rcError = String(e2); }
      }

      // 3) Accidentes Personales (solo si lleva AP)
      if (e.parameter.ap === 'SI' && e.parameter.apRow) {
        try {
          var ap  = JSON.parse(e.parameter.apRow);
          var sh3 = SpreadsheetApp.openById(SHEET3_ID).getSheets()[0];
          var f3  = lastRowByCol_(sh3, 10) + 1;            // col J = N° Documento
          sh3.getRange(f3, 1, 1, ap.length).setValues([ap]);
          res.fila3 = f3;
        } catch (e3) { res.apError = String(e3); }
      }

      SpreadsheetApp.flush();
      return out_(cb, res);
    }

    return ContentService.createTextOutput('Conector Protect Motos activo ✔');
  } catch (err) {
    return out_(cb, { ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ============ NÚMERO DEL PRECOBRO ============ */
// AP (Accidentes Personales): cédula en la columna J, número en la columna A.
// RC (Responsabilidad Civil): cédula en la columna G, número en la columna B.
// Si una cédula está en varias filas, se usa la ÚLTIMA (la más reciente).
function ponerNumero_(p) {
  var tipo = String(p.tipo || '').toUpperCase();
  if (tipo !== 'AP' && tipo !== 'RC') return { ok:false, error:'Tipo no válido: debe ser AP o RC.' };
  var numero = String(p.numero || '').trim();
  if (!numero) return { ok:false, error:'Falta el número.' };
  var ceds; try { ceds = JSON.parse(p.ceds || '[]'); } catch (x) { return { ok:false, error:'La lista de cédulas no es válida.' }; }
  var escribir = p.modo === 'escribir', reemplazar = p.reemplazar === '1', aut = {};
  try { (JSON.parse(p.autorizar || '[]')).forEach(function (c) { aut[String(c).replace(/\D/g, '').replace(/^0+/, '')] = true; }); } catch (xa) {}
  var cfg = tipo === 'AP' ? { id: SHEET3_ID, colCed: 10, colNum: 1, nombre: 'Accidentes Personales', colNom: 4, nNom: 3 } : { id: SHEET2_ID, colCed: 7, colNum: 2, nombre: 'Responsabilidad Civil', colNom: 5, nNom: 1 };
  var sh = SpreadsheetApp.openById(cfg.id).getSheets()[0], last = sh.getLastRow();
  var norm = function (v) { return String(v == null ? '' : v).replace(/\.0+$/, '').replace(/\D/g, '').replace(/^0+/, ''); };
  var out = { ok:true, tipo:tipo, hoja:cfg.nombre, columna: tipo === 'AP' ? 'A' : 'B', escribir:escribir, encontrados:0, escritos:0, yaTenian:0, conflictos:[], noEncontrados:[] };
  if (last < 2) { out.noEncontrados = ceds.slice(); return out; }
  var C = sh.getRange(1, cfg.colCed, last, 1).getValues(), N = sh.getRange(1, cfg.colNum, last, 1).getValues(), NM = sh.getRange(1, cfg.colNom, last, cfg.nNom).getValues(), idx = {}, r;
  for (r = 1; r < last; r++) { var k = norm(C[r][0]); if (k) idx[k] = r + 1; }
  var valor = /^\d{1,15}$/.test(numero) ? Number(numero) : numero, vistos = {};
  ceds.forEach(function (c) {
    var k = norm(c); if (!k || vistos[k]) return; vistos[k] = true;
    var fila = idx[k];
    if (!fila) { out.noEncontrados.push(k); return; }
    out.encontrados++;
    var actual = String(N[fila - 1][0] == null ? '' : N[fila - 1][0]).trim();
    if (actual === '') { if (escribir) { sh.getRange(fila, cfg.colNum).setValue(valor); out.escritos++; } else out.escritos++; }
    else if (actual === numero) out.yaTenian++;
    else {
      out.conflictos.push({ ced:k, fila:fila, actual:actual, nombre: NM[fila - 1].join(' ').replace(/\s+/g, ' ').trim() });
      if (escribir && (reemplazar || aut[k])) { sh.getRange(fila, cfg.colNum).setValue(valor); out.escritos++; out.reemplazados = (out.reemplazados || 0) + 1; }
    }
  });
  if (escribir) SpreadsheetApp.flush();
  return out;
}

function out_(cb, obj) {
  var j = JSON.stringify(obj);
  if (cb) return ContentService.createTextOutput(cb + '(' + j + ')')
                                .setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(j).setMimeType(ContentService.MimeType.JSON);
}

/* ============ BASE DE FASECOLDA ============ */
/* Pestaña "Codigos Fasecolda": fila 1 = encabezados; datos desde fila 2.
   Columnas: A Fasecolda · B Marca · C Línea · D Cilindraje · E Modelo · F Tipo */
function hojaFase_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(HOJA_FASECOLDA);
  if (!sh) {
    sh = ss.insertSheet(HOJA_FASECOLDA);
    sh.appendRow(['Fasecolda', 'Marca', 'Línea', 'Cilindraje', 'Modelo', 'Tipo']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  return sh;
}

function faseList_() {
  var sh = hojaFase_(); var last = sh.getLastRow(); if (last < 2) return [];
  var v = sh.getRange(2, 1, last - 1, 6).getValues(); var out = [];
  for (var r = 0; r < v.length; r++) {
    var f = String(v[r][0] || '').replace(/[^0-9]/g, '');
    if (!f) continue;
    out.push({
      fase: f,
      marca: String(v[r][1] || ''),
      linea: String(v[r][2] || ''),
      cil:   String(v[r][3] || ''),
      modelo:String(v[r][4] || ''),
      tipo:  String(v[r][5] || '')
    });
  }
  return out;
}

function faseBuscar_(sh, fase) {
  var last = sh.getLastRow(); if (last < 2) return 0;
  var v = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var r = 0; r < v.length; r++) {
    if (String(v[r][0] || '').replace(/[^0-9]/g, '') === fase) return r + 2;
  }
  return 0;
}

function faseSave_(p) {
  var fase = String(p.fase || '').replace(/[^0-9]/g, '');
  if (!fase) return { ok:false, error:'SIN_FASECOLDA' };
  var sh = hojaFase_();
  var row = [fase, p.marca || '', p.linea || '', p.cil || '', p.modelo || '', p.tipo || ''];
  var f = faseBuscar_(sh, fase);
  if (f > 0) { sh.getRange(f, 1, 1, 6).setValues([row]); SpreadsheetApp.flush(); return { ok:true, fila:f, actualizado:true }; }
  sh.appendRow(row); SpreadsheetApp.flush();
  return { ok:true, fila:sh.getLastRow(), nuevo:true };
}

/* ============ CONTRATOS (igual que v7) ============ */
/* Busca un N° de contrato en la columna N. Devuelve la fila si existe, o 0. */
function buscarContrato_(sh, contrato) {
  var last = sh.getLastRow(); if (last < 1) return 0;
  var vals = sh.getRange(1, 14, last, 1).getValues();      // col N = #CONTRATO
  for (var r = vals.length - 1; r >= 1; r--) if (String(vals[r][0]).trim() === contrato) return r + 1;
  return 0;
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var byName = ss.getSheetByName(NOMBRE_PESTANA);
  if (byName) return byName;
  var sheets = ss.getSheets();
  if (GID) for (var i = 0; i < sheets.length; i++) if (sheets[i].getSheetId() === GID) return sheets[i];
  for (var j = 0; j < sheets.length; j++) {
    var n = sheets[j].getName().toLowerCase();
    if (n.indexOf('protect') >= 0 || n.indexOf('seguim') >= 0) return sheets[j];
  }
  return sheets[0];
}

function lastRowByCol_(sh, col) {
  var vals = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var r = vals.length - 1; r >= 1; r--) if (String(vals[r][0]).trim() !== '') return r + 1;
  return 1;
}

function diagnostico() {
  var log = [];
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    log.push('Archivo: "' + ss.getName() + '"');
    ss.getSheets().forEach(function(s){ log.push('   - "' + s.getName() + '"  GID=' + s.getSheetId() + '  última fila: ' + s.getLastRow()); });
    var sh = getSheet_();
    log.push('>> Escribirá en: "' + sh.getName() + '"  |  próxima fila (col N): ' + (lastRowByCol_(sh, 14) + 1));
  } catch (e) { log.push('ERROR principal: ' + e); }
  try { SpreadsheetApp.openById(SHEET2_ID).getSheets()[0]; log.push('RC: OK'); } catch (e) { log.push('RC ERROR: ' + e); }
  try { SpreadsheetApp.openById(SHEET3_ID).getSheets()[0]; log.push('AP: OK'); } catch (e) { log.push('AP ERROR: ' + e); }
  try { var shf = hojaFase_(); log.push('Fasecolda: OK ("' + shf.getName() + '", ' + Math.max(0, shf.getLastRow()-1) + ' códigos)'); } catch (e) { log.push('Fasecolda ERROR: ' + e); }
  Logger.log(log.join('\n'));
}

  return { doGet:doGet, diagnostico:diagnostico };
})();

// ========================================================================
// MÓDULO: Conciliación (origen: conectores/conciliacion/PASO_1 + PASO_2; ya usa el prefijo CONC_)
// ========================================================================
/**
 * PROTECT MOTOS — Conciliación de pagos contra "Consolidados"
 *
 * Archivo INDEPENDIENTE: no modifica ni depende de Codigo_cobros.gs.
 * Todas las funciones y constantes llevan el prefijo CONC_ para no chocar con las existentes.
 * No crea triggers. Se ejecuta a mano: elegir CONC_conciliar y pulsar "Ejecutar".
 *
 * Solo LEE las hojas "Protect" y "Consolidado".
 * ÚNICA escritura en una hoja tuya: la columna F de "Consolidados" (estado de cada fila: "Consolidado",
 * "Pagó de menos", "Sin registro en Protect"...). Si la columna F ya tiene datos que no son de esta
 * automatización, NO la sobrescribe. Se desactiva con CONC_ESCRIBIR_ESTADO_CONS = false.
 * Además escribe en dos hojas propias (las crea si no existen):
 *   - "Conciliacion_Dugo": foto actual, se reescribe en cada corrida.
 *   - "Historial_Consolidacion": seguimiento permanente (desde cuándo está consolidado cada contrato, cuánto lleva pendiente).
 *
 * Regla: PROTECT es la base (un registro por contrato). Un contrato está CONSOLIDADO cuando la persona
 * (cédula) aparece en la hoja "Consolidados". No se mira ningún valor para decidirlo.
 * Para los consolidados, segunda pregunta: ¿pagó lo que era? Se compara Protect!P (valor pagado a Dugo Motos)
 * contra Consolidados C y D, cada una por separado (nunca se suman): "Pagó lo correcto", "Pagó de más" o "Pagó de menos".
 * Eso NO cambia el estado de consolidación; es una verificación aparte.
 */

// ==================== CONFIGURACIÓN ====================
var CONC_SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var CONC_HOJA_PROTECT = 'Protect';
var CONC_HOJA_CONSOLIDADOS = 'Consolidado';
var CONC_HOJA_RESULTADO = 'Conciliacion_Dugo';

var CONC_HOJA_HISTORIAL = 'Historial_Consolidacion';
var CONC_HOJA_ASIGNACIONES = 'Asignaciones_Pagos'; // a qué contrato pertenece cada pago, decidido a mano (varios contratos)
var CONC_HOJA_AJUSTES = 'Ajustes_Manuales'; // correcciones hechas a mano desde el HTML (se conservan entre corridas)
var CONC_DIAS_RECIENTE = 7; // ventana para "conciliados / nuevos / cambios de la semana"

// Estado de cada fila de Consolidados, escrito en esta columna (6 = F) con el título de la fila 2
var CONC_ESCRIBIR_ESTADO_CONS = true;
var CONC_COL_ESTADO_CONS = 6;
var CONC_TITULO_ESTADO_CONS = 'Estado de consolidación';
// Número de contrato de Protect (columna N) escrito al frente de cada pago, en esta columna (7 = G)
var CONC_ESCRIBIR_CONTRATO_CONS = true;
var CONC_COL_CONTRATO_CONS = 7;
var CONC_TITULO_CONTRATO_CONS = 'N° contrato (Protect)';
// Valor pagado a Dugo Motos (Protect columna P) del contrato al que se asignó cada pago, escrito en esta columna (8 = H)
var CONC_ESCRIBIR_VALOR_DUGO_CONS = true;
var CONC_COL_VALOR_DUGO_CONS = 8;
var CONC_TITULO_VALOR_DUGO_CONS = 'Valor pagado a Dugo Motos';
// Columna donde TÚ escribes el número de contrato de cada pago (9 = I). La automatización solo pone el título; nunca toca esas celdas.
var CONC_COL_CONTRATO_MANUAL = 9;
var CONC_TITULO_CONTRATO_MANUAL = 'Contrato manual (escribe aquí)';

// Estado de cada contrato escrito en la hoja Protect, al frente de cada fila (3 = columna C). Solo escribe si la columna está vacía o ya es de esta automatización.
var CONC_ESCRIBIR_ESTADO_PROTECT = true;
var CONC_COL_ESTADO_PROTECT = 3;
var CONC_TITULO_ESTADO_PROTECT = 'Estado de consolidación';

var CONC_TOLERANCIA = 1000; // diferencias de hasta $1.000 (redondeos) se ignoran: cuenta como "Pagó lo correcto"

// Protect: fila 1 = encabezados. Columnas (base 1): E, H, M, N, P
var CONC_PROTECT_FILA_INICIO = 2;   // por defecto; CONC_filaInicioProtect() lo corrige si los encabezados están más abajo (p. ej. fila 2 y datos desde la 3)
var CONC_P = { CEDULA: 5, CLIENTE: 8, PLACA: 13, CONTRATO: 14, PAGADO_DUGO: 16 };
// Columnas de Protect que solo se MUESTRAN como información del cliente (no intervienen en la conciliación)
var CONC_P_INFO = { ASESOR: 2, FECHA_FIRMA: 11, FIN: 12, CUOTA: 17, PLAZO: 18, FORMA: 20, CELULAR: 31, ESTADO_CLIENTE: 44 };

// Consolidados: fila 1 = fórmulas (se ignora), fila 2 = encabezados, datos desde la 3. A, B, C, D
var CONC_CONS_FILA_INICIO = 3;

var CONC_ESTADO = {
  CONCILIADO: 'Consolidado',
  POR_NOMBRE: 'Consolidado por nombre (revisar)',
  FALTA: 'Falta por consolidar',
  SIN_PROTECT: 'Sin registro en Protect',
  NO_APLICA: 'No aplica · Anulado',   // Protect columna AR = Anulado: el cliente no llevó la póliza, no hay que consolidar
  DIRECTO: 'Pagó directo a Protect'   // el cliente paga directo a la cuenta: no aparece en Consolidado, se marca a mano
};

// "Pagó de más" no es problema, pero si la diferencia es grande suele ser que Protect!P está mal: se avisa para revisarlo.
// Avisa cuando lo pagado supera lo de Protect en MÁS de este monto (pesos). Opcional: PORC > 0 exige además ese porcentaje (0.25 = 25 %).
var CONC_REVISAR_MAS_PORC = 0;
var CONC_REVISAR_MAS_MIN = 5000;

var CONC_VALOR = {
  ATIPICO: 'Protect!P atípico (revisar)',
  COINCIDE: 'Pagó lo correcto',
  MAS: 'Pagó de más',
  MAS_REVISAR: 'Pagó de más (revisar valor)',
  MENOS: 'Pagó de menos',
  SIN_DATO: 'Sin valor para comparar'
};

var CONC_COLORES = {
  'Consolidado': '#d9ead3',
  'Consolidado por nombre (revisar)': '#fff2cc',
  'Falta por consolidar': '#f4cccc',
  'Sin registro en Protect': '#e6e6e6'
};

var CONC_COLORES_VALOR = {
  'Pagó lo correcto': '#d9ead3',
  'Pagó de más': '#cfe2f3',
  'Pagó de menos': '#ea4335',
  'Sin valor para comparar': '#e6e6e6'
};

var CONC_ENCABEZADOS = [
  'Estado', 'Cédula', 'Cliente (Consolidados)', 'Cliente (Protect)', 'Placa', 'Contrato',
  'Protect!P (pagado a Dugo Motos)', 'Consolidados C', 'Consolidados D',
  '¿Pagó lo que era?', 'Diferencia (valor usado − P)', 'Diferencia C − P', 'Diferencia D − P',
  'Cruce', 'Fila Consolidados', 'Fila Protect', 'Observación'
];

// ==================== PUNTO DE ENTRADA ====================
function CONC_conciliar() {
  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  var out = CONC_procesar(ss, CONC_TOLERANCIA);
  Logger.log('Columnas detectadas en Consolidados: ' + JSON.stringify(out.columnas));
  Logger.log('Conciliación lista: ' + JSON.stringify(out.res.resumen) + ' | seguimiento: ' + JSON.stringify(out.hist));
}

// Lee, concilia, actualiza el historial y escribe las hojas propias. Lo usan la ejecución manual y la pantalla web.
function CONC_procesar(ss, tol, rapido) {
  // rapido = true: solo LEE y calcula (sin escribir en ninguna hoja y sin bloquear). Es lo que usa la pantalla para mostrar
  // resultados en pocos segundos; la escritura de las hojas se hace aparte (rapido = false), en segundo plano.
  var lock = null;
  if (!rapido) {
    // Candado del USUARIO (distinto del candado del script que usan los guardados): así una actualización larga de las hojas no bloquea los guardados
    lock = LockService.getUserLock();
    if (!lock.tryLock(30000)) throw new Error('Hay otra actualización de la hoja en curso. Espera unos segundos y vuelve a intentar.');
  }
  try {
    var hojaProtect = CONC_buscarHoja(ss, CONC_HOJA_PROTECT);
    var hojaCons = CONC_buscarHoja(ss, CONC_HOJA_CONSOLIDADOS);
    var protect = CONC_leerProtect(hojaProtect);
    var lectura = CONC_leerConsolidados(hojaCons);
    var columnas = CONC_detectarColumnas(lectura.filas, protect, lectura.encabezados);
    var ajustes = CONC_leerAjustes(ss);
    var asignaciones = CONC_leerAsignaciones(ss);
    var res = CONC_calcular(protect, lectura.filas, tol, ajustes, asignaciones);
    var porFila = {}; lectura.filas.forEach(function (r) { porFila[r.fila] = r; });
    res.filas.forEach(function (f) { var u = String(f.filaCons || '').split(',')[0].trim(), r = u ? porFila[Number(u)] : null; f.mesCons = r ? r.mes : 0; f.anioCons = r ? r.anio : 0; });
    var resumenMeses = CONC_resumenMeses(lectura.filas, protect);
    var previos = CONC_leerHistorial(ss);
    var ah = CONC_aplicarHistorial(res.filas, previos, new Date());
    var estadoEnHoja = { escrito: false, rapido: true }, estadoProtect = { escrito: false };
    if (!rapido) {
      CONC_escribirResultado(ss, res);
      CONC_escribirHistorial(ss, ah.registros);
      estadoEnHoja = CONC_escribirEstadoEnConsolidados(hojaCons, lectura.filas);
      try { estadoProtect = CONC_escribirEstadoEnProtect(hojaProtect, res.filas); }
      catch (e) { estadoProtect = { escrito: false, error: String(e && e.message ? e.message : e) }; }
    }
    var estadosAR = {};
    protect.forEach(function (p) { var v = String((p.extra && p.extra.estadoCliente) || '').trim() || '(vacío)'; estadosAR[v] = (estadosAR[v] || 0) + 1; });
    return { capacidades: ['otraPersona', 'asignarLote'], estadoProtect: estadoProtect, estadosAR: estadosAR, diag: CONC_diagnostico(protect, lectura.filas, res.filas), estadoEnHoja: estadoEnHoja, res: res, hist: ah.resumen, atipicos: CONC_atipicos(res.filas), columnas: columnas, consMeses: resumenMeses, colMesAnio: { mes: lectura.colMes, anio: lectura.colAnio } };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// Busca la pestaña por nombre exacto; si no, sin importar mayúsculas, tildes, espacios ni una "s" final.
// Si no la encuentra, el error lista las pestañas que sí existen.
function CONC_buscarHoja(ss, nombre) {
  var exacta = ss.getSheetByName(nombre);
  if (exacta) return exacta;
  var clave = function (t) {
    return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
  };
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    if (clave(hojas[i].getName()) === clave(nombre)) return hojas[i];
  }
  throw new Error('No se encontró la hoja "' + nombre + '". Pestañas que veo: ' +
    hojas.map(function (h) { return '"' + h.getName() + '"'; }).join(', '));
}

// ==================== LECTURA (solo lectura) ====================
// Fila donde empiezan los datos de Protect: la siguiente a la fila de encabezados, que se reconoce porque en la columna del contrato (N) dice "contrato"
function CONC_filaInicioProtect(hoja) {
  try {
    var tope = Math.min(8, hoja.getLastRow());
    if (tope >= 1) {
      var enc = hoja.getRange(1, CONC_P.CONTRATO, tope, 1).getValues();
      for (var i = 0; i < enc.length; i++) {
        var t = CONC_normNombre(enc[i][0]);
        if (t && /CONTRATO/.test(t)) return i + 2;
      }
    }
  } catch (e) {}
  return CONC_PROTECT_FILA_INICIO;
}

function CONC_leerProtect(hoja) {
  var iniP = CONC_filaInicioProtect(hoja);
  var ultima = hoja.getLastRow();
  if (ultima < iniP) return [];
  var n = ultima - iniP + 1;
  var anchoLectura = Math.min(Math.max(CONC_P_INFO.ESTADO_CLIENTE, CONC_P.PAGADO_DUGO), hoja.getLastColumn());
  var datos = hoja.getRange(iniP, 1, n, anchoLectura).getValues();
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var cedula = f[CONC_P.CEDULA - 1];
    var cliente = f[CONC_P.CLIENTE - 1];
    var placa = f[CONC_P.PLACA - 1];
    var contrato = f[CONC_P.CONTRATO - 1];
    var pagado = f[CONC_P.PAGADO_DUGO - 1];
    if (CONC_vacio(cedula) && CONC_vacio(cliente) && CONC_vacio(contrato) && CONC_vacio(placa)) continue;
    filas.push({
      fila: iniP + i,
      cedula: cedula, cliente: cliente, placa: placa, contrato: contrato,
      pagado: CONC_corregirMiles(CONC_aNumero(pagado)), pagadoOriginal: CONC_aNumero(pagado),
      extra: {
        asesor: CONC_texto(f[CONC_P_INFO.ASESOR - 1]),
        fechaFirma: CONC_fechaTxt(f[CONC_P_INFO.FECHA_FIRMA - 1]),
        fin: CONC_fechaTxt(f[CONC_P_INFO.FIN - 1]),
        cuota: CONC_aNumero(f[CONC_P_INFO.CUOTA - 1]),
        plazo: CONC_aNumero(f[CONC_P_INFO.PLAZO - 1]),
        forma: CONC_texto(f[CONC_P_INFO.FORMA - 1]).toUpperCase(),
        celular: CONC_texto(f[CONC_P_INFO.CELULAR - 1]),
        // Anulado si lo dice la columna AR o si el nombre del cliente (columna H) dice "Anulado"/"Anulada"
        estadoCliente: /^\s*anulad[oa]\s*$/i.test(CONC_texto(cliente)) ? 'ANULADO' : CONC_texto(f[CONC_P_INFO.ESTADO_CLIENTE - 1]).toUpperCase()
      }
    });
  }
  return filas;
}

function CONC_leerConsolidados(hoja) {
  var ultima = hoja.getLastRow();
  if (ultima < CONC_CONS_FILA_INICIO) return { filas: [], encabezados: [] };
  var n = ultima - CONC_CONS_FILA_INICIO + 1;
  var ancho = Math.min(Math.max(4, hoja.getLastColumn()), 30);
  var datos = hoja.getRange(CONC_CONS_FILA_INICIO, 1, n, ancho).getValues();
  var encabezados = CONC_CONS_FILA_INICIO > 2 ? hoja.getRange(CONC_CONS_FILA_INICIO - 1, 1, 1, ancho).getValues()[0] : [];
  var colMes = -1, colAnio = -1, h, hn;
  for (h = 4; h < encabezados.length; h++) {   // Mes y Año: por el TÍTULO de la columna (a partir de la E), donde estén
    if (h === CONC_COL_ESTADO_CONS - 1 || h === CONC_COL_CONTRATO_CONS - 1 || h === CONC_COL_VALOR_DUGO_CONS - 1) continue;
    hn = CONC_normNombre(encabezados[h]);
    if (colMes < 0 && hn === 'MES') colMes = h;
    else if (colAnio < 0 && (hn === 'ANO' || hn === 'ANIO')) colAnio = h;
  }
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    if (CONC_vacio(f[0]) && CONC_vacio(f[1]) && CONC_vacio(f[2]) && CONC_vacio(f[3])) continue;
    filas.push({
      fila: CONC_CONS_FILA_INICIO + i,
      mes: colMes >= 0 ? CONC_mesNum(f[colMes]) : 0, anio: colAnio >= 0 ? CONC_anioNum(f[colAnio]) : 0,
      cedula: f[0], cliente: f[1],
      c: CONC_sinCero(CONC_corregirMiles(CONC_aNumero(f[2]))), d: CONC_sinCero(CONC_corregirMiles(CONC_aNumero(f[3]))),
      h: CONC_sinCero(CONC_corregirMiles(CONC_aNumero(f[CONC_COL_VALOR_DUGO_CONS - 1]))),   // columna H: «Valor pagado a Dugo Motos» (la escribe esta automatización)
      extra: f.slice(4)
    });
  }
  return { filas: filas, encabezados: encabezados, colMes: colMes, colAnio: colAnio };
}

// Mes (1-12) a partir de un número, un nombre («Octubre», «oct») o una fecha. 0 si no se entiende.
function CONC_mesNum(v) {
  if (CONC_vacio(v)) return 0;
  if (v instanceof Date) return v.getMonth() + 1;
  var t = String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/^\d{1,2}$/.test(t)) { var n = Number(t); return n >= 1 && n <= 12 ? n : 0; }
  var N = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var k = t.slice(0, 3); if (k === 'set') k = 'sep';
  var i = N.indexOf(k);
  return i >= 0 ? i + 1 : 0;
}
// Año de 4 cifras a partir de un número, un texto («2026», «26») o una fecha. 0 si no se entiende.
function CONC_anioNum(v) {
  if (CONC_vacio(v)) return 0;
  if (v instanceof Date) return v.getFullYear();
  var n = parseInt(String(v).replace(/[^0-9]/g, '').slice(-4), 10);
  if (isNaN(n)) return 0;
  if (n < 100) n += 2000;
  return n >= 2000 && n <= 2100 ? n : 0;
}

// Resumen de lo consolidado por mes y año, con las columnas Mes y Año de la hoja Consolidado.
// ¿Qué valor se toma de cada pago? C y D son el mismo pago visto de dos formas: NUNCA se suman entre sí; se elige UNO.
//   1) Si solo una de las dos tiene valor, esa.
//   2) Si vienen las dos: se comparan con la columna H de la misma fila («Valor pagado a Dugo Motos») y se toma la que coincide
//      (si ninguna coincide exacto, la más cercana a H).
//   3) Si la fila aún no tiene H, se compara con lo que Protect dice que pagó esa cédula (columna P); y si tampoco hay pista, la mayor.
// Después, los valores elegidos de cada pago SÍ se suman por mes y por año.
function CONC_valorPago(r, pagadosPorCedula) {
  var c = CONC_sinCero(r.c), d = CONC_sinCero(r.d);
  if (c === null && d === null) return { v: 0, col: '' };
  if (c === null) return { v: d, col: 'D' };
  if (d === null) return { v: c, col: 'C' };
  if (c === d) return { v: c, col: 'C' };
  var h = CONC_sinCero(r.h === undefined ? null : r.h);
  if (h !== null) {
    if (CONC_iguales(c, h, CONC_TOLERANCIA)) return { v: c, col: 'C' };
    if (CONC_iguales(d, h, CONC_TOLERANCIA)) return { v: d, col: 'D' };
    return Math.abs(c - h) <= Math.abs(d - h) ? { v: c, col: 'C' } : { v: d, col: 'D' };
  }
  var ps = pagadosPorCedula[CONC_normCedula(r.cedula)] || [], okC = false, okD = false;
  ps.forEach(function (p) { if (CONC_iguales(c, p, CONC_TOLERANCIA)) okC = true; if (CONC_iguales(d, p, CONC_TOLERANCIA)) okD = true; });
  if (okC && !okD) return { v: c, col: 'C' };
  if (okD && !okC) return { v: d, col: 'D' };
  return c >= d ? { v: c, col: 'C' } : { v: d, col: 'D' };
}

function CONC_resumenMeses(filas, protect) {
  var m = {}, sin = { n: 0, c: 0, d: 0 }, ped = {};
  (protect || []).forEach(function (p) { if (p.pagado === null || p.pagado === undefined) return; var k = CONC_normCedula(p.cedula); (ped[k] = ped[k] || []).push(p.pagado); });
  filas.forEach(function (r) {
    var c = r.c || 0, d = r.d || 0;
    if (!r.mes || !r.anio) { sin.n++; sin.c += c; sin.d += d; return; }
    var k = r.anio * 100 + r.mes, o = m[k] = m[k] || { anio: r.anio, mes: r.mes, n: 0, c: 0, d: 0, auto: 0, nC: 0, nD: 0 };
    var vp = CONC_valorPago(r, ped);
    o.n++; o.c += c; o.d += d; o.auto += vp.v;
    if (vp.col === 'C') o.nC++; else if (vp.col === 'D') o.nD++;
  });
  return { meses: Object.keys(m).sort().map(function (k) { return m[k]; }), sinFecha: sin };
}

// Busca en Consolidados (columnas E en adelante) cuál trae la placa y cuál el número de contrato.
// 1) por el título de la columna ("placa", "contrato"); 2) si no hay título, por el contenido: la columna
// cuyos valores coinciden con placas / contratos de Protect. Les pone r.placa y r.contrato a las filas.
function CONC_detectarColumnas(cons, protect, encabezados) {
  var info = { placa: -1, contrato: -1, origenPlaca: '', origenContrato: '' };
  var ancho = 0;
  cons.forEach(function (r) { if (r.extra.length > ancho) ancho = r.extra.length; });
  if (!ancho) return info;
  var i;
  var propias = {};
  propias[CONC_COL_ESTADO_CONS - 1] = true; propias[CONC_COL_CONTRATO_CONS - 1] = true; propias[CONC_COL_VALOR_DUGO_CONS - 1] = true; // columnas que escribe esta automatización
  for (i = 4; i < 4 + ancho; i++) {
    if (propias[i]) continue;
    var h = CONC_normNombre(encabezados[i] || '');
    if (!h) continue;
    if (info.placa < 0 && /PLACA/.test(h)) { info.placa = i - 4; info.origenPlaca = 'título'; }
    else if (info.contrato < 0 && /CONTRATO/.test(h)) { info.contrato = i - 4; info.origenContrato = 'título'; }
  }
  var setC = {}, setP = {};
  protect.forEach(function (p) {
    var kc = CONC_normClave(p.contrato), kp = CONC_normClave(p.placa);
    if (kc) setC[kc] = true;
    if (kp) setP[kp] = true;
  });
  // Las placas tienen una forma muy reconocible (ERN58H, ABC123). Los contratos son números cortos que se confunden
  // fácil con cualquier otra columna, así que el contrato SOLO se toma si la columna se titula "contrato".
  var formaPlaca = /^[A-Z]{3}[0-9]{2}[A-Z0-9]$/;
  var mejor = function (set, excluir) {
    var idx = -1, top = 0;
    for (var j = 0; j < ancho; j++) {
      if (j === excluir || propias[j + 4]) continue;
      var no = 0, hit = 0, forma = 0;
      cons.forEach(function (r) {
        var k = CONC_normClave(r.extra[j]);
        if (!k) return;
        no++; if (formaPlaca.test(k)) forma++; if (set[k]) hit++;
      });
      if (hit >= 3 && no && hit / no >= 0.3 && forma / no >= 0.7 && hit > top) { top = hit; idx = j; }
    }
    return idx;
  };
  if (info.placa < 0) { var ip = mejor(setP, info.contrato); if (ip >= 0) { info.placa = ip; info.origenPlaca = 'contenido'; } }
  cons.forEach(function (r) {
    r.placa = info.placa >= 0 ? CONC_texto(r.extra[info.placa]) : '';
    r.contrato = info.contrato >= 0 ? CONC_texto(r.extra[info.contrato]) : '';
  });
  return info;
}

// ==================== LÓGICA (pura, sin acceso a hojas) ====================
// Protect es la base: un resultado por contrato. El contrato está CONSOLIDADO si la cédula aparece en Consolidados.
// Cada fila de Consolidados paga UN contrato. Si la cédula tiene varios contratos, se asignan así:
//   1) por valor exacto (la fila cuyo C o D es igual a Protect!P de ese contrato);
//   2) las filas que sobran, por orden, a los contratos que quedaron sin pago ("Asignado por orden (revisar)");
//   3) el contrato que se queda sin fila => "Falta por consolidar".
function CONC_calcular(protect, cons, tol, ajustes, asignaciones) {
  // 0) Filas de Consolidados que traen número de contrato o placa: van directo a su contrato
  var porContrato = {}, porPlaca = {};
  protect.forEach(function (p) {
    p.directRows = []; p.directMetodo = '';
    var kc = CONC_normClave(p.contrato), kp = CONC_normClave(p.placa);
    if (kc) (porContrato[kc] = porContrato[kc] || []).push(p);
    if (kp) (porPlaca[kp] = porPlaca[kp] || []).push(p);
  });
  var consPorCedula = {}, consPorNombre = {}, vecesPago = {};
  cons.forEach(function (r) {
    r.kCed = CONC_normCedula(r.cedula);
    r.kNom = CONC_normNombre(r.cliente);
    r.usada = false; r.directa = false;
    r.clavePago = CONC_clavePago(r, vecesPago);
    // Asignación MANUAL (hecha desde el HTML): manda sobre cualquier regla automática
    var am = asignaciones && asignaciones[r.clavePago];
    if (am) {
      if (am.contrato === 'NINGUNO') { r.usada = true; r.ignorada = true; r.estadoFila = 'No es un pago · ajuste manual'; return; }
      var dests = CONC_destinosManual(am.contrato, r.kCed, porContrato, protect);
      if (dests.length) {
        r.directa = true; r.usada = true; r.manual = true;
        if (am.otra) r.otraManual = { cedula: CONC_texto(r.cedula), nombre: CONC_texto(r.cliente) };   // tú indicaste que pagó otra persona
        if (dests.length > 1) r.compartida = dests;   // un solo pago que cubre varios contratos
        dests.forEach(function (dest) { dest.directRows.push(r); dest.directMetodo = 'manual'; });
        return;
      }
    }
    var kc = CONC_normClave(r.contrato), kp = CONC_normClave(r.placa), destino = null, metodo = '';
    if (kc && !porContrato[kc]) r.contratoInvalido = true; // escribiste un contrato que no existe en Protect
    if (kc && porContrato[kc] && porContrato[kc].length === 1) { destino = porContrato[kc][0]; metodo = 'contrato'; }
    else if (kp && porPlaca[kp] && porPlaca[kp].length === 1) { destino = porPlaca[kp][0]; metodo = 'placa'; }
    if (destino) {
      r.directa = true; r.usada = true;
      destino.directRows.push(r);
      if (destino.directMetodo !== 'manual' && (!destino.directMetodo || metodo === 'contrato')) destino.directMetodo = metodo;
      return;
    }
    if (r.kCed) (consPorCedula[r.kCed] = consPorCedula[r.kCed] || []).push(r);
    if (r.kNom) (consPorNombre[r.kNom] = consPorNombre[r.kNom] || []).push(r);
  });

  // Agrupar contratos de Protect por persona. 1) por cédula; 2) los que no cruzan por cédula, por nombre
  // (exacto o aproximado) entre las filas de Consolidado que todavía no tienen dueño.
  var grupos = {}, orden = [], sinGrupo = [], pendientesNombre = [];
  var anulados = [], directosAparte = [], activasPorCed = {}, noAnuladasPorCed = {};
  protect.forEach(function (p) {
    p.directoAuto = !!(p.extra && CONC_esAsesorDirecto(p.extra.asesor));
    if (!(p.extra && CONC_esAnulado(p.extra.estadoCliente))) noAnuladasPorCed[CONC_normCedula(p.cedula)] = true;
    // "activo" = contrato normal: ni anulado ni de un asesor que cobra directo
    if (!(p.extra && CONC_esAnulado(p.extra.estadoCliente)) && !p.directoAuto) activasPorCed[CONC_normCedula(p.cedula)] = true;
  });
  protect.forEach(function (p) {
    p.kCed = CONC_normCedula(p.cedula);
    p.kNom = CONC_normNombre(p.cliente);
    p.tokNom = CONC_tokensNombre(p.cliente);
    // Contratos Anulados o Cancelados (Protect columna AR): no se consolidan y no entran al reparto de pagos
    if (p.extra && CONC_esAnulado(p.extra.estadoCliente)) {
      // Si la persona NO tiene otros contratos activos y SÍ aparece en Consolidado con un pago, no se esconde: se consolida normal y se marca para revisar
      if (p.kCed && consPorCedula[p.kCed] && !noAnuladasPorCed[p.kCed]) { p.anuladoConPago = true; }
      else { p.noAplica = true; anulados.push(p); return; }
    }
    // Contrato de un asesor que cobra directo (Kelli): si la persona tiene otros contratos normales, el pago de Consolidado es de esos, no de este
    if (p.directoAuto && p.kCed && activasPorCed[p.kCed]) { directosAparte.push(p); return; }
    if (p.kCed && consPorCedula[p.kCed]) {
      var gk = 'C:' + p.kCed;
      if (!grupos[gk]) { grupos[gk] = { cruce: 'Cédula', filas: consPorCedula[p.kCed], contratos: [] }; orden.push(gk); }
      grupos[gk].contratos.push(p);
    } else {
      pendientesNombre.push(p);
    }
  });
  orden.forEach(function (gk) { grupos[gk].filas.forEach(function (r) { r.usada = true; }); });
  // Si la cédula solo tiene contratos anulados/cancelados pero aparece en Consolidado, se avisa en esa fila (no es "sin registro")
  anulados.forEach(function (p) {
    (consPorCedula[p.kCed] || []).forEach(function (r) {
      if (!r.usada) { r.usada = true; r.estadoFila = 'Contrato anulado en Protect (revisar)'; }
      p.tienePago = true;
    });
  });

  var libresPorToken = {};
  cons.forEach(function (r) {
    if (r.usada || r.directa) return;
    r.tokNom = CONC_tokensNombre(r.cliente);
    r.tokNom.forEach(function (t) { (libresPorToken[t] = libresPorToken[t] || []).push(r); });
  });
  var cacheNombre = {};
  pendientesNombre.forEach(function (p) {
    var gk = null, cruce = '', filas = null;
    if (p.tokNom.length >= 2) {
      var m = cacheNombre[p.kNom] !== undefined ? cacheNombre[p.kNom] : (cacheNombre[p.kNom] = CONC_buscarPorNombre(p.tokNom, libresPorToken));
      if (m) {
        gk = 'N:' + p.kNom; cruce = m.exacto ? 'Nombre (revisar)' : 'Nombre aproximado (revisar)'; filas = m.filas;
        filas.forEach(function (r) { r.usada = true; });
      }
    }
    if (!gk && p.directRows.length) { gk = 'D:' + p.fila; cruce = ''; filas = []; }
    if (!gk) { sinGrupo.push(p); return; }
    if (!grupos[gk]) { grupos[gk] = { cruce: cruce, filas: filas, contratos: [] }; orden.push(gk); }
    grupos[gk].contratos.push(p);
  });

  var umbralP = CONC_umbralAtipico(protect.map(function (p) { return p.pagado; }));
  var salida = [];
  var base = function (p, cruce) {
    return {
      estado: '', cedula: p.cedula, clienteCons: '', clienteProtect: p.cliente, placa: p.placa, contrato: p.contrato,
      pagado: p.pagado, c: null, d: null, concordo: '', valor: '', dif: null, difC: null, difD: null,
      cruce: cruce, filaCons: '', filaProtect: p.fila, obs: (p.pagadoOriginal !== undefined && p.pagadoOriginal !== null && p.pagadoOriginal !== p.pagado) ? 'Protect!P trae ' + p.pagadoOriginal + ' (con punto de miles): se leyó como $' + String(p.pagado).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '. Corrige la celda en Protect. ' : '', extra: p.extra || null, nCons: 0, varios: false, asignacion: '', porOrden: false
    };
  };

  directosAparte.forEach(function (p) {
    var f = base(p, '');
    CONC_aplicarAjusteManual(f, p, ajustes, []);   // aquí se marca "Pagó directo a Protect" (o lo que hayas decidido a mano)
    salida.push(f);
  });

  anulados.forEach(function (p) {
    var f = base(p, '');
    f.estado = CONC_ESTADO.NO_APLICA;
    f.obs = 'En Protect (columna AR) este contrato figura como "' + p.extra.estadoCliente + '": el cliente no llevó la póliza, no hay que consolidarlo.' +
      (p.tienePago ? ' OJO: la cédula aparece en Consolidado; revisa si ese pago corresponde a otro contrato.' : '');
    CONC_aplicarAjusteManual(f, p, ajustes, []);
    salida.push(f);
  });

  sinGrupo.forEach(function (p) {
    var f = base(p, '');
    f.estado = CONC_ESTADO.FALTA;
    f.obs = 'No aparece en la hoja Consolidado (ni por cédula ni por nombre).';
    CONC_aplicarAjusteManual(f, p, ajustes, []);
    salida.push(f);
  });

  orden.forEach(function (gk) {
    var g = grupos[gk], n = g.contratos.length;
    g.filas.forEach(function (r) { r.usada = true; });
    // Contratos que ya recibieron filas por contrato/placa no entran al reparto por valor/orden
    var libres = g.contratos.filter(function (p) { return !p.directRows.length; });
    var asigLibres = CONC_asignar(libres.length ? libres : g.contratos, g.filas, tol);
    var asig = g.contratos.map(function (p) {
      var extra = libres.length ? (libres.indexOf(p) >= 0 ? asigLibres[libres.indexOf(p)] : { filas: [], metodo: '' })
                                : asigLibres[g.contratos.indexOf(p)];
      var filasTot = p.directRows.concat(extra.filas);
      return { filas: filasTot, metodo: p.directRows.length ? p.directMetodo : extra.metodo };
    });
    g.contratos.forEach(function (p, i) {
      var f = base(p, g.cruce), a = asig[i];
      if (p.anuladoConPago) f.anuladoConPago = true;
      if (p.directRows.length) f.cruce = p.directMetodo === 'manual' ? 'Asignación manual' : (p.directMetodo === 'contrato' ? 'Número de contrato' : 'Placa');
      f.varios = n > 1;
      if (!a.filas.length) {
        f.estado = CONC_ESTADO.FALTA;
        f.obs = 'Esta cédula tiene ' + n + ' contratos en Protect pero solo ' + g.filas.length + (g.filas.length === 1 ? ' fila' : ' filas') +
          ' en Consolidados: a este contrato no se le asignó ningún pago.';
        CONC_aplicarAjusteManual(f, p, ajustes, []);
        salida.push(f);
        return;
      }
      // Un solo pago que cubre varios contratos: se compara contra la SUMA de lo que Dugo Motos cobra por esos contratos
      var pagadoEval = p.pagado, comp = null;
      if (a.filas.length === 1 && a.filas[0].compartida) {
        comp = a.filas[0].compartida; var totC = 0, hayC = false;
        comp.forEach(function (q) { if (q.pagado !== null) { totC += q.pagado; hayC = true; } });
        pagadoEval = hayC ? totC : null;
      }
      var mejor = CONC_mejorValor(a.filas, pagadoEval, tol);
      if (comp) { f.compartidoCon = comp.map(function (q) { return CONC_texto(q.contrato); }); f.pagadoCompartido = pagadoEval; }
      f.estado = (g.cruce === 'Cédula' || p.directRows.length) ? CONC_ESTADO.CONCILIADO : CONC_ESTADO.POR_NOMBRE;
      f.clienteCons = mejor.r.cliente; f.c = mejor.r.c; f.d = mejor.r.d; f.nCons = a.filas.length;
      f.concordo = mejor.concordo; f.valor = mejor.valor; f.dif = mejor.dif; f.difC = mejor.difC; f.difD = mejor.difD;
      if (mejor.suma) { f.sumaPagos = mejor.suma; f.c = mejor.suma.total; f.d = null; }
      if (p.pagado !== null && p.pagado > umbralP) {
        f.valor = CONC_VALOR.ATIPICO; f.dif = null; f.difC = null; f.difD = null; f.concordo = '';
      }
      if (f.valor === CONC_VALOR.MAS && pagadoEval && f.dif > Math.max(CONC_REVISAR_MAS_MIN, CONC_REVISAR_MAS_PORC * pagadoEval)) f.valor = CONC_VALOR.MAS_REVISAR;
      // Pago hecho por OTRA persona: solo cuando TÚ lo indicaste al asignar el pago (opción "¿Pagó otra persona por este contrato?")
      var otra = null;
      a.filas.forEach(function (r) { if (!otra && r.otraManual) otra = r.otraManual; });
      if (otra) f.otraPersona = otra;
      // Pagos de Consolidado asignados a este contrato (la pantalla los usa para marcar «pagó otra persona» con un botón)
      f.pagosAsignados = a.filas.filter(function (r) { return r.clavePago; }).map(function (r) { return { clavePago: r.clavePago, cedula: CONC_texto(r.cedula), cliente: CONC_texto(r.cliente), c: r.c, d: r.d, fila: r.fila, otra: !!r.otraManual }; });
      f.filaCons = a.filas.map(function (r) { return r.fila; }).join(', ');
      var notas = ['Aparece en Consolidados (' + a.filas.length + (a.filas.length === 1 ? ' fila' : ' filas') + ': ' + f.filaCons + ').'];
      if (otra) notas.push('El pago lo hizo otra persona: ' + (otra.nombre || 'sin nombre') + ' (cédula ' + otra.cedula + '). El contrato está a nombre de ' + (p.cliente || 'otra persona') + '.');
      if (comp) notas.push('Un solo pago de Consolidado cubre los contratos ' + f.compartidoCon.join(' + ') + ': se compara con la suma de Dugo Motos ($ ' + String(Math.round(pagadoEval || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ').');
      if (mejor.suma) notas.push('Este contrato tiene ' + mejor.suma.n + ' pagos: se sumaron ($ ' + String(Math.round(mejor.suma.total)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ') para compararlos con el valor de Dugo Motos.');
      if (g.cruce === 'Nombre (revisar)' && !p.directRows.length) notas.push('Se encontró solo por nombre; confirma que sea la misma persona.');
      if (p.directRows.length) {
        if (p.directMetodo === 'manual') {
          f.asignacion = 'Asignado manualmente';
          notas.push('Asignación manual: tú indicaste que este pago pertenece a este contrato.');
        } else {
          f.asignacion = p.directMetodo === 'contrato' ? 'Asignado por contrato' : 'Asignado por placa';
          notas.push('Consolidados trae ' + (p.directMetodo === 'contrato' ? 'el número de contrato' : 'la placa') + ' de este pago: asignación segura.');
        }
      } else if (n > 1) {
        if (a.metodo === 'orden') {
          f.asignacion = 'Asignado por orden (revisar)'; f.porOrden = true;
          notas.push('Esta cédula tiene ' + n + ' contratos: la fila se asignó por orden porque el valor no coincidió con ninguno. Revisa que corresponda a este contrato.');
        } else {
          f.asignacion = 'Asignado por valor';
          notas.push('Esta cédula tiene ' + n + ' contratos: la fila se asignó por coincidir el valor con Protect!P.');
        }
      }
      if (p.anuladoConPago) notas.push('OJO: en Protect (columna AR) este contrato figura como "' + p.extra.estadoCliente + '" pero la cédula aparece pagando en Consolidado. Revisa si de verdad no llevó la póliza.');
      f.obs = (f.obs ? f.obs : '') + notas.join(' ');
      CONC_aplicarAjusteManual(f, p, ajustes, a.filas);
      a.filas.forEach(function (r) { r.valorDugo = r.compartida ? pagadoEval : p.pagado; });
      a.filas.forEach(function (r) { r.contratoAsig = r.compartida ? r.compartida.map(function (q) { return CONC_texto(q.contrato); }).join(' + ') : CONC_texto(p.contrato); });
      salida.push(f);
      if (!(f.ajuste && f.ajuste.decision === 'Falta')) {
        var txtFila = CONC_textoFila(f);
        a.filas.forEach(function (r) { r.estadoFila = txtFila; });
      }
    });
  });

  // Personas que están en Consolidados pero no en Protect
  cons.forEach(function (r) {
    if (r.usada) { if (!r.estadoFila) r.estadoFila = CONC_ESTADO.CONCILIADO; return; }
    r.estadoFila = CONC_ESTADO.SIN_PROTECT;
    var claveS = 'S:' + String(r.clavePago || '').replace(/^R:/, '');
    var ajS = ajustes && ajustes[claveS];
    var obsS = 'Está en Consolidados pero no en Protect (ni por cédula ni por nombre).';
    if (ajS) {
      if (ajS.decision === 'Revisado') { r.estadoFila += ' · revisado'; obsS += ' Marcado como revisado.'; }
      if (ajS.nota) { r.estadoFila += ' · Nota: ' + String(ajS.nota).slice(0, 150); obsS += ' Nota: ' + ajS.nota; }
    }
    salida.push({
      claveAjuste: claveS, ajuste: ajS ? { decision: ajS.decision, nota: ajS.nota || '', fecha: ajS.fecha || '' } : null, revisado: !!(ajS && ajS.decision === 'Revisado'),
      estado: CONC_ESTADO.SIN_PROTECT, cedula: r.cedula, clienteCons: r.cliente, clienteProtect: '', placa: '', contrato: '',
      pagado: null, c: r.c, d: r.d, concordo: '', valor: '', dif: null, difC: null, difD: null, cruce: 'Sin cruce',
      filaCons: r.fila, filaProtect: '', obs: obsS, extra: null,
      nCons: 1, varios: false, asignacion: '', porOrden: false
    });
  });

  // Para las personas con varios contratos: lista de sus contratos y de sus pagos (para reasignar a mano desde el HTML)
  var porPersona = {}, duenoContrato = {};
  salida.forEach(function (f) {
    if (f.estado === CONC_ESTADO.SIN_PROTECT || !f.claveAjuste) return;
    var kp = CONC_normCedula(f.cedula);
    if (!kp) return;
    (porPersona[kp] = porPersona[kp] || { contratos: [], pagos: [], filas: [] }).contratos.push(f);
    var kc = CONC_normClave(f.contrato);
    if (kc) duenoContrato[kc] = kp;
  });
  var yaPago = {};
  cons.forEach(function (r) {
    var kp = r.kCed;
    if (r.contratoAsig && duenoContrato[CONC_normClave(r.contratoAsig)]) kp = duenoContrato[CONC_normClave(r.contratoAsig)];
    if (!kp || !porPersona[kp] || yaPago[r.clavePago]) return;
    yaPago[r.clavePago] = true;
    porPersona[kp].pagos.push({ clavePago: r.clavePago, fila: r.fila, c: r.c, d: r.d, contratoActual: r.ignorada ? 'NINGUNO' : (r.contratoAsig || ''), manual: !!(r.manual || r.ignorada) });
  });
  Object.keys(porPersona).forEach(function (kp) {
    var g = porPersona[kp];
    if (g.contratos.length < 2) return;
    var lista = g.contratos.map(function (f) { return { contrato: CONC_texto(f.contrato), placa: f.placa || '', pagado: f.pagado }; });
    g.contratos.forEach(function (f) { f.contratosGrupo = lista; f.pagosGrupo = g.pagos; });
  });

  // Orden del historial: como están en Protect; lo que no está en Protect va al final
  salida.forEach(function (x, i) { x._i = i; });
  salida.sort(function (a, b) {
    var fa = a.filaProtect === '' ? Infinity : a.filaProtect;
    var fb = b.filaProtect === '' ? Infinity : b.filaProtect;
    return fa === fb ? a._i - b._i : (fa < fb ? -1 : 1);
  });
  salida.forEach(function (x) { delete x._i; });

  cons.forEach(function (r) {
    if (r.contratoInvalido && r.estadoFila) r.estadoFila += ' · el contrato escrito no existe en Protect (revisar)';
  });

  var resumen = {};
  salida.forEach(function (s) { resumen[s.estado] = (resumen[s.estado] || 0) + 1; });
  return { filas: salida, resumen: resumen };
}

// ----- Búsqueda por nombre (cuando la cédula está mal escrita) -----
function CONC_tokensNombre(v) {
  if (CONC_vacio(v)) return [];
  var s = String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  var stop = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1 };
  var visto = {}, out = [];
  s.split(/\s+/).forEach(function (t) { if (t.length >= 2 && !stop[t] && !visto[t]) { visto[t] = 1; out.push(t); } });
  return out;
}

// Filas libres de Consolidado cuyo nombre coincide (aunque falten o sobren nombres o estén en otro orden).
// Si hay dos personas distintas con nombre parecido (cédulas distintas) no adivina.
function CONC_buscarPorNombre(tok, indice) {
  var ordenados = tok.slice().sort(function (a, b) { return (indice[a] ? indice[a].length : 0) - (indice[b] ? indice[b].length : 0); });
  var cand = [], visto = {};
  ordenados.slice(0, 2).forEach(function (t) {
    (indice[t] || []).forEach(function (r) { if (!visto[r.fila] && !r.usada) { visto[r.fila] = 1; cand.push(r); } });
  });
  var res = [], exacto = true, cedulas = {};
  cand.forEach(function (r) {
    var set = {}, inter = 0;
    r.tokNom.forEach(function (t) { set[t] = 1; });
    tok.forEach(function (t) { if (set[t]) inter++; });
    var mn = Math.min(tok.length, r.tokNom.length), mx = Math.max(tok.length, r.tokNom.length);
    if (inter >= 2 && inter / mn >= 0.75 && inter / mx >= 0.5) {
      res.push(r);
      if (!(tok.length === r.tokNom.length && inter === tok.length)) exacto = false;
      if (r.kCed) cedulas[r.kCed] = true;
    }
  });
  if (!res.length || Object.keys(cedulas).length > 1) return null;
  return { filas: res, exacto: exacto };
}

// ----- Asignación manual de pagos a contratos (hoja "Asignaciones_Pagos") -----
var CONC_ASIG_ENCABEZADOS = ['ClavePago', 'Contrato asignado', 'Cédula', 'Cliente', 'Valor C', 'Valor D', 'Fecha', 'Pagó otra persona'];

// Identidad de un pago aunque cambie de fila: cédula + C + D (+ n° de repetición si hay filas idénticas)
function CONC_clavePago(r, veces) {
  var base = 'R:' + CONC_normCedula(r.cedula) + '|' + (r.c === null || r.c === undefined ? '' : r.c) + '|' + (r.d === null || r.d === undefined ? '' : r.d);
  veces[base] = (veces[base] || 0) + 1;
  return base + '|#' + veces[base];
}

function CONC_leerAsignaciones(ss) {
  var hoja = ss.getSheetByName(CONC_HOJA_ASIGNACIONES);
  if (!hoja || hoja.getLastRow() < 1) return {};
  if (hoja.getRange(1, 1).getValue() !== CONC_ASIG_ENCABEZADOS[0]) {
    throw new Error('Ya existe una hoja "' + CONC_HOJA_ASIGNACIONES + '" con otro contenido. No se usa; renómbrala o cambia CONC_HOJA_ASIGNACIONES.');
  }
  if (hoja.getLastRow() < 2) return {};
  var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, CONC_ASIG_ENCABEZADOS.length).getValues(), out = {};
  datos.forEach(function (r) { if (!CONC_vacio(r[0]) && !CONC_vacio(r[1])) out[String(r[0])] = { contrato: String(r[1]), otra: String(r[7] || '') === 'Sí' }; });
  return out;
}

// d: { clavePago, contrato ('NINGUNO' = no es un pago, 'AUTO' = volver a la asignación automática), cedula, cliente, c, d }
function CONC_guardarAsignacion(ss, d) {
  var clave = String(d.clavePago || '');
  if (clave.indexOf('R:') !== 0) throw new Error('Falta la clave del pago.');
  var contrato = String(d.contrato === undefined || d.contrato === null ? '' : d.contrato).trim();
  if (!contrato) throw new Error('Falta el contrato.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otra operación en curso. Intenta de nuevo en un momento.');
  try {
    var hoja = ss.getSheetByName(CONC_HOJA_ASIGNACIONES);
    if (!hoja) hoja = ss.insertSheet(CONC_HOJA_ASIGNACIONES);
    if (hoja.getLastRow() < 1) {
      hoja.getRange(1, 1, 1, CONC_ASIG_ENCABEZADOS.length).setValues([CONC_ASIG_ENCABEZADOS])
        .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
      hoja.setFrozenRows(1);
    } else if (hoja.getRange(1, 1).getValue() !== CONC_ASIG_ENCABEZADOS[0]) {
      throw new Error('Ya existe una hoja "' + CONC_HOJA_ASIGNACIONES + '" con otro contenido. No se sobrescribe.');
    }
    var ultima = hoja.getLastRow(), fila = -1;
    if (ultima >= 2) {
      var claves = hoja.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < claves.length; i++) if (String(claves[i][0]) === clave) { fila = i + 2; break; }
    }
    if (contrato === 'AUTO') {
      if (fila > 0) hoja.deleteRow(fila);
      return { ok: true, accion: 'automatico' };
    }
    if (fila < 0) fila = ultima + 1;
    hoja.getRange(fila, 1, 1, 6).setNumberFormat('@');
    hoja.getRange(fila, 1, 1, CONC_ASIG_ENCABEZADOS.length).setValues([[clave, contrato, String(d.cedula || ''), String(d.cliente || ''),
      d.c === undefined || d.c === null ? '' : d.c, d.d === undefined || d.d === null ? '' : d.d, new Date(), d.otra ? 'Sí' : '']]);
    hoja.getRange(fila, 7).setNumberFormat('dd/mm/yyyy hh:mm');
    if (CONC_vacio(hoja.getRange(1, 8).getValue())) hoja.getRange(1, 8).setValue(CONC_ASIG_ENCABEZADOS[7]).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
    return { ok: true, accion: 'guardado' };
  } finally {
    lock.releaseLock();
  }
}

// Guarda varias asignaciones de una vez. lista: [{ clavePago, contrato, cedula, cliente, c, d }, ...]
function CONC_guardarAsignaciones(ss, lista) {
  if (!lista || !lista.length) return { ok: true, guardados: 0 };
  if (lista.length > 40) throw new Error('Demasiadas asignaciones a la vez (máximo 40).');
  var n = 0;
  lista.forEach(function (d) { CONC_guardarAsignacion(ss, d); n++; });
  return { ok: true, guardados: n };
}

// ----- Ajustes manuales (se guardan en la hoja "Ajustes_Manuales") -----
function CONC_claveAjuste(p) {
  return 'P:' + (CONC_normClave(p.contrato) || ('F' + p.fila)) + '|' + CONC_normCedula(p.cedula);
}

// Regla automática DESACTIVADA: "Pagó directo a Protect" se marca solo a mano desde el HTML (botón «Dinero entró directo a Protect»).
// Para volver a activarla por asesor (columna B de Protect), cambia null por una expresión, por ejemplo /KELL[IY]/
var CONC_ASESORES_DIRECTO = null;
function CONC_esAsesorDirecto(asesor) {
  if (!CONC_ASESORES_DIRECTO) return false;
  var t = String(asesor === undefined || asesor === null ? '' : asesor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return CONC_ASESORES_DIRECTO.test(t);
}

function CONC_aplicarAjusteManual(f, p, ajustes, filasAsignadas) {
  f.claveAjuste = CONC_claveAjuste(p);
  if (p.extra && CONC_esAsesorDirecto(p.extra.asesor) && f.estado !== CONC_ESTADO.NO_APLICA) {
    f.estado = CONC_ESTADO.DIRECTO; f.valor = ''; f.dif = null; f.difC = null; f.difD = null; f.concordo = '';
    f.asignacion = ''; f.porOrden = false; f.directoAuto = true;
    f.obs = 'Asesor "' + p.extra.asesor + '" (columna B de Protect): sus clientes pagan directo a Protect, no aparecen en Consolidado.' + (f.obs ? ' ' + f.obs : '');
  }
  var aj = ajustes && ajustes[f.claveAjuste];
  if (!aj) return;
  // Un contrato anulado no se consolida: un ajuste manual viejo ("Falta", "Directo"…) no debe taparlo
  if (f.estado === CONC_ESTADO.NO_APLICA && aj.decision !== 'Nota') return;
  f.ajuste = { decision: aj.decision, nota: aj.nota || '', fecha: aj.fecha || '' };
  var nota = aj.nota ? ' Nota: ' + aj.nota : '';
  if (aj.decision === 'Nota') {
    f.obs = (f.obs ? f.obs + ' ' : '') + 'Nota: ' + (aj.nota || '(vacía)');
  } else if (aj.decision === 'Falta' && !(filasAsignadas || []).some(function (r) { return r.manual; })) {
    f.estado = CONC_ESTADO.FALTA; f.valor = ''; f.dif = null; f.difC = null; f.difD = null; f.concordo = '';
    f.asignacion = ''; f.porOrden = false;
    f.obs = 'Ajuste manual: marcado como "Falta por consolidar" (lo que aparece en Consolidado no es un pago).' + nota;
    (filasAsignadas || []).forEach(function (r) { r.estadoFila = 'No es un pago · ajuste manual'; });
  } else if (aj.decision === 'Falta') {
    // Marcaste "Falta" pero después asignaste a mano un pago a este contrato: la asignación manda
    f.obs = 'Antes lo marcaste como "Falta por consolidar", pero asignaste un pago a este contrato: la asignación manda.' + nota + (f.obs ? ' ' + f.obs : '');
  } else if (aj.decision === 'Revisado') {
    f.revisado = true;
    f.obs = 'Revisado por ti: confirmaste que el consolidado está bien.' + nota + (f.obs ? ' ' + f.obs : '');
  } else if (aj.decision === 'Directo') {
    f.estado = CONC_ESTADO.DIRECTO; f.valor = ''; f.dif = null; f.difC = null; f.difD = null; f.concordo = '';
    f.asignacion = ''; f.porOrden = false;
    f.obs = 'Ajuste manual: el dinero entró directo a Protect (no aparece en Consolidado).' + nota;
  } else if (aj.decision === 'Consolidado') {
    f.estado = CONC_ESTADO.CONCILIADO;
    if (!f.valor) f.valor = CONC_VALOR.SIN_DATO;
    f.porOrden = false;
    f.obs = 'Ajuste manual: marcado como "Consolidado".' + nota + (f.obs ? ' ' + f.obs : '');
  }
}

function CONC_leerAjustes(ss) {
  var hoja = ss.getSheetByName(CONC_HOJA_AJUSTES);
  if (!hoja || hoja.getLastRow() < 1) return {};
  if (hoja.getRange(1, 1).getValue() !== CONC_AJ_ENCABEZADOS[0]) {
    throw new Error('Ya existe una hoja "' + CONC_HOJA_AJUSTES + '" con otro contenido. No se usa; renómbrala o cambia CONC_HOJA_AJUSTES.');
  }
  if (hoja.getLastRow() < 2) return {};
  var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, CONC_AJ_ENCABEZADOS.length).getValues();
  var out = {};
  datos.forEach(function (r) {
    if (CONC_vacio(r[0]) || (r[1] !== 'Consolidado' && r[1] !== 'Falta' && r[1] !== 'Nota' && r[1] !== 'Directo' && r[1] !== 'Revisado')) return;
    out[String(r[0])] = { decision: r[1], nota: CONC_texto(r[5]), fecha: CONC_fechaHoraTxt(CONC_aFecha(r[6])) };
  });
  return out;
}

// d: { clave, decision: 'Consolidado' | 'Falta' | 'Nota' (solo nota, no cambia el estado) | 'Quitar', cedula, cliente, contrato, nota }
function CONC_guardarAjuste(ss, d) {
  var decision = String(d.decision || '');
  if (['Consolidado', 'Falta', 'Directo', 'Revisado', 'Nota', 'Quitar'].indexOf(decision) < 0) throw new Error('Decisión no válida.');
  var clave = String(d.clave || '');
  if (!clave || (clave.indexOf('P:') !== 0 && clave.indexOf('S:') !== 0)) throw new Error('Falta la clave del contrato.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otra operación en curso. Intenta de nuevo en un momento.');
  try {
    var hoja = ss.getSheetByName(CONC_HOJA_AJUSTES);
    if (!hoja) hoja = ss.insertSheet(CONC_HOJA_AJUSTES);
    if (hoja.getLastRow() < 1) {
      hoja.getRange(1, 1, 1, CONC_AJ_ENCABEZADOS.length).setValues([CONC_AJ_ENCABEZADOS])
        .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
      hoja.setFrozenRows(1);
    } else if (hoja.getRange(1, 1).getValue() !== CONC_AJ_ENCABEZADOS[0]) {
      throw new Error('Ya existe una hoja "' + CONC_HOJA_AJUSTES + '" con otro contenido. No se sobrescribe.');
    }
    var ultima = hoja.getLastRow(), fila = -1;
    if (ultima >= 2) {
      var claves = hoja.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < claves.length; i++) if (String(claves[i][0]) === clave) { fila = i + 2; break; }
    }
    if (decision === 'Quitar') {
      if (fila > 0) hoja.deleteRow(fila);
      return { ok: true, accion: 'quitado' };
    }
    var registro = [[clave, decision, String(d.cedula || ''), String(d.cliente || ''), String(d.contrato || ''),
      String(d.nota || '').slice(0, 300), new Date()]];
    if (fila < 0) fila = ultima + 1;
    hoja.getRange(fila, 1, 1, 5).setNumberFormat('@');
    hoja.getRange(fila, 1, 1, CONC_AJ_ENCABEZADOS.length).setValues(registro);
    hoja.getRange(fila, 7).setNumberFormat('dd/mm/yyyy hh:mm');
    return { ok: true, accion: 'guardado' };
  } finally {
    lock.releaseLock();
  }
}

// Solo cuenta si la celda de Protect (columna AR) dice EXACTAMENTE Anulado (cualquier otro texto, incluido Cancelado, no cuenta)
function CONC_esAnulado(v) {
  var t = String(v === undefined || v === null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  return t === 'ANULADO' || t === 'ANULADA';   // "Cancelado" es otra cosa: no se toma en cuenta
}

// Contratos a los que apunta una asignación manual: uno, varios ("130, 141" / "130 + 141") o 'TODOS' (todos los de la cédula)
function CONC_destinosManual(txt, kCed, porContrato, protect) {
  var t = String(txt === undefined || txt === null ? '' : txt).trim(), dests = [];
  if (/^todos$/i.test(t)) {
    protect.forEach(function (p) { if (CONC_normCedula(p.cedula) === kCed) dests.push(p); });
    return dests;
  }
  t.split(/[,;+]|\s+y\s+/i).forEach(function (x) {
    var k = CONC_normClave(x); if (!k) return;
    var cands = porContrato[k] || [];
    var d = cands.filter(function (c) { return CONC_normCedula(c.cedula) === kCed; })[0] || cands[0];
    if (d && dests.indexOf(d) < 0) dests.push(d);
  });
  return dests;
}

// Reparte las filas de Consolidados entre los contratos de una misma persona (un pago = un contrato).
// Devuelve, por contrato (mismo orden), { filas: [...], metodo: 'unico' | 'valor' | 'orden' | '' }.
function CONC_asignar(contratos, filas, tol) {
  filas.forEach(function (r) { r.c = CONC_sinCero(r.c); r.d = CONC_sinCero(r.d); });
  var res = contratos.map(function () { return { filas: [], metodo: '' }; });
  if (contratos.length === 1) { res[0].filas = filas.slice(); res[0].metodo = 'unico'; return res; }

  var usada = filas.map(function () { return false; });
  // 1) Por valor exacto
  contratos.forEach(function (p, i) {
    if (p.pagado === null) return;
    for (var j = 0; j < filas.length; j++) {
      if (usada[j]) continue;
      if (CONC_iguales(filas[j].c, p.pagado, tol) || CONC_iguales(filas[j].d, p.pagado, tol)) {
        res[i].filas.push(filas[j]); res[i].metodo = 'valor'; usada[j] = true; return;
      }
    }
  });
  // 2) Las filas que sobran, por orden, a los contratos que quedaron sin pago
  var libres = [], j2;
  for (j2 = 0; j2 < filas.length; j2++) if (!usada[j2]) libres.push(j2);
  var k = 0;
  contratos.forEach(function (p, i) {
    if (res[i].filas.length || k >= libres.length) return;
    res[i].filas.push(filas[libres[k]]); res[i].metodo = 'orden'; usada[libres[k]] = true; k++;
  });
  // Filas que todavía sobran (más pagos que contratos): van al contrato con el valor más cercano
  libres.forEach(function (j) {
    if (usada[j]) return;
    var mejor = 0, dmin = Infinity;
    contratos.forEach(function (p, i) {
      if (p.pagado === null) return;
      var dd = Math.min(filas[j].c === null ? Infinity : Math.abs(filas[j].c - p.pagado), filas[j].d === null ? Infinity : Math.abs(filas[j].d - p.pagado));
      if (dd < dmin) { dmin = dd; mejor = i; }
    });
    res[mejor].filas.push(filas[j]); if (!res[mejor].metodo) res[mejor].metodo = 'orden'; usada[j] = true;
  });
  return res;
}

// Texto del estado para la fila de Consolidados, según el contrato al que se asignó
function CONC_textoFila(f) {
  var t0 = CONC_textoFilaBase(f);
  if (f.otraPersona && /^(Consolidado|Pagó de menos)/.test(t0)) {
    if (/^Consolidado/.test(t0)) return t0.replace(/^Consolidado/, 'Consolidado a nombre de otra persona');
    return t0 + ' · a nombre de otra persona';
  }
  return t0;
}

function CONC_textoFilaBase(f) {
  if (f.revisado && (f.estado === CONC_ESTADO.CONCILIADO || f.estado === CONC_ESTADO.POR_NOMBRE)) {
    return 'Consolidado · revisado ✔' + (f.ajuste && f.ajuste.nota ? ' · Nota: ' + String(f.ajuste.nota).slice(0, 150) : '');
  }
  if (f.estado === CONC_ESTADO.POR_NOMBRE) return CONC_ESTADO.POR_NOMBRE;
  if (f.estado === CONC_ESTADO.DIRECTO) return CONC_ESTADO.DIRECTO;
  if (f.valor === CONC_VALOR.ATIPICO) return CONC_ESTADO.CONCILIADO + ' · Protect!P atípico (revisar)';
  var t = CONC_ESTADO.CONCILIADO; // pagar de más no importa: solo "Consolidado"
  if (f.valor === CONC_VALOR.MAS_REVISAR) t += ' · pagó de más $' + String(Math.round(f.dif || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' (revisar Protect!P)';
  if (f.valor === CONC_VALOR.MENOS) {
    var falta = Math.abs(Math.round(f.dif || 0));
    t = CONC_VALOR.MENOS + ' · faltan $' + String(falta).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  if (f.porOrden) t += ' · por orden (revisar)';
  if (f.anuladoConPago) t += ' · contrato anulado (revisar)';
  if (f.ajuste && f.ajuste.nota) t += ' · Nota: ' + String(f.ajuste.nota).slice(0, 150);
  if (f.ajuste && f.ajuste.decision === 'Consolidado') t += ' · ajuste manual';
  return t;
}

function CONC_colorFila(t) {
  t = String(t).split(' · Nota:')[0];
  if (/^Consolidado a nombre de otra persona/.test(t) && !/revisar/.test(t)) return '#e4dcf5';   // la nota escrita por ti no cambia el color
  if (/^No es un pago/.test(t)) return '#e6e6e6';
  if (/^Pagó directo/.test(t)) return '#cfe2f3';
  if (/^Contrato anulado/.test(t)) return '#e6e6e6';
  if (/^Pagó de menos/.test(t)) return '#ea4335';
  if (/revisar|nombre/i.test(t)) return '#fce5cd';
  if (/^Sin registro/.test(t)) return '#e6e6e6';
  if (/más/.test(t)) return '#cfe2f3';
  return '#d9ead3';
}

function CONC_esEstadoPropio(v) {
  return /^(Consolidado|Pagó de menos|Pagó directo|Contrato anulado|Sin registro en Protect|No es un pago)/.test(String(v));
}

// Escribe SOLO las columnas F (estado) y G (# contrato de Protect) de Consolidado. No sobrescribe datos ajenos.
function CONC_escribirEstadoEnConsolidados(hoja, filasCons) {
  if (!CONC_ESCRIBIR_ESTADO_CONS || !filasCons.length) return { escrito: false };
  var ini = CONC_CONS_FILA_INICIO, n = hoja.getLastRow() - ini + 1;
  var colF = CONC_COL_ESTADO_CONS, colG = CONC_COL_CONTRATO_CONS, escribirG = CONC_ESCRIBIR_CONTRATO_CONS;

  // ---- Guardas (antes de escribir nada) ----
  var actualF = hoja.getRange(ini, colF, n, 1).getValues();
  for (var i = 0; i < actualF.length; i++) {
    var v = actualF[i][0];
    if (!CONC_vacio(v) && !CONC_esEstadoPropio(v)) {
      throw new Error('La columna F de "' + hoja.getName() + '" ya tiene datos que no son de esta automatización (fila ' + (ini + i) +
        ': "' + v + '"). No se sobrescribe. Muévelos o cambia CONC_COL_ESTADO_CONS.');
    }
  }
  var tituloF = hoja.getRange(ini - 1, colF).getValue();
  if (!CONC_vacio(tituloF) && tituloF !== CONC_TITULO_ESTADO_CONS) {
    throw new Error('El título de la columna F de "' + hoja.getName() + '" (fila ' + (ini - 1) + ') es "' + tituloF + '". No se sobrescribe.');
  }
  if (escribirG) {
    var tituloG = hoja.getRange(ini - 1, colG).getValue();
    if (!CONC_vacio(tituloG) && tituloG !== CONC_TITULO_CONTRATO_CONS) {
      throw new Error('El título de la columna G de "' + hoja.getName() + '" (fila ' + (ini - 1) + ') es "' + tituloG + '". No se sobrescribe.');
    }
    if (CONC_vacio(tituloG)) {
      var actualG = hoja.getRange(ini, colG, n, 1).getValues();
      for (var k = 0; k < actualG.length; k++) {
        if (!CONC_vacio(actualG[k][0])) {
          throw new Error('La columna G de "' + hoja.getName() + '" ya tiene datos (fila ' + (ini + k) + ': "' + actualG[k][0] +
            '"). No se sobrescribe. Vacíala o cambia CONC_COL_CONTRATO_CONS.');
        }
      }
    }
  }

  // Columna H (valor Dugo) e I (contrato manual). Antes la columna H era la del contrato manual: si ya tenía contratos escritos, se pasan a I.
  var colV = CONC_COL_VALOR_DUGO_CONS, colM = CONC_COL_CONTRATO_MANUAL, escribirV = CONC_ESCRIBIR_VALOR_DUGO_CONS;
  var moverAManual = null;
  if (escribirV) {
    var tituloV = hoja.getRange(ini - 1, colV).getValue();
    var datosV = hoja.getRange(ini, colV, n, 1).getValues();
    var hayV = datosV.some(function (x) { return !CONC_vacio(x[0]); });
    if (tituloV === CONC_TITULO_CONTRATO_MANUAL) {
      if (hayV) {
        var tituloM = hoja.getRange(ini - 1, colM).getValue();
        var datosM = hoja.getRange(ini, colM, n, 1).getValues();
        if ((!CONC_vacio(tituloM) && tituloM !== CONC_TITULO_CONTRATO_MANUAL) || datosM.some(function (x) { return !CONC_vacio(x[0]); })) {
          throw new Error('La columna H de "' + hoja.getName() + '" tiene contratos escritos a mano y la columna I no está libre para pasarlos. Vacía la columna I o mueve esos contratos.');
        }
        moverAManual = datosV;
      }
    } else if (tituloV !== CONC_TITULO_VALOR_DUGO_CONS) {
      if (!CONC_vacio(tituloV)) throw new Error('El título de la columna H de "' + hoja.getName() + '" (fila ' + (ini - 1) + ') es "' + tituloV + '". No se sobrescribe.');
      if (hayV) throw new Error('La columna H de "' + hoja.getName() + '" ya tiene datos. No se sobrescribe. Vacíala o cambia CONC_COL_VALOR_DUGO_CONS.');
    }
  }

  // ---- Escritura ----
  var estadoPorFila = {}, contratoPorFila = {};
  filasCons.forEach(function (r) { estadoPorFila[r.fila] = r.estadoFila || ''; contratoPorFila[r.fila] = r.contratoAsig || ''; });
  var textos = [], colores = [], fuentes = [], contratos = [], valoresDugo = [], valorPorFila = {};
  filasCons.forEach(function (r) { valorPorFila[r.fila] = r.valorDugo; });
  for (var m = 0; m < n; m++) {
    var t = estadoPorFila[ini + m] || '';
    textos.push([t]);
    colores.push([t ? CONC_colorFila(t) : null]);
    fuentes.push([/^Pagó de menos/.test(t) ? '#ffffff' : '#000000']);
    contratos.push([contratoPorFila[ini + m] || '']);
    var vd = valorPorFila[ini + m];
    valoresDugo.push([vd === null || vd === undefined || vd === '' ? '' : vd]);
  }
  hoja.getRange(ini - 1, colF).setValue(CONC_TITULO_ESTADO_CONS).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  hoja.getRange(ini, colF, n, 1).setValues(textos).setBackgrounds(colores).setFontColors(fuentes).setFontWeight('bold');
  if (escribirG) {
    hoja.getRange(ini - 1, colG).setValue(CONC_TITULO_CONTRATO_CONS).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
    var rg = hoja.getRange(ini, colG, n, 1);
    rg.setNumberFormat('@'); // texto, para que "1342-R" o "0061" no cambien
    rg.setValues(contratos).setFontWeight('bold').setHorizontalAlignment('center');
  }
  if (moverAManual) {
    hoja.getRange(ini, colM, n, 1).setNumberFormat('@').setValues(moverAManual);
    hoja.getRange(ini - 1, colM).setValue(CONC_TITULO_CONTRATO_MANUAL).setFontWeight('bold').setBackground('#d6a417').setFontColor('#13223f');
    hoja.getRange(ini, colV, n, 1).clearContent();
  }
  if (escribirV) {
    hoja.getRange(ini - 1, colV).setValue(CONC_TITULO_VALOR_DUGO_CONS).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
    var rv = hoja.getRange(ini, colV, n, 1);
    rv.setNumberFormat('$#,##0').setValues(valoresDugo).setFontWeight('bold').setFontColor('#13223f').setBackground(null).setHorizontalAlignment('right');
    try { hoja.showColumns(colV); hoja.setColumnWidth(colV, 190); } catch (e) {}
  }
  // Título de la columna donde tú escribes el contrato (solo si está vacío; las celdas de abajo nunca se tocan)
  var colH = CONC_COL_CONTRATO_MANUAL;
  if (colH && CONC_vacio(hoja.getRange(ini - 1, colH).getValue())) {
    hoja.getRange(ini - 1, colH).setValue(CONC_TITULO_CONTRATO_MANUAL).setFontWeight('bold').setBackground('#d6a417').setFontColor('#13223f');
  }
  var nValores = valoresDugo.filter(function (x) { return x[0] !== ''; }).length;
  var muestraH = '';
  if (escribirV) {
    try {
      SpreadsheetApp.flush();
      var primero = valoresDugo.findIndex ? valoresDugo.findIndex(function (x) { return x[0] !== ''; }) : -1;
      if (primero >= 0) muestraH = 'fila ' + (ini + primero) + ' = ' + hoja.getRange(ini + primero, colV).getDisplayValue() + ' (hoja "' + hoja.getName() + '")';
    } catch (e) { muestraH = 'no se pudo leer: ' + e.message; }
  }
  return { escrito: true, columna: colF, filas: Object.keys(estadoPorFila).length, contrato: escribirG, columnaManual: colH, valorDugo: escribirV, valoresDugo: nValores, muestraH: muestraH };
}

// Escribe SOLO la columna C (estado) de la hoja Protect, al frente de cada contrato. No toca ninguna otra columna ni fórmula.
function CONC_textoEstadoProtect(f) {
  if (f.estado === CONC_ESTADO.FALTA) return 'Falta por consolidar';
  if (f.estado === CONC_ESTADO.NO_APLICA) return 'No aplica · Anulado';
  if (f.estado === CONC_ESTADO.DIRECTO) return 'Pagó directo a Protect';
  var t = CONC_textoFila(f);
  if (f.ajuste && f.ajuste.nota) t = t.split(' · Nota:')[0];   // la nota no se repite aquí
  return t;
}

function CONC_colorEstadoProtect(t) {
  if (/^Falta/.test(t)) return '#f4cccc';
  if (/^No aplica/.test(t)) return '#e6e6e6';
  if (/^Pagó directo/.test(t)) return '#cfe2f3';
  return CONC_colorFila(t);
}

function CONC_escribirEstadoEnProtect(hoja, filasRes) {
  if (!CONC_ESCRIBIR_ESTADO_PROTECT) return { escrito: false };
  var col = CONC_COL_ESTADO_PROTECT, ini = CONC_filaInicioProtect(hoja), n = hoja.getLastRow() - ini + 1;
  if (n < 1) return { escrito: false };
  var titulo = hoja.getRange(ini - 1, col).getValue();
  var tituloNorm = CONC_normNombre(titulo), tituloPropio = (titulo === CONC_TITULO_ESTADO_PROTECT || tituloNorm === 'CONSOLIDADO');   // "Consolidado" es el título que ya tenías en Protect
  if (!CONC_vacio(titulo) && !tituloPropio) {
    throw new Error('El título de la columna C de "' + hoja.getName() + '" (fila ' + (ini - 1) + ') es "' + titulo + '". No se sobrescribe.');
  }
  var actual = hoja.getRange(ini, col, n, 1).getValues();
  // Un cero suelto (0, "0") o un espacio cuenta como celda vacía; cualquier otro dato que no sea de esta automatización se respeta
  var ajenas = [];
  for (var i = 0; i < actual.length; i++) {
    var v = actual[i][0];
    if (CONC_vacio(v) || String(v).trim() === '' || Number(v) === 0) continue;
    if (!CONC_vacio(titulo) && /^(Consolidado|Pagó de menos|Pagó directo|Falta por consolidar|No aplica|Sin registro)/.test(String(v))) continue;
    ajenas.push('fila ' + (ini + i) + ': "' + v + '"');
  }
  if (ajenas.length) {
    throw new Error('La columna C de "' + hoja.getName() + '" tiene ' + ajenas.length + ' celda(s) con datos que no son de esta automatización (' + ajenas.slice(0, 6).join(' · ') + (ajenas.length > 6 ? ' …' : '') + '). No se sobrescribe. Bórralas o vacía esas celdas.');
  }
  var porFila = {};
  filasRes.forEach(function (f) { if (f.filaProtect !== '' && f.filaProtect !== undefined && f.filaProtect !== null) porFila[f.filaProtect] = CONC_textoEstadoProtect(f); });
  var textos = [], colores = [], fuentes = [], cuenta = 0;
  for (var m = 0; m < n; m++) {
    var t = porFila[ini + m] || '';
    if (t) cuenta++;
    textos.push([t]);
    colores.push([t ? CONC_colorEstadoProtect(t) : null]);
    fuentes.push([/^Pagó de menos/.test(t) ? '#ffffff' : '#000000']);
  }
  if (CONC_vacio(titulo)) hoja.getRange(ini - 1, col).setValue(CONC_TITULO_ESTADO_PROTECT).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');   // si ya tienes título ("Consolidado") se respeta
  hoja.getRange(ini, col, n, 1).setValues(textos).setBackgrounds(colores).setFontColors(fuentes).setFontWeight('bold');
  try { hoja.setColumnWidth(col, 260); } catch (e) {}
  return { escrito: true, columna: col, filas: cuenta };
}

// Diagnóstico del cruce: ayuda a ver por qué las cédulas de las dos hojas coinciden o no
function CONC_diagnostico(protect, cons, filas) {
  var kp = {}, kc = {}, vacP = 0, vacC = 0;
  protect.forEach(function (p) { var k = CONC_normCedula(p.cedula); if (!k) vacP++; else kp[k] = true; });
  cons.forEach(function (r) { var k = CONC_normCedula(r.cedula); if (!k) vacC++; else kc[k] = true; });
  var coinc = 0, kcLista = Object.keys(kc);
  kcLista.forEach(function (k) { if (kp[k]) coinc++; });
  var muestraCons = [], muestraProt = [];
  filas.forEach(function (f) {
    if (f.estado === CONC_ESTADO.SIN_PROTECT && muestraCons.length < 12) {
      muestraCons.push({ fila: f.filaCons, original: String(f.cedula), normalizada: CONC_normCedula(f.cedula), cliente: f.clienteCons });
    }
    if (f.estado === CONC_ESTADO.FALTA && muestraProt.length < 12) {
      muestraProt.push({ fila: f.filaProtect, original: String(f.cedula), normalizada: CONC_normCedula(f.cedula), cliente: f.clienteProtect });
    }
  });
  return {
    protectFilas: protect.length, consFilas: cons.length,
    protectCedulas: Object.keys(kp).length, consCedulas: kcLista.length,
    protectSinCedula: vacP, consSinCedula: vacC, cedulasQueCoinciden: coinc,
    muestraConsSinCruce: muestraCons, muestraProtectSinCruce: muestraProt
  };
}

// Un Protect!P mucho mayor que el resto (unas 20 veces la mediana y más de $20 millones) es casi seguro un error
// de digitación o una fila de totales: no se compara contra el pago ni dispara la alarma de "pagó de menos".
function CONC_umbralAtipico(valores) {
  var v = valores.filter(function (x) { return x !== null && x > 0; }).sort(function (a, b) { return a - b; });
  if (v.length < 10) return Infinity;
  return Math.max(v[Math.floor(v.length / 2)] * 20, 20000000);
}

// ¿Pagó lo que era? Compara C y D de Consolidados contra Protect!P. No cambia el estado de consolidación.
function CONC_mejorValor(filas, pagado, tol) {
  filas.forEach(function (r) { r.c = CONC_sinCero(r.c); r.d = CONC_sinCero(r.d); });
  var vacio = function (r) { return r.c === null && r.d === null; };
  var conValor = filas.filter(function (r) { return !vacio(r); });
  var ultima = filas[filas.length - 1];
  if (pagado === null || !conValor.length) {
    var r0 = conValor.length ? conValor[conValor.length - 1] : ultima;
    return { r: r0, concordo: '', valor: CONC_VALOR.SIN_DATO, dif: null, difC: null, difD: null };
  }
  var mejor = null;
  conValor.forEach(function (r) {
    var difC = r.c === null ? null : r.c - pagado, difD = r.d === null ? null : r.d - pagado;
    var okC = difC !== null && Math.abs(difC) <= tol, okD = difD !== null && Math.abs(difD) <= tol;
    var usarC = difD === null || (difC !== null && Math.abs(difC) <= Math.abs(difD));
    var dif = (okC || okD) ? (okC ? difC : difD) : (usarC ? difC : difD);
    var cand = { r: r, difC: difC, difD: difD, dif: dif, ok: okC || okD, okC: okC, okD: okD, dist: Math.abs(dif) };
    if (!mejor || (cand.ok && !mejor.ok) || (cand.ok === mejor.ok && cand.dist < mejor.dist)) mejor = cand;
  });
  var valor = mejor.ok ? CONC_VALOR.COINCIDE : (mejor.dif > 0 ? CONC_VALOR.MAS : CONC_VALOR.MENOS);
  var concordo = mejor.ok ? (mejor.okC && mejor.okD ? 'C y D' : (mejor.okC ? 'C' : 'D')) : '';
  // Varios pagos del mismo contrato (cuotas): si ninguno alcanza por sí solo, se SUMAN los pagos de las filas
  // (en cada fila, C y D son el mismo pago visto dos veces: se toma el mayor, nunca se suman entre sí).
  if (!mejor.ok && conValor.length >= 2) {
    var total = 0;
    conValor.forEach(function (r) { total += Math.max(r.c === null ? 0 : r.c, r.d === null ? 0 : r.d); });
    var dif = total - pagado;
    return { r: mejor.r, concordo: '', valor: Math.abs(dif) <= tol ? CONC_VALOR.COINCIDE : (dif > 0 ? CONC_VALOR.MAS : CONC_VALOR.MENOS),
      dif: dif, difC: null, difD: null, suma: { n: conValor.length, total: total } };
  }
  return { r: mejor.r, concordo: concordo, valor: valor, dif: mejor.dif, difC: mejor.difC, difD: mejor.difD };
}

// ==================== HISTORIAL / SEGUIMIENTO ====================
var CONC_AJ_ENCABEZADOS = ['Clave', 'Decisión', 'Cédula', 'Cliente', 'Contrato', 'Nota', 'Fecha'];

var CONC_HIST_ENCABEZADOS = [
  'Clave', 'Cédula', 'Cliente', 'Contrato', 'Placa', 'Estado actual', 'Estado anterior',
  'Primera vez visto', 'Consolidado desde', 'Último cambio de estado', 'Última revisión', 'Corridas',
  'En última corrida', 'Desde línea base', 'Protect!P', 'C', 'D', 'Diferencia'
];

// Clave del seguimiento: un registro por contrato de Protect (así, si contabilidad manda después una fila
// con el valor correcto, es el MISMO contrato que pasa de pendiente a conciliado). Lo que no tiene contrato
// (filas solo de Consolidados o ambiguas) se sigue por cédula + valores.
function CONC_claveBase(f) {
  if (f.contrato) return 'P:' + f.contrato + '|' + CONC_normCedula(f.cedula);
  return 'X|' + CONC_normCedula(f.cedula) + '|' + (f.placa || '') + '|' + (f.c === null || f.c === undefined ? '' : f.c) + '|' + (f.d === null || f.d === undefined ? '' : f.d);
}

// De varias filas del mismo contrato, la que representa su estado: conciliada > menor diferencia > resto
function CONC_puntaje(f) {
  if (f.estado === CONC_ESTADO.CONCILIADO) return 0;
  return 1;
}

function CONC_aFecha(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  if (CONC_vacio(v)) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function CONC_fechaHoraTxt(d) {
  if (!d) return '';
  var z = function (n) { return (n < 10 ? '0' : '') + n; };
  return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

function CONC_leerHistorial(ss) {
  var hoja = ss.getSheetByName(CONC_HOJA_HISTORIAL);
  if (!hoja || hoja.getLastRow() < 1) return [];
  if (hoja.getRange(1, 1).getValue() !== CONC_HIST_ENCABEZADOS[0]) {
    throw new Error('Ya existe una hoja "' + CONC_HOJA_HISTORIAL + '" con otro contenido. No se sobrescribe; renómbrala o cambia CONC_HOJA_HISTORIAL.');
  }
  if (hoja.getLastRow() < 2) return [];
  var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, CONC_HIST_ENCABEZADOS.length).getValues();
  return datos.filter(function (r) { return !CONC_vacio(r[0]); }).map(function (r) {
    return {
      clave: String(r[0]), cedula: r[1], cliente: r[2], contrato: r[3], placa: r[4],
      estado: r[5], estadoAnterior: r[6],
      primeraVez: CONC_aFecha(r[7]), fechaConc: CONC_aFecha(r[8]), fechaEstado: CONC_aFecha(r[9]), ultimaVista: CONC_aFecha(r[10]),
      corridas: Number(r[11]) || 1, enUltima: r[12], desdeBase: r[13] === 'Sí',
      pagado: CONC_aNumero(r[14]), c: CONC_aNumero(r[15]), d: CONC_aNumero(r[16]), dif: CONC_aNumero(r[17])
    };
  });
}

// Pura (sin hojas): cruza el resultado actual con el historial previo. Agrega f.hist a cada fila.
function CONC_aplicarHistorial(filas, previos, ahora) {
  var DIA = 86400000;
  var corte = new Date(ahora.getTime() - CONC_DIAS_RECIENTE * DIA);
  var primeraCorrida = previos.length === 0;
  var prevMap = {}, registros = [], grupos = {}, orden = [];
  previos.forEach(function (h) { prevMap[h.clave] = h; });
  var ultimaAnterior = null;
  previos.forEach(function (h) { if (h.ultimaVista && (!ultimaAnterior || h.ultimaVista > ultimaAnterior)) ultimaAnterior = h.ultimaVista; });

  var resumen = { diasReciente: CONC_DIAS_RECIENTE, primeraCorrida: primeraCorrida, ultimaCorridaAnterior: CONC_fechaHoraTxt(ultimaAnterior),
    nuevos: 0, concRecientes: 0, cambios: 0, noAparecen: 0, pendientes: 0 };

  filas.forEach(function (f) {
    var k = CONC_claveBase(f);
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push(f);
  });

  orden.forEach(function (clave) {
    var fs = grupos[clave];
    var rep = fs.reduce(function (m, f) { return CONC_puntaje(f) < CONC_puntaje(m) ? f : m; }, fs[0]);
    var h = prevMap[clave], r;
    if (!h) {
      r = { clave: clave, estadoAnterior: '', primeraVez: ahora, fechaEstado: ahora, corridas: 1, desdeBase: primeraCorrida,
        fechaConc: (rep.estado === CONC_ESTADO.CONCILIADO && !primeraCorrida) ? ahora : null };
    } else {
      r = h;
      if (h.estado !== rep.estado) { r.estadoAnterior = h.estado; r.fechaEstado = ahora; }
      r.fechaConc = rep.estado === CONC_ESTADO.CONCILIADO
        ? (h.fechaConc || (h.desdeBase && h.estado === CONC_ESTADO.CONCILIADO ? null : ahora))
        : null;
      r.corridas = (h.corridas || 1) + 1;
    }
    r.cedula = rep.cedula; r.cliente = rep.clienteProtect || rep.clienteCons; r.contrato = rep.contrato; r.placa = rep.placa;
    r.estado = rep.estado; r.ultimaVista = ahora; r.enUltima = 'Sí';
    r.pagado = rep.pagado; r.c = rep.c; r.d = rep.d; r.dif = rep.dif;
    registros.push(r);

    var conc = rep.estado === CONC_ESTADO.CONCILIADO;
    var nuevoReciente = !r.desdeBase && r.primeraVez >= corte;
    var concReciente = !!(r.fechaConc && r.fechaConc >= corte);
    var cambioReciente = !!(r.estadoAnterior && r.fechaEstado >= corte);
    if (nuevoReciente) resumen.nuevos++;
    if (concReciente) resumen.concRecientes++;
    if (cambioReciente) resumen.cambios++;
    if (!conc && rep.estado !== CONC_ESTADO.DIRECTO && rep.estado !== CONC_ESTADO.NO_APLICA) resumen.pendientes++;
    var hist = {
      clave: clave, estadoContrato: rep.estado,
      primeraVez: CONC_fechaHoraTxt(r.primeraVez), fechaConc: CONC_fechaHoraTxt(r.fechaConc), estadoAnterior: r.estadoAnterior || '',
      fechaEstado: CONC_fechaHoraTxt(r.fechaEstado), desdeBase: r.desdeBase, corridas: r.corridas,
      diasPendiente: conc ? null : Math.floor((ahora - r.primeraVez) / DIA),
      diasEnConciliar: (conc && r.fechaConc) ? Math.floor((r.fechaConc - r.primeraVez) / DIA) : null,
      antesDelSeguimiento: conc && !r.fechaConc,
      nuevoReciente: nuevoReciente, concReciente: concReciente, cambioReciente: cambioReciente
    };
    fs.forEach(function (f) { f.hist = hist; });
  });

  // Registros del historial que ya no aparecen en esta corrida: se conservan
  previos.forEach(function (h) {
    if (grupos[h.clave]) return;
    h.enUltima = 'No'; resumen.noAparecen++;
    registros.push(h);
  });
  return { registros: registros, resumen: resumen };
}

function CONC_escribirHistorial(ss, registros) {
  var hoja = ss.getSheetByName(CONC_HOJA_HISTORIAL);
  if (!hoja) hoja = ss.insertSheet(CONC_HOJA_HISTORIAL);
  CONC_quitarFiltro(hoja);
  hoja.clear();
  hoja.getRange(1, 1, 1, CONC_HIST_ENCABEZADOS.length).setValues([CONC_HIST_ENCABEZADOS])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff').setWrap(true);
  hoja.setFrozenRows(1);
  if (!registros.length) return;
  var filas = registros.map(function (r) {
    return [r.clave, r.cedula, r.cliente, r.contrato, r.placa, r.estado, r.estadoAnterior || '',
      r.primeraVez || '', r.fechaConc || '', r.fechaEstado || '', r.ultimaVista || '', r.corridas,
      r.enUltima, r.desdeBase ? 'Sí' : '', CONC_celda(r.pagado), CONC_celda(r.c), CONC_celda(r.d), CONC_celda(r.dif)];
  });
  var n = filas.length;
  hoja.getRange(2, 1, n, 5).setNumberFormat('@');
  hoja.getRange(2, 1, n, CONC_HIST_ENCABEZADOS.length).setValues(filas);
  hoja.getRange(2, 8, n, 4).setNumberFormat('dd/mm/yyyy hh:mm');
  hoja.getRange(2, 15, n, 4).setNumberFormat('#,##0;-#,##0;0');
  hoja.setColumnWidths(2, 17, 120);
  hoja.setColumnWidth(1, 160);
  hoja.getRange(1, 1, n + 1, CONC_HIST_ENCABEZADOS.length).createFilter();
}

// Pagos de Protect!P muy por encima de lo normal (típico: una fila de totales o un número mal escrito)
function CONC_atipicos(filas) {
  var vistos = {}, unicos = [];
  filas.forEach(function (f) { if (f.filaProtect === '' || vistos[f.filaProtect]) return; vistos[f.filaProtect] = true; unicos.push(f); });
  var umbral = CONC_umbralAtipico(unicos.map(function (f) { return f.pagado; }));
  var out = unicos.filter(function (f) { return f.pagado !== null && f.pagado > umbral; }).map(function (f) {
    return { filaProtect: f.filaProtect, cliente: f.clienteProtect || f.clienteCons, contrato: f.contrato, placa: f.placa, pagado: f.pagado };
  });
  out.sort(function (a, b) { return b.pagado - a.pagado; });
  return out.slice(0, 15);
}

// ==================== ESCRITURA (solo en la hoja "Conciliacion_Dugo") ====================
function CONC_escribirResultado(ss, res) {
  var hoja = ss.getSheetByName(CONC_HOJA_RESULTADO);
  if (!hoja) {
    hoja = ss.insertSheet(CONC_HOJA_RESULTADO);
  } else if (hoja.getLastRow() > 0 && hoja.getRange(1, 1).getValue() !== CONC_ENCABEZADOS[0]) {
    // Seguridad: no pisar una hoja con ese nombre que no fue creada por esta automatización
    throw new Error('Ya existe una hoja "' + CONC_HOJA_RESULTADO + '" con otro contenido. No se sobrescribe; renómbrala o cambia CONC_HOJA_RESULTADO.');
  }
  hoja.clear();
  CONC_quitarFiltro(hoja);

  var filas = res.filas.map(function (s) {
    return [s.estado, s.cedula, s.clienteCons, s.clienteProtect, s.placa, s.contrato,
      CONC_celda(s.pagado), CONC_celda(s.c), CONC_celda(s.d),
      s.valor || '', CONC_celda(s.dif), CONC_celda(s.difC), CONC_celda(s.difD),
      s.cruce, s.filaCons, s.filaProtect, s.obs];
  });

  hoja.getRange(1, 1, 1, CONC_ENCABEZADOS.length).setValues([CONC_ENCABEZADOS])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff').setWrap(true);
  hoja.setFrozenRows(1);

  if (filas.length) {
    var rango = hoja.getRange(2, 1, filas.length, CONC_ENCABEZADOS.length);
    // Cédula, placa y contrato como texto para no perder ceros ni formato
    hoja.getRange(2, 2, filas.length, 1).setNumberFormat('@');
    hoja.getRange(2, 5, filas.length, 2).setNumberFormat('@');
    rango.setValues(filas);
    hoja.getRange(2, 7, filas.length, 3).setNumberFormat('#,##0');
    hoja.getRange(2, 11, filas.length, 3).setNumberFormat('#,##0;-#,##0;0');
    var colores = filas.map(function (f) { return [CONC_COLORES[f[0]] || '#ffffff']; });
    hoja.getRange(2, 1, filas.length, 1).setBackgrounds(colores);
    // Alarma: "Pagó de menos" en rojo fuerte (columna 10 = ¿Pagó lo que era?, 11 = diferencia)
    var coloresV = filas.map(function (f) { return [CONC_COLORES_VALOR[f[9]] || '#ffffff']; });
    hoja.getRange(2, 10, filas.length, 1).setBackgrounds(coloresV);
    var fuentes = filas.map(function (f) { return [f[9] === 'Pagó de menos' ? '#ffffff' : '#000000']; });
    hoja.getRange(2, 10, filas.length, 1).setFontColors(fuentes).setFontWeight('bold');
    hoja.getRange(1, 1, filas.length + 1, CONC_ENCABEZADOS.length).createFilter();
  }

  // Resumen a la derecha
  var colResumen = CONC_ENCABEZADOS.length + 2;
  var resumen = [['Resumen', 'Cantidad']];
  Object.keys(CONC_ESTADO).forEach(function (k) {
    resumen.push([CONC_ESTADO[k], res.resumen[CONC_ESTADO[k]] || 0]);
  });
  resumen.push(['Generado', new Date()]);
  hoja.getRange(1, colResumen, resumen.length, 2).setValues(resumen);
  hoja.getRange(1, colResumen, 1, 2).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  hoja.getRange(resumen.length, colResumen + 1).setNumberFormat('dd/mm/yyyy hh:mm');

  hoja.setColumnWidths(1, CONC_ENCABEZADOS.length, 120);
  hoja.setColumnWidth(3, 220); hoja.setColumnWidth(4, 220);
  hoja.setColumnWidth(CONC_ENCABEZADOS.length, 420);
}

// Una celda en 0 (vacía o con fórmula que da 0) no es un pago
function CONC_sinCero(n) { return n === 0 ? null : n; }

// Quita el filtro existente de una hoja propia (Google no deja crear un segundo filtro)
function CONC_quitarFiltro(hoja) {
  var f = hoja.getFilter();
  if (f) f.remove();
}

function CONC_texto(v) { return CONC_vacio(v) ? '' : String(v).trim(); }

// Fechas a texto dd/MM/yyyy (las fechas de Sheets no viajan bien a la pantalla)
function CONC_fechaTxt(v) {
  if (CONC_vacio(v)) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(v.getDate()) + '/' + z(v.getMonth() + 1) + '/' + v.getFullYear();
  }
  return String(v).trim();
}

function CONC_celda(v) { return v === null || v === undefined ? '' : v; }

// ==================== UTILIDADES ====================
function CONC_vacio(v) { return v === '' || v === null || v === undefined; }

function CONC_iguales(a, b, tol) {
  return a !== null && b !== null && Math.abs(a - b) <= tol;
}

// Convierte números y textos tipo "$ 1.234.567", "1,234,567", "1234567,50" a número. Vacío/no numérico => null
function CONC_aNumero(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (CONC_vacio(v)) return null;
  var s = String(v).replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || !/\d/.test(s)) return null;
  var neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  var punto = s.lastIndexOf('.');
  var coma = s.lastIndexOf(',');
  if (punto !== -1 && coma !== -1) {
    // El último separador es el decimal
    if (coma > punto) { s = s.replace(/\./g, '').replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
  } else if (punto !== -1 || coma !== -1) {
    var sep = punto !== -1 ? '.' : ',';
    var partes = s.split(sep);
    var miles = partes.length > 2 || partes[partes.length - 1].length === 3;
    s = miles ? partes.join('') : partes.join('.');
  }
  var n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// Un valor como 292.565 (tres decimales) en la columna P casi seguro es 292.565 pesos con el punto de miles mal leído: se toma como 292565
function CONC_corregirMiles(n) {
  if (n === null || n === undefined || isNaN(n)) return n;
  if (n > 0 && n < 10000 && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 && Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return Math.round(n * 1000);
  return n;
}

function CONC_normCedula(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).replace(/\.0+$/, '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  s = s.replace(/^(CC|CE|TI|NIT|NI|PA|PP|PEP|DNI)(?=\d)/, ''); // "CC 1033256529" => "1033256529"
  return s.replace(/^0+(?=\d)/, '');
}

// Placas y números de contrato: sin espacios, guiones ni puntos, en mayúsculas ("1342-R" = "1342 r" = "1342R")
function CONC_normClave(v) {
  if (CONC_vacio(v)) return '';
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function CONC_normNombre(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  var t = s.split(/\s+/).filter(function (x) { return x; });
  return t.sort().join(' ');
}

/**
 * PROTECT MOTOS — Pantalla web de la conciliación (Conciliacion_Dugo.html)
 *
 * IMPORTANTE: este archivo define doGet(), que ya existe en Codigo_cobros.gs.
 * Por eso debe ir en un proyecto de Apps Script APARTE (junto con
 * Conciliacion_Consolidados.gs y Conciliacion_Dugo.html), nunca en el de cobros.
 * Así no se toca el conector de cobros ni el de contratos.
 *
 * Este archivo va en el segundo archivo del proyecto (el "Sin título"). NO se pega en el archivo .html.
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Solo yo  (recomendado: la pantalla ve datos de pagos)
 */

// Clave para usar la conciliación desde el HTML local (Conciliacion_Dugo_Local.html)
var CONC_TOKEN = 'PM-CONC-3e97c3a8bb5298ef9d192391';

function CONC_doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'conciliar') return CONC_respuestaJsonp(params);
  if (params.action === 'ajustar') return CONC_respuestaAjuste(params);
  if (params.action === 'asignar') return CONC_respuestaAsignar(params);
  if (params.action === 'asignarlote') return CONC_respuestaAsignarLote(params);
  // Sin acción: solo confirma que el conector está activo (el HTML se abre desde el escritorio, no desde aquí)
  return ContentService.createTextOutput('Conector de Conciliación Dugo activo · versión v12')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Llamada desde la pantalla. Calcula, escribe la hoja "Conciliacion_Dugo" y devuelve los resultados.
 * @param {number|string} tolerancia pesos de diferencia aceptados (por defecto CONC_TOLERANCIA)
 */
function CONC_apiConciliar(tolerancia, rapido) {
  var tol = Number(tolerancia);
  if (tolerancia === '' || tolerancia === null || tolerancia === undefined || isNaN(tol) || tol < 0) {
    tol = CONC_TOLERANCIA;
  }

  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  var out = CONC_procesar(ss, tol, !!rapido);

  return {
    tolerancia: tol,
    hoja: CONC_HOJA_RESULTADO,
    hojaHistorial: CONC_HOJA_HISTORIAL,
    resumen: out.res.resumen,
    filas: out.res.filas,
    hist: out.hist,
    atipicos: out.atipicos,
    columnas: out.columnas,
    consMeses: out.consMeses,
    colMesAnio: out.colMesAnio,
    estadoEnHoja: out.estadoEnHoja,
    estadosAR: out.estadosAR,
    estadoProtect: out.estadoProtect,
    capacidades: out.capacidades,
    version: 'v12',
    rapido: !!rapido,
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
      salida = { ok: true, data: CONC_apiConciliar(params.tolerancia, params.rapido === '1') };
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
      salida = { ok: true, data: { guardado: r, datos: params.rapido === '1' ? CONC_apiConciliar(params.tolerancia, true) : null } };
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
      var ra = CONC_apiAsignar(params.clavePago, params.contrato, params.cedula, params.cliente, params.c, params.d);
      salida = { ok: true, data: { guardado: ra, datos: params.rapido === '1' ? CONC_apiConciliar(params.tolerancia, true) : null } };
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
      var rl = CONC_guardarAsignaciones(SpreadsheetApp.openById(CONC_SHEET_ID), lista);
      salida = { ok: true, data: { guardado: rl, datos: params.rapido === '1' ? CONC_apiConciliar(params.tolerancia, true) : null } };
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


// ========================================================================
// ENRUTADOR
// ========================================================================
var UNICO_RUTAS = {
  'PM-COBROS-2026': 'PM_Cobros',
  'PM-CRM-2026': 'PM_CRM',
  'PM-OMS-2026': 'PM_OMS',
  'PM-SOAT-2026': 'PM_SOAT',
  'PM-9K3ZQ-2026': 'PM_Contratos',
  'PM-CONC-3e97c3a8bb5298ef9d192391': 'CONC'
};

var UNICO_MODS = { PM_Cobros: PM_Cobros, PM_CRM: PM_CRM, PM_OMS: PM_OMS, PM_SOAT: PM_SOAT, PM_Contratos: PM_Contratos };

function UNICO_modulo(token) { return UNICO_RUTAS[String(token || '')] || ''; }

function UNICO_texto(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var m = UNICO_modulo(p.token);
  if (m === 'CONC') return CONC_doGet(e);
  if (m) return UNICO_MODS[m].doGet(e);
  if (p.token) {   // clave que ninguno de los conectores conoce: mismo aviso que daban ellos
    var salida = JSON.stringify({ ok: false, error: 'Token inválido.' });
    return ContentService.createTextOutput(p.callback ? p.callback + '(' + salida + ')' : salida)
      .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
  // Sin clave: solo confirma que está activo (los textos de abajo los reconocen las pantallas)
  return UNICO_texto('Conector Protect Motos activo ✔ · Conector único ' + UNICO_VERSION +
    ' · Conciliación Dugo activa · versión v12 · módulos: Cobros, CRM, Clientes OMS, SOAT, Contratos, Conciliación');
}

function doPost(e) {
  var body = {};
  try { body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {}; } catch (x) {}
  var m = UNICO_modulo(body.token);
  if (m && m !== 'CONC' && UNICO_MODS[m] && UNICO_MODS[m].doPost) return UNICO_MODS[m].doPost(e);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: m ? 'Este conector no recibe esa petición.' : 'Token inválido.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Funciones para ejecutar a mano desde el editor ----
function AUTORIZAR_TODO() {   // ejecútela UNA vez: pide los permisos de Hojas de cálculo y Drive
  SpreadsheetApp.openById('1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04').getName();
  DriveApp.getRootFolder().getName();
  LockService.getScriptLock();
  return 'Permisos listos. Ya puede publicar la aplicación web.';
}
function COBROS_pruebaDrive() { return PM_Cobros.pruebaDrive(); }
function OMS_autorizarPermisos() { return PM_OMS.autorizarPermisos(); }
function CONTRATOS_diagnostico() { return PM_Contratos.diagnostico(); }

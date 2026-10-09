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
    return { estadoProtect: estadoProtect, estadosAR: estadosAR, diag: CONC_diagnostico(protect, lectura.filas, res.filas), estadoEnHoja: estadoEnHoja, res: res, hist: ah.resumen, atipicos: CONC_atipicos(res.filas), columnas: columnas };
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
        estadoCliente: CONC_texto(f[CONC_P_INFO.ESTADO_CLIENTE - 1]).toUpperCase()
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
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    if (CONC_vacio(f[0]) && CONC_vacio(f[1]) && CONC_vacio(f[2]) && CONC_vacio(f[3])) continue;
    filas.push({
      fila: CONC_CONS_FILA_INICIO + i,
      cedula: f[0], cliente: f[1],
      c: CONC_sinCero(CONC_corregirMiles(CONC_aNumero(f[2]))), d: CONC_sinCero(CONC_corregirMiles(CONC_aNumero(f[3]))),
      extra: f.slice(4)
    });
  }
  return { filas: filas, encabezados: encabezados };
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
      f.filaCons = a.filas.map(function (r) { return r.fila; }).join(', ');
      var notas = ['Aparece en Consolidados (' + a.filas.length + (a.filas.length === 1 ? ' fila' : ' filas') + ': ' + f.filaCons + ').'];
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
var CONC_ASIG_ENCABEZADOS = ['ClavePago', 'Contrato asignado', 'Cédula', 'Cliente', 'Valor C', 'Valor D', 'Fecha'];

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
  datos.forEach(function (r) { if (!CONC_vacio(r[0]) && !CONC_vacio(r[1])) out[String(r[0])] = { contrato: String(r[1]) }; });
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
      d.c === undefined || d.c === null ? '' : d.c, d.d === undefined || d.d === null ? '' : d.d, new Date()]]);
    hoja.getRange(fila, 7).setNumberFormat('dd/mm/yyyy hh:mm');
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
  f.ajuste = { decision: aj.decision, nota: aj.nota || '', fecha: aj.fecha || '' };
  var nota = aj.nota ? ' Nota: ' + aj.nota : '';
  if (aj.decision === 'Nota') {
    f.obs = (f.obs ? f.obs + ' ' : '') + 'Nota: ' + (aj.nota || '(vacía)');
  } else if (aj.decision === 'Falta') {
    f.estado = CONC_ESTADO.FALTA; f.valor = ''; f.dif = null; f.difC = null; f.difD = null; f.concordo = '';
    f.asignacion = ''; f.porOrden = false;
    f.obs = 'Ajuste manual: marcado como "Falta por consolidar" (lo que aparece en Consolidado no es un pago).' + nota;
    (filasAsignadas || []).forEach(function (r) { r.estadoFila = 'No es un pago · ajuste manual'; });
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
  t = String(t).split(' · Nota:')[0];   // la nota escrita por ti no cambia el color
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

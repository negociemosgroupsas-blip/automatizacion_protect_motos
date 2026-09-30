/**
 * PROTECT MOTOS — Conciliación de pagos contra "Consolidados"
 *
 * Archivo INDEPENDIENTE: no modifica ni depende de Codigo_cobros.gs.
 * Todas las funciones y constantes llevan el prefijo CONC_ para no chocar con las existentes.
 * No crea triggers. Se ejecuta a mano: elegir CONC_conciliar y pulsar "Ejecutar".
 *
 * Solo LEE las hojas "Protect" y "Consolidados".
 * Solo ESCRIBE en dos hojas propias (las crea si no existen):
 *   - "Conciliacion_Dugo": foto actual, se reescribe en cada corrida.
 *   - "Historial_Conciliacion": seguimiento permanente (desde cuándo está conciliado cada pago, cuánto lleva pendiente).
 *
 * Regla: Protect!P (valor pagado a Dugo Motos) se compara por separado con
 * Consolidados!C y Consolidados!D. Nunca se suman. Si alguna concuerda => Conciliado.
 * La columna O de Protect NO se usa.
 */

// ==================== CONFIGURACIÓN ====================
var CONC_SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var CONC_HOJA_PROTECT = 'Protect';
var CONC_HOJA_CONSOLIDADOS = 'Consolidados';
var CONC_HOJA_RESULTADO = 'Conciliacion_Dugo';

var CONC_HOJA_HISTORIAL = 'Historial_Conciliacion';
var CONC_DIAS_RECIENTE = 7; // ventana para "conciliados / nuevos / cambios de la semana"

var CONC_TOLERANCIA = 0; // pesos de diferencia aceptados para considerar "Conciliado"

// Protect: fila 1 = encabezados. Columnas (base 1): E, H, M, N, P
var CONC_PROTECT_FILA_INICIO = 2;
var CONC_P = { CEDULA: 5, CLIENTE: 8, PLACA: 13, CONTRATO: 14, PAGADO_DUGO: 16 };
// Columnas de Protect que solo se MUESTRAN como información del cliente (no intervienen en la conciliación)
var CONC_P_INFO = { ASESOR: 2, FECHA_FIRMA: 11, FIN: 12, CUOTA: 17, PLAZO: 18, FORMA: 20, CELULAR: 31, ESTADO_CLIENTE: 44 };

// Consolidados: fila 1 = fórmulas (se ignora), fila 2 = encabezados, datos desde la 3. A, B, C, D
var CONC_CONS_FILA_INICIO = 3;

var CONC_ESTADO = {
  CONCILIADO: 'Conciliado',
  MAS: 'Pagó de más',
  MENOS: 'Pagó de menos',
  SIN_VALOR_CONT: 'Sin valor de contabilidad',
  SIN_VALOR_PROTECT: 'Sin valor en Protect!P',
  SIN_CONS: 'Sin registro en Consolidados',
  SIN_PROTECT: 'Sin registro en Protect',
  AMBIGUO: 'Ambiguo (revisar)'
};

var CONC_COLORES = {
  'Conciliado': '#d9ead3',
  'Pagó de más': '#fff2cc',
  'Pagó de menos': '#f4cccc',
  'Sin valor de contabilidad': '#e6e6e6',
  'Sin valor en Protect!P': '#e6e6e6',
  'Sin registro en Consolidados': '#fce5cd',
  'Sin registro en Protect': '#fce5cd',
  'Ambiguo (revisar)': '#d9d2e9'
};

var CONC_ENCABEZADOS = [
  'Estado', 'Cédula', 'Cliente (Consolidados)', 'Cliente (Protect)', 'Placa', 'Contrato',
  'Protect!P (pagado a Dugo Motos)', 'Consolidados C', 'Consolidados D',
  'Concordó con', 'Diferencia (valor usado − P)', 'Diferencia C − P', 'Diferencia D − P',
  'Cruce', 'Fila Consolidados', 'Fila Protect', 'Observación'
];

// ==================== PUNTO DE ENTRADA ====================
function CONC_conciliar() {
  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  var out = CONC_procesar(ss, CONC_TOLERANCIA);
  Logger.log('Conciliación lista: ' + JSON.stringify(out.res.resumen) + ' | seguimiento: ' + JSON.stringify(out.hist));
}

// Lee, concilia, actualiza el historial y escribe las hojas propias. Lo usan la ejecución manual y la pantalla web.
function CONC_procesar(ss, tol) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otra conciliación en curso. Espera un minuto y vuelve a intentar.');
  try {
    var hojaProtect = CONC_buscarHoja(ss, CONC_HOJA_PROTECT);
    var hojaCons = CONC_buscarHoja(ss, CONC_HOJA_CONSOLIDADOS);
    var res = CONC_calcular(CONC_leerProtect(hojaProtect), CONC_leerConsolidados(hojaCons), tol);
    var previos = CONC_leerHistorial(ss);
    var ah = CONC_aplicarHistorial(res.filas, previos, new Date());
    CONC_escribirResultado(ss, res);
    CONC_escribirHistorial(ss, ah.registros);
    return { res: res, hist: ah.resumen, atipicos: CONC_atipicos(res.filas) };
  } finally {
    lock.releaseLock();
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
function CONC_leerProtect(hoja) {
  var ultima = hoja.getLastRow();
  if (ultima < CONC_PROTECT_FILA_INICIO) return [];
  var n = ultima - CONC_PROTECT_FILA_INICIO + 1;
  var anchoLectura = Math.min(Math.max(CONC_P_INFO.ESTADO_CLIENTE, CONC_P.PAGADO_DUGO), hoja.getLastColumn());
  var datos = hoja.getRange(CONC_PROTECT_FILA_INICIO, 1, n, anchoLectura).getValues();
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
      fila: CONC_PROTECT_FILA_INICIO + i,
      cedula: cedula, cliente: cliente, placa: placa, contrato: contrato,
      pagado: CONC_aNumero(pagado),
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
  if (ultima < CONC_CONS_FILA_INICIO) return [];
  var n = ultima - CONC_CONS_FILA_INICIO + 1;
  var datos = hoja.getRange(CONC_CONS_FILA_INICIO, 1, n, 4).getValues();
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    if (CONC_vacio(f[0]) && CONC_vacio(f[1]) && CONC_vacio(f[2]) && CONC_vacio(f[3])) continue;
    filas.push({
      fila: CONC_CONS_FILA_INICIO + i,
      cedula: f[0], cliente: f[1],
      c: CONC_aNumero(f[2]), d: CONC_aNumero(f[3])
    });
  }
  return filas;
}

// ==================== LÓGICA (pura, sin acceso a hojas) ====================
function CONC_calcular(protect, cons, tol) {
  var porCedula = {};
  var porNombre = {};
  protect.forEach(function (p) {
    p.kCed = CONC_normCedula(p.cedula);
    p.kNom = CONC_normNombre(p.cliente);
    p.usada = false;
    if (p.kCed) (porCedula[p.kCed] = porCedula[p.kCed] || []).push(p);
    if (p.kNom) (porNombre[p.kNom] = porNombre[p.kNom] || []).push(p);
  });

  var salida = [];

  cons.forEach(function (r) {
    var kCed = CONC_normCedula(r.cedula);
    var cruce = 'Cédula';
    var cands = kCed ? (porCedula[kCed] || []) : [];
    if (!cands.length) {
      var kNom = CONC_normNombre(r.cliente);
      cands = kNom ? (porNombre[kNom] || []) : [];
      cruce = 'Nombre (revisar)';
    }

    if (!cands.length) {
      salida.push(CONC_filaSalida(CONC_ESTADO.SIN_PROTECT, r, null, null, cruce === 'Nombre (revisar)' ? 'Sin cruce' : cruce,
        'No aparece en Protect por cédula ni por nombre.'));
      return;
    }

    if (cands.length === 1) {
      var unico = cands[0];
      unico.usada = true;
      salida.push(CONC_evaluar(r, unico, tol, cruce, ''));
      return;
    }

    // Varias motos con la misma cédula/nombre: solo se asigna si C o D concuerda con UNA sola
    var coinciden = cands.filter(function (p) {
      return p.pagado !== null && (CONC_iguales(r.c, p.pagado, tol) || CONC_iguales(r.d, p.pagado, tol));
    });
    cands.forEach(function (p) { p.usada = true; });
    if (coinciden.length === 1) {
      salida.push(CONC_evaluar(r, coinciden[0], tol, cruce, 'Varias motos con este cliente; asignado por coincidencia exacta de valor.'));
    } else {
      var lista = cands.map(function (p) {
        return 'placa ' + (p.placa || '?') + ' / contrato ' + (p.contrato || '?') + ' / P=' + (p.pagado === null ? 'vacío' : p.pagado) + ' (fila ' + p.fila + ')';
      }).join(' | ');
      salida.push(CONC_filaSalida(CONC_ESTADO.AMBIGUO, r, null, null, cruce,
        (coinciden.length > 1 ? 'Varias motos con el mismo valor. ' : 'Ninguna moto concuerda con C ni D. ') + 'Candidatas: ' + lista));
    }
  });

  // Filas de Protect que nadie reclamó
  protect.forEach(function (p) {
    if (p.usada) return;
    salida.push({
      estado: CONC_ESTADO.SIN_CONS, cedula: p.cedula, clienteCons: '', clienteProtect: p.cliente,
      placa: p.placa, contrato: p.contrato, pagado: p.pagado, c: null, d: null,
      concordo: '', dif: null, difC: null, difD: null, cruce: '', filaCons: '', filaProtect: p.fila,
      obs: 'Está en Protect pero no en Consolidados.', extra: p.extra || null
    });
  });

  // Orden del historial: como están en Protect; lo que no está en Protect va al final
  salida.forEach(function (x, i) { x._i = i; });
  salida.sort(function (a, b) {
    var fa = a.filaProtect === '' ? Infinity : a.filaProtect;
    var fb = b.filaProtect === '' ? Infinity : b.filaProtect;
    return fa === fb ? a._i - b._i : (fa < fb ? -1 : 1);
  });
  salida.forEach(function (x) { delete x._i; });

  var resumen = {};
  salida.forEach(function (s) { resumen[s.estado] = (resumen[s.estado] || 0) + 1; });
  return { filas: salida, resumen: resumen };
}

function CONC_evaluar(r, p, tol, cruce, obs) {
  if (p.pagado === null) {
    return CONC_filaSalida(CONC_ESTADO.SIN_VALOR_PROTECT, r, p, null, cruce, obs || 'Protect!P está vacío o no es numérico.');
  }
  if (r.c === null && r.d === null) {
    return CONC_filaSalida(CONC_ESTADO.SIN_VALOR_CONT, r, p, null, cruce, obs || 'C y D vacías en Consolidados.');
  }
  var difC = r.c === null ? null : r.c - p.pagado;
  var difD = r.d === null ? null : r.d - p.pagado;
  var okC = difC !== null && Math.abs(difC) <= tol;
  var okD = difD !== null && Math.abs(difD) <= tol;

  var estado, concordo, dif;
  if (okC || okD) {
    estado = CONC_ESTADO.CONCILIADO;
    concordo = okC && okD ? 'C y D' : (okC ? 'C' : 'D');
    dif = okC ? difC : difD;
  } else {
    // Ninguna concuerda: se usa la más cercana (empate => C)
    var usarC = difD === null || (difC !== null && Math.abs(difC) <= Math.abs(difD));
    dif = usarC ? difC : difD;
    concordo = usarC ? 'Ninguna (más cercana: C)' : 'Ninguna (más cercana: D)';
    estado = dif > 0 ? CONC_ESTADO.MAS : CONC_ESTADO.MENOS;
  }
  var fila = CONC_filaSalida(estado, r, p, null, cruce, obs);
  fila.concordo = concordo;
  fila.dif = dif;
  fila.difC = difC;
  fila.difD = difD;
  return fila;
}

function CONC_filaSalida(estado, r, p, _reservado, cruce, obs) {
  return {
    estado: estado,
    cedula: r.cedula,
    clienteCons: r.cliente,
    clienteProtect: p ? p.cliente : '',
    placa: p ? p.placa : '',
    contrato: p ? p.contrato : '',
    pagado: p ? p.pagado : null,
    c: r.c, d: r.d,
    concordo: '', dif: null, difC: null, difD: null,
    cruce: cruce,
    filaCons: r.fila,
    filaProtect: p ? p.fila : '',
    obs: obs || '',
    extra: p ? (p.extra || null) : null
  };
}


// ==================== HISTORIAL / SEGUIMIENTO ====================
var CONC_HIST_ENCABEZADOS = [
  'Clave', 'Cédula', 'Cliente', 'Contrato', 'Placa', 'Estado actual', 'Estado anterior',
  'Primera vez visto', 'Conciliado desde', 'Último cambio de estado', 'Última revisión', 'Corridas',
  'En última corrida', 'Desde línea base', 'Protect!P', 'C', 'D', 'Diferencia'
];

// Clave del seguimiento: un registro por contrato de Protect (así, si contabilidad manda después una fila
// con el valor correcto, es el MISMO contrato que pasa de pendiente a conciliado). Lo que no tiene contrato
// (filas solo de Consolidados o ambiguas) se sigue por cédula + valores.
function CONC_claveBase(f) {
  if (f.contrato) return 'P:' + f.contrato + '|' + CONC_normCedula(f.cedula);
  return 'X|' + CONC_normCedula(f.cedula) + '|' + (f.c === null || f.c === undefined ? '' : f.c) + '|' + (f.d === null || f.d === undefined ? '' : f.d);
}

// De varias filas del mismo contrato, la que representa su estado: conciliada > menor diferencia > resto
function CONC_puntaje(f) {
  if (f.estado === CONC_ESTADO.CONCILIADO) return 0;
  if ((f.estado === CONC_ESTADO.MAS || f.estado === CONC_ESTADO.MENOS) && f.dif !== null) return 1 + Math.abs(f.dif) / 1e13;
  return 2;
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
    if (!conc) resumen.pendientes++;
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
  hoja.autoResizeColumns(2, 17);
  hoja.setColumnWidth(1, 160);
  hoja.getRange(1, 1, n + 1, CONC_HIST_ENCABEZADOS.length).createFilter();
}

// Pagos de Protect!P muy por encima de lo normal (típico: una fila de totales o un número mal escrito)
function CONC_atipicos(filas) {
  var vals = filas.filter(function (f) { return f.pagado > 0; }).map(function (f) { return f.pagado; }).sort(function (a, b) { return a - b; });
  if (vals.length < 10) return [];
  var mediana = vals[Math.floor(vals.length / 2)];
  var umbral = mediana * 20;
  var vistos = {}, out = [];
  filas.forEach(function (f) {
    if (!(f.pagado > umbral) || vistos[f.filaProtect]) return;
    vistos[f.filaProtect] = true;
    out.push({ filaProtect: f.filaProtect, cliente: f.clienteProtect || f.clienteCons, contrato: f.contrato, placa: f.placa, pagado: f.pagado });
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
  if (hoja.getFilter()) hoja.getFilter().remove();

  var filas = res.filas.map(function (s) {
    return [s.estado, s.cedula, s.clienteCons, s.clienteProtect, s.placa, s.contrato,
      CONC_celda(s.pagado), CONC_celda(s.c), CONC_celda(s.d),
      s.concordo, CONC_celda(s.dif), CONC_celda(s.difC), CONC_celda(s.difD),
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

  hoja.autoResizeColumns(1, CONC_ENCABEZADOS.length);
  hoja.setColumnWidth(CONC_ENCABEZADOS.length, 420);
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

function CONC_normCedula(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return s.replace(/^0+(?=\d)/, '');
}

function CONC_normNombre(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  var t = s.split(/\s+/).filter(function (x) { return x; });
  return t.sort().join(' ');
}

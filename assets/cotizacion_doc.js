/* PROTECT MOTOS — Documento de la cotización de renovación (PDF / imagen).
   Construye una hoja carta con el logo, los datos del cliente, las dos opciones (contado y financiado) y las coberturas.
   El PDF se genera con «Imprimir → Guardar como PDF» del navegador (igual que los contratos); la imagen se dibuja localmente. */
(function(w){
  'use strict';
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }

  /* ---- Coberturas por defecto (se pueden editar en el formulario y quedan guardadas en el navegador) ---- */
  var RC_PM = ['Daños a bienes de terceros','Lesiones o muerte a 1 persona','Lesiones o muerte a 2 o más personas','Amparo patrimonial','Muerte accidental (para el conductor)','Asistencia jurídica en proceso penal','Asistencia jurídica en proceso civil','Gastos médicos (hasta 4 eventos)'];
  var AP_PM = ['Muerte accidental: $5.000.000','Incapacidad total por accidente: $5.000.000','Auxilio por pérdida de documentos: $100.000','Grúa por accidente: $300.000','Paso de corriente: $50.000','Suministro de combustible: $50.000','Despinche (llanta sellomática): $50.000'];
  var BASE_PM = ['Pérdida total por hurto','Pérdida total por daños','Cubre el 80 % del valor de la moto'];
  var SURA = ['Responsabilidad Civil Extracontractual (límite global): $840.000.000','Deducible pérdida total por daños: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por daños: deducible único 0,5 SMMLV','Deducible pérdida total por hurto: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por hurto: deducible único 0,5 SMMLV','Deducible ante eventos de la naturaleza (temblor, terremoto): deducible único 0,5 SMMLV','Amparo patrimonial: sí cubre','Asistencia jurídica en procesos penales y civiles: sí cubre','Asistencia en viaje: asistencia de motos'];
  var DEFECTO = {
    'Protect Motos': { op1: BASE_PM, op2: BASE_PM.concat(['— Responsabilidad civil —']).concat(RC_PM).concat(['— Asistencias —']).concat(AP_PM) },
    'Sura': { op1: SURA.slice(1,5).concat([SURA[7]]), op2: SURA }
  };
  var CLAVE = 'pm_cot_cobert';
  function leerGuardadas(){ try{ return JSON.parse(localStorage.getItem(CLAVE)||'{}')||{}; }catch(e){ return {}; } }
  function coberturas(aseg, op){
    var g = leerGuardadas(), k = aseg+'|'+op;
    if(g[k] && g[k].length) return g[k];
    var d = DEFECTO[aseg] || DEFECTO['Protect Motos'];
    return (d[op]||[]).slice();
  }
  function guardarCoberturas(aseg, op, lista){ var g = leerGuardadas(); g[aseg+'|'+op] = lista; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }
  function restaurarCoberturas(aseg){ var g = leerGuardadas(); delete g[aseg+'|op1']; delete g[aseg+'|op2']; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }

  /* ---- Estilos del documento (estilo afiche: fondo azul, tarjetas redondeadas, títulos en cápsula) ---- */
  var CSS = [
    '@page{size:letter;margin:8mm}',
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    'body{margin:0;background:#fff;color:#13223f;font-family:Arial,Helvetica,sans-serif}',
    '.doc{font-family:Arial,Helvetica,sans-serif;width:794px;margin:0 auto;padding:26px 28px 24px;font-size:13px;line-height:1.45;color:#fff;border-radius:26px;position:relative;overflow:hidden;',
      'background:radial-gradient(circle at 90% 4%,rgba(255,255,255,.28),rgba(255,255,255,0) 34%),radial-gradient(circle at 4% 62%,rgba(255,255,255,.16),rgba(255,255,255,0) 30%),linear-gradient(165deg,#0b63c9 0%,#1596e0 52%,#0a4fae 100%)}',
    '.sup{display:flex;justify-content:space-between;align-items:center;gap:14px}',
    '.logo{background:#fff;border-radius:999px;padding:7px 18px;display:flex;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.18)} .logo img{height:58px;width:auto;display:block}',
    '.fecha{font-size:12px;text-align:right;opacity:.95;line-height:1.5} .fecha b{display:block;font-size:13px}',
    '.marco{margin-top:14px;border:2px solid rgba(255,255,255,.7);border-radius:26px;padding:16px 16px 14px}',
    '.over{text-align:center;letter-spacing:.38em;font-weight:700;font-size:13px;margin:0 0 8px;padding-left:.38em}',
    '.titulo{background:#0b2a6b;border-radius:20px 20px 20px 4px;padding:14px 22px;text-align:left;box-shadow:0 6px 16px rgba(0,0,0,.22)}',
    '.titulo b{display:block;font-size:36px;line-height:1.05;letter-spacing:.5px;font-weight:900} .titulo small{display:block;margin-top:4px;font-size:13px;opacity:.9}',
    '.saludo{margin:12px 4px 10px;font-size:13.5px} .saludo b{color:#ffd54a}',
    '.pills{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px}',
    '.pill{background:#fff;color:#0b2a6b;border-radius:999px;padding:7px 14px;display:flex;align-items:center;gap:9px;font-size:13px;box-shadow:0 3px 8px rgba(0,0,0,.12)}',
    '.pill i{flex:0 0 26px;height:26px;border-radius:50%;background:#0b63c9;color:#fff;font-style:normal;text-align:center;line-height:26px;font-size:14px} .pill span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#5f6882;line-height:1.1} .pill b{display:block;font-size:14px;line-height:1.2}',
    '.aseg{margin:12px 0 0;display:inline-block;background:#ffc928;color:#0b2a6b;border-radius:999px;padding:5px 18px;font-weight:800;font-size:13px;box-shadow:0 3px 8px rgba(0,0,0,.18)}',
    '.op{margin-top:14px;background:#fff;color:#13223f;border-radius:22px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.2);page-break-inside:avoid}',
    '.op h3{margin:0;background:#0b2a6b;color:#fff;padding:11px 18px;font-size:15px;letter-spacing:.3px;border-radius:0 0 18px 0;display:inline-block;max-width:92%}',
    '.op h3 small{font-weight:400;opacity:.9;margin-left:8px;font-size:12.5px;color:#ffd54a}',
    '.pre{display:grid;grid-template-columns:1fr 1.15fr;gap:10px;padding:12px 14px 6px}',
    '.pre>div{border-radius:16px;padding:10px 14px}',
    '.pre>div:first-child{background:#ffc928;color:#0b2a6b} .pre>div:last-child{background:#e3f2fd;color:#0b2a6b}',
    '.pre span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:800;opacity:.85} .pre b{display:block;font-size:26px;line-height:1.1;margin:3px 0;font-weight:900} .pre small{display:block;font-size:12px;opacity:.9}',
    '.cob{padding:8px 14px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}',
    '.cob div{display:flex;gap:9px;align-items:center;font-size:12.5px;background:#eef6ff;border-radius:999px;padding:5px 12px 5px 6px;color:#0b2a6b;min-height:30px} .cob i{flex:0 0 21px;height:21px;border-radius:50%;background:#0b63c9;color:#fff;font-style:normal;font-size:12px;text-align:center;line-height:21px}',
    '.cob div span{line-height:1.25}',
    '.cob .sec{grid-column:1/-1;background:#0b63c9;color:#fff;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:.5px;text-transform:uppercase;padding:5px 14px;margin-top:4px;min-height:0;display:block}',
    '.cta{margin-top:16px;display:flex;align-items:center;gap:14px;background:#0b2a6b;border-radius:22px;padding:12px 16px;box-shadow:0 6px 16px rgba(0,0,0,.22)}',
    '.cta .tx{flex:1} .cta .tx b{display:block;font-size:18px;letter-spacing:.3px} .cta .tx span{font-size:12.5px;opacity:.92}',
    '.cta .ph{background:#fff;color:#0b2a6b;border-radius:999px;padding:8px 18px;font-weight:900;font-size:17px;white-space:nowrap}',
    '.cta .bt{background:#ffc928;color:#0b2a6b;border-radius:14px;padding:10px 20px;font-weight:900;font-size:15px;font-style:italic;white-space:nowrap}',
    '.nota{margin:12px 6px 0;font-size:11.5px;opacity:.95}',
    '.pie{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fff;color:#13223f;border-radius:999px;padding:8px 22px;font-size:12px}',
    '.pie img{height:42px;width:auto;display:block} .pie b{color:#0b2a6b}'
  ].join('');

  function celdaFin(o, plazo){
    if(o.primera !== o.resto) return '<b>'+cop(o.primera)+'</b><small>1ª cuota · luego '+(plazo-1)+' cuotas de '+cop(o.resto)+'</small><small>Total '+cop(o.total)+'</small>';
    return '<b>'+plazo+' × '+cop(o.cuota)+'</b><small>cuotas mensuales</small><small>Total '+cop(o.total)+'</small>';
  }
  function bloqueCob(lista){
    return '<div class="cob">'+lista.map(function(t){
      if(/^—.*—$/.test(t)) return '<div class="sec">'+esc(t.replace(/—/g,'').trim())+'</div>';
      return '<div><i>✓</i><span>'+esc(t)+'</span></div>'; }).join('')+'</div>';
  }

  /* d: {fecha,id,nombre,placa,moto,aseguradora,plazo,garantizar,cubre,op1:{contado,primera,resto,cuota,total},op2:{...},cob1:[],cob2:[],nota} */
  function html(d){
    var logo = w.PM_LOGO || '';
    var fecha = d.fecha || new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
    var op = function(n, titulo, sub, o, cob){
      return '<div class="op"><h3>OPCIÓN '+n+' · '+esc(titulo)+(sub?'<small>'+esc(sub)+'</small>':'')+'</h3>'+
        '<div class="pre"><div><span>De contado</span><b>'+cop(o.contado)+'</b><small>Un solo pago</small></div>'+
        '<div><span>Financiado a '+d.plazo+' meses</span>'+celdaFin(o, d.plazo)+'</div></div>'+bloqueCob(cob)+'</div>';
    };
    var pill = function(ico, etq, val){ return '<div class="pill"><i>'+ico+'</i><div><span>'+etq+'</span><b>'+esc(val||'—')+'</b></div></div>'; };
    return '<div class="doc">'+
      '<div class="sup"><div class="logo">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b style="color:#0b2a6b;font-size:20px">PROTECT MOTOS</b>')+'</div>'+
      '<div class="fecha"><b>'+esc(fecha)+'</b>'+(d.id?'Cotización N.º '+esc(d.id):'Renovación de garantía')+'</div></div>'+
      '<div class="marco"><p class="over">RENOVACIÓN</p>'+
      '<div class="titulo"><b>COTIZACIÓN<br>DE GARANTÍA</b><small>Protección para su moto, con las opciones que mejor le convienen</small></div>'+
      '<p class="saludo"><b>'+esc(d.nombre)+'</b>, le damos un cordial saludo. De acuerdo con nuestra conversación, le enviamos la información de la renovación de su moto'+(d.moto?' <b>'+esc(d.moto)+'</b>':'')+'. Encontrará dos opciones, cada una con su valor de contado y financiado a '+d.plazo+' meses.</p>'+
      '<div class="pills">'+pill('👤','Cliente',d.nombre)+pill('🏍️','Placa',d.placa)+pill('🔧','Moto',d.moto)+pill('💰','Valor garantizado',d.garantizar?cop(d.garantizar):'')+'</div>'+
      '<span class="aseg">Respaldo: '+esc(d.aseguradora)+'</span></div>'+
      op(1,'HURTO O PÉRDIDA TOTAL',(d.aseguradora==='Protect Motos'?'cubre el 80 %':''),d.op1,d.cob1)+
      op(2,'HURTO / PÉRDIDA TOTAL + RESPONSABILIDAD CIVIL + ASISTENCIAS','',d.op2,d.cob2)+
      '<div class="cta"><div class="tx"><b>¡CONTÁCTANOS HOY!</b><span>Responde este mensaje y dejamos tu garantía lista.</span></div><div class="ph">📞 312 880 68 73</div><div class="bt">RENUEVA AQUÍ</div></div>'+
      '<p class="nota">'+esc(d.nota||'Valores en pesos colombianos (COP). La cotización corresponde a la moto y los datos indicados.')+'</p>'+
      '<div class="pie">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b>PROTECT MOTOS</b>')+'<div style="text-align:center"><b>Negociemos Group S.A.S.</b> · NIT 901.715.327-0</div><div style="text-align:right">protectmotos@gmail.com</div></div>'+
      '</div>';
  }
  function pagina(d){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización renovación - '+esc(d.nombre)+(d.placa?' - '+esc(d.placa):'')+'</title><style>'+CSS+'</style></head><body>'+html(d)+'</body></html>';
  }

  /* PDF: se abre la hoja y se lanza «Imprimir» (elija «Guardar como PDF») */
  function imprimir(d){
    var v = w.open('', '_blank');
    if(!v){ return false; }
    v.document.open(); v.document.write(pagina(d)); v.document.close();
    var lanzar = function(){ try{ v.focus(); v.print(); }catch(e){} };
    if(v.document.readyState === 'complete') setTimeout(lanzar, 400); else v.onload = function(){ setTimeout(lanzar, 400); };
    return true;
  }

  /* Imagen PNG (para enviar por WhatsApp como foto) */
  function png(d){
    return new Promise(function(ok, mal){
      var host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;';
      host.innerHTML = '<style>'+CSS+'</style>'+html(d);
      document.body.appendChild(host);
      var nodo = host.querySelector('.doc'), W = 794, H = nodo.offsetHeight + 4;
      var xml = new XMLSerializer().serializeToString(nodo);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+CSS+'</style>'+xml+'</div></foreignObject></svg>';
      document.body.removeChild(host);
      var img = new Image();
      img.onload = function(){
        try{
          var c = document.createElement('canvas'); c.width = W*2; c.height = H*2;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,c.width,c.height); x.scale(2,2); x.drawImage(img,0,0);
          c.toBlob(function(b){ b ? ok(b) : mal(new Error('No se pudo crear la imagen.')); }, 'image/png');
        }catch(e){ mal(e); }
      };
      img.onerror = function(){ mal(new Error('No se pudo dibujar la imagen.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    });
  }

  w.PMCotDoc = { html:html, pagina:pagina, imprimir:imprimir, png:png, coberturas:coberturas, guardarCoberturas:guardarCoberturas, restaurarCoberturas:restaurarCoberturas, DEFECTO:DEFECTO };
})(window);

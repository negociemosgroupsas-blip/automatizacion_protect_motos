/* PROTECT MOTOS — Documento de la cotización de renovación (PDF / imagen).
   Construye una hoja carta con el logo, los datos del cliente, las dos opciones (contado y financiado) y las coberturas.
   El PDF se genera con «Imprimir → Guardar como PDF» del navegador (igual que los contratos); la imagen se dibuja localmente. */
(function(w){
  'use strict';
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }

  /* ---- Coberturas por defecto (se pueden editar en el formulario y quedan guardadas en el navegador) ---- */
  /* Formato de cada línea: «Texto» = una cobertura simple · «Texto | valor» = cobertura con su valor ·
     «Texto | límite | deducible % | deducible SMMLV» = fila de la tabla de condiciones · «— Título —» = nuevo bloque.
     Marcas: {V80} = lo que cubre el 80 %, {RC} = valor de la RC, {AP} = valor de las asistencias. */
  var BASE_PM = ['Pérdida total por hurto','Pérdida total por daños','Cubre el 80 % del valor de la moto'];
  var RC_PM = ['— Responsabilidad civil · Condiciones de cobertura —',
    'Amparo patrimonial | Incluido | Sin deducible | Sin deducible',
    'Daños a bienes de terceros | $100.000.000 | 10 % | 1,0 SMMLV',
    'Lesiones o muerte a una persona | $100.000.000 | 10 % | 1,0 SMMLV',
    'Lesiones o muerte a dos o más personas | $200.000.000 | 10 % | 1,0 SMMLV',
    'Gastos médicos | $200.000 | Sin deducible | Sin deducible',
    'Asistencia jurídica en proceso penal | $10.348.632 | Sin deducible | Sin deducible',
    'Asistencia jurídica en proceso civil | $5.338.580 | Sin deducible | Sin deducible',
    'Muerte accidente de tránsito | $5.000.000 | Sin deducible | Sin deducible'];
  var AP_PM = ['— AP · Accidentes personales —',
    'Muerte accidental | $5.000.000','Incapacidad total por accidente | $5.000.000','Auxilio por pérdida de documentos | $100.000',
    '— Carro taller: todos los servicios · 1 vez cada uno al año —',
    'Grúa por accidente | $300.000','Paso de corriente | $50.000','Suministro de combustible | $50.000','Despinche (llanta sellomática) | $50.000'];
  var SURA = ['Responsabilidad Civil Extracontractual (límite global): $840.000.000','Deducible pérdida total por daños: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por daños: deducible único 0,5 SMMLV','Deducible pérdida total por hurto: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por hurto: deducible único 0,5 SMMLV','Deducible ante eventos de la naturaleza (temblor, terremoto): deducible único 0,5 SMMLV','Amparo patrimonial: sí cubre','Asistencia jurídica en procesos penales y civiles: sí cubre','Asistencia en viaje: asistencia de motos'];
  var DEFECTO = {
    'Protect Motos': { op1: BASE_PM, op2: ['Todo lo de la Opción 1','Responsabilidad civil','Asistencias y Carro taller'].concat(RC_PM).concat(AP_PM) },
    'Sura': { op1: SURA.slice(1,5).concat([SURA[7]]), op2: SURA }
  };
  var CLAVE = 'pm_cot_cobert3';
  function leerGuardadas(){ try{ return JSON.parse(localStorage.getItem(CLAVE)||'{}')||{}; }catch(e){ return {}; } }
  function coberturas(aseg, op){
    var g = leerGuardadas(), k = aseg+'|'+op;
    if(g[k] && g[k].length) return g[k];
    var d = DEFECTO[aseg] || DEFECTO['Protect Motos'];
    return (d[op]||[]).slice();
  }
  function guardarCoberturas(aseg, op, lista){ var g = leerGuardadas(); g[aseg+'|'+op] = lista; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }
  function restaurarCoberturas(aseg){ var g = leerGuardadas(); delete g[aseg+'|op1']; delete g[aseg+'|op2']; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }

  /* ---- Plan de salud (regalo por llevar la Opción 2): una línea por beneficio; se guarda en el navegador ---- */
  var CLAVE_PLAN = 'pm_cot_plansalud';
  var PLAN_DEFECTO = ['Consultas médicas 24/7','Médico a domicilio','Atención pediátrica e interna virtual','Escaneo de signos vitales desde tu casa','Consejos de salud y autocuidado'];
  function planSalud(){ try{ var g = JSON.parse(localStorage.getItem(CLAVE_PLAN)||'null'); if(g && g.length) return g; }catch(e){} return PLAN_DEFECTO.slice(); }
  function guardarPlanSalud(lista){ try{ localStorage.setItem(CLAVE_PLAN, JSON.stringify((lista||[]).filter(Boolean))); }catch(e){} }

  /* ---- Estilos del documento: UNA hoja, poco texto y toda la cobertura a la vista (cifras grandes, sin tablas largas).
          Colores: Negociemos (azul oscuro y dorado) + azul de Seguros Mundial (RC) + aguamarina estilo Sura (asistencias). Letra: Lato, igual que el CRM. ---- */
  var TEL = '(+57) 312 880 68 73', VIGENCIA_DIAS = 5;
  var F = "'LatoInf','Lato',Arial,Helvetica,sans-serif";
  var C_NAVY = '#021346', C_MUN = '#0071CE', C_AQUA = '#00A7B5', C_GOLD = '#b8923a', C_GOLD_L = '#e3c378';
  var CSS = (w.PM_LATO_FF || '') + [
    '@page{size:letter;margin:6mm}',
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:inherit}',
    'body{margin:0;background:#fff;color:#13223f;font-family:'+F+'}',
    '.doc{font-family:'+F+';width:794px;margin:0 auto;padding:18px 30px 0;font-size:12px;line-height:1.3;color:#13223f;background:#fff;position:relative;overflow:hidden}',
    '.sup{display:flex;justify-content:space-between;align-items:center;gap:12px}',
    '.sup img{height:50px;width:auto;display:block}',
    '.sup .fecha{text-align:right;font-size:12px;color:#5b6b8c;line-height:1.5} .sup .fecha b{color:#13223f;font-weight:700}',
    '.sup .val{display:inline-block;background:#f5f2ea;color:#5a4a22;border:1px solid #e2d8bd;border-radius:0;padding:2px 11px;font-size:11px;font-weight:700;margin-top:3px}',
    '.hero{margin-top:10px;background:'+C_NAVY+';border-radius:0;padding:13px 26px 15px;color:#fff;position:relative}',
    '.hero small{color:#aebbd8;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase}',
    '.hero h1{font-size:25px;line-height:1.2;margin:5px 0 0;font-weight:700} .hero h1 em{font-style:normal;color:'+C_GOLD_L+'}',
    '.hero .cifra{position:absolute;right:22px;top:22px;background:'+C_GOLD+';color:'+C_NAVY+';border-radius:0;padding:10px 16px;text-align:center;width:200px}',
    '.hero .cifra span{font-size:10.5px;text-transform:uppercase;font-weight:700;letter-spacing:.05em} .hero .cifra b{display:block;font-size:26px;line-height:1.15;font-weight:700} .hero .cifra i{font-style:normal;font-size:11px}',
    '.op{display:block;border:1px solid #dfe5f1;margin-top:12px;position:relative;background:#fff;page-break-inside:avoid}',
    '.op.rec{border:2px solid '+C_GOLD+'}',
    '.op .hd{background:'+C_NAVY+';color:#fff;padding:7px 14px;display:flex;align-items:center;gap:12px;font-size:14px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}',
    '.op .hd .n{background:'+C_GOLD+';color:'+C_NAVY+';width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:17px;flex:none}',
    '.op .hd .rc{margin-left:auto;background:'+C_GOLD+';color:'+C_NAVY+';font-size:10.5px;padding:3px 11px;letter-spacing:.04em}',
    '.op .bd{display:flex}',
    '.op .pp{width:236px;flex:none;background:#f6f7fb;padding:16px 16px;border-right:1px solid #e3e8f2;display:flex;flex-direction:column}',
    '.op h3{font-size:14.5px;margin:0 0 9px;font-weight:700;color:'+C_NAVY+'}',
    '.op .pr small{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#5b6b8c;font-weight:700;display:block} .op .pr b{display:block;font-size:34px;line-height:1.1;color:'+C_NAVY+';font-weight:700}',
    '.op .pr2{margin-top:8px;padding-top:8px;border-top:1px dashed #cfd8ec} .op .pr2 b{font-size:21px} .op .pr2 em{font-style:normal;font-size:11px;color:#5b6b8c;display:block}',
    '.op .dia{margin-top:12px;background:#fff;border:1px solid #e3e8f2;padding:6px 8px;font-size:12px;color:#3a4a6b;font-weight:700;text-align:center}',
    '.op .cv{flex:1;padding:9px 16px 6px}',
    '.op .sh{margin:9px 0 3px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:'+C_NAVY+';border-bottom:2px solid '+C_GOLD+';padding-bottom:2px;display:flex;justify-content:space-between;gap:8px} .op .sh:first-child{margin-top:0} .op .sh i{font-style:normal;font-weight:400;text-transform:none;letter-spacing:0;color:#5b6b8c}',
    '.op .r{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:3px 0;border-bottom:1px solid #eef1f7;font-size:12.5px;line-height:1.2} .op .r b{white-space:nowrap;font-weight:700;color:'+C_NAVY+'} .op .r small{color:#7a869f;font-size:9.5px;margin-left:5px}',
    '.op .r .ck{display:inline-flex;width:14px;height:14px;background:'+C_NAVY+';color:#fff;font-size:9px;align-items:center;justify-content:center;font-weight:700;margin-right:8px;flex:none;vertical-align:middle} .op .r span.n{display:flex;align-items:center}',
    '.op .gf{margin:9px 0 0;background:#f5f2ea;border-left:5px solid '+C_GOLD+';padding:5px 10px;font-size:11px;font-weight:700;color:'+C_NAVY+'}',
    '.op.h{display:block} .op.h .top{display:flex;align-items:flex-end;gap:18px;background:#f6f7fb;padding:12px 16px;border-bottom:1px solid #e3e8f2} .op.h .top .pr{flex:1} .op.h .top .pr b{font-size:22px} .op.h .top .pr2{margin:0;padding:0;border:0} .op.h .top .pr2 b{font-size:17px;padding-top:4px} .op.h .top .dia{margin:0;align-self:center;flex:none}',
    '.op.h .cv{display:grid;grid-template-columns:repeat(3,1fr);gap:0 18px;padding:8px 16px 8px} .op.h .cv .r{border-bottom:0;padding:3px 0;font-size:12.5px}',
    '.op .gl{margin-top:22px;background:#f5f2ea;border-left:5px solid '+C_GOLD+';padding:12px 12px} .op .gl b{display:block;font-size:12.5px;color:'+C_NAVY+';font-weight:700;margin-bottom:5px;line-height:1.3} .op .gl div{font-size:12px;line-height:1.3;padding:4px 0 4px 15px;position:relative;color:#3b3524} .op .gl div:before{content:"✓";position:absolute;left:0;font-weight:700;color:'+C_NAVY+'}',
    '.cta{margin:14px -30px 0;background:'+C_NAVY+';color:#fff;padding:12px 30px;display:flex;align-items:center;gap:18px;border-top:5px solid '+C_GOLD+'}',
    '.cta .t{flex:1} .cta .t>b{font-size:16.5px;display:block;font-weight:700} .cta .t span{font-size:11.5px;color:#c9d6f6}',
    '.cta .w{background:#fff;color:'+C_NAVY+';border-radius:0;padding:9px 17px;font-weight:700;font-size:13.5px;text-align:center;text-decoration:none} .cta .w small{display:block;font-size:10.5px;font-weight:400}'
  ].join('');

  function celdaFin(o, plazo){
    if(o.primera !== o.resto) return '<b>'+cop(o.primera)+'</b><em>1ª cuota y luego '+(plazo-1)+' de '+cop(o.resto)+'</em>';
    return '<b>'+plazo+' × '+cop(o.cuota)+'</b><em>Total '+cop(o.total)+'</em>';
  }
  function conValores(t, d){ return String(t).replace(/\{V80\}/g, d.cubre?cop(d.cubre):'').replace(/\{RC\}/g, cop(d.rc||152857)).replace(/\{AP\}/g, cop(d.ap||47000)); }
  /* separa una lista de coberturas: las líneas simples (van en la tarjeta) y los bloques con detalle */
  function partes(lista, d){
    var chips = [], secs = [], cur = null;
    (lista||[]).forEach(function(t0){
      var t = conValores(t0, d).trim(); if(!t) return;
      if(/^—.*—$/.test(t)){ cur = { titulo:t.replace(/—/g,'').trim(), filas:[] }; secs.push(cur); return; }
      var c = t.split('|').map(function(x){ return x.trim(); });
      if(!cur) chips.push(c[0].replace(/:\s*$/,'')); else cur.filas.push(c);
    });
    return { chips:chips, secs:secs };
  }
  function ded(c){ var a = c[2]||'', b = c[3]||''; if(/^sin deducible$/i.test(a) && /^sin deducible$/i.test(b)) return ''; return [a,b].filter(Boolean).join(' · '); }
  /* cada cobertura = una casilla pequeña: nombre y, en grande, su valor (el deducible solo se escribe si existe) */
  function casillas(filas){
    return '<div class="g">'+filas.filter(function(c){ return !/^valor total/i.test(c[0]); }).map(function(c){
      var dd = c.length>=3 ? ded(c) : '';
      return '<div class="t"><span>'+esc(c[0])+'</span>'+(c.length>=2?'<b>'+esc(c[1])+'</b>':'')+(dd?'<i>Deducible '+esc(dd)+'</i>':'')+'</div>';
    }).join('')+'</div>';
  }
  function seccion(sc, aqua){
    if(/^carro taller/i.test(sc.titulo)) return '<div class="tl"><b>Carro taller</b> · '+esc(sc.titulo.replace(/^carro taller:?\s*/i,''))+'</div><div style="height:5px"></div>'+casillas(sc.filas);
    return '<h4>'+esc(sc.titulo.replace(/^(responsabilidad civil)\s*·\s*condiciones de cobertura$/i,'$1'))+'</h4>'+casillas(sc.filas);
  }
  var MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function vigenciaTxt(){ var f = new Date(); f.setDate(f.getDate()+VIGENCIA_DIAS); return f.getDate()+' de '+MES[f.getMonth()]; }
  function porDia(v){ return Math.ceil((Number(v)||0)/365/100)*100; }

  /* d: {fecha,id,nombre,placa,moto,aseguradora,plazo,op1:{contado,primera,resto,cuota,total},op2:{...},cubre,cob1:[],cob2:[],salud:[],asesor?,telefono?} */
  function html(d){
    var logo = w.PM_LOGO || '';
    var fecha = d.fecha || new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
    var p1 = partes(d.cob1, d), p2 = partes(d.cob2, d);
    var protect = (d.aseguradora||'Protect Motos') === 'Protect Motos';
    var primer = String(d.nombre||'').split(' ')[0] || 'cliente';
    var motoTxt = String(d.moto||'').replace(/\s*·\s*$/,'').trim();
    var renov = d.tipo !== 'nueva';
    var garantizado = Number(d.garantizar)>0 ? Number(d.garantizar) : (Number(d.cubre)>0 ? Number(d.cubre)/0.8 : 0);
    var titulo = renov ? 'Renueva la protección de tu <em>'+esc(motoTxt||'moto')+'</em>' : 'Tu <em>'+esc(motoTxt||'moto')+'</em> merece estar protegida';
    var cifra = '';
    var d1 = porDia(d.op1.contado), d2 = porDia(d.op2.contado), L = d.salud || [];
    var ck = function(t, fuerte){ return '<div class="r"><span class="n"><span class="ck">✓</span>'+(fuerte?'<b style="font-weight:700">'+esc(t)+'</b>':esc(t))+'</span></div>'; };
    var fila = function(c){ if(/^valor total/i.test(c[0])) return ''; var dd = c.length>=3 ? ded(c) : '';
      return '<div class="r"><span>'+esc(c[0])+(dd?'<small>Deducible '+esc(dd)+'</small>':'')+'</span>'+(c.length>=2?'<b>'+esc(c[1])+'</b>':'')+'</div>'; };
    var precios = function(n, tit, o, dia, rec, extra){
      return '<div class="pp">'+
        '<div class="pr"><small>De contado</small><b>'+cop(o.contado)+'</b></div>'+
        '<div class="pr pr2"><small>Financiado a '+d.plazo+' meses</small>'+celdaFin(o, d.plazo)+'</div>'+
        (dia>0?'<div class="dia">Menos de '+cop(dia)+' al día</div>':'')+(extra||'')+'</div>';
    };
    /* Opción 1: lo que cubre, en una columna */
    var cv1 = '<div class="sh">Qué cubre</div>'+p1.chips.map(function(t){ return ck(t); }).join('');
    /* Opción 2: TODO lo que cubre, en una sola columna (lo de la Opción 1 + RC + AP + Carro taller + regalo) */
    var cv2 = '<div class="sh">Qué cubre · todo en una sola opción</div>'+(p1.chips.length?p1.chips.map(function(t){ return ck(t); }).join(''):'');
    if(p2.secs.length){
      p2.secs.forEach(function(sc){
        var carro = /^carro taller/i.test(sc.titulo), tit = carro ? 'Carro taller' : sc.titulo.replace(/^(responsabilidad civil)\s*·\s*condiciones de cobertura$/i,'$1'), nota = carro ? sc.titulo.replace(/^carro taller:?\s*/i,'') : (/responsabilidad civil/i.test(tit)&&protect?'respaldada por Seguros Mundial':'');
        cv2 += '<div class="sh"><span>'+esc(tit)+'</span>'+(nota?'<i>'+esc(nota)+'</i>':'')+'</div>'+sc.filas.map(fila).join('');
      });
    } else cv2 += p2.chips.filter(function(t){ return !/^todo lo de/i.test(t) && p1.chips.indexOf(t)<0; }).map(function(t){ return ck(t); }).join('');
    var regaloIzq = L.length ? '<div class="gl"><b>DE REGALO con la Opción 2<br>Plan de salud para el titular y 2 beneficiarios</b>'+L.map(function(t){ return '<div>'+esc(t)+'</div>'; }).join('')+'</div>' : '';
    var asesor = d.asesor ? 'Tu asesor: <b>'+esc(d.asesor)+'</b> · Protect Motos' : 'Protect Motos · Negociemos Group S.A.S.';
    var tel = d.telefono || TEL, tdig = String(tel).replace(/\D/g,''); if(tdig.length===10) tdig = '57'+tdig;
    return '<div class="doc">'+
      '<div class="sup"><div>'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b style="font-size:20px;color:#021346">PROTECT MOTOS</b>')+'</div>'+
        '<div class="fecha"><b>Cotización'+(d.id?' N.º '+esc(d.id):'')+'</b><br>'+esc(fecha)+'<br><span class="val">Válida hasta el '+vigenciaTxt()+'</span></div></div>'+
      '<div class="hero"><small>Hola, '+esc(primer)+''+(d.placa?' · '+esc(d.placa):'')+'</small><h1>'+titulo+'</h1>'+cifra+'</div>'+
      '<div class="op h"><div class="hd"><span class="n">1</span>Opción 1 · Hurto o pérdida total</div><div class="top">'+(function(){ var o=d.op1; return '<div class="pr"><small>De contado</small><b>'+cop(o.contado)+'</b></div><div class="pr pr2"><small>Financiado a '+d.plazo+' meses</small>'+celdaFin(o, d.plazo)+'</div>'+(d1>0?'<div class="dia">Menos de '+cop(d1)+' al día</div>':''); })()+'</div><div class="cv">'+p1.chips.map(function(t){ return ck(t); }).join('')+'</div></div>'+
      '<div class="op rec"><div class="hd"><span class="n">2</span>Opción 2 · '+esc(protect?'Protección total':'Todo incluido')+'<span class="rc">RECOMENDADA · LA MÁS ELEGIDA</span></div><div class="bd">'+precios(2,'',d.op2,d2,true,regaloIzq)+'<div class="cv">'+cv2+'</div></div></div>'+
      '<div class="cta"><div class="t"><b>¿Listo para proteger tu moto?</b><span>'+asesor+'</span></div><a class="w" href="https://wa.me/'+tdig+'">Escríbeme por WhatsApp<small>'+esc(tel)+'</small></a></div></div>';
  }
  function pagina(d){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización - '+esc(d.nombre)+(d.placa?' - '+esc(d.placa):'')+'</title><style>'+CSS+'</style></head><body>'+html(d)+'</body></html>';
  }

  /* PDF: se abre la hoja y se lanza «Imprimir» (elija «Guardar como PDF») */
  function imprimir(d){
    var v = w.open('', '_blank');
    if(!v){ return false; }
    v.document.open(); v.document.write(pagina(d)); v.document.close();
    var lanzar = function(){ try{
      /* cada hoja (.doc) cabe en una hoja carta: se reduce un poco el ancho para respetar los márgenes */
      [].forEach.call(v.document.querySelectorAll('.doc'), function(doc){ var h = doc.offsetHeight, z = Math.min(1, 1000/h, 765/794); if(z<1) doc.style.zoom = String(Math.round(z*1000)/1000); });
      v.focus(); v.print(); }catch(e){} };
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

  w.PMCotDoc = { planSalud:planSalud, guardarPlanSalud:guardarPlanSalud, html:html, pagina:pagina, imprimir:imprimir, png:png, coberturas:coberturas, guardarCoberturas:guardarCoberturas, restaurarCoberturas:restaurarCoberturas, DEFECTO:DEFECTO };
})(window);

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
  var C_NAVY = '#021346', C_MUN = '#0071CE', C_AQUA = '#00A7B5', C_GOLD = '#fdc33e';
  var CSS = (w.PM_LATO_FF || '') + [
    '@page{size:letter;margin:6mm}',
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:inherit}',
    'body{margin:0;background:#fff;color:#13223f;font-family:'+F+'}',
    '.doc{font-family:'+F+';width:794px;margin:0 auto;padding:18px 30px 0;font-size:12px;line-height:1.3;color:#13223f;background:#fff;position:relative;overflow:hidden}',
    '.sup{display:flex;justify-content:space-between;align-items:center;gap:12px}',
    '.sup img{height:50px;width:auto;display:block}',
    '.sup .fecha{text-align:right;font-size:12px;color:#5b6b8c;line-height:1.5} .sup .fecha b{color:#13223f;font-weight:700}',
    '.sup .val{display:inline-block;background:#fff3d6;color:#8a5a00;border:1px solid #f0cf86;border-radius:20px;padding:2px 11px;font-size:11px;font-weight:700;margin-top:3px}',
    '.hero{margin-top:10px;background:linear-gradient(120deg,'+C_NAVY+' 0%,#06307f 55%,'+C_MUN+' 100%);border-radius:18px;padding:18px 24px;color:#fff;position:relative;min-height:112px;border-bottom:4px solid '+C_GOLD+'}',
    '.hero small{color:#bcd6f5;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase}',
    '.hero h1{font-size:24px;line-height:1.2;margin:5px 0 0;max-width:420px;font-weight:700} .hero h1 em{font-style:normal;color:'+C_GOLD+'}',
    '.hero .cifra{position:absolute;right:22px;top:22px;background:'+C_GOLD+';color:'+C_NAVY+';border-radius:14px;padding:10px 16px;text-align:center;width:200px}',
    '.hero .cifra span{font-size:10.5px;text-transform:uppercase;font-weight:700;letter-spacing:.05em} .hero .cifra b{display:block;font-size:26px;line-height:1.15;font-weight:700} .hero .cifra i{font-style:normal;font-size:11px}',
    '.cards{display:flex;gap:14px;margin-top:18px;align-items:stretch}',
    '.card{flex:1;border:1.5px solid #cfe0f5;border-radius:16px;padding:13px 16px;position:relative;background:#fff}',
    '.card.rec{border:2.5px solid '+C_GOLD+';background:#fffdf5;box-shadow:0 8px 22px rgba(253,195,62,.28)}',
    '.card .tag{position:absolute;top:-12px;left:16px;background:'+C_GOLD+';color:'+C_NAVY+';font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 13px;letter-spacing:.04em}',
    '.card h3{font-size:14.5px;margin:0 0 8px;font-weight:700;color:'+C_NAVY+'}',
    '.card .pr small{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#5b6b8c;font-weight:700;display:block} .card .pr b{display:block;font-size:27px;line-height:1.1;color:'+C_NAVY+';font-weight:700}',
    '.card .pr2{margin-top:7px;padding-top:7px;border-top:1px dashed #cfd8ec} .card .pr2 b{font-size:17px} .card .pr2 em{font-style:normal;font-size:11px;color:#5b6b8c;display:block}',
    '.card .dia{margin-top:8px;background:#e8f3fd;border-radius:10px;padding:5px 10px;font-size:11px;color:#0a56a0;font-weight:700;text-align:center}',
    '.card ul{list-style:none;margin:9px 0 0;padding:0;display:grid;gap:4px;font-size:11.5px}',
    '.card li{display:flex;gap:7px;align-items:center} .card li .ck{display:inline-flex;width:16px;height:16px;border-radius:50%;background:'+C_MUN+';color:#fff;font-size:10px;align-items:center;justify-content:center;font-weight:700;flex:none} .card li b{font-weight:700}',
    '.rg{margin-top:14px;background:linear-gradient(90deg,'+C_GOLD+',#ffe28f);color:'+C_NAVY+';border-radius:14px;padding:9px 16px;display:flex;align-items:center;gap:12px}',
    '.rg .ic{font-size:26px;line-height:1} .rg b{font-size:13px;font-weight:700;display:block} .rg span.l{display:block;font-size:11.5px;margin-top:2px;line-height:1.4}',
    '.det{margin-top:14px}',
    '.det .tit{margin:0 0 7px;font-size:13px;font-weight:700;color:'+C_NAVY+';text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:10px} .det .tit:after{content:"";flex:1;height:1px;background:#dfe5f1}',
    '.det .cob{display:grid;grid-template-columns:1.1fr 1fr;gap:10px;align-items:start}',
    '.det .dc{border-radius:14px;overflow:hidden;padding-bottom:7px;border:1px solid #cfe0f5;background:#f6faff}',
    '.det .dc h4{margin:0 0 7px;color:#fff;padding:6px 12px;font-size:11px;letter-spacing:.4px;text-transform:uppercase;font-weight:700;background:'+C_MUN+'} .det .dc.aq{background:#f2fbfc;border-color:#c5ebee} .det .dc.aq h4{background:'+C_AQUA+'}',
    '.det .g{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 8px}',
    '.det .t{background:#fff;border:1px solid #dbe8f8;border-radius:10px;padding:4px 9px} .det .dc.aq .t{border-color:#c5ebee}',
    '.det .t span{display:block;font-size:10px;color:#5b6b8c;line-height:1.2} .det .t b{display:block;font-size:13.5px;color:'+C_NAVY+';font-weight:700;line-height:1.25} .det .t i{display:block;font-style:normal;font-size:9.5px;color:#b45309;line-height:1.2}',
    '.det .tl{margin:7px 8px 0;background:#fff6d6;border:1px solid #f0cf6a;color:#7a4b00;border-radius:10px;padding:4px 10px;font-size:10.5px} .det .tl b{color:#b45309;font-weight:700}',
    '.det .nota{margin:6px 10px 0;font-size:10px;color:#5b6b8c}',
    '.cta{margin:14px -30px 0;background:'+C_NAVY+';color:#fff;padding:12px 30px;display:flex;align-items:center;gap:18px;border-top:5px solid '+C_GOLD+'}',
    '.cta .t{flex:1} .cta .t>b{font-size:16.5px;display:block;font-weight:700} .cta .t span{font-size:11.5px;color:#c9d6f6}',
    '.cta .w{background:#25d366;color:#04301a;border-radius:12px;padding:9px 17px;font-weight:700;font-size:13.5px;text-align:center;text-decoration:none} .cta .w small{display:block;font-size:10.5px;font-weight:400}'
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
    if(/^carro taller/i.test(sc.titulo)) return '<div class="tl"><b>🛵 Carro taller</b> · '+esc(sc.titulo.replace(/^carro taller:?\s*/i,''))+'</div><div style="height:5px"></div>'+casillas(sc.filas);
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
    var cifra = (protect && Number(d.cubre)>0) ? '<div class="cifra"><span>Te respaldamos hasta</span><b>'+cop(d.cubre)+'</b><i>80 % de '+cop(garantizado)+'</i></div>' : '';
    var li = function(t, fuerte){ return '<li><span class="ck">✓</span>'+(fuerte?'<b>'+esc(t)+'</b>':esc(t))+'</li>'; };
    var lista1 = p1.chips.map(function(t){ return li(t); }).join('');
    var lista2 = p2.chips.map(function(t){ return li(t,/responsabilidad|salud/i.test(t)); }).join('') + ((d.salud&&d.salud.length)?li('Plan de salud de regalo',true):'');
    var d1 = porDia(d.op1.contado), d2 = porDia(d.op2.contado);
    var tarjeta = function(n, tit, o, lista, dia, rec){
      return '<div class="card'+(rec?' rec':'')+'">'+(rec?'<div class="tag">⭐ RECOMENDADA · LA MÁS ELEGIDA</div>':'')+'<h3>Opción '+n+' · '+esc(tit)+'</h3>'+
        '<div class="pr"><small>De contado</small><b>'+cop(o.contado)+'</b></div>'+
        '<div class="pr pr2"><small>Financiado a '+d.plazo+' meses</small>'+celdaFin(o, d.plazo)+'</div>'+
        (dia>0?'<div class="dia">Menos de '+cop(dia)+' al día</div>':'')+'<ul>'+lista+'</ul></div>';
    };
    var asesor = d.asesor ? 'Tu asesor: <b>'+esc(d.asesor)+'</b> · Protect Motos' : 'Protect Motos · Negociemos Group S.A.S.';
    var tel = d.telefono || TEL, tdig = String(tel).replace(/\D/g,''); if(tdig.length===10) tdig = '57'+tdig;
    var rcS = p2.secs.filter(function(x){ return !/^(ap|carro)/i.test(x.titulo); }), otS = p2.secs.filter(function(x){ return /^(ap|carro)/i.test(x.titulo); });
    var detalle = p2.secs.length ? '<div class="det"><div class="tit">Todo lo que cubre tu Opción 2</div><div class="cob"><div class="dc">'+rcS.map(function(x){ return seccion(x); }).join('')+(protect?'<div class="nota">Responsabilidad civil respaldada por Compañía Mundial de Seguros S.A.</div>':'')+'</div>'+(otS.length?'<div class="dc aq">'+otS.map(function(x){ return seccion(x,true); }).join('')+'</div>':'')+'</div></div>' : '';
    var L = d.salud || [];
    var regalo = '<div class="rg"><span class="ic">🎁</span><div><b>DE REGALO con la Opción 2 · Plan de salud para ti y 2 beneficiarios</b>'+(L.length?'<span class="l">'+L.map(esc).join(' · ')+'</span>':'')+'</div></div>';
    return '<div class="doc">'+
      '<div class="sup"><div>'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b style="font-size:20px;color:#021346">PROTECT MOTOS</b>')+'</div>'+
        '<div class="fecha"><b>Cotización'+(d.id?' N.º '+esc(d.id):'')+'</b><br>'+esc(fecha)+'<br><span class="val">⏳ Válida hasta el '+vigenciaTxt()+'</span></div></div>'+
      '<div class="hero"><small>Hola, '+esc(primer)+' 👋'+(d.placa?' · '+esc(d.placa):'')+'</small><h1>'+titulo+'</h1>'+cifra+'</div>'+
      '<div class="cards">'+tarjeta(1,'Hurto o pérdida total',d.op1,lista1,d1,false)+tarjeta(2,protect?'Protección total':'Todo incluido',d.op2,lista2,d2,true)+'</div>'+
      regalo+detalle+
      '<div class="cta"><div class="t"><b>¿Listo para proteger tu moto?</b><span>'+asesor+'</span></div><a class="w" href="https://wa.me/'+tdig+'">💬 Escríbeme por WhatsApp<small>'+esc(tel)+'</small></a></div></div>';
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

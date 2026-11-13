/* PROTECT MOTOS — Módulo Renovaciones: ENVIAR COTIZACIÓN + panel «Cotizaciones de renovación».
   Es un archivo aparte: solo suma. Usa las reglas de assets/cotizador_core.js y el conector del CRM (crm-4).
   Nada se envía solo: el WhatsApp se abre únicamente cuando la persona lo confirma. */
(function(w){
  'use strict';
  var d = document;
  var LS = function(k){ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } };
  var LSset = function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} };
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }
  function num(v){ return Number(String(v||'').replace(/[^0-9]/g,''))||0; }
  function $(id){ return d.getElementById(id); }

  // ---------- Conector (CRM) ----------
  var cnt = 0;
  function llamar(params){
    return new Promise(function(ok, mal){
      var url = LS('pm_crm_url'), tok = LS('pm_crm_token')||'PM-CRM-2026';
      if(!url){ mal(new Error('Falta la URL del conector del CRM (pestaña Conexiones).')); return; }
      cnt++;
      var cb = 'pm_cr_'+Date.now()+'_'+cnt, s = d.createElement('script'), fin = false;
      var t = setTimeout(function(){ if(fin) return; fin=true; limpiar(); mal(new Error('El conector no respondió a tiempo.')); }, 25000);
      function limpiar(){ clearTimeout(t); try{ delete w[cb]; }catch(e){ w[cb]=undefined; } if(s.parentNode) s.parentNode.removeChild(s); }
      w[cb] = function(r){ if(fin) return; fin=true; limpiar(); ok(r); };
      s.onerror = function(){ if(fin) return; fin=true; limpiar(); mal(new Error('No se pudo contactar el conector del CRM.')); };
      var q = 'token='+encodeURIComponent(tok)+'&callback='+cb;
      Object.keys(params).forEach(function(k){ q += '&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]); });
      s.src = url + (url.indexOf('?')<0?'?':'&') + q;
      d.body.appendChild(s);
    }).then(function(r){
      if(!r || r.ok===false){
        var m = (r&&r.error)||'Respuesta inválida.';
        if(/Acción no disponible/.test(m)) m = 'El conector del CRM todavía no tiene la versión crm-4. Pega el código nuevo (conectores/crm/Codigo_crm.gs) y publica «Nueva versión».';
        throw new Error(m);
      }
      return r;
    });
  }

  // ---------- Estilos y ventanas ----------
  function css(){
    if($('pmcr_css')) return;
    var s = d.createElement('style'); s.id='pmcr_css';
    s.textContent =
      '.pmcr-fondo{position:fixed;inset:0;background:rgba(10,20,40,.55);z-index:9999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}'+
      '.pmcr-fondo.on{display:flex}'+
      '.pmcr-caja{background:#fff;border-radius:14px;max-width:640px;width:100%;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;color:#13223f}'+
      '.pmcr-caja h3{margin:0 0 4px;font-size:1.1rem}.pmcr-sub{color:#667;font-size:.82rem;margin:0 0 12px}'+
      '.pmcr-g{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}@media(max-width:560px){.pmcr-g{grid-template-columns:1fr}}'+
      '.pmcr-g label{display:flex;flex-direction:column;font-size:.76rem;font-weight:700;gap:3px}.pmcr-g .ancho{grid-column:1/-1}'+
      '.pmcr-g input,.pmcr-g select,.pmcr-g textarea{border:1px solid #cfd6e4;border-radius:8px;padding:8px 10px;font:inherit;font-weight:400;font-size:.9rem}'+
      '.pmcr-g input[readonly]{background:#f1f4f9}'+
      '.pmcr-cuadro{background:#f4f7fc;border:1px solid #dbe3f1;border-radius:10px;padding:10px 12px;margin:12px 0;font-size:.86rem;line-height:1.5}'+
      '.pmcr-msg{width:100%;min-height:200px;border:1px solid #cfd6e4;border-radius:8px;padding:10px;font:inherit;font-size:.86rem;box-sizing:border-box}'+
      '.pmcr-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}'+
      '.pmcr-b{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:.85rem;cursor:pointer;background:#13223f;color:#fff}'+
      '.pmcr-b.v{background:#1f9d55}.pmcr-b.g{background:#e3e8f2;color:#13223f}.pmcr-b.r{background:#c0392b}.pmcr-b.o{background:#e0a800;color:#13223f}.pmcr-b:disabled{opacity:.5;cursor:default}'+
      '.pmcr-st{font-size:.82rem;margin-top:8px;min-height:1.2em}.pmcr-st.mal{color:#b3261e}.pmcr-st.bien{color:#0b6b2b}'+
      '.pmcr-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:12px}'+
      '.pmcr-t{background:#f4f7fc;border:1px solid #dbe3f1;border-radius:10px;padding:10px}.pmcr-t b{display:block;font-size:1.3rem}.pmcr-t span{font-size:.72rem;color:#556}'+
      '.pmcr-tw{overflow:auto}.pmcr-tw table{border-collapse:collapse;width:100%;font-size:.82rem}.pmcr-tw th,.pmcr-tw td{border-bottom:1px solid #e4e9f2;padding:6px 8px;text-align:left;white-space:nowrap}.pmcr-tw th{background:#13223f;color:#fff}'+
      '.pmcr-e{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.74rem;font-weight:700}.pmcr-e.p{background:#fff3c4;color:#7a5b00}.pmcr-e.a{background:#d7f5df;color:#0b6b2b}.pmcr-e.n{background:#fad4d4;color:#9b1c1c}';
    d.head.appendChild(s);
  }
  function ventana(id, html){
    css();
    var f = $(id);
    if(!f){ f = d.createElement('div'); f.id=id; f.className='pmcr-fondo'; d.body.appendChild(f); }
    f.innerHTML = '<div class="pmcr-caja">'+html+'</div>';
    f.classList.add('on');
    return f;
  }
  function cerrar(id){ var f=$(id); if(f) f.classList.remove('on'); }
  function numWA(c){ var x=String(c||'').replace(/\D/g,''); return (x.indexOf('57')===0 && x.length>10) ? x : '57'+x; }

  // ---------- Mensaje ----------
  function mensaje(q){
    var m = '¡Hola, '+q.nombre+'! 😊\nTe escribimos de Protect Motos.\n\n'+
      'Queremos ayudarte a renovar la garantía de tu moto '+(q.moto?(q.moto+' '):'')+'de placa '+q.placa+'.\n\n'+
      '🧾 Valor de tu factura anterior: '+cop(q.factura)+'\n'+
      '📈 Valor comercial actual de tu moto: '+cop(q.fasecolda)+'\n\n'+
      '💛 Precio de renovación:\n'+
      '• De contado: '+cop(q.contado)+'\n'+
      '• Financiado a '+q.plazo+' meses: '+q.plazo+' cuotas de '+cop(q.cuota)+' (total '+cop(q.financiado)+')\n\n'+
      '¿Quieres que renovemos tu garantía? Respóndenos y lo dejamos listo hoy mismo 💙';
    return m;
  }

  // ---------- Formulario: ENVIAR COTIZACIÓN ----------
  var cur = null;
  function abrir(c){
    cur = { c:c, guardada:null };
    var f = ventana('pmcr_fcot',
      '<h3>Enviar cotización de renovación</h3><p class="pmcr-sub">Datos del cliente tomados del sistema. Revisa, escribe el valor actual de Fasecolda y confirma.</p>'+
      '<div class="pmcr-g">'+
      '<label>Nombre<input id="pmcr_nom" value="'+esc(c.cliente)+'"></label>'+
      '<label>Cédula<input id="pmcr_ced" value="'+esc(c.cedula||'')+'"></label>'+
      '<label>Placa<input id="pmcr_pla" value="'+esc(c.placa)+'"></label>'+
      '<label>Marca / referencia<input id="pmcr_moto" placeholder="cargando…"></label>'+
      '<label>Valor factura del año anterior<input id="pmcr_fac" inputmode="numeric" placeholder="$"></label>'+
      '<label>Valor Fasecolda actual<input id="pmcr_fas" inputmode="numeric" placeholder="$ (escríbelo)"></label>'+
      '<label>Valor a garantizar (−10 %, el menor)<input id="pmcr_gar" readonly></label>'+
      '<label>Plazo financiado<select id="pmcr_plz"><option value="3">3 meses</option><option value="6">6 meses</option><option value="12" selected>12 meses</option></select></label>'+
      '</div>'+
      '<div class="pmcr-cuadro" id="pmcr_res">Escribe la factura y el valor de Fasecolda para calcular.</div>'+
      '<label style="font-size:.76rem;font-weight:700">Mensaje de WhatsApp (puedes editarlo)</label>'+
      '<textarea class="pmcr-msg" id="pmcr_txt"></textarea>'+
      '<div class="pmcr-st" id="pmcr_st"></div>'+
      '<div class="pmcr-bar">'+
      '<button class="pmcr-b" id="pmcr_gua">Guardar cotización</button>'+
      '<button class="pmcr-b g" id="pmcr_cop">Copiar mensaje</button>'+
      '<button class="pmcr-b v" id="pmcr_wa">Abrir WhatsApp</button>'+
      '<button class="pmcr-b g" id="pmcr_cer">Cerrar</button></div>');
    var fac=$('pmcr_fac'), fas=$('pmcr_fas');
    ['pmcr_nom','pmcr_ced','pmcr_pla','pmcr_moto','pmcr_fac','pmcr_fas','pmcr_plz'].forEach(function(id){ $(id).addEventListener('input', recalcular); $(id).addEventListener('change', recalcular); });
    $('pmcr_txt').addEventListener('input', function(){ cur.editado = true; });
    $('pmcr_cer').onclick = function(){ cerrar('pmcr_fcot'); };
    $('pmcr_gua').onclick = function(){ guardar(false); };
    $('pmcr_cop').onclick = copiar;
    $('pmcr_wa').onclick = abrirWA;
    llamar({action:'cotRen_moto', contrato:c.contrato}).then(function(r){
      if(r.encontrado){
        if(!$('pmcr_ced').value) $('pmcr_ced').value = r.cedula||'';
        $('pmcr_moto').value = [r.marca, r.referencia].filter(Boolean).join(' ');
        if(r.valorMoto>0) fac.value = r.valorMoto.toLocaleString('es-CO');
        cur.celular = r.celular || c.celular;
        var rec = ''; try{ rec = (JSON.parse(LS('pm_cotren_fase')||'{}'))[(r.referencia||'').toUpperCase()]||''; }catch(e){}
        if(rec && !fas.value) fas.value = Number(rec).toLocaleString('es-CO');
      } else { $('pmcr_moto').placeholder = 'escríbela'; setSt('No se encontró la moto en Protect: completa los datos a mano.', 'mal'); }
      recalcular();
    }).catch(function(e){ $('pmcr_moto').placeholder='escríbela'; setSt(e.message,'mal'); recalcular(); });
    recalcular();
  }
  function setSt(t,k){ var e=$('pmcr_st'); if(e){ e.textContent=t; e.className='pmcr-st '+(k||''); } }
  function leer(){
    var fac=num($('pmcr_fac').value), fas=num($('pmcr_fas').value), plz=Number($('pmcr_plz').value);
    var gar = PMCot.valorAGarantizar(fac, fas), cz = PMCot.cotizar(gar), fi = cz.financiado[plz]||{};
    return { nombre:$('pmcr_nom').value.trim(), cedula:$('pmcr_ced').value.trim(), placa:$('pmcr_pla').value.trim(), moto:$('pmcr_moto').value.trim(),
      factura:fac, fasecolda:fas, garantizar:gar, plazo:plz, contado:cz.contado?cz.contado.protect:0, financiado:fi.total||0, cuota:fi.cuota||0, contrato:cur.c.contrato };
  }
  function recalcular(){
    if(!cur) return;
    cur.guardada = null; // si cambian valores, se guardaría como una cotización nueva
    var q = leer();
    $('pmcr_gar').value = q.garantizar ? cop(q.garantizar) : '';
    if(!(q.garantizar>0)){ $('pmcr_res').innerHTML = 'Escribe la factura y el valor de Fasecolda para calcular.'; return; }
    var a = q.factura>0 ? Math.round(q.factura/1.1) : 0, b = q.fasecolda>0 ? Math.round(q.fasecolda/1.1) : 0;
    $('pmcr_res').innerHTML = 'Factura −10 %: <b>'+(a?cop(a):'—')+'</b> · Fasecolda −10 %: <b>'+(b?cop(b):'—')+'</b> → valor a garantizar <b>'+cop(q.garantizar)+'</b><br>'+
      'Contado: <b>'+cop(q.contado)+'</b> · Financiado '+q.plazo+' meses: <b>'+cop(q.financiado)+'</b> ('+q.plazo+' cuotas de <b>'+cop(q.cuota)+'</b>)';
    if(!cur.editado) $('pmcr_txt').value = mensaje(q);
  }
  function guardar(silencioso){
    var q = leer();
    if(!q.nombre) { setSt('Falta el nombre.','mal'); return Promise.reject(); }
    if(!(q.garantizar>0)){ setSt('Escribe la factura y/o el valor de Fasecolda antes de guardar.','mal'); return Promise.reject(); }
    if(cur.guardada){ setSt('Esta cotización ya quedó guardada ('+cur.guardada+').','bien'); return Promise.resolve(cur.guardada); }
    setSt('Guardando…'); $('pmcr_gua').disabled = true;
    return llamar({action:'cotRen_guardar', nombre:q.nombre, cedula:q.cedula, placa:q.placa, moto:q.moto, factura:q.factura, fasecolda:q.fasecolda,
      contado:q.contado, financiado:q.financiado, plazo:q.plazo, contrato:q.contrato}).then(function(r){
      cur.guardada = r.id; setSt('Cotización guardada: '+r.id+' (estado Pendiente).','bien');
      try{ var k=(q.moto.split(' ').slice(1).join(' ')||q.moto).toUpperCase(); var db=JSON.parse(LS('pm_cotren_fase')||'{}'); db[k]=q.fasecolda; LSset('pm_cotren_fase',JSON.stringify(db)); }catch(e){}
      $('pmcr_gua').disabled = false; if(w.PMCotRen && w.PMCotRen.panelRefrescar) w.PMCotRen.panelRefrescar();
      return r.id;
    }).catch(function(e){ setSt(e.message,'mal'); $('pmcr_gua').disabled=false; throw e; });
  }
  function copiar(){
    var t = $('pmcr_txt').value;
    function ok(){ setSt('Mensaje copiado. Pégalo en WhatsApp.','bien'); }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(ok, function(){ $('pmcr_txt').select(); d.execCommand('copy'); ok(); }); }
    else { $('pmcr_txt').select(); d.execCommand('copy'); ok(); }
  }
  function abrirWA(){
    var q = leer();
    if(!(q.garantizar>0)){ setSt('Primero escribe la factura y el valor de Fasecolda.','mal'); return; }
    var cel = cur.celular || cur.c.celular;
    if(!w.confirm('¿Abrir WhatsApp con el mensaje para '+q.nombre+'?\n\nEl mensaje NO se envía solo: tú lo revisas y le das enviar. Si la cotización no está guardada, se guardará ahora como Pendiente.')) return;
    var abrir2 = function(){ w.open('https://wa.me/'+numWA(cel)+'?text='+encodeURIComponent($('pmcr_txt').value), '_blank'); };
    if(cur.guardada){ abrir2(); return; }
    guardar().then(abrir2, function(){ /* el error ya se mostró; no se abre WhatsApp */ });
  }

  // ---------- Panel ----------
  var DATOS = [];
  function panelRefrescar(){
    var cont = $('pmcr_panel'); if(!cont) return Promise.resolve();
    cont.querySelector('.pmcr-cuerpo').innerHTML = '<p class="pmcr-sub">Cargando cotizaciones…</p>';
    return llamar({action:'cotRen_listar'}).then(function(r){ DATOS = r.cotizaciones||[]; pintar(); })
      .catch(function(e){ cont.querySelector('.pmcr-cuerpo').innerHTML = '<p class="pmcr-st mal">'+esc(e.message)+'</p>'; });
  }
  function pintar(){
    var cont = $('pmcr_panel'); css();
    var f = $('pmcr_filtro') ? $('pmcr_filtro').value : 'todos', b = $('pmcr_busca') ? $('pmcr_busca').value.toLowerCase() : '';
    var tot = DATOS.length, pen = 0, ace = 0, no = 0, con = 0, fin = 0, rc = 0, ap = 0, ase = {};
    DATOS.forEach(function(x){
      if(x.estado==='Pendiente') pen++; else if(x.estado==='Aceptó renovación'){ ace++; if(x.forma==='Contado') con++; else if(x.forma==='Financiado') fin++;
        if(x.rc==='Sí') rc++; if(x.ap==='Sí') ap++; var a=x.aseguradora||'Sin dato'; ase[a]=(ase[a]||0)+1; } else if(x.estado==='No aceptó renovación') no++;
    });
    var resp = ace+no, conv = tot ? Math.round(ace*100/tot) : 0;
    var tiles = [['Total cotizaciones',tot],['Pendientes',pen],['Aceptaron',ace],['No aceptaron',no],['% conversión',conv+' %'],['Contado',con],['Financiado',fin],['Con RC',rc],['Con AP',ap]];
    var h = '<div class="pmcr-tiles">'+tiles.map(function(t){ return '<div class="pmcr-t"><b>'+t[1]+'</b><span>'+t[0]+'</span></div>'; }).join('')+'</div>';
    var ks = Object.keys(ase); if(ks.length) h += '<p class="pmcr-sub"><b>Por aseguradora (aceptadas):</b> '+ks.map(function(k){ return esc(k)+': '+ase[k]; }).join(' · ')+'</p>';
    var lista = DATOS.filter(function(x){
      if(f==='pend' && x.estado!=='Pendiente') return false; if(f==='ace' && x.estado!=='Aceptó renovación') return false; if(f==='no' && x.estado!=='No aceptó renovación') return false;
      return !b || (x.nombre+' '+x.placa+' '+x.cedula+' '+x.id).toLowerCase().indexOf(b)>=0;
    }).reverse();
    h += '<div class="pmcr-tw"><table><thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Placa</th><th>Moto</th><th>Contado</th><th>Financiado</th><th>Plazo</th><th>Estado</th><th>Aseguradora</th><th>Valor final</th><th>Acciones</th></tr></thead><tbody>';
    lista.forEach(function(x){
      var cl = x.estado==='Pendiente'?'p':x.estado==='Aceptó renovación'?'a':'n';
      h += '<tr><td>'+esc(x.id)+'</td><td>'+esc(x.fecha)+'</td><td>'+esc(x.nombre)+'</td><td>'+esc(x.placa)+'</td><td>'+esc(x.moto)+'</td><td>'+cop(x.contado)+'</td><td>'+cop(x.financiado)+'</td><td>'+(x.plazo||'')+'</td>'+
        '<td><span class="pmcr-e '+cl+'">'+esc(x.estado)+'</span></td><td>'+esc(x.aseguradora)+'</td><td>'+(x.valorFinal?cop(x.valorFinal):'')+'</td><td>'+
        (x.estado==='Pendiente' ? '<button class="pmcr-b v" data-a="ace" data-id="'+esc(x.id)+'">Aceptó</button> <button class="pmcr-b r" data-a="no" data-id="'+esc(x.id)+'">No aceptó</button>' : '')+'</td></tr>';
    });
    h += '</tbody></table></div>'; if(!lista.length) h += '<p class="pmcr-sub">No hay cotizaciones en esta vista.</p>';
    cont.querySelector('.pmcr-cuerpo').innerHTML = h;
    Array.prototype.forEach.call(cont.querySelectorAll('button[data-a]'), function(bt){
      bt.onclick = function(){ var x = DATOS.filter(function(y){ return y.id===bt.getAttribute('data-id'); })[0]; if(x) (bt.getAttribute('data-a')==='ace' ? formAcepto : formNoAcepto)(x); };
    });
  }
  function iniciarPanel(cont){
    css();
    cont.innerHTML = '<div id="pmcr_panel"><div class="pmcr-g" style="grid-template-columns:auto auto auto 1fr;align-items:end;margin-bottom:10px">'+
      '<label>Ver<select id="pmcr_filtro"><option value="todos">Todas</option><option value="pend">Pendientes</option><option value="ace">Aceptaron</option><option value="no">No aceptaron</option></select></label>'+
      '<label>Buscar<input id="pmcr_busca" type="search" placeholder="nombre, placa, cédula o ID"></label>'+
      '<button class="pmcr-b g" id="pmcr_ref">Actualizar</button></div><div class="pmcr-cuerpo"></div></div>';
    $('pmcr_filtro').onchange = pintar; $('pmcr_busca').oninput = pintar; $('pmcr_ref').onclick = panelRefrescar;
    return panelRefrescar();
  }

  // ---------- Aceptó / No aceptó ----------
  function formAcepto(x){
    ventana('pmcr_facep',
      '<h3>Aceptó la renovación</h3><p class="pmcr-sub">'+esc(x.nombre)+' · '+esc(x.placa)+' · '+esc(x.id)+'</p>'+
      '<div class="pmcr-g">'+
      '<label>Aseguradora<select id="pa_ase"><option>Protect Motos</option><option>OMS</option><option>Sura</option><option value="__o">Otra…</option></select></label>'+
      '<label id="pa_otl" style="display:none">¿Cuál?<input id="pa_ot"></label>'+
      '<label>Forma de pago<select id="pa_for"><option value="Contado">Contado</option><option value="Financiado">Financiado</option></select></label>'+
      '<label id="pa_plzl" style="display:none">Plazo (meses)<select id="pa_plz"><option>3</option><option>6</option><option selected>12</option></select></label>'+
      '<label>¿Lleva RC?<select id="pa_rc"><option>No</option><option>Sí</option></select></label>'+
      '<label>¿Lleva AP?<select id="pa_ap"><option>No</option><option>Sí</option></select></label>'+
      '<label>Valor final contratado<input id="pa_val" inputmode="numeric" placeholder="$"></label>'+
      '<label class="ancho">Observaciones<textarea id="pa_obs" rows="2"></textarea></label></div>'+
      '<div class="pmcr-st" id="pa_st"></div><div class="pmcr-bar"><button class="pmcr-b v" id="pa_ok">Guardar aceptación</button><button class="pmcr-b g" id="pa_x">Cancelar</button></div>');
    $('pa_val').value = (x.financiado||x.contado) ? Number(x.contado||0).toLocaleString('es-CO') : '';
    $('pa_ase').onchange = function(){ $('pa_otl').style.display = this.value==='__o' ? '' : 'none'; };
    $('pa_for').onchange = function(){ var fi=this.value==='Financiado'; $('pa_plzl').style.display = fi?'':'none'; $('pa_val').value = (fi?x.financiado:x.contado) ? Number(fi?x.financiado:x.contado).toLocaleString('es-CO') : ''; };
    $('pa_x').onclick = function(){ cerrar('pmcr_facep'); };
    $('pa_ok').onclick = function(){
      var ase = $('pa_ase').value==='__o' ? $('pa_ot').value.trim() : $('pa_ase').value, st=$('pa_st');
      if(!ase){ st.textContent='Escribe la aseguradora.'; st.className='pmcr-st mal'; return; }
      var fo = $('pa_for').value, val = num($('pa_val').value);
      if(!(val>0)){ st.textContent='Escribe el valor final contratado.'; st.className='pmcr-st mal'; return; }
      if(!w.confirm('¿Confirmas que '+x.nombre+' ACEPTÓ la renovación con '+ase+' ('+fo+', '+cop(val)+')?')) return;
      $('pa_ok').disabled = true; st.textContent='Guardando…'; st.className='pmcr-st';
      llamar({action:'cotRen_estado', id:x.id, estado:'Aceptó renovación', aseguradora:ase, forma:fo, plazo:fo==='Financiado'?$('pa_plz').value:'', rc:$('pa_rc').value, ap:$('pa_ap').value, valorFinal:val, obs:$('pa_obs').value})
        .then(function(){ cerrar('pmcr_facep'); return panelRefrescar(); })
        .catch(function(e){ st.textContent=e.message; st.className='pmcr-st mal'; $('pa_ok').disabled=false; });
    };
  }
  function formNoAcepto(x){
    ventana('pmcr_fno',
      '<h3>No aceptó la renovación</h3><p class="pmcr-sub">'+esc(x.nombre)+' · '+esc(x.placa)+' · '+esc(x.id)+'</p>'+
      '<div class="pmcr-g"><label class="ancho">Motivo (opcional)<textarea id="pn_obs" rows="2" placeholder="Ej.: precio, ya renovó en otra parte, vendió la moto…"></textarea></label></div>'+
      '<div class="pmcr-st" id="pn_st"></div><div class="pmcr-bar"><button class="pmcr-b r" id="pn_ok">Guardar</button><button class="pmcr-b g" id="pn_x">Cancelar</button></div>');
    $('pn_x').onclick = function(){ cerrar('pmcr_fno'); };
    $('pn_ok').onclick = function(){
      if(!w.confirm('¿Confirmas que '+x.nombre+' NO aceptó la renovación?')) return;
      $('pn_ok').disabled = true;
      llamar({action:'cotRen_estado', id:x.id, estado:'No aceptó renovación', obs:$('pn_obs').value})
        .then(function(){ cerrar('pmcr_fno'); return panelRefrescar(); })
        .catch(function(e){ $('pn_st').textContent=e.message; $('pn_st').className='pmcr-st mal'; $('pn_ok').disabled=false; });
    };
  }

  w.PMCotRen = { abrir:abrir, iniciarPanel:iniciarPanel, panelRefrescar:panelRefrescar, _mensaje:mensaje };
})(window);

/* PROTECT MOTOS — Facturación Mundial: lectura de la hoja «Estado de Facturas» y alertas de pago.
   Lo usan el módulo «Facturación Mundial» y el Inicio (misma regla en los dos). La hoja se pide al conector único. */
(function(w){
  'use strict';
  function norm(s){return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
  function num(v){if(typeof v==='number')return v;var t=String(v==null?'':v).replace(/[$\s]/g,'');if(!t||t==='-')return 0;if(/,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');else t=t.replace(/[.,](?=\d{3}(\D|$))/g,'');var n=parseFloat(t);return isNaN(n)?0:n}
  function fecha(v){var t=String(v==null?'':v).trim(),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(t);if(m)return {y:+m[1],m:+m[2],d:+m[3],iso:m[1]+'-'+m[2]+'-'+m[3]};m=/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(t);return m?{y:+m[3],m:+m[2],d:+m[1],iso:m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2)}:null}
  function LS(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
  function interpretar(A){
    var hi=-1,c={};
    for(var i=0;i<Math.min(A.length,30)&&hi<0;i++){var H=(A[i]||[]).map(norm);if(H.some(function(h){return /^valor cobrado/.test(h)})&&H.some(function(h){return /factura/.test(h)})){hi=i;
      H.forEach(function(h,j){
        if(/factura/.test(h)&&/retorno/.test(h))c.fret=j; else if(c.fac==null&&/factura/.test(h))c.fac=j; else if(/periodo.*desde/.test(h))c.des=j; else if(/periodo.*hasta/.test(h))c.has=j; else if(/^#?\s*poliza/.test(h))c.pol=j; else if(/^producto/.test(h))c.prod=j;
        else if(/^valor cobrado/.test(h))c.val=j; else if(/prima base/.test(h))c.prima=j; else if(/retorno/.test(h)&&!/factura/.test(h))c.ret=j; else if(/^%/.test(h))c.pct=j; else if(/^estado/.test(h))c.est=j; else if(/fecha limite/.test(h))c.lim=j; else if(/observ/.test(h))c.obs=j; else if(/^#?\s*cobro/.test(h))c.cob=j; else if(/radicado/.test(h)&&/home/.test(h))c.rh=j; else if(/radicado/.test(h)&&/correo|rc/.test(h))c.rc=j;
      })}}
    if(hi<0)throw new Error('No encontré la fila de títulos. Busco una columna «#Factura de pago» y otra «Valor cobrado».');
    var out=[];
    for(var k=hi+1;k<A.length;k++){var w=A[k]||[];var val=num(w[c.val]);var fac=String(w[c.fac]==null?'':w[c.fac]).trim();if(!fac&&!val)continue;
      out.push({fila:k+1,facRaw:fac,rh:String(w[c.rh]==null?'':w[c.rh]).trim(),fret:String(w[c.fret]==null?'':w[c.fret]).trim(),rc:String(w[c.rc]==null?'':w[c.rc]).trim(),cob:String(w[c.cob]==null?'':w[c.cob]).trim(),pct:w[c.pct]==null?'':w[c.pct],fac:fac||'(sin factura)',des:fecha(w[c.des]),has:fecha(w[c.has]),pol:String(w[c.pol]==null?'':w[c.pol]).trim(),prod:String(w[c.prod]||'').trim().toUpperCase()||'SIN DATO',val:val,prima:num(w[c.prima]),ret:num(w[c.ret]),est:String(w[c.est]==null?'':w[c.est]).trim(),lim:fecha(w[c.lim]),obs:String(w[c.obs]||'').trim()})}
    return out;
  }
  function mapaEst(){try{return JSON.parse(LS('pm_mundial_estados')||'{}')}catch(e){return {}}}
  function claseEst(txt){var m=mapaEst(),k=norm(txt)||'(vacío)';if(m[k])return m[k];if(/pagad|cancelad|abonad|cubiert/.test(k))return 'pagado';if(/anulad|devuelt|reversad/.test(k))return 'ignorar';return 'pendiente'}
  /* Facturas por pagar agrupadas, con los días que faltan para la fecha límite (negativo = ya venció) */
  function pendientes(rows,hoy){
    hoy=hoy||new Date();var h0=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()),g={};
    rows.forEach(function(r){if(claseEst(r.est)!=='pendiente')return;var o=g[r.fac]=g[r.fac]||{fac:r.fac,des:r.des,has:r.has,n:0,val:0,ret:0,lim:null,est:{}};o.n++;o.val+=r.val;o.ret+=r.ret;if(r.lim&&(!o.lim||r.lim.iso<o.lim.iso))o.lim=r.lim;if(r.est)o.est[r.est]=1});
    return Object.keys(g).map(function(k){var o=g[k];o.dias=o.lim?Math.round((new Date(o.lim.y,o.lim.m-1,o.lim.d)-h0)/86400000):null;o.nivel=o.dias===null?'sinfecha':o.dias<0?'vencida':o.dias<=3?'urgente':o.dias<=7?'pronto':'enplazo';return o})
      .sort(function(a,b){return (a.dias===null?9e9:a.dias)-(b.dias===null?9e9:b.dias)});
  }
  function resumenAlertas(lista){var r={ven:0,vVen:0,urg:0,vUrg:0,pro:0,vPro:0,sin:0};lista.forEach(function(o){if(o.nivel==='vencida'){r.ven++;r.vVen+=o.val}else if(o.nivel==='urgente'){r.urg++;r.vUrg+=o.val}else if(o.nivel==='pronto'){r.pro++;r.vPro+=o.val}else if(o.nivel==='sinfecha')r.sin++});return r}
  function llamar(id,hoja){
    return new Promise(function(ok,mal){
      var url=LS('pm_crm_url'),tok=LS('pm_crm_token')||'PM-CRM-2026';
      if(!url){mal(new Error('Falta conectar el conector único: en el menú, Conexiones → Conector único.'));return}
      var cb='pm_mu_'+Date.now()+'_'+Math.floor(Math.random()*1e6),s=document.createElement('script'),fin=false;
      var t=setTimeout(function(){if(fin)return;fin=true;lim();mal(new Error('El conector no respondió a tiempo. Revise que publicó «Nueva versión» con el código crm-12 y que ejecutó AUTORIZAR_TODO.'))},60000);
      function lim(){clearTimeout(t);try{delete w[cb]}catch(e){w[cb]=undefined}if(s.parentNode)s.parentNode.removeChild(s)}
      w[cb]=function(r){if(fin)return;fin=true;lim();ok(r)};s.onerror=function(){if(fin)return;fin=true;lim();mal(new Error('No se pudo contactar el conector.'))};
      s.src=url+(url.indexOf('?')<0?'?':'&')+'action=mundial_leer&token='+encodeURIComponent(tok)+'&sheetId='+encodeURIComponent(id||'')+'&hoja='+encodeURIComponent(hoja||'')+'&callback='+cb+'&_='+Date.now();document.body.appendChild(s);
    }).then(function(r){if(!r||r.ok===false){var m=(r&&r.error)||'Respuesta inválida.';if(/Acción no disponible/.test(m))m='El conector todavía no lee las facturas de Mundial: pegue el código nuevo (Codigo_UNICO.gs) y publique «Nueva versión».';throw new Error(m)}return r});
  }
  w.PMMundial={norm:norm,num:num,fecha:fecha,interpretar:interpretar,mapaEst:mapaEst,claseEst:claseEst,pendientes:pendientes,resumenAlertas:resumenAlertas,leer:function(){return llamar(LS('pm_mundial_sheet'),LS('pm_mundial_tab')).then(function(r){return {r:r,filas:interpretar(r.filas||[])}})}};
})(window);

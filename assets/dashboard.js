/* PROTECT MOTOS — Dashboard: todas las gráficas en una sola pantalla, casi sin texto.
   No pide datos nuevos ni toca el Inicio: dibuja con lo que el Inicio ya leyó (Cobros, Dugo Motos, banco, Mundial, SOAT y OMS).
   Solo un selector de año; cada gráfica lleva un título corto y los números van sobre las barras. */
(function(w){
  'use strict';
  var MES=['E','F','M','A','M','J','J','A','S','O','N','D'],MESL=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var AZ='#4a8fe0',DO='#c58a1b',NA='#1e3a8a',GR='#5b78c7',VE='#1f9d55',RO='#d64545',DR='#fdc33e';
  var Y=null,timer=null,montado=false,FIRMA='';
  function $(i){return document.getElementById(i)}
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function cop(n){return '$'+Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
  function corto(n){n=Math.round(n||0);return n>=1e6?(Math.round(n/1e5)/10).toString().replace('.',',')+'M':n>=1e3?Math.round(n/1e3)+'k':String(n)}
  function ceros(){var a=[],i;for(i=0;i<12;i++)a.push(0);return a}

  var CSS='\
#v-dashboard{overflow:auto;padding:22px 26px 40px;--dbc:#131d38;--dbt:#e8eefc;--dbs:#a3b4d8;--dbl:#2a3b70;background:radial-gradient(1100px 520px at 12% -8%,#1c2f6b 0,transparent 62%),#0a1124;color:var(--dbt)}\
body.inicio-claro #v-dashboard{--dbc:#fff;--dbt:#13223f;--dbs:#5f6f93;--dbl:#e1e7f2;background:linear-gradient(180deg,#e9eef8 0,#f5f7fb 380px,#f5f7fb 100%)}\
#v-dashboard .db-top{display:flex;align-items:center;gap:14px;margin-bottom:16px}\
#v-dashboard .db-top h1{margin:0;font-size:1.7rem;color:var(--dbt)}\
#v-dashboard .db-top select{margin-left:auto;background:var(--dbc);color:var(--dbt);border:1px solid var(--dbl);border-radius:10px;padding:8px 12px;font-size:.95rem}\
#v-dashboard .db-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}\
#v-dashboard .db-c{background:var(--dbc);border:1px solid var(--dbl);border-top:3px solid var(--dorado,#d6a417);border-radius:16px;padding:14px 16px 12px;min-width:0;display:flex;flex-direction:column}\
#v-dashboard .db-c h3{margin:0 0 8px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--dbs);font-weight:700;display:flex;align-items:center;gap:8px}\
#v-dashboard .db-c h3 i{display:inline-block;width:7px;height:7px;border-radius:50%}\
#v-dashboard .s3{grid-column:span 3} #v-dashboard .s4{grid-column:span 4} #v-dashboard .s6{grid-column:span 6} #v-dashboard .s8{grid-column:span 8} #v-dashboard .s12{grid-column:span 12}\
@media(max-width:1100px){#v-dashboard .s3,#v-dashboard .s4{grid-column:span 6} #v-dashboard .s6,#v-dashboard .s8{grid-column:span 12}}\
@media(max-width:640px){#v-dashboard .db-grid>*{grid-column:span 12!important}}\
#v-dashboard .db-k{display:flex;flex-direction:column;justify-content:center;gap:2px}\
#v-dashboard .db-k b{font-size:2rem;line-height:1.1;color:var(--dbt)} #v-dashboard .db-k span{font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dbs);font-weight:700}\
#v-dashboard .db-g{display:flex;align-items:flex-end;gap:6px;height:170px;padding:16px 2px 20px} #v-dashboard .db-m{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative;min-width:0}\
#v-dashboard .db-bb{display:flex;align-items:flex-end;justify-content:center;gap:2px;width:100%;height:100%}\
#v-dashboard .db-b{flex:1;max-width:22px;border-radius:4px 4px 0 0;position:relative;min-height:0}\
#v-dashboard .db-b b{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);font-size:.58rem;font-weight:700;color:var(--dbs);white-space:nowrap;margin-bottom:2px}\
#v-dashboard .db-m>span{position:absolute;bottom:-18px;font-size:.66rem;color:var(--dbs)}\
#v-dashboard .db-m.act>span{color:var(--dbt);font-weight:700}\
#v-dashboard .db-h{display:flex;flex-direction:column;gap:7px;padding:4px 0}\
#v-dashboard .db-hr{display:grid;grid-template-columns:78px 1fr 34px;align-items:center;gap:8px;font-size:.78rem;color:var(--dbs)}\
#v-dashboard .db-hr div{height:12px;background:rgba(127,140,170,.18);border-radius:6px;overflow:hidden} #v-dashboard .db-hr i{display:block;height:100%;border-radius:6px;background:'+AZ+'} #v-dashboard .db-hr b{color:var(--dbt);text-align:right}\
#v-dashboard .db-hr span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#v-dashboard .db-dn{display:flex;align-items:center;justify-content:center;gap:16px;flex:1;padding:6px 0}\
#v-dashboard .db-ring{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;flex:none} #v-dashboard .db-ring div{width:92px;height:92px;border-radius:50%;background:var(--dbc);display:grid;place-items:center;font-size:1.35rem;font-weight:700;color:var(--dbt)}\
#v-dashboard .db-lg{display:flex;flex-direction:column;gap:6px;font-size:.78rem;color:var(--dbs)} #v-dashboard .db-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px} #v-dashboard .db-lg b{color:var(--dbt);margin-left:4px}\
#v-dashboard .db-ley{display:flex;gap:14px;font-size:.72rem;color:var(--dbs);margin:0 0 -6px} #v-dashboard .db-ley i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}\
#v-dashboard .db-vac{flex:1;display:grid;place-items:center;color:var(--dbs);font-size:.8rem;min-height:120px}';

  function montar(){
    if(montado)return;var v=$('v-dashboard');if(!v)return;montado=true;
    var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    v.innerHTML='<div class="db-top"><h1>Dashboard</h1><select id="dbAnio" aria-label="Año"></select></div><div class="db-grid" id="dbGrid"></div>';
    $('dbAnio').addEventListener('change',function(){Y=+this.value;FIRMA='';pintar()});
  }
  function tarjeta(cls,titulo,color,cuerpo){return '<div class="db-c '+cls+'"><h3><i style="background:'+color+'"></i>'+esc(titulo)+'</h3>'+cuerpo+'</div>'}
  function kpi(cls,titulo,valor,color){return tarjeta(cls,titulo,color,'<div class="db-k"><b>'+valor+'</b></div>')}
  function columnas(series,ley){
    var max=1,i;series.forEach(function(s){s.v.forEach(function(x){if(x>max)max=x})});
    var hoy=new Date(),mAct=(Y===hoy.getFullYear())?hoy.getMonth():-1;
    var ok=series.some(function(s){return s.v.some(function(x){return x>0})});
    if(!ok)return '<div class="db-vac">—</div>';
    return (ley?'<div class="db-ley">'+series.map(function(s){return '<span><i style="background:'+s.c+'"></i>'+esc(s.n)+'</span>'}).join('')+'</div>':'')+
      '<div class="db-g">'+MES.map(function(l,i){
        var tip=MESL[i]+' '+Y+': '+series.map(function(s){return (s.n?s.n+' ':'')+(s.f?s.f(s.v[i]):s.v[i])}).join(' · ');
        return '<div class="db-m'+(i===mAct?' act':'')+'" title="'+esc(tip)+'"><div class="db-bb">'+series.map(function(s){var h=s.v[i]?Math.max(3,Math.round(s.v[i]/max*100)):0;return '<div class="db-b" style="height:'+h+'%;background:'+s.c+'">'+(s.v[i]?'<b>'+(s.f?s.f(s.v[i]):s.v[i])+'</b>':'')+'</div>'}).join('')+'</div><span>'+l+'</span></div>'}).join('')+'</div>';
  }
  function aro(partes){   // partes: [{n,v,c}]
    var t=partes.reduce(function(a,p){return a+p.v},0);if(!t)return '<div class="db-vac">—</div>';
    var acc=0,grad=partes.map(function(p){var a=acc/t*100;acc+=p.v;return p.c+' '+a+'% '+(acc/t*100)+'%'}).join(',');
    return '<div class="db-dn"><div class="db-ring" style="background:conic-gradient('+grad+')"><div>'+Math.round(partes[0].v/t*100)+'%</div></div><div class="db-lg">'+partes.map(function(p){return '<span><i style="background:'+p.c+'"></i>'+esc(p.n)+'<b>'+p.v+'</b></span>'}).join('')+'</div></div>';
  }

  function datos(){
    var d={ok:false,anios:{}},R=w.PM_REP,i;
    d.cont=ceros();d.fin=ceros();d.ases={};d.rc=0;d.sinrc=0;d.ap=0;d.est={ACTIVO:0,FINALIZADO:0,CANCELADO:0};
    if(R){d.ok=true;
      Object.keys(R.cf||{}).forEach(function(k){k=+k;var y=Math.floor((k-1)/12),m=k-y*12;d.anios[y]=1;if(y===Y){d.cont[m-1]+=R.cf[k].C||0;d.fin[m-1]+=R.cf[k].F||0}});
      (R.rcs||[]).forEach(function(r){var y=Math.floor((r.k-1)/12);d.anios[y]=1;if(y!==Y)return;d.ases[r.a]=(d.ases[r.a]||0)+1;if(r.rc)d.rc++;else d.sinrc++;if(r.ap)d.ap++});
      (R.ecs||[]).forEach(function(e){if(d.est[e.e]!==undefined)d.est[e.e]++;if(e.y)d.anios[e.y]=1});
    }
    d.dugo=ceros();var C=w.PM_CONS;if(C&&C.meses)C.meses.forEach(function(o){d.anios[o.anio]=1;if(o.anio===Y)d.dugo[o.mes-1]+=(o.auto!=null?o.auto:(o.c||o.d||0))});
    d.banco=ceros();d.bancoN=0;var B=w.PM_BK;if(B&&B.filas)B.filas.forEach(function(o){d.anios[o.y]=1;if(o.y===Y){d.banco[o.m-1]+=o.v;d.bancoN++}});
    d.mun=ceros();d.munR=ceros();var M=w.PM_MUN;if(M&&M.filas&&w.PMMundial)M.filas.forEach(function(r){var f=r.des||r.has;if(!f)return;d.anios[f.y]=1;if(f.y!==Y||w.PMMundial.claseEst(r.est)==='ignorar')return;d.mun[f.m-1]+=r.val;d.munR[f.m-1]+=r.ret});
    d.soat=ceros();d.soatG=ceros();var S=w.PM_SOAT;if(S&&S.soat)S.soat.forEach(function(x){var m=/^(\d{4})-(\d{2})/.exec(x.fechaISO||'');if(!m)return;d.anios[+m[1]]=1;if(+m[1]===Y){d.soat[+m[2]-1]++;d.soatG[+m[2]-1]+=Number(x.ganancia)||0}});
    d.oms=ceros();var O=w.PM_OMS;if(O&&O.contratos)O.contratos.forEach(function(c){var m=/^(\d{4})-(\d{2})/.exec(c.fechaFirmaISO||'');if(!m||!String(c.cliente||'').trim())return;d.anios[+m[1]]=1;if(+m[1]===Y)d.oms[+m[2]-1]++});
    return d;
  }
  function pintar(){
    montar();var g=$('dbGrid');if(!g)return;
    var hoy=new Date();if(Y===null)Y=hoy.getFullYear();
    var d=datos();
    var firma=Y+'|'+JSON.stringify([d.cont,d.fin,d.ases,d.rc,d.sinrc,d.ap,d.est,d.dugo,d.banco,d.mun,d.munR,d.soat,d.oms,Object.keys(d.anios).length,(w.PMK||{}).contratos]);
    if(firma===FIRMA&&g.innerHTML)return;FIRMA=firma;
    var ys=Object.keys(d.anios).map(Number).filter(function(y){return y>2000}).sort().reverse();if(ys.indexOf(hoy.getFullYear())<0)ys.unshift(hoy.getFullYear());if(ys.indexOf(Y)<0){Y=ys[0]}
    $('dbAnio').innerHTML=ys.map(function(y){return '<option'+(y===Y?' selected':'')+'>'+y+'</option>'}).join('');
    var K=w.PMK||{},mAct=hoy.getMonth(),esAct=Y===hoy.getFullYear();
    var meta=105;try{meta=+localStorage.getItem('pm_meta_contratos')||105}catch(e){}
    var contMes=K.contratos!=null?K.contratos:null;
    var tCont=d.cont.reduce(function(a,b){return a+b},0)+d.fin.reduce(function(a,b){return a+b},0);
    var tBanco=d.banco.reduce(function(a,b){return a+b},0),tDugo=d.dugo.reduce(function(a,b){return a+b},0),tRet=d.munR.reduce(function(a,b){return a+b},0),tMun=d.mun.reduce(function(a,b){return a+b},0);
    var tSoat=d.soat.reduce(function(a,b){return a+b},0),tOms=d.oms.reduce(function(a,b){return a+b},0);
    var h='';
    h+=kpi('s3','Contratos '+Y,tCont||'—',AZ)+kpi('s3','Consignado al banco',tBanco?corto(tBanco):'—',DR)+kpi('s3','Valor cobrado Dugo',tDugo?corto(tDugo):'—',GR)+kpi('s3','Retorno Mundial',tRet?corto(tRet):'—',DO);
    h+=tarjeta('s8','Contratos',AZ,columnas([{n:'Contado',v:d.cont,c:DR},{n:'Financiado',v:d.fin,c:AZ}],true));
    var pm=esAct&&contMes!=null?Math.min(100,Math.round(contMes/meta*100)):null;
    h+=tarjeta('s4','Meta del mes',VE,pm===null?'<div class="db-vac">—</div>':'<div class="db-dn"><div class="db-ring" style="background:conic-gradient('+VE+' 0 '+pm+'%,rgba(127,140,170,.25) '+pm+'% 100%)"><div>'+pm+'%</div></div><div class="db-lg"><span><b style="margin:0;font-size:1.3rem">'+contMes+'</b> / '+meta+'</span></div></div>');
    var as=Object.keys(d.ases).map(function(a){return [a,d.ases[a]]}).sort(function(a,b){return b[1]-a[1]}).slice(0,8),amax=as.length?as[0][1]:1;
    h+=tarjeta('s4','Asesores',AZ,as.length?'<div class="db-h">'+as.map(function(x){return '<div class="db-hr"><span title="'+esc(x[0])+'">'+esc(x[0])+'</span><div><i style="width:'+Math.round(x[1]/amax*100)+'%"></i></div><b>'+x[1]+'</b></div>'}).join('')+'</div>':'<div class="db-vac">—</div>');
    h+=tarjeta('s4','RC',DO,aro([{n:'Con RC',v:d.rc,c:DO},{n:'Sin RC',v:d.sinrc,c:'rgba(127,140,170,.35)'}]));
    h+=tarjeta('s4','Clientes',VE,aro([{n:'Activos',v:d.est.ACTIVO,c:VE},{n:'Finalizados',v:d.est.FINALIZADO,c:AZ},{n:'Cancelados',v:d.est.CANCELADO,c:RO}]));
    h+=tarjeta('s6','Valor cobrado a Dugo Motos',GR,columnas([{v:d.dugo,c:GR,f:corto}],false));
    h+=tarjeta('s6','Banco',DR,columnas([{v:d.banco,c:AZ,f:corto}],false));
    h+=tarjeta('s6','Mundial',DO,columnas([{n:'Consignado',v:d.mun,c:AZ,f:corto},{n:'Retorno',v:d.munR,c:DO,f:corto}],true));
    h+=tarjeta('s3','SOAT',NA,columnas([{v:d.soat,c:NA}],false));
    h+=tarjeta('s3','OMS',GR,columnas([{v:d.oms,c:GR}],false));
    g.innerHTML=h;
  }
  function activo(){return location.hash==='#dashboard'}
  function ciclo(){
    clearInterval(timer);if(!activo())return;pintar();
    // los datos llegan solos desde el Inicio (cada minuto); aquí solo se vuelve a dibujar
    try{if(w.cargarBanco)w.cargarBanco();if(w.cargarMundialAl)w.cargarMundialAl()}catch(e){}
    var n=0;timer=setInterval(function(){if(!activo()){clearInterval(timer);return}n++;pintar()},n<20?3000:10000);
  }
  w.addEventListener('hashchange',ciclo);document.addEventListener('pm-cobros',function(){if(activo())pintar()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ciclo);else ciclo();
  w.pmDashboard={pintar:pintar};
})(window);

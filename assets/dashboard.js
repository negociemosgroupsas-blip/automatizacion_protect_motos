/* PROTOTIPO — Dashboard v3: un tipo de gráfica distinto según lo que se muestra, títulos claros, letra del CRM (Lato) y paleta de tablero profesional. */
(function(w){
  'use strict';
  var MES=['E','F','M','A','M','J','J','A','S','O','N','D'],MESL=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var BL='#3b82f6',BL2='#1d4ed8',TE='#14b8a6',AM='#f5a524',SL='#94a3b8',RJ='#ef6a6a',NV='#1e3a8a';
  var Y=null,timer=null,montado=false,FIRMA='',uid=0;
  function $(i){return document.getElementById(i)}
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function corto(n){return '$ '+Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
  function ceros(){var a=[],i;for(i=0;i<12;i++)a.push(0);return a}
  function suma(a){return a.reduce(function(p,q){return p+q},0)}
  var CSS='\
#v-dashboard{overflow:auto;padding:24px 28px 44px;--cd:#111c3a;--bd:rgba(148,170,230,.16);--tx:#eaf0ff;--sb:#9db0dc;--gl:rgba(148,170,230,.16);--sh:0 10px 28px rgba(2,6,20,.35);background:#0b1226;color:var(--tx)}\
body.inicio-claro #v-dashboard{--cd:#ffffff;--bd:#e2e8f3;--tx:#12203f;--sb:#64748b;--gl:rgba(100,116,139,.18);--sh:0 6px 20px rgba(30,58,138,.07);background:#f1f4f9}\
#v-dashboard .d-top{display:flex;align-items:center;gap:14px;margin-bottom:18px}\
#v-dashboard .d-top h1{margin:0;font-size:1.7rem;color:var(--tx)} #v-dashboard .d-top .pt{width:9px;height:9px;border-radius:50%;background:'+TE+';box-shadow:0 0 0 5px rgba(20,184,166,.22)}\
#v-dashboard .d-top select{margin-left:auto;background:var(--cd);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:9px 16px;font-size:.95rem}\
#v-dashboard .d-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}\
#v-dashboard .d-c{background:var(--cd);border:1px solid var(--bd);border-radius:16px;padding:16px 18px 14px;box-shadow:var(--sh);min-width:0}\
#v-dashboard .hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}\
#v-dashboard .hd h3{margin:0;font-size:.98rem;color:var(--tx);font-weight:700;letter-spacing:.1px}\
#v-dashboard .hd .bar{width:4px;height:18px;border-radius:3px;background:var(--ac,'+BL+')}\
#v-dashboard .hd .tt{margin-left:auto;font-size:.82rem;font-weight:700;color:var(--ac,'+BL+');background:var(--bg2,rgba(59,130,246,.12));padding:4px 11px;border-radius:999px;white-space:nowrap}\
#v-dashboard .s3{grid-column:span 3} #v-dashboard .s4{grid-column:span 4} #v-dashboard .s5{grid-column:span 5} #v-dashboard .s6{grid-column:span 6} #v-dashboard .s7{grid-column:span 7} #v-dashboard .s8{grid-column:span 8} #v-dashboard .s12{grid-column:span 12}\
@media(max-width:1200px){#v-dashboard .s3,#v-dashboard .s4,#v-dashboard .s5{grid-column:span 6} #v-dashboard .s6,#v-dashboard .s7,#v-dashboard .s8{grid-column:span 12}}\
@media(max-width:700px){#v-dashboard .d-grid>*{grid-column:span 12!important}}\
#v-dashboard .k-n{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}\
#v-dashboard .k-n b{font-size:1.45rem;line-height:1;font-weight:700;letter-spacing:-.4px} #v-dashboard .k-s{font-size:.74rem;color:var(--sb);margin-top:4px}\
#v-dashboard .dl{font-size:.74rem;font-weight:700;border-radius:999px;padding:4px 9px;white-space:nowrap} #v-dashboard .dl.up{color:#0f766e;background:rgba(20,184,166,.16)} #v-dashboard .dl.dn{color:#b91c1c;background:rgba(239,106,106,.18)}\
body:not(.inicio-claro) #v-dashboard .dl.up{color:#5eead4} body:not(.inicio-claro) #v-dashboard .dl.dn{color:#fca5a5}\
#v-dashboard svg.ch{display:block;width:100%;height:auto;overflow:visible} #v-dashboard svg text{fill:var(--sb);font-family:inherit}\
#v-dashboard .ley{display:flex;gap:16px;flex-wrap:wrap;font-size:.76rem;color:var(--sb);margin:0 0 4px} #v-dashboard .ley i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px} #v-dashboard .ley i.l{height:3px;width:16px;border-radius:2px;vertical-align:3px}\
#v-dashboard .ring{display:flex;align-items:center;justify-content:center;gap:20px;padding:6px 0} #v-dashboard .ring svg{width:150px;height:150px;flex:none}\
#v-dashboard .lg{display:flex;flex-direction:column;gap:9px;font-size:.84rem;color:var(--sb)} #v-dashboard .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px} #v-dashboard .lg b{color:var(--tx);margin-left:6px;font-size:.98rem}\
#v-dashboard .rk{display:flex;flex-direction:column;gap:11px;margin-top:4px} #v-dashboard .rk div.f{display:grid;grid-template-columns:96px 1fr 34px;align-items:center;gap:10px;font-size:.84rem}\
#v-dashboard .rk .nm{color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600} #v-dashboard .rk .br{height:11px;background:var(--gl);border-radius:6px;overflow:hidden} #v-dashboard .rk .br i{display:block;height:100%;border-radius:6px} #v-dashboard .rk b{text-align:right;color:var(--tx)}\
#v-dashboard .seg{display:flex;height:22px;border-radius:11px;overflow:hidden;margin:10px 0 14px;background:var(--gl)} #v-dashboard .seg i{display:block;height:100%}\
#v-dashboard .sg-l{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center} #v-dashboard .sg-l div{background:var(--gl);border-radius:10px;padding:9px 4px} #v-dashboard .sg-l b{display:block;font-size:1.25rem;color:var(--tx)} #v-dashboard .sg-l span{font-size:.74rem;color:var(--sb)}\
#v-dashboard .vac{display:grid;place-items:center;color:var(--sb);min-height:110px}';
  function curva(pts){if(pts.length<2)return '';var d='M'+pts[0][0]+','+pts[0][1];for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;d+=' C'+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+','+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+' '+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+','+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+' '+p2[0]+','+p2[1]}return d}
  var EJE={l:10,r:10,t:22,b:24};
  function base(W,H,mAct,max){var iw=W-EJE.l-EJE.r,ih=H-EJE.t-EJE.b,o='',q,i;for(q=0;q<=3;q++){var yy=EJE.t+ih*q/3;o+='<line x1="'+EJE.l+'" x2="'+(W-EJE.r)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--gl)" stroke-width="1"'+(q<3?' stroke-dasharray="3 4"':'')+'/>'}
    for(i=0;i<12;i++)o+='<text x="'+(EJE.l+iw*(i+.5)/12)+'" y="'+(H-7)+'" font-size="11" text-anchor="middle"'+(i===mAct?' style="fill:var(--tx);font-weight:700"':'')+'>'+MES[i]+'</text>';return {o:o,iw:iw,ih:ih}}
  function yv(v,max,ih){return Math.round(EJE.t+ih-(v/max)*ih)}
  /* 1) columnas apiladas (contado + financiado) con el total encima */
  function apiladas(a,b,ca,cb,W,H,mAct){var max=1,i;for(i=0;i<12;i++)max=Math.max(max,a[i]+b[i]);max*=1.12;var g=base(W,H,mAct),o=g.o,bw=Math.min(34,g.iw/12*.62);
    for(i=0;i<12;i++){var x=EJE.l+g.iw*(i+.5)/12-bw/2,ya=yv(a[i],max,g.ih),yb=yv(a[i]+b[i],max,g.ih);if(a[i])o+='<rect x="'+x+'" y="'+ya+'" width="'+bw+'" height="'+(EJE.t+g.ih-ya)+'" fill="'+ca+'"/>';if(b[i])o+='<rect x="'+x+'" y="'+yb+'" width="'+bw+'" height="'+(ya-yb)+'" rx="'+(a[i]?0:5)+'" fill="'+cb+'"/>';if(a[i]+b[i])o+='<text x="'+(x+bw/2)+'" y="'+(yb-6)+'" font-size="11" font-weight="700" text-anchor="middle" style="fill:var(--tx)">'+(a[i]+b[i])+'</text>'}
    return '<svg class="ch" viewBox="0 0 '+W+' '+H+'">'+o+'</svg>'}
  /* 2) área suave (flujo continuo) */
  function area(v,c,W,H,mAct,f){var max=Math.max.apply(null,v.concat([1]))*1.15,g=base(W,H,mAct),id='a'+(++uid),last=-1,i,mx=0;v.forEach(function(x,k){if(x>0)last=k;if(x>v[mx])mx=k});
    var pts=v.map(function(x,k){return [Math.round(EJE.l+g.iw*(k+.5)/12),yv(x,max,g.ih)]}),P=last>=0?pts.slice(0,last+1):[];if(P.length<2)return '<div class="vac">—</div>';
    var d=curva(P),o=g.o+'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+c+'" stop-opacity=".4"/><stop offset="100%" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs><path d="'+d+' L'+P[P.length-1][0]+','+(EJE.t+g.ih)+' L'+P[0][0]+','+(EJE.t+g.ih)+' Z" fill="url(#'+id+')"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2.8" stroke-linecap="round"/>';
    [mx,last].forEach(function(k,j){if(j&&(k===mx||last-mx<2))return;o+='<circle cx="'+pts[k][0]+'" cy="'+pts[k][1]+'" r="4" fill="var(--cd)" stroke="'+c+'" stroke-width="2.4"/><text x="'+pts[k][0]+'" y="'+(pts[k][1]-10)+'" font-size="11" font-weight="700" text-anchor="middle" style="fill:var(--tx)">'+f(v[k])+'</text>'});
    return '<svg class="ch" viewBox="0 0 '+W+' '+H+'">'+o+'</svg>'}
  /* 3) combo: columnas + línea acumulada o línea de otra serie (eje propio) */
  function combo(bars,line,cb,cl,W,H,mAct,fb,fl){var max=Math.max.apply(null,bars.concat([1]))*1.2,mx2=Math.max.apply(null,line.concat([1]))*1.12,g=base(W,H,mAct),o=g.o,bw=Math.min(30,g.iw/12*.58),i,pts=[],last=-1;
    var ult=-1,mxi=0;bars.forEach(function(x,k){if(x>0)ult=k;if(x>bars[mxi])mxi=k});
    for(i=0;i<12;i++){var x=EJE.l+g.iw*(i+.5)/12;if(bars[i]){var y=yv(bars[i],max,g.ih);o+='<rect x="'+(x-bw/2)+'" y="'+y+'" width="'+bw+'" height="'+(EJE.t+g.ih-y)+'" rx="5" fill="'+cb+'" opacity=".9"/>'+''}if(line[i]>0)last=i;pts.push([Math.round(x),yv(line[i],mx2,g.ih)])}
    var P=last>=0?pts.slice(0,last+1):[];if(P.length>1)o+='<path d="'+curva(P)+'" fill="none" stroke="'+cl+'" stroke-width="2.8" stroke-linecap="round"/>';P.forEach(function(p,k){if(line[k]>0&&(k===last||k===0))o+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="var(--cd)" stroke="'+cl+'" stroke-width="2.4"/>'});
    return '<svg class="ch" viewBox="0 0 '+W+' '+H+'">'+o+'</svg>'}
  /* 4) palitos con círculo (lollipop) */
  function palitos(v,c,W,H,mAct){var max=Math.max.apply(null,v.concat([1]))*1.25,g=base(W,H,mAct),o=g.o,i;for(i=0;i<12;i++){if(!v[i])continue;var x=EJE.l+g.iw*(i+.5)/12,y=yv(v[i],max,g.ih);o+='<line x1="'+x+'" x2="'+x+'" y1="'+(EJE.t+g.ih)+'" y2="'+y+'" stroke="'+c+'" stroke-width="3" stroke-linecap="round" opacity=".45"/><circle cx="'+x+'" cy="'+y+'" r="6.5" fill="'+c+'"/><text x="'+x+'" y="'+(y-11)+'" font-size="11" font-weight="700" text-anchor="middle" style="fill:var(--tx)">'+v[i]+'</text>'}
    return '<svg class="ch" viewBox="0 0 '+W+' '+H+'">'+o+'</svg>'}
  /* 5) escalera acumulada (step) */
  function escalera(v,c,W,H,mAct){var acc=0,cum=v.map(function(x){acc+=x;return acc}),max=Math.max(acc,1)*1.15,g=base(W,H,mAct),id='e'+(++uid),last=-1,i;v.forEach(function(x,k){if(x>0)last=k});if(last<0)return '<div class="vac">—</div>';
    var d='',x0=EJE.l,y0;for(i=0;i<=last;i++){var xa=EJE.l+g.iw*i/12,xb=EJE.l+g.iw*(i+1)/12,y=yv(cum[i],max,g.ih);d+=(i?' L'+xa+','+y:'M'+xa+','+y)+' L'+xb+','+y}
    var xe=EJE.l+g.iw*(last+1)/12;var o=g.o+'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+c+'" stop-opacity=".35"/><stop offset="100%" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs><path d="'+d+' L'+xe+','+(EJE.t+g.ih)+' L'+EJE.l+','+(EJE.t+g.ih)+' Z" fill="url(#'+id+')"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2.8" stroke-linejoin="round"/><text x="'+xe+'" y="'+(yv(cum[last],max,g.ih)-8)+'" font-size="11" font-weight="700" text-anchor="end" style="fill:var(--tx)">'+cum[last]+'</text>';
    return '<svg class="ch" viewBox="0 0 '+W+' '+H+'">'+o+'</svg>'}
  /* 6) aro, medidor y barra 100 % */
  function aro(partes,centro){var t=suma(partes.map(function(p){return p.v}));if(!t)return '<div class="vac">—</div>';var R=56,C=2*Math.PI*R,acc=0,s='<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="'+R+'" fill="none" stroke="var(--gl)" stroke-width="16"/>';
    partes.forEach(function(p){var len=p.v/t*C;s+='<circle cx="75" cy="75" r="'+R+'" fill="none" stroke="'+p.c+'" stroke-width="16" stroke-dasharray="'+Math.max(0,len-2)+' '+(C-len+2)+'" stroke-dashoffset="'+(-acc)+'" transform="rotate(-90 75 75)"/>';acc+=len});
    return '<div class="ring">'+s+'<text x="75" y="83" font-size="26" font-weight="700" text-anchor="middle" style="fill:var(--tx)">'+centro+'</text></svg><div class="lg">'+partes.map(function(p){return '<span><i style="background:'+p.c+'"></i>'+esc(p.n)+'<b>'+p.v+'</b></span>'}).join('')+'</div></div>'}
  function gauge(pct,txt,sub){var R=62,L=Math.PI*R,v=Math.min(100,pct)/100*L;return '<div style="text-align:center;padding:10px 0 4px"><svg viewBox="0 0 160 100" style="width:80%;max-width:250px"><path d="M18,88 A62,62 0 0 1 142,88" fill="none" stroke="var(--gl)" stroke-width="15" stroke-linecap="round"/><path d="M18,88 A62,62 0 0 1 142,88" fill="none" stroke="'+TE+'" stroke-width="15" stroke-linecap="round" stroke-dasharray="'+v+' '+L+'"/><text x="80" y="76" font-size="30" font-weight="700" text-anchor="middle" style="fill:var(--tx)">'+pct+'%</text><text x="80" y="96" font-size="11" text-anchor="middle">'+sub+'</text></svg></div>'}
  function segmentos(partes){var t=suma(partes.map(function(p){return p.v}));if(!t)return '<div class="vac">—</div>';return '<div class="seg">'+partes.map(function(p){return '<i style="width:'+(p.v/t*100)+'%;background:'+p.c+'"></i>'}).join('')+'</div><div class="sg-l">'+partes.map(function(p){return '<div><b style="color:'+p.c+'">'+p.v+'</b><span>'+esc(p.n)+'</span></div>'}).join('')+'</div>'}
  function miniBarras(v,c,W,H){var max=Math.max.apply(null,v.concat([1])),bw=W/12,o='';v.forEach(function(x,i){var h=x?Math.max(4,Math.round(x/max*(H-4))):0;o+='<rect x="'+(i*bw+bw*.2)+'" y="'+(H-h)+'" width="'+(bw*.6)+'" height="'+h+'" rx="3" fill="'+c+'" opacity="'+(x?1:.2)+'"/>'});return '<svg class="ch" viewBox="0 0 '+W+' '+H+'" style="margin-top:10px">'+o+'</svg>'}
  function miniLinea(v,c,W,H){var max=Math.max.apply(null,v.concat([1])),last=-1,id='m'+(++uid);v.forEach(function(x,i){if(x>0)last=i});var P=v.slice(0,last+1).map(function(x,i){return [Math.round(W*(i+.5)/12),Math.round(H-3-(x/max)*(H-8))]});if(P.length<2)return '';var d=curva(P);return '<svg class="ch" viewBox="0 0 '+W+' '+H+'" style="margin-top:10px"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+c+'" stop-opacity=".4"/><stop offset="100%" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs><path d="'+d+' L'+P[P.length-1][0]+','+H+' L'+P[0][0]+','+H+' Z" fill="url(#'+id+')"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/></svg>'}
  function delta(v){var l=-1,i,hoy=new Date(),corte=(Y===hoy.getFullYear())?hoy.getMonth()-1:11;for(i=0;i<=corte&&i<v.length;i++)if(v[i]>0)l=i;if(l<1||!(v[l-1]>0))return '';var p=Math.round((v[l]-v[l-1])/v[l-1]*100);return '<span class="dl '+(p>=0?'up':'dn')+'">'+(p>=0?'▲':'▼')+' '+Math.abs(p)+'%</span>'}
  function tarjeta(cls,titulo,color,total,cuerpo){return '<div class="d-c '+cls+'" style="--ac:'+color+';--bg2:'+color+'22"><div class="hd"><span class="bar"></span><h3>'+esc(titulo)+'</h3>'+(total!=null&&total!==''?'<span class="tt">'+total+'</span>':'')+'</div>'+cuerpo+'</div>'}
  function kpi(cls,titulo,color,valor,sub,serie,mini){return tarjeta(cls,titulo,color,'','<div class="k-n"><b>'+valor+'</b>'+delta(serie)+'</div><div class="k-s">'+esc(sub)+'</div>'+mini)}

  function datos(){
    var d={anios:{}},R=w.PM_REP;d.cont=ceros();d.fin=ceros();d.ases={};d.rc=0;d.sinrc=0;d.est={ACTIVO:0,FINALIZADO:0,CANCELADO:0};
    if(R){Object.keys(R.cf||{}).forEach(function(k){k=+k;var y=Math.floor((k-1)/12),m=k-y*12;d.anios[y]=1;if(y===Y){d.cont[m-1]+=R.cf[k].C||0;d.fin[m-1]+=R.cf[k].F||0}});
      (R.rcs||[]).forEach(function(r){var y=Math.floor((r.k-1)/12);d.anios[y]=1;if(y!==Y)return;d.ases[r.a]=(d.ases[r.a]||0)+1;if(r.rc)d.rc++;else d.sinrc++});
      (R.ecs||[]).forEach(function(e){if(d.est[e.e]!==undefined)d.est[e.e]++;if(e.y)d.anios[e.y]=1})}
    d.dugo=ceros();var C=w.PM_CONS;if(C&&C.meses)C.meses.forEach(function(o){d.anios[o.anio]=1;if(o.anio===Y)d.dugo[o.mes-1]+=(o.auto!=null?o.auto:(o.c||o.d||0))});
    d.banco=ceros();var B=w.PM_BK;if(B&&B.filas)B.filas.forEach(function(o){d.anios[o.y]=1;if(o.y===Y)d.banco[o.m-1]+=o.v});
    d.mun=ceros();d.munR=ceros();var M=w.PM_MUN;if(M&&M.filas&&w.PMMundial)M.filas.forEach(function(r){var f=r.des||r.has;if(!f)return;d.anios[f.y]=1;if(f.y!==Y||w.PMMundial.claseEst(r.est)==='ignorar')return;d.mun[f.m-1]+=r.val;d.munR[f.m-1]+=r.ret});
    d.soat=ceros();var S=w.PM_SOAT;if(S&&S.soat)S.soat.forEach(function(x){var m=/^(\d{4})-(\d{2})/.exec(x.fechaISO||'');if(!m)return;d.anios[+m[1]]=1;if(+m[1]===Y)d.soat[+m[2]-1]++});
    d.oms=ceros();var O=w.PM_OMS;if(O&&O.contratos)O.contratos.forEach(function(c){var m=/^(\d{4})-(\d{2})/.exec(c.fechaFirmaISO||'');if(!m||!String(c.cliente||'').trim())return;d.anios[+m[1]]=1;if(+m[1]===Y)d.oms[+m[2]-1]++});
    return d}
  var PAL=[BL,TE,AM,'#8b5cf6','#f97316','#64748b'];
  function pintar(){
    var v=$('v-dashboard');if(!v)return;if(!montado){montado=true;var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);v.innerHTML='<div class="d-top"><span class="pt"></span><h1>Dashboard</h1><select id="dbAnio" aria-label="Año"></select></div><div class="d-grid" id="dbGrid"></div>';$('dbAnio').addEventListener('change',function(){Y=+this.value;FIRMA='';pintar()})}
    var hoy=new Date();if(Y===null)Y=hoy.getFullYear();var d=datos();
    var firma=Y+'|'+JSON.stringify([d.cont,d.fin,d.ases,d.rc,d.sinrc,d.est,d.dugo,d.banco,d.mun,d.munR,d.soat,d.oms,(w.PMK||{}).contratos]);if(firma===FIRMA)return;FIRMA=firma;
    var ys=Object.keys(d.anios).map(Number).filter(function(y){return y>2000}).sort().reverse();if(ys.indexOf(hoy.getFullYear())<0)ys.unshift(hoy.getFullYear());if(ys.indexOf(Y)<0)Y=ys[0];
    $('dbAnio').innerHTML=ys.map(function(y){return '<option'+(y===Y?' selected':'')+'>'+y+'</option>'}).join('');
    var K=w.PMK||{},esAct=Y===hoy.getFullYear(),mAct=esAct?hoy.getMonth():-1,meta=105;try{meta=+localStorage.getItem('pm_meta_contratos')||105}catch(e){}
    var tot=d.cont.map(function(x,i){return x+d.fin[i]}),acum=0,dugoAc=d.dugo.map(function(x){acum+=x;return acum});
    var h='';
    h+=kpi('s3','Contratos del año',BL,suma(tot)||'—','vendidos en '+Y,tot,miniBarras(tot,BL,240,46));
    h+=kpi('s3','Entró al banco',TE,suma(d.banco)?corto(suma(d.banco)):'—','consignaciones',d.banco,miniLinea(d.banco,TE,240,46));
    h+=kpi('s3','Cobrado a Dugo Motos',AM,suma(d.dugo)?corto(suma(d.dugo)):'—','valor consolidado',d.dugo,miniBarras(d.dugo,AM,240,46));
    h+=kpi('s3','Retorno de Mundial','#8b5cf6',suma(d.munR)?corto(suma(d.munR)):'—','comisión',d.munR,miniLinea(d.munR,'#8b5cf6',240,46));
    h+=tarjeta('s8','Contratos por mes',BL,suma(tot)+' contratos','<div class="ley"><span><i style="background:'+AM+'"></i>De contado</span><span><i style="background:'+BL+'"></i>Financiados</span></div>'+apiladas(d.cont,d.fin,AM,BL,760,250,mAct));
    var pm=esAct&&K.contratos!=null?Math.round(K.contratos/meta*100):null;
    h+=tarjeta('s4','Meta del mes',TE,pm===null?'':K.contratos+' de '+meta,pm===null?'<div class="vac">—</div>':gauge(pm,K.contratos,'meta '+meta+' contratos'));
    h+=tarjeta('s7','Dinero que entra al banco',TE,suma(d.banco)?cop2(suma(d.banco)):'',area(d.banco,TE,760,230,mAct,corto));
    var as=Object.keys(d.ases).map(function(a){return [a,d.ases[a]]}).sort(function(a,b){return b[1]-a[1]}).slice(0,6),amax=as.length?as[0][1]:1;
    h+=tarjeta('s5','Ranking de asesores',BL,'contratos '+Y,as.length?'<div class="rk">'+as.map(function(x,i){return '<div class="f"><span class="nm">'+esc(x[0])+'</span><span class="br"><i style="width:'+Math.round(x[1]/amax*100)+'%;background:'+PAL[i%PAL.length]+'"></i></span><b>'+x[1]+'</b></div>'}).join('')+'</div>':'<div class="vac">—</div>');
    h+=tarjeta('s6','Valor cobrado a Dugo Motos',AM,suma(d.dugo)?cop2(suma(d.dugo)):'','<div class="ley"><span><i style="background:'+AM+'"></i>Por mes</span><span><i class="l" style="background:'+NV+'"></i>Acumulado: <b>'+corto(suma(d.dugo))+'</b></span></div>'+combo(d.dugo,dugoAc,AM,BL2,700,240,mAct,corto,corto));
    h+=tarjeta('s6','Mundial: consignado y retorno','#8b5cf6',suma(d.munR)?corto(suma(d.munR)):'','<div class="ley"><span><i style="background:'+BL+'"></i>Consignado: <b>'+corto(suma(d.mun))+'</b></span><span><i class="l" style="background:#8b5cf6"></i>Retorno: <b>'+corto(suma(d.munR))+'</b></span></div>'+combo(d.mun,d.munR,BL,'#8b5cf6',700,240,mAct,corto,corto));
    h+=tarjeta('s4','Contratos con RC',AM,Math.round(d.rc/Math.max(1,d.rc+d.sinrc)*100)+' %',aro([{n:'Con RC',v:d.rc,c:AM},{n:'Sin RC',v:d.sinrc,c:SL}],Math.round(d.rc/Math.max(1,d.rc+d.sinrc)*100)+'%'));
    h+=tarjeta('s4','Estado de los clientes',TE,suma([d.est.ACTIVO,d.est.FINALIZADO,d.est.CANCELADO])+' clientes',segmentos([{n:'Activos',v:d.est.ACTIVO,c:TE},{n:'Finalizados',v:d.est.FINALIZADO,c:BL},{n:'Cancelados',v:d.est.CANCELADO,c:RJ}]));
    h+=tarjeta('s4','SOAT vendidos',BL2,suma(d.soat)+' en '+Y,palitos(d.soat,BL2,420,200,mAct));
    h+=tarjeta('s12','Pólizas OMS: acumulado del año','#8b5cf6',suma(d.oms)+' pólizas',escalera(d.oms,'#8b5cf6',1200,170,mAct));
    $('dbGrid').innerHTML=h;
  }
  function cop2(n){return '$ '+Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
  function activo(){return location.hash==='#dashboard'}
  function ciclo(){clearInterval(timer);if(!activo())return;pintar();try{if(w.cargarBanco)w.cargarBanco();if(w.cargarMundialAl)w.cargarMundialAl()}catch(e){}timer=setInterval(function(){if(!activo()){clearInterval(timer);return}pintar()},3000)}
  w.addEventListener('hashchange',ciclo);document.addEventListener('pm-cobros',function(){if(activo())pintar()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ciclo);else ciclo();
})(window);

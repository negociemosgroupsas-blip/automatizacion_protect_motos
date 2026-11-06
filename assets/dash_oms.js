/* Tablero ejecutivo de Clientes OMS. Lo usan el botón «Clientes OMS» y el Inicio del CRM (misma gráfica en los dos).
   Uso: PMDashOMS.render(elemento, {clientes:[...], gestiones:[...]})  ·  PMDashOMS.por(clientes, gestiones) devuelve cuántos hay por renovar. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var MC = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var DIAS_AVISO = 8, DIAS_VENCIDO = 30;
  var ACC_ENV = 'Mensaje de renovación enviado', ACC_REN = 'Renovó', ACC_NO = 'No renovará';
  var YEARSEL = {};   // año elegido por cada tablero
  var LAST = {};      // últimos datos de cada tablero (para repintar al cambiar el año desde fuera)

  /* ---------- utilidades ---------- */
  function E(tag, a, txt) { var e = document.createElementNS(NS, tag); for (var k in (a || {})) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pesos(v) { v = Math.round(Number(v) || 0); return '$' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function corto(v) { v = Number(v) || 0; if (v >= 1e6) return '$' + (v / 1e6).toFixed(1).replace('.', ',') + ' M'; if (v >= 1e3) return '$' + Math.round(v / 1e3) + ' mil'; return '$' + Math.round(v); }
  function fecha(iso) { if (!iso) return null; var p = String(iso).split('-'); if (p.length !== 3) return null; var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setHours(0, 0, 0, 0); return isNaN(d.getTime()) ? null : d; }
  function hoy() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function clave(c) { return String(c.cedula || '').replace(/\D/g, '') + '|' + String(c.placa || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  var tipEl = null;
  function tip(ev, html) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'od-tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = html; tipEl.style.display = 'block';
    var x = ev.clientX + 14, y = ev.clientY - 10;
    if (x + tipEl.offsetWidth > window.innerWidth - 8) x = ev.clientX - tipEl.offsetWidth - 14;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  function notip() { if (tipEl) tipEl.style.display = 'none'; }
  function ancho(el) { return Math.max(260, Math.floor(el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 600)); }

  /* ---------- estado de cada cliente ---------- */
  function ultimaGestion(gest) {
    var m = {};
    (gest || []).forEach(function (g) { var k = g.contrato; if (!m[k] || (g.fechaGestionISO || '') >= (m[k].fechaGestionISO || '')) m[k] = g; });
    return m;
  }
  function analizar(clientes, gestiones) {
    var ult = ultimaGestion(gestiones), porClave = {}, h = hoy();
    clientes.forEach(function (c) { var k = clave(c); (porClave[k] = porClave[k] || []).push(c); });
    return clientes.map(function (c) {
      var ini = fecha(c.fechaFirmaISO), fin = fecha(c.finISO), g = ult[c.contrato], acc = g ? g.accion : '';
      var d = fin ? Math.round((fin.getTime() - h.getTime()) / 86400000) : null, tipo;
      var posterior = (porClave[clave(c)] || []).some(function (o) { return o !== c && fecha(o.finISO) && fin && fecha(o.finISO) > fin; });
      if (c.estado === 'CANCELADO') tipo = 'cancelado';
      else if (posterior || acc === ACC_REN) tipo = 'renovado';
      else if (acc === ACC_NO) tipo = 'norenovara';
      else if (d === null) tipo = 'vigente';
      else if (d < -DIAS_VENCIDO) tipo = 'vencido';
      else if (d <= DIAS_AVISO) tipo = acc === ACC_ENV ? 'enviado' : 'renovar';
      else tipo = 'vigente';
      return { c: c, ini: ini, fin: fin, d: d, tipo: tipo, g: g, valor: Number(c.valorProtect) || 0, forma: c.forma || 'SIN DATO', veh: String(c.placa || '').trim() };
    });
  }

  /* ---------- gráficas ---------- */
  function svgBase(W, H) { return E('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'class': 'od-svg' }); }

  function combo(box, datos, etq, activo) {
    var W = ancho(box), H = 250, pl = 10, pr = 58, pt = 28, pb = 26, iw = W - pl - pr, ih = H - pt - pb, n = datos.length, slot = iw / n, bw = Math.min(40, slot * 0.6);
    var maxN = Math.max.apply(null, datos.map(function (d) { return d ? d.n : 0; }).concat(1)) * 1.25, maxG = Math.max.apply(null, datos.map(function (d) { return d ? d.g : 0; }).concat(1)) * 1.25;
    var v = svgBase(W, H), xs = function (j) { return pl + slot * (j + .5); }, yG = function (x) { return pt + ih - x / maxG * ih; };
    [0, .5, 1].forEach(function (f) { var y = pt + ih - f * ih; v.appendChild(E('line', { x1: pl, x2: W - pr, y1: y, y2: y, 'class': 'od-grid' })); v.appendChild(E('text', { x: W - pr + 6, y: y + 4, 'class': 'od-ge' }, corto(maxG * f))); });
    var pts = [];
    datos.forEach(function (d, j) {
      if (!d) return; var hh = d.n / maxN * ih, cur = j === activo;
      v.appendChild(E('rect', { x: xs(j) - bw / 2, y: pt + ih - hh, width: bw, height: Math.max(hh, d.n ? 2 : 0), rx: 5, fill: cur ? '#f0c94a' : '#13223f', stroke: cur ? '#13223f' : 'none', 'stroke-width': cur ? 1.5 : 0 }));
      if (d.n) v.appendChild(E('text', { x: xs(j), y: hh >= 20 ? pt + ih - hh + 15 : pt + ih - hh - 6, 'text-anchor': 'middle', 'class': hh >= 20 && !cur ? 'od-tw' : 'od-tv' }, d.n));
      pts.push({ x: xs(j), y: yG(d.g), g: d.g });
    });
    for (var j = 0; j < n; j++) v.appendChild(E('text', { x: xs(j), y: H - 8, 'text-anchor': 'middle', 'class': 'od-ts' }, String(etq[j]).charAt(0).toUpperCase() + String(etq[j]).slice(1)));
    if (pts.length > 1) v.appendChild(E('polyline', { points: pts.map(function (p) { return p.x + ',' + p.y; }).join(' '), fill: 'none', stroke: '#1f9d55', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    pts.forEach(function (p) { v.appendChild(E('circle', { cx: p.x, cy: p.y, r: 4.5, fill: '#fff', stroke: '#1f9d55', 'stroke-width': 2.5 })); if (p.g) v.appendChild(E('text', { x: p.x, y: p.y - 10, 'text-anchor': 'middle', 'class': 'od-tg' }, corto(p.g))); });
    datos.forEach(function (d, j) { if (!d) return; var r = E('rect', { x: pl + slot * j, y: 0, width: slot, height: H, 'class': 'od-hit' });
      r.addEventListener('mousemove', function (ev) { tip(ev, '<b>' + d.t + '</b><br>' + d.n + ' clientes nuevos<br>Valor vendido: ' + pesos(d.g)); }); r.addEventListener('mouseleave', notip); v.appendChild(r); });
    box.innerHTML = ''; box.appendChild(v);
  }

  function dona(box, items, total, centro) {
    var R = 62, C = 2 * Math.PI * R, v = svgBase(170, 170), acc = 0;
    v.appendChild(E('circle', { cx: 85, cy: 85, r: R, fill: 'none', stroke: '#eef0f5', 'stroke-width': 26 }));
    items.forEach(function (it) {
      var len = it.n / total * C, gap = items.length > 1 ? 2.5 : 0, w = Math.max(len - gap, 0);
      var c = E('circle', { cx: 85, cy: 85, r: R, fill: 'none', stroke: it.c, 'stroke-width': 26, transform: 'rotate(-90 85 85)', 'stroke-dasharray': w + ' ' + (C - w), 'stroke-dashoffset': -acc });
      c.addEventListener('mousemove', function (ev) { tip(ev, '<b>' + esc(it.l) + '</b><br>' + it.n + ' (' + Math.round(it.n / total * 100) + ' %)'); }); c.addEventListener('mouseleave', notip);
      v.appendChild(c); acc += len;
    });
    v.appendChild(E('text', { x: 85, y: 88, 'text-anchor': 'middle', 'class': 'od-gn' }, total || 0)); v.appendChild(E('text', { x: 85, y: 106, 'text-anchor': 'middle', 'class': 'od-gs' }, centro || 'clientes'));
    var leg = items.map(function (it) { return '<div><i style="background:' + it.c + '"></i><span>' + esc(it.l) + '</span><b>' + it.n + '</b><span class="p">' + Math.round(it.n / total * 100) + ' %</span></div>'; }).join('');
    box.innerHTML = '<div class="od-dona"><div class="od-dn"></div><div class="od-leg">' + (leg || '<span class="od-mute">Sin datos</span>') + '</div></div>';
    box.querySelector('.od-dn').appendChild(v);
  }

  function acumulada(box, A, B, yv) {
    var W = ancho(box), H = 230, pl = 10, pr = 58, pt = 26, pb = 26, iw = W - pl - pr, ih = H - pt - pb, slot = iw / 12;
    var mx = Math.max.apply(null, A.concat(B).filter(function (x) { return x !== null; }).concat(1)) * 1.15, v = svgBase(W, H), xs = function (i) { return pl + slot * (i + .5); }, ys = function (x) { return pt + ih - x / mx * ih; };
    [0, .5, 1].forEach(function (f) { var y = pt + ih - f * ih; v.appendChild(E('line', { x1: pl, x2: W - pr, y1: y, y2: y, 'class': 'od-grid' })); v.appendChild(E('text', { x: W - pr + 6, y: y + 4, 'class': 'od-ge' }, corto(mx * f))); });
    for (var i = 0; i < 12; i++) v.appendChild(E('text', { x: xs(i), y: H - 8, 'text-anchor': 'middle', 'class': 'od-ts' }, MC[i].charAt(0).toUpperCase() + MC[i].slice(1)));
    v.appendChild(E('polyline', { points: B.map(function (x, i) { return xs(i) + ',' + ys(x); }).join(' '), fill: 'none', stroke: '#b8c0d4', 'stroke-width': 2.5, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round' }));
    var pa = [], last = -1; A.forEach(function (x, i) { if (x !== null) { pa.push([xs(i), ys(x)]); last = i; } });
    if (pa.length) {
      var pp = pa.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      v.appendChild(E('polygon', { points: pp + ' ' + pa[pa.length - 1][0] + ',' + (pt + ih) + ' ' + pa[0][0] + ',' + (pt + ih), fill: '#1f9d55', 'fill-opacity': .12 }));
      v.appendChild(E('polyline', { points: pp, fill: 'none', stroke: '#1f9d55', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      var u = pa[pa.length - 1]; v.appendChild(E('circle', { cx: u[0], cy: u[1], r: 5, fill: '#fff', stroke: '#1f9d55', 'stroke-width': 3 })); v.appendChild(E('text', { x: u[0], y: u[1] - 11, 'text-anchor': 'middle', 'class': 'od-tg' }, corto(A[last])));
    }
    for (var j = 0; j < 12; j++) (function (j) { var r = E('rect', { x: pl + slot * j, y: 0, width: slot, height: H, 'class': 'od-hit' });
      r.addEventListener('mousemove', function (ev) { tip(ev, '<b>' + MESES[j] + '</b><br>' + yv + ': ' + (A[j] === null ? '—' : pesos(A[j])) + '<br>' + (yv - 1) + ': ' + pesos(B[j])); }); r.addEventListener('mouseleave', notip); v.appendChild(r); })(j);
    box.innerHTML = ''; box.appendChild(v);
  }

  function medidor(box, ren, nor, pen) {
    var tot = ren + nor + pen, pct = tot ? Math.round(ren / tot * 100) : 0, W = 220, H = 128, cx = 110, cy = 112, R = 86, v = svgBase(W, H);
    function arco(a0, a1, col) { var p = function (a) { return [cx + R * Math.cos(Math.PI * (1 - a)), cy - R * Math.sin(Math.PI * (1 - a))]; }, s = p(a0), e = p(a1);
      return E('path', { d: 'M' + s[0] + ' ' + s[1] + ' A' + R + ' ' + R + ' 0 0 1 ' + e[0] + ' ' + e[1], fill: 'none', stroke: col, 'stroke-width': 18, 'stroke-linecap': 'round' }); }
    v.appendChild(arco(0, 1, '#eef0f5'));
    if (tot) { var a = 0; [[ren, '#1f9d55'], [pen, '#d6a417'], [nor, '#d64545']].forEach(function (x) { if (!x[0]) return; var f = x[0] / tot; v.appendChild(arco(a + 0.005, Math.min(a + f, 1) - 0.005, x[1])); a += f; }); }
    v.appendChild(E('text', { x: cx, y: cy - 18, 'text-anchor': 'middle', 'class': 'od-gn' }, pct + ' %')); v.appendChild(E('text', { x: cx, y: cy, 'text-anchor': 'middle', 'class': 'od-gs' }, 'renovaron'));
    box.innerHTML = '<div style="text-align:center"></div><div class="od-parts"><div style="border-color:#1f9d55"><b>' + ren + '</b><span>Renovaron</span></div><div style="border-color:#d6a417"><b>' + pen + '</b><span>Sin respuesta</span></div><div style="border-color:#d64545"><b>' + nor + '</b><span>No renovaron</span></div></div>';
    box.firstChild.appendChild(v);
  }

  function barrasH(box, items, total) {   // ranking horizontal (vehículos más vendidos)
    if (!items.length) { box.innerHTML = '<div class="od-mute" style="padding:30px 0;text-align:center">Sin datos</div>'; return; }
    var max = items[0].n;
    box.innerHTML = '<div class="od-rank">' + items.map(function (it, i) {
      return '<div class="od-r" title="' + esc(it.l) + ': ' + it.n + '"><span class="od-rk">' + (i + 1) + '</span><span class="od-rn">' + esc(it.l) + '</span><div class="od-rp"><div class="od-rb" style="width:' + Math.round(it.n / max * 100) + '%;background:' + (i === 0 ? '#d6a417' : '#13223f') + '"></div></div><b>' + it.n + '</b><span class="od-rq">' + Math.round(it.n / total * 100) + ' %</span></div>';
    }).join('') + '</div>';
  }

  function estados(box, a) {
    var c = { ACTIVO: 0, CANCELADO: 0, FINALIZADO: 0, otros: 0 };
    a.forEach(function (x) { var e = x.c.estado; if (c[e] !== undefined) c[e]++; else c.otros++; });
    var tot = a.length || 1, it = [['Activos', c.ACTIVO, '#1f9d55'], ['Cancelados', c.CANCELADO, '#d64545'], ['Finalizados', c.FINALIZADO, '#5b78c7'], ['Otros', c.otros, '#c9d0e0']].filter(function (x) { return x[1]; });
    box.innerHTML = '<div class="od-tiles">' + [['Activos', c.ACTIVO, '#1f9d55'], ['Cancelados', c.CANCELADO, '#d64545'], ['Finalizados', c.FINALIZADO, '#5b78c7']].map(function (x) { return '<div style="border-color:' + x[2] + '"><b>' + x[1] + '</b><span>' + x[0] + ' · ' + Math.round(x[1] / tot * 100) + ' %</span></div>'; }).join('') + '</div>' +
      '<div class="od-band">' + it.map(function (x) { return '<i style="width:' + (x[1] / tot * 100) + '%;background:' + x[2] + '" title="' + x[0] + ': ' + x[1] + '">' + (x[1] / tot > .08 ? x[1] : '') + '</i>'; }).join('') + '</div>';
  }

  /* ---------- tablero completo ---------- */
  function css() {
    if (document.getElementById('od-css')) return;
    var s = document.createElement('style'); s.id = 'od-css';
    s.textContent = [
      '.od-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 12px}',
      '.od-top h2{margin:0;font-size:1.05rem;color:#13223f} .od-top label{font-size:.8rem;color:#6b7280;display:flex;align-items:center;gap:6px} .od-top select{border:1px solid #e3e6eb;border-radius:8px;padding:5px 8px;font-size:.85rem;background:#fff}',
      '.od-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}',
      '.od-k{background:#fff;border:1px solid #e3e6eb;border-radius:14px;padding:12px 14px;border-top:3px solid #d6a417} .od-k b{display:block;font-size:1.7rem;color:#13223f;line-height:1.1} .od-k span{font-size:.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.3px} .od-k.al{border-top-color:#d64545} .od-k.al b{color:#d64545} .od-k.vd{border-top-color:#1f9d55}',
      '.od-grid12{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}',
      '.od-card{background:#fff;border:1px solid #e3e6eb;border-radius:14px;padding:14px 16px;min-width:0} .od-card h3{margin:0 0 2px;font-size:.98rem;color:#13223f;border-left:4px solid #f0c94a;padding-left:9px;line-height:1.2;font-family:inherit}',
      '.od-card .od-sub{font-size:.76rem;color:#6b7280;margin:2px 0 8px;min-height:1.1em} .od-c8{grid-column:span 8} .od-c4{grid-column:span 4} .od-c6{grid-column:span 6} .od-c12{grid-column:1/-1}',
      '.od-fil{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 8px} .od-fil label{display:flex;align-items:center;gap:6px;font-size:.76rem;color:#6b7280} .od-fil select{border:1px solid #e3e6eb;background:#fff;border-radius:8px;padding:4px 8px;font-size:.8rem;color:#1f2430;cursor:pointer}',
      '.od-ayuda{margin:0 0 6px;font-size:.78rem;color:#6b7a99;line-height:1.35;padding-right:34px}',
      '.od-leg2{display:flex;gap:14px;flex-wrap:wrap;font-size:.76rem;color:#6b7280;margin:0 0 4px} .od-leg2 i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}',
      '.od-dona{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center} .od-leg{display:grid;gap:7px;min-width:150px;flex:1;font-size:.82rem}',
      '.od-leg div{display:grid;grid-template-columns:12px 1fr auto auto;gap:8px;align-items:center} .od-leg i{width:12px;height:12px;border-radius:4px} .od-leg b{font-size:.95rem;color:#13223f} .od-leg .p{color:#6b7280;font-size:.76rem;min-width:34px;text-align:right}',
      '.od-mute{color:#6b7280;font-size:.85rem}',
      '.od-svg text{font-family:inherit} .od-ts{fill:#6b7280;font-size:11px} .od-tv{fill:#13223f;font-size:12px;font-weight:700} .od-tw{fill:#fff;font-size:11px;font-weight:700}',
      '.od-tg{fill:#1f9d55;font-size:11px;font-weight:800;paint-order:stroke;stroke:#fff;stroke-width:3px} .od-ge{fill:#1f9d55;font-size:10px;font-weight:700} .od-grid{stroke:#e6e9f0;stroke-dasharray:3 4} .od-hit{fill:transparent;cursor:pointer}',
      '.od-gn{font-size:1.9rem;font-weight:800;fill:#13223f} .od-gs{font-size:.72rem;fill:#6b7280}',
      '.od-parts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px} .od-parts div{background:#f4f5f7;border-radius:10px;padding:8px 10px;border-left:4px solid} .od-parts b{display:block;font-size:1.2rem;color:#13223f} .od-parts span{font-size:.7rem;color:#6b7280}',
      '.od-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:4px 0 12px} .od-tiles div{background:#f4f5f7;border-radius:10px;padding:10px 12px;border-left:5px solid} .od-tiles b{display:block;font-size:1.7rem;color:#13223f;line-height:1.05} .od-tiles span{font-size:.74rem;color:#6b7280}',
      '.od-band{display:flex;height:28px;border-radius:999px;overflow:hidden;background:#e8ebf3} .od-band i{display:flex;align-items:center;justify-content:center;color:#fff;font:700 .8rem Arial;font-style:normal}',
      '.od-rank{display:grid;gap:8px} .od-r{display:grid;grid-template-columns:18px minmax(80px,150px) 1fr 30px 38px;gap:8px;align-items:center;font-size:.82rem} .od-rk{color:#6b7280;text-align:right;font-size:.75rem} .od-rn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#13223f}',
      '.od-rp{background:#e8ebf3;border-radius:999px;height:12px;overflow:hidden} .od-rb{height:100%;border-radius:999px} .od-r b{color:#13223f;text-align:right} .od-rq{color:#6b7280;font-size:.74rem;text-align:right}',
      '.od-tip{position:fixed;display:none;background:#13223f;color:#fff;border-radius:8px;padding:7px 10px;font-size:.78rem;pointer-events:none;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
      '@media(max-width:1000px){.od-c8,.od-c4,.od-c6,.od-c12{grid-column:1/-1}}'
    ].join('\n');
    document.head.appendChild(s);
  }


  /* ---------- Ayuda ⓘ (la usan también las tarjetas del Inicio) ---------- */
  var ayDone = false, ayPop = null, ayTimer = null;
  function ayCss() {
    if (document.getElementById('ay-css')) return;
    var st = document.createElement('style'); st.id = 'ay-css';
    st.textContent = [
      '.ay-c{position:relative}',
      '.ay-i{position:absolute;right:12px;top:12px;width:26px;height:26px;border-radius:50%;border:1px solid rgba(120,140,190,.5);background:rgba(120,140,190,.14);color:#6b7a99;font-size:.9rem;font-weight:700;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:3;font-family:Georgia,serif;font-style:italic}',
      '.ay-i:hover,.ay-i:focus{background:#fdc33e;color:#1a1200;border-color:#fdc33e;outline:none}',
      '.ay-sub{margin:0 0 6px;font-size:.78rem;color:#6b7a99;line-height:1.35;padding-right:34px}',
      '#ayPop{position:fixed;display:none;z-index:9999;max-width:300px;background:#13223f;color:#eef2ff;border:1px solid #3b4f8f;border-radius:12px;padding:10px 12px;font-size:.8rem;line-height:1.45;box-shadow:0 10px 28px rgba(0,0,0,.4)}',
      '#ayPop b{color:#fdc33e;display:block;margin-bottom:3px}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function ayBoton(titulo, info) { return '<button type="button" class="ay-i" aria-label="Cómo se lee esta gráfica" data-t="' + esc(titulo) + '" data-info="' + esc(info) + '">i</button>'; }
  function ayWire() {
    ayCss();
    if (ayDone) return; ayDone = true;
    ayPop = document.createElement('div'); ayPop.id = 'ayPop'; document.body.appendChild(ayPop);
    function mostrar(b) {
      clearTimeout(ayTimer);
      ayPop.innerHTML = '<b>' + esc(b.getAttribute('data-t') || 'Cómo se lee') + '</b>' + esc(b.getAttribute('data-info') || '');
      ayPop.style.display = 'block';
      var r = b.getBoundingClientRect(), w = ayPop.offsetWidth, x = Math.min(window.innerWidth - w - 10, Math.max(10, r.right - w)), y = r.bottom + 8;
      if (y + ayPop.offsetHeight > window.innerHeight - 10) y = Math.max(10, r.top - ayPop.offsetHeight - 8);
      ayPop.style.left = x + 'px'; ayPop.style.top = y + 'px';
    }
    function ocultar() { ayTimer = setTimeout(function () { ayPop.style.display = 'none'; }, 120); }
    document.addEventListener('mouseover', function (ev) { var b = ev.target.closest && ev.target.closest('.ay-i'); if (b) mostrar(b); });
    document.addEventListener('mouseout', function (ev) { var b = ev.target.closest && ev.target.closest('.ay-i'); if (b) ocultar(); });
    document.addEventListener('focusin', function (ev) { var b = ev.target.closest && ev.target.closest('.ay-i'); if (b) mostrar(b); });
    document.addEventListener('focusout', function (ev) { var b = ev.target.closest && ev.target.closest('.ay-i'); if (b) ocultar(); });
    document.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('.ay-i'); if (b) { mostrar(b); return; } ayPop.style.display = 'none'; });
  }

  var ST = {};     // filtros de cada tarjeta, por tablero
  var TOP = {};    // selección del filtro de arriba («todo el tablero»)
  function porDefecto(yA) { return { combo: { y: String(yA), m: '0' }, forma: { y: String(yA), m: '0' }, acum: { y: String(yA) }, med: { y: String(yA) }, estados: { y: 'todos', m: '0' }, veh: { y: String(yA), m: '0' } }; }
  function opcionesAnio(lista) { return '<option value="todos">Todos los años</option>' + lista.map(function (y) { return '<option>' + y + '</option>'; }).join(''); }
  var OPC_MES = '<option value="0">Todo el año</option>' + MESES.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join('');
  function filtro(k, lista, conMes) { return '<div class="od-fil" data-k="' + k + '"><label>Año <select data-f="y">' + opcionesAnio(lista) + '</select></label>' + (conMes ? '<label>Mes <select data-f="m">' + OPC_MES + '</select></label>' : '') + '</div>'; }
  function pasa(x, st) {   // ¿el cliente se vendió en el año y mes elegidos?
    if (!x.ini) return false;
    if (st.y !== 'todos' && x.ini.getFullYear() !== +st.y) return false;
    if (st.m && st.m !== '0' && x.ini.getMonth() + 1 !== +st.m) return false;
    return true;
  }

  function render(root, datos) {
    css();
    var clientes = (datos && datos.clientes) || [], gest = (datos && datos.gestiones) || [];
    var id = root.id || (root.id = 'od' + Math.random().toString(36).slice(2, 7));
    LAST[id] = datos;
    var a = analizar(clientes, gest), h = hoy(), yA = h.getFullYear(), mA = h.getMonth();
    var ys = {}; ys[yA] = 1; a.forEach(function (x) { if (x.ini) ys[x.ini.getFullYear()] = 1; });
    var lista = Object.keys(ys).map(Number).sort(function (p, q) { return q - p; });
    var S = ST[id] = ST[id] || porDefecto(yA), top = TOP[id] = TOP[id] || { y: '', m: '' };
    Object.keys(S).forEach(function (k) { if (S[k].y !== 'todos' && !ys[S[k].y]) S[k].y = String(yA); });

    // KPIs (no dependen de los filtros)
    var activos = 0, mes = 0, valMes = 0, porRenovar = 0, enviados = 0;
    a.forEach(function (x) {
      if (x.c.estado === 'ACTIVO' && x.tipo !== 'renovado' && x.tipo !== 'vencido' && x.tipo !== 'norenovara') activos++;
      if (x.ini && x.ini.getFullYear() === yA && x.ini.getMonth() === mA) { mes++; valMes += x.valor; }
      if (x.tipo === 'renovar') porRenovar++; else if (x.tipo === 'enviado') enviados++;
    });
    // renovaciones: clientes cuyo año ya se cumplió (filtro de la tarjeta Renovaciones)
    var ren = 0, nor = 0, pen = 0;
    a.forEach(function (x) {
      if (!x.fin || x.fin >= h || x.tipo === 'cancelado') return; if (S.med.y !== 'todos' && x.fin.getFullYear() !== +S.med.y) return;
      if (x.tipo === 'renovado') ren++; else if (x.tipo === 'norenovara' || x.tipo === 'vencido') nor++; else pen++;
    });
    var baseR = ren + nor + pen, tasa = baseR ? Math.round(ren / baseR * 100) : 0;
    // la tasa de la tarjeta de arriba usa todos los años
    var rA = 0, nA = 0, pA = 0;
    a.forEach(function (x) { if (!x.fin || x.fin >= h || x.tipo === 'cancelado') return; if (x.tipo === 'renovado') rA++; else if (x.tipo === 'norenovara' || x.tipo === 'vencido') nA++; else pA++; });
    var tasaTodos = (rA + nA + pA) ? Math.round(rA / (rA + nA + pA) * 100) : null;

    root.innerHTML =
      '<div class="od-top"><h2>Tablero de Clientes OMS</h2><div class="od-fil od-fil-top"><label>Año <select class="od-y"><option value="">Cada tarjeta</option>' + opcionesAnio(lista) + '</select></label><label>Mes <select class="od-m"><option value="">Cada tarjeta</option>' + OPC_MES + '</select></label></div></div>' +
      '<div class="od-kpis">' +
        '<div class="od-k"><b>' + activos + '</b><span>Clientes vigentes</span></div>' +
        '<div class="od-k"><b>' + mes + '</b><span>Nuevos este mes</span></div>' +
        '<div class="od-k vd"><b>' + corto(valMes) + '</b><span>Valor vendido del mes</span></div>' +
        '<div class="od-k' + (porRenovar ? ' al' : '') + '"><b>' + porRenovar + '</b><span>Por renovar (≤' + DIAS_AVISO + ' días)</span></div>' +
        '<div class="od-k"><b>' + enviados + '</b><span>Mensajes enviados</span></div>' +
        '<div class="od-k"><b>' + (tasaTodos === null ? '—' : tasaTodos + ' %') + '</b><span>Tasa de renovación</span></div>' +
      '</div>' +
      '<div class="od-grid12">' +
        '<div class="od-card od-c8 ay-c"><h3>OMS: clientes nuevos y valor vendido</h3>' + ayBoton('OMS: clientes nuevos y valor vendido','Sale de la hoja de clientes OMS: cada cliente cuenta en el mes de su fecha de inicio. El valor es lo que figura en «Valor a pagar» (en financiados, por las cuotas del año).') + '<p class="od-ayuda">Clientes nuevos de cada mes (columnas) y el valor vendido (línea).</p><p class="od-sub" data-s="1"></p>' + filtro('combo', lista, true) + '<div class="od-leg2"><span><i style="background:#13223f"></i>Columnas: clientes nuevos</span><span><i style="background:#1f9d55"></i>Línea: valor vendido</span></div><div data-g="combo"></div></div>' +
        '<div class="od-card od-c4 ay-c"><h3>OMS: ¿contado o financiado?</h3>' + ayBoton('OMS: ¿contado o financiado?','Sale de la columna Compra de la hoja OMS. Usa el año y el mes de la fecha de inicio.') + '<p class="od-ayuda">Cómo pagaron los clientes OMS del período.</p><p class="od-sub" data-s="2"></p>' + filtro('forma', lista, true) + '<div data-g="forma"></div></div>' +
        '<div class="od-card od-c8 ay-c"><h3>OMS: vehículos más vendidos</h3>' + ayBoton('OMS: vehículos más vendidos','Cuenta la columna Vehículo de la hoja OMS. Muestra los 6 primeros.') + '<p class="od-ayuda">Los modelos que más se venden en el período.</p><p class="od-sub" data-s="6"></p>' + filtro('veh', lista, true) + '<div data-g="veh"></div></div>' +
        '<div class="od-card od-c4 ay-c"><h3>OMS: renovaciones</h3>' + ayBoton('OMS: renovaciones','Cuenta los clientes cuya fecha fin ya pasó. Renovó = hay un registro nuevo del mismo cliente y vehículo, o lo marcaste «Renovó». Sin respuesta = aún no se sabe.') + '<p class="od-ayuda">Qué parte de los clientes que cumplieron su año renovó.</p><p class="od-sub" data-s="4"></p>' + filtro('med', lista, false) + '<div data-g="med"></div></div>' +
        '<div class="od-card od-c12 ay-c"><h3>OMS: ¿cuántos clientes están activos?</h3>' + ayBoton('OMS: ¿cuántos clientes están activos?','Sale de la columna Estado de la hoja OMS. Puedes filtrar por la fecha de inicio.') + '<p class="od-ayuda">Activos, cancelados y finalizados de OMS.</p><p class="od-sub" data-s="5"></p>' + filtro('estados', lista, true) + '<div data-g="estados"></div></div>' +
      '</div>';
    var q = function (s) { return root.querySelector(s); };
    ayWire();
    [].forEach.call(root.querySelectorAll('.od-card'), function (c) { c.setAttribute('data-buscar', (c.textContent || '').toLowerCase().slice(0, 400)); });

    // valores de los filtros + eventos
    Object.keys(S).forEach(function (k) {
      var f = root.querySelector('.od-fil[data-k="' + k + '"]'); if (!f) return;
      var sy = f.querySelector('[data-f="y"]'), sm = f.querySelector('[data-f="m"]'); sy.value = S[k].y; if (sm) sm.value = S[k].m || '0';
      f.addEventListener('change', function (ev) { var t = ev.target; if (!t.dataset.f) return; S[k][t.dataset.f] = t.value; render(root, datos); });
    });
    var ty = q('.od-y'), tm = q('.od-m'); ty.value = top.y; tm.value = top.m;
    q('.od-fil-top').addEventListener('change', function () {
      top.y = ty.value; top.m = tm.value;
      Object.keys(S).forEach(function (k) { if (top.y !== '') S[k].y = top.y; if (top.m !== '' && S[k].m !== undefined) S[k].m = top.m; });
      render(root, datos);
    });

    // 1) clientes nuevos y valor vendido
    var C = S.combo, mm = +C.m, porMes = {}; a.forEach(function (x) { if (!x.ini) return; var k = x.ini.getFullYear() * 12 + x.ini.getMonth(); var o = porMes[k] = porMes[k] || { n: 0, g: 0 }; o.n++; o.g += x.valor; });
    var datosC = [], etq = [], act = -1, totN = 0, totG = 0, i, porAnio = (mm !== 0 || C.y === 'todos');
    if (!porAnio) { for (i = 0; i < 12; i++) { var o2 = porMes[+C.y * 12 + i] || { n: 0, g: 0 }, fut = (+C.y === yA && i > mA); datosC.push(fut ? null : { n: o2.n, g: o2.g, t: MESES[i] + ' ' + C.y }); etq.push(MC[i]); if (!fut) { totN += o2.n; totG += o2.g; } } if (+C.y === yA) act = mA; }
    else { lista.slice().reverse().forEach(function (y) { var n = 0, g = 0; for (var m = 0; m < 12; m++) { if (mm && m + 1 !== mm) continue; var o = porMes[y * 12 + m]; if (o) { n += o.n; g += o.g; } } datosC.push({ n: n, g: g, t: (mm ? MESES[mm - 1] + ' ' : 'Año ') + y }); etq.push(String(y)); if (C.y === 'todos' || y === +C.y) { totN += n; totG += g; } if (y === yA) act = datosC.length - 1; }); }
    q('[data-s="1"]').textContent = totN + ' clientes nuevos · ' + pesos(totG) + (totN ? ' · ' + pesos(totG / totN) + ' por cliente' : '');
    combo(q('[data-g="combo"]'), datosC, etq, act);

    // 2) contado o financiado
    var cf = {}, nF = 0; a.forEach(function (x) { if (!pasa(x, S.forma)) return; var k = x.forma === 'FINANCIADO' ? 'Financiado' : x.forma === 'CONTADO' ? 'Contado' : 'Sin dato'; cf[k] = (cf[k] || 0) + 1; nF++; });
    var pal = { Financiado: '#13223f', Contado: '#d6a417', 'Sin dato': '#b8c0d4' };
    q('[data-s="2"]').textContent = nF ? nF + ' clientes' : 'Sin ventas en el período';
    dona(q('[data-g="forma"]'), Object.keys(cf).sort(function (p, r) { return cf[r] - cf[p]; }).map(function (k) { return { l: k, n: cf[k], c: pal[k] }; }), nF);

    // 4) renovaciones
    q('[data-s="4"]').textContent = baseR ? 'De ' + baseR + ' clientes que ya cumplieron su año' : 'Aún no hay clientes que hayan cumplido su año';
    medidor(q('[data-g="med"]'), ren, nor, pen);

    // 5) estado de los clientes
    var aE = a.filter(function (x) { return pasa(x, S.estados); });
    q('[data-s="5"]').textContent = aE.length + ' clientes' + (S.estados.y === 'todos' && S.estados.m === '0' ? ' en total' : ' en el período');
    estados(q('[data-g="estados"]'), aE);

    // 6) vehículos más vendidos
    var vc = {}, nv = 0; a.forEach(function (x) { if (!x.veh || !pasa(x, S.veh)) return; var k = x.veh.toUpperCase().replace(/\s+/g, ' '); vc[k] = (vc[k] || 0) + 1; nv++; });
    var tp = Object.keys(vc).sort(function (p, r) { return vc[r] - vc[p]; }).slice(0, 6).map(function (k) { return { l: k, n: vc[k] }; });
    q('[data-s="6"]').textContent = nv ? 'Los ' + tp.length + ' más vendidos de ' + nv + ' clientes' : 'Sin ventas en el período';
    barrasH(q('[data-g="veh"]'), tp, nv || 1);
  }

  function resumen(clientes, gestiones) {
    var a = analizar(clientes || [], gestiones || []), r = 0, e = 0;
    a.forEach(function (x) { if (x.tipo === 'renovar') r++; else if (x.tipo === 'enviado') e++; });
    return { porRenovar: r, enviados: e, lista: a };
  }

  function aplicar(root, y, m) {   // pone el año y/o el mes en todas las tarjetas del tablero
    if (!root || !root.id || !LAST[root.id]) return;
    var S = ST[root.id]; if (!S) { render(root, LAST[root.id]); S = ST[root.id]; }
    Object.keys(S).forEach(function (k) { if (y !== '' && y != null) S[k].y = String(y); if (m !== '' && m != null && S[k].m !== undefined) S[k].m = String(m); });
    render(root, LAST[root.id]);
  }
  function setYear(root, y) { aplicar(root, y, null); }
  function reset(root) { if (!root || !root.id || !LAST[root.id]) return; delete ST[root.id]; delete TOP[root.id]; render(root, LAST[root.id]); }

  window.PMAyuda = { wire: ayWire, boton: ayBoton, css: ayCss };
  window.PMDashOMS = { render: render, setYear: setYear, setPeriodo: aplicar, reset: reset, resumen: resumen, analizar: analizar, DIAS_AVISO: DIAS_AVISO, ACC_ENV: ACC_ENV, ACC_REN: ACC_REN, ACC_NO: ACC_NO };
})();

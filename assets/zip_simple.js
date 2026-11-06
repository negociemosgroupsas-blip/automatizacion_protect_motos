/* Crea un archivo .zip (sin compresión) a partir de una lista de archivos. No necesita internet.
   ZipSimple.crear([{nombre:'carpeta/archivo.csv', datos:'texto' | Uint8Array | ArrayBuffer}]) -> Blob */
(function () {
  var T = null;
  function tabla() { if (T) return T; T = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } return T; }
  function crc(b) { var t = tabla(), c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function bytes(d) { if (typeof d === 'string') return new TextEncoder().encode(d); if (d instanceof ArrayBuffer) return new Uint8Array(d); return d; }
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function crear(archivos) {
    var partes = [], central = [], pos = 0, f = new Date();
    var hora = (f.getHours() << 11) | (f.getMinutes() << 5) | (f.getSeconds() >> 1), dia = ((f.getFullYear() - 1980) << 9) | ((f.getMonth() + 1) << 5) | f.getDate();
    archivos.forEach(function (a) {
      var nom = new TextEncoder().encode(a.nombre), d = bytes(a.datos), c = crc(d);
      var loc = [0x50, 0x4B, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(c), u32(d.length), u32(d.length), u16(nom.length), u16(0));
      partes.push(new Uint8Array(loc), nom, d);
      central.push({ nom: nom, c: c, len: d.length, pos: pos });
      pos += loc.length + nom.length + d.length;
    });
    var ini = pos, tam = 0;
    central.forEach(function (e) {
      var h = [0x50, 0x4B, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(e.c), u32(e.len), u32(e.len), u16(e.nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.pos));
      partes.push(new Uint8Array(h), e.nom); tam += h.length + e.nom.length;
    });
    partes.push(new Uint8Array([0x50, 0x4B, 5, 6].concat(u16(0), u16(0), u16(central.length), u16(central.length), u32(tam), u32(ini), u16(0))));
    return new Blob(partes, { type: 'application/zip' });
  }
  window.ZipSimple = { crear: crear };
})();

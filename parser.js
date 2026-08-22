/* ============================================================================
   parser.js — Convierte el marcado RTF-lite de los módulos e-Sword (.bblx)
   a HTML seguro, separando los títulos de perícopa del cuerpo del versículo.

   Vocabulario detectado en RV1960:
     \par                  -> salto de párrafo
     {\qc \b Titulo\par}   -> título de perícopa (encabezado)
     {\cf6 ...}            -> palabras de Cristo (rojo rúbrica)
     {\super\cf6 (A)}      -> marcador de referencia cruzada (volado)
     \i ... \i0            -> cursiva (palabras añadidas por el traductor)

   Salida: { headings: [strHTML,...], body: strHTML }
   El cuerpo usa clases CSS: .woc (words of Christ), .xref, <em>.
   Los toggles de rojo / referencias se controlan luego por CSS.
   ==========================================================================*/
(function (root) {
  'use strict';

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Tokeniza en: control words (\word, con número opcional), grupos { }, y texto.
  function tokenize(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === '\\') {
        // símbolos escapados \\ \{ \}
        var nx = src[i + 1];
        if (nx === '\\' || nx === '{' || nx === '}') {
          toks.push({ t: 'text', v: nx }); i += 2; continue;
        }
        // control word
        var m = /^\\([a-zA-Z]+)(-?\d+)?\s?/.exec(src.slice(i));
        if (m) {
          toks.push({ t: 'ctrl', w: m[1], num: m[2] !== undefined ? parseInt(m[2], 10) : null });
          i += m[0].length; continue;
        }
        i += 1; continue; // backslash suelto
      }
      if (c === '{') { toks.push({ t: 'open' }); i++; continue; }
      if (c === '}') { toks.push({ t: 'close' }); i++; continue; }
      // texto normal hasta el próximo \ { }
      var j = i;
      while (j < n && src[j] !== '\\' && src[j] !== '{' && src[j] !== '}') j++;
      toks.push({ t: 'text', v: src.slice(i, j) });
      i = j;
    }
    return toks;
  }

  // Estado de formato inline
  function cloneState(s) { return { cf: s.cf, sup: s.sup, ital: s.ital, heading: s.heading }; }

  function parse(scripture) {
    if (scripture == null) return { headings: [], body: '' };
    var src = String(scripture).replace(/\r/g, ' ').trim();
    var toks = tokenize(src);

    var headings = [];
    var body = '';                 // HTML del cuerpo
    var headBuf = null;            // buffer de texto de un heading en curso
    var stack = [{ cf: 0, sup: false, ital: false, heading: false }];

    function st() { return stack[stack.length - 1]; }

    function openInline(s) {
      var pre = '';
      if (s.ital) pre += '<em>';
      if (s.cf === 6) pre += '<span class="woc">';
      if (s.sup) pre += '<sup class="xref">';
      return pre;
    }
    function closeInline(s) {
      var post = '';
      if (s.sup) post += '</sup>';
      if (s.cf === 6) post += '</span>';
      if (s.ital) post += '</em>';
      return post;
    }

    for (var k = 0; k < toks.length; k++) {
      var tk = toks[k];

      if (tk.t === 'open') {
        stack.push(cloneState(st()));
      } else if (tk.t === 'close') {
        if (stack.length > 1) {
          var closing = stack.pop();
          // si cerramos el grupo que abrió el heading, lo materializamos
          if (closing.heading && !st().heading) {
            if (headBuf !== null) {
              var h = headBuf.replace(/\s*\u0001\s*/g, '<br>').trim()
                             .replace(/(<br>\s*)+$/,'').replace(/^(\s*<br>)+/,'');
              if (h) headings.push(h);
              headBuf = null;
            }
          }
        }
      } else if (tk.t === 'ctrl') {
        var w = tk.w, s = st();
        if (w === 'qc') { s.heading = true; if (headBuf === null) headBuf = ''; }
        else if (w === 'cf') { s.cf = (tk.num === null ? 0 : tk.num); }
        else if (w === 'super') { s.sup = true; }
        else if (w === 'b') { /* negrita: implícita en headings; ignorar en cuerpo */ }
        else if (w === 'i') { s.ital = (tk.num === 0 ? false : true); }
        else if (w === 'par' || w === 'p') {
          if (s.heading) { if (headBuf !== null) headBuf += '\u0001'; }
          else { body += '<span class="pbrk"></span>'; }
        }
        // otros controles se ignoran
      } else if (tk.t === 'text') {
        var s2 = st();
        var txt = tk.v;
        if (s2.heading) {
          if (headBuf === null) headBuf = '';
          headBuf += esc(txt);
        } else {
          if (txt.length) body += openInline(s2) + esc(txt) + closeInline(s2);
        }
      }
    }

    // heading sin cierre explícito (por si acaso)
    if (headBuf !== null) {
      var h2 = headBuf.replace(/\s*\u0001\s*/g, '<br>').trim().replace(/(<br>\s*)+$/,'');
      if (h2) headings.push(h2);
    }

    var PB = '<span class="pbrk"></span>';
    while (body.indexOf(PB) === 0) body = body.slice(PB.length).replace(/^\s+/, '');
    while (body.length >= PB.length && body.slice(-PB.length) === PB) body = body.slice(0, -PB.length).replace(/\s+$/, '');
    body = body.replace(/\s{2,}/g, ' ').replace(/^\s+/, '').replace(/\s+$/, '');
    return { headings: headings, body: body };
  }

  // Texto plano (para búsqueda / análisis): sin marcado ni referencias voladas.
  function plain(scripture) {
    var p = parse(scripture);
    var b = p.body
      .replace(/<sup class="xref">.*?<\/sup>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ').trim();
    return b;
  }

  var api = { parse: parse, plain: plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RTF = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Transfiere el rojo (palabras de Cristo) del módulo SIMPLE al módulo STRONG,
   alineando por caracteres no-espacio e inyectando {\cf6 ...} en el crudo Strong. */
const fs=require('fs');
const RTF=require('./parser.js');

// --- del crudo SIMPLE: secuencia de caracteres de lectura (char, red) desde el body HTML ---
function simpleReadSeq(raw){
  const html=RTF.parse(raw).body;
  const seq=[]; // {ch, red}
  let i=0, n=html.length, wocDepth=0, skipSup=0;
  const stack=[]; // 'woc' | 'pbrk' | 'em'
  function decodeEnt(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');}
  while(i<n){
    if(html[i]==='<'){
      const j=html.indexOf('>',i); if(j<0)break;
      const tag=html.slice(i,j+1); i=j+1;
      if(/^<sup\b/.test(tag)){skipSup++; continue;}
      if(/^<\/sup>/.test(tag)){if(skipSup>0)skipSup--; continue;}
      if(skipSup>0) continue;
      if(/^<span[^>]*\bwoc\b/.test(tag)){stack.push('woc'); continue;}
      if(/^<span[^>]*\bpbrk\b/.test(tag)){stack.push('pbrk'); continue;}
      if(/^<span\b/.test(tag)){stack.push('span'); continue;}
      if(/^<\/span>/.test(tag)){stack.pop(); continue;}
      // em u otros: ignorar
      continue;
    }
    // texto hasta el próximo tag
    let j=html.indexOf('<',i); if(j<0)j=n;
    if(skipSup===0){
      const txt=decodeEnt(html.slice(i,j));
      const red=stack.indexOf('woc')>=0;
      for(const ch of txt) seq.push({ch,red});
    }
    i=j;
  }
  return seq;
}

// --- del crudo STRONG: tokens en orden, TODO verbatim salvo el texto legible ---
// tipos: 'group' ({...}), 'pass' (control words / hex / escapes, verbatim, no-letra), 'text'
function strongTokens(raw){
  const src=String(raw);
  const toks=[]; let i=0, n=src.length;
  while(i<n){
    const c=src[i];
    if(c==='{'){ let depth=0,j=i;
      for(;j<n;j++){ if(src[j]==='{')depth++; else if(src[j]==='}'){depth--; if(depth===0){j++;break;}} }
      toks.push({t:'group', s:src.slice(i,j)}); i=j; continue;
    }
    if(c==='\\'){
      const nx=src[i+1];
      if(nx==="'"&&/[0-9a-fA-F]{2}/.test(src.substr(i+2,2))){ toks.push({t:'pass', s:src.substr(i,4)}); i+=4; continue; }
      if(nx==='\\'||nx==='{'||nx==='}'){ toks.push({t:'pass', s:src.substr(i,2)}); i+=2; continue; }
      const m=/^\\[a-zA-Z]+(-?\d+)?[ ]?/.exec(src.slice(i));
      if(m){ toks.push({t:'pass', s:m[0]}); i+=m[0].length; continue; }
      toks.push({t:'pass', s:c}); i++; continue;
    }
    let j=i; while(j<n && src[j]!=='\\' && src[j]!=='{' && src[j]!=='}') j++;
    toks.push({t:'text', s:src.slice(i,j)}); i=j;
  }
  return toks;
}

const isSpace=ch=>/\s/.test(ch);
function norm(ch){return ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
const isLetter=ch=>/[a-z0-9]/.test(norm(ch));

// Reconstruye el crudo Strong de un versículo alineando por LETRAS con el simple:
//  · repara la corrupción «¿» -> "ae" SOLO donde el simple confirma a+e en esa posición
//  · inyecta {\cf6 ...} para las palabras de Cristo (rojo) tomadas del simple
// Tolera acentos, comillas y espaciado distintos. Si no alinea por letras -> original.
function rebuildVerse(rawStrong, rawSimple){
  const sseq=simpleReadSeq(rawSimple);
  const sLet=[]; for(const x of sseq){ if(isLetter(x.ch)) sLet.push({L:norm(x.ch), red:x.red}); }
  const hadRed=sLet.some(x=>x.red);

  const toks=strongTokens(rawStrong);
  let p=0, aligned=true, lastRed=false;
  const units=[]; // {s, red}
  for(const tk of toks){
    if(tk.t!=='text'){ units.push({s:tk.s, red:lastRed}); continue; }
    for(const ch of tk.s){
      if(ch==='\u00bf' && p+1<sLet.length && sLet[p].L==='a' && sLet[p+1].L==='e'){
        var rd=sLet[p].red; units.push({s:'ae', red:rd}); lastRed=sLet[p+1].red; p+=2; continue;
      }
      if(isLetter(ch)){
        if(p<sLet.length && sLet[p].L===norm(ch)){ lastRed=sLet[p].red; p++; }
        else { aligned=false; }
      }
      units.push({s:ch, red:lastRed});
    }
  }
  if(!aligned || p!==sLet.length) return {raw:rawStrong, ok:false, hadRed:hadRed};

  let out='', open=false;
  for(const u of units){
    if(u.red && !open){ out+='{\\cf6 '; open=true; }
    else if(!u.red && open){ out+='}'; open=false; }
    out+=u.s;
  }
  if(open) out+='}';
  return {raw:out, ok:true, hadRed:hadRed};
}

// ---- proceso principal ----
const simple=JSON.parse(fs.readFileSync('data/RV1960.json','utf8'));
const strong=JSON.parse(fs.readFileSync('data/RV1960S.json','utf8'));
const S={};
simple.books.forEach(b=>{S[b.n]=b.ch;});
let redV=0, fixedAe=0, changedV=0, failRed=0, failAny=0;
const fails=[];
strong.books.forEach(b=>{
  const sb=S[b.n]; if(!sb)return;
  b.ch.forEach((verses,ci)=>{
    const sch=sb[ci]; if(!sch)return;
    verses.forEach((raw,vi)=>{
      const rs=sch[vi]; if(rs===undefined||rs===null)return;
      const r=rebuildVerse(raw, rs);
      if(r.ok){
        if(r.raw!==raw){
          if(r.raw.indexOf('\\cf6')>=0 && raw.indexOf('\\cf6')<0) redV++;
          if(raw.indexOf('\u00bf')>=0 && r.raw.indexOf('\u00bf')<raw.split('\u00bf').length-1) fixedAe++;
          verses[vi]=r.raw; changedV++;
        }
      } else {
        failAny++; if(r.hadRed)failRed++;
        if(fails.length<10)fails.push((b.n)+':'+(ci+1)+':'+(vi+1));
      }
    });
  });
});
fs.writeFileSync('data/RV1960S.json', JSON.stringify(strong));
console.log('Versículos con rojo inyectado:', redV);
console.log('Versículos con «¿»→"ae" reparados:', fixedAe);
console.log('Versículos modificados en total:', changedV);
console.log('Versículos que no alinearon:', failAny, '(de ellos con rojo:', failRed+')', fails.length?('ej: '+fails.join(', ')):'');
console.log('Tamaño nuevo:', (fs.statSync('data/RV1960S.json').size/1048576).toFixed(2),'MB');

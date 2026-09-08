/* ============================================================================
   parser.js — Marcado RTF-lite de módulos e-Sword (.bblx) -> HTML.
   Soporta dos variantes de RV1960:
     · Simple:  \par, {\qc \b Título\par}, {\cf6 …} (Cristo), {\super\cf6 (A)} (ref)
     · Strong:  {\cf11\super H7225  NCcSFC} (número Strong + morfología),
                \bullet (palabra añadida), «» como \'ab \'bb
   Salida: { headings:[…], body:'…' } con clases .woc .xref .strong (+ data-s,data-m)
   ==========================================================================*/
(function (root) {
  'use strict';

  var CP1252 = {0x80:'\u20AC',0x82:'\u201A',0x83:'\u0192',0x84:'\u201E',0x85:'\u2026',
    0x86:'\u2020',0x87:'\u2021',0x88:'\u02C6',0x89:'\u2030',0x8A:'\u0160',0x8B:'\u2039',
    0x8C:'\u0152',0x8E:'\u017D',0x91:'\u2018',0x92:'\u2019',0x93:'\u201C',0x94:'\u201D',
    0x95:'\u2022',0x96:'\u2013',0x97:'\u2014',0x98:'\u02DC',0x99:'\u2122',0x9A:'\u0161',
    0x9B:'\u203A',0x9C:'\u0153',0x9E:'\u017E',0x9F:'\u0178'};
  function hexChar(hh){var n=parseInt(hh,16);if(CP1252[n])return CP1252[n];return String.fromCharCode(n);}

  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function tokenize(src){
    var toks=[],i=0,n=src.length;
    while(i<n){var c=src[i];
      if(c==='\\'){
        var nx=src[i+1];
        if(nx==="'"&&/[0-9a-fA-F]{2}/.test(src.substr(i+2,2))){toks.push({t:'text',v:hexChar(src.substr(i+2,2))});i+=4;continue;}
        if(nx==='\\'||nx==='{'||nx==='}'){toks.push({t:'text',v:nx});i+=2;continue;}
        var m=/^\\([a-zA-Z]+)(-?\d+)?[ ]?/.exec(src.slice(i));
        if(m){toks.push({t:'ctrl',w:m[1],num:m[2]!==undefined?parseInt(m[2],10):null});i+=m[0].length;continue;}
        i+=1;continue;
      }
      if(c==='{'){toks.push({t:'open'});i++;continue;}
      if(c==='}'){toks.push({t:'close'});i++;continue;}
      var j=i;while(j<n&&src[j]!=='\\'&&src[j]!=='{'&&src[j]!=='}')j++;
      toks.push({t:'text',v:src.slice(i,j)});i=j;
    }
    return toks;
  }

  function renderSuper(buf){
    var t=(buf||'').replace(/[\t\r\n]+/g,'  ').replace(/ {3,}/g,'  ').trim();
    if(!t)return '';
    if(/^[HG]\d/.test(t)){
      var mm=/^((?:[HG]\d+ ?)+?)(?: {2,}([\s\S]*))?$/.exec(t);
      var numsPart, morph='';
      if(mm){numsPart=mm[1].trim();morph=(mm[2]||'').trim().replace(/\s+/g,' ');}
      else{numsPart=t;}
      var nums=numsPart.split(/\s+/).filter(Boolean);
      var disp=nums.map(function(x){return x.replace(/^[HG]/,'');}).join('·');
      return '<sup class="strong" data-s="'+escAttr(nums.join(' '))+'"'+(morph?(' data-m="'+escAttr(morph)+'"'):'')+' tabindex="0" role="button">'+disp+'</sup>';
    }
    return '<sup class="xref">'+esc(t.replace(/\s+/g,' '))+'</sup>';
  }

  function parse(scripture){
    if(scripture==null)return{headings:[],body:''};
    var src=String(scripture).replace(/\r/g,' ').trim();
    var toks=tokenize(src);
    var headings=[],body='',headBuf=null;
    var stack=[{cf:0,ital:false,heading:false,isSuper:false,buf:null}];
    function st(){return stack[stack.length-1];}
    function activeSuper(){for(var i=stack.length-1;i>=0;i--){if(stack[i].isSuper)return stack[i];}return null;}
    function emitText(txt){
      var sup=activeSuper();
      if(sup){sup.buf+=txt;return;}
      var s2=st();
      if(s2.heading){if(headBuf===null)headBuf='';headBuf+=esc(txt);return;}
      if(!txt.length)return;
      var pre='',post='';
      if(s2.ital){pre+='<em>';post='</em>'+post;}
      if(s2.cf===6){pre+='<span class="woc">';post='</span>'+post;}
      body+=pre+esc(txt)+post;
    }

    for(var k=0;k<toks.length;k++){var tk=toks[k];
      if(tk.t==='open'){var p=st();stack.push({cf:p.cf,ital:p.ital,heading:p.heading,isSuper:false,buf:null});}
      else if(tk.t==='close'){
        if(stack.length>1){var f=stack.pop();
          if(f.isSuper){body+=renderSuper(f.buf);}
          else if(f.heading && !st().heading){
            if(headBuf!==null){var h=headBuf.replace(/\s*\u0001\s*/g,'<br>').trim().replace(/(<br>\s*)+$/,'').replace(/^(\s*<br>)+/,'');if(h)headings.push(h);headBuf=null;}
          }
        }
      }
      else if(tk.t==='ctrl'){var w=tk.w,s=st();
        if(w==='qc'){s.heading=true;if(headBuf===null)headBuf='';}
        else if(w==='cf'){s.cf=(tk.num===null?0:tk.num);}
        else if(w==='super'){s.isSuper=true;if(s.buf===null)s.buf='';}
        else if(w==='b'){}
        else if(w==='i'){s.ital=(tk.num===0?false:true);}
        else if(w==='bullet'){}
        else if(w==='tab'){emitText(' ');}
        else if(w==='par'||w==='p'){if(activeSuper()){}else if(s.heading){if(headBuf!==null)headBuf+='\u0001';}else{body+='<span class="pbrk"></span>';}}
      }
      else if(tk.t==='text'){emitText(tk.v);}
    }
    if(headBuf!==null){var h2=headBuf.replace(/\s*\u0001\s*/g,'<br>').trim().replace(/(<br>\s*)+$/,'');if(h2)headings.push(h2);}

    var PB='<span class="pbrk"></span>';
    while(body.indexOf(PB)===0)body=body.slice(PB.length).replace(/^\s+/,'');
    while(body.length>=PB.length&&body.slice(-PB.length)===PB)body=body.slice(0,-PB.length).replace(/\s+$/,'');
    body=body.replace(/\s{2,}/g,' ').replace(/^\s+/,'').replace(/\s+$/,'');
    return{headings:headings,body:body};
  }

  function plain(scripture){
    var p=parse(scripture);
    return p.body.replace(/<sup[^>]*>[\s\S]*?<\/sup>/g,'').replace(/<[^>]+>/g,'')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s{2,}/g,' ').trim();
  }

  var api={parse:parse,plain:plain};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.RTF=api;
})(typeof window!=='undefined'?window:globalThis);

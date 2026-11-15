/* ReproCheck: local-only ZIP metadata and selected manifest reader. */
(() => {
'use strict';
const decoder = new TextDecoder('utf-8', {fatal:true});
const MB=1024*1024, limits={archive:32*MB,expanded:128*MB,entries:2000,manifest:256*1024};
const fail=msg=>{throw new Error(msg)};
const safePath=s=>{
  if(typeof s!=='string'||!s||s.length>1024||/[:\\\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(s)||s.startsWith('/')) return false;
  return s.split('/').every(x=>x && x!=='.' && x!=='..');
};
const utf8=b=>{try{return decoder.decode(b)}catch{return fail('A ZIP path or manifest is not valid UTF-8.')}};
function openZip(input){
  if(!(input instanceof Uint8Array)||input.length<22||input.length>limits.archive) fail('Use a ZIP between 22 bytes and 32 MiB.');
  const d=new DataView(input.buffer,input.byteOffset,input.byteLength);
  const u16=p=>d.getUint16(p,true),u32=p=>d.getUint32(p,true);
  let end=-1;
  for(let p=input.length-22;p>=Math.max(0,input.length-65557);p--)
    if(u32(p)===0x06054b50&&p+22+u16(p+20)===input.length){end=p;break}
  if(end<0) fail('Missing ZIP end record.');
  const n=u16(end+10), length=u32(end+12), start=u32(end+16);
  if(u16(end+4)||u16(end+6)||u16(end+8)!==n) fail('Multi-part ZIPs are not supported.');
  if(!n||n>limits.entries||start+length!==end) fail('Empty, oversized, ZIP64 or malformed directory.');
  const files=new Map(); const names=new Set(); let pos=start,total=0;
  for(let i=0;i<n;i++){
    if(pos+46>end||u32(pos)!==0x02014b50) fail('Malformed ZIP directory entry.');
    const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),compressed=u32(pos+20),size=u32(pos+24);
    const nameLength=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),disk=u16(pos+34),attrs=u32(pos+38),local=u32(pos+42);
    const next=pos+46+nameLength+extra+comment;
    if(next>end||!nameLength||disk||local+30>start||u32(local)!==0x04034b50) fail('Malformed ZIP file header.');
    if(flags&~0x080e||![0,8].includes(method)||(method===0&&compressed!==size)) fail('Encrypted or unsupported ZIP compression.');
    const mode=(attrs>>>16)&0xf000;
    if(mode&&![0x4000,0x8000].includes(mode)) fail('Archive contains a link or special file.');
    const raw=input.subarray(pos+46,pos+46+nameLength), name=utf8(raw);
    const directory=name.endsWith('/'), path=name.replace(/\/$/,'');
    if(!safePath(path)) fail('Archive contains an unsafe path.');
    if(names.has(path)) fail('Archive contains a duplicate path.');
    names.add(path); total+=size;
    if(total>limits.expanded) fail('Declared expanded size exceeds 128 MiB.');
    const lnl=u16(local+26),lel=u16(local+28),data=local+30+lnl+lel;
    if(local+30+lnl>start||data+compressed>start||lnl!==nameLength||u16(local+8)!==method||u16(local+6)!==flags||
      !raw.every((b,j)=>input[local+30+j]===b)) fail('Inconsistent ZIP headers.');
    if(!(flags&8)&&(u32(local+14)!==crc||u32(local+18)!==compressed||u32(local+22)!==size)) fail('Inconsistent ZIP sizes or checksum.');
    if(!directory) files.set(path,{data,size,compressed,method,crc});
    pos=next;
  }
  if(pos!==end||!files.size) fail('Archive contains no files or has an invalid directory.');
  return files;
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);return i});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=(crc>>>8)^crcTable[(crc^b)&255];return (crc^0xffffffff)>>>0}
async function readManifest(bytes,e){
  if(e.size>limits.manifest) fail('Manifest exceeds 256 KiB.');
  const payload=bytes.subarray(e.data,e.data+e.compressed); let decoded=payload;
  if(e.method===8){
    if(typeof DecompressionStream!=='function') fail('This browser does not support offline ZIP decompression.');
    const reader=new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const out=new Uint8Array(e.size);let p=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;
      if(p+value.length>out.length){await reader.cancel();fail('Manifest expanded beyond its declared size.')}
      out.set(value,p);p+=value.length;
    }}finally{reader.releaseLock()}
    if(p!==e.size)fail('Manifest size does not match its ZIP header.');
    decoded=out;
  }
  if(crc32(decoded)!==e.crc)fail('Manifest checksum does not match.');
  let m; try{m=JSON.parse(utf8(decoded))}catch{fail('Manifest is not valid JSON.')}
  if(!m||m.version!==1||!Array.isArray(m.figures)||m.figures.length>200)fail('Use manifest version 1 with a figures array of at most 200 rows.');
  return m.figures;
}
const markdownEscape=s=>String(s).replace(/[\r\n]/g,' ').replace(/[\\`*_\[\]{}<>#|]/g,'\\$&');
const pattern={readme:/^readme(?:\.[a-z0-9]+)?$/i,config:/(?:^|\/)(?:config|params|parameters|settings|environment)(?:[\/._-]|$)/i,
figure:/(?:^|\/)(?:fig(?:ure)?s?|plots?)(?:\/|[_.-]|\d).*\.(?:png|jpe?g|webp|svg|pdf|tiff?)$/i};
async function audit(input,name='archive.zip'){
  const files=openZip(input);let paths=[...files.keys()].filter(x=>!x.split('/').some(part=>part.startsWith('.')||part==='__MACOSX'));
  let root='';
  if(paths.length&&paths.every(x=>x.includes('/'))&&new Set(paths.map(x=>x.split('/')[0])).size===1)root=paths[0].split('/')[0]+'/';
  paths=paths.map(x=>x.slice(root.length)).sort();
  const known=new Set(paths), checks=[];
  const add=(status,label,detail)=>checks.push({status,label,detail});
  const readme=paths.find(x=>pattern.readme.test(x));
  add(readme?'pass':'missing','Project README',readme||'Add a README at the project root with instructions for reproducing the figures.');
  const config=paths.filter(x=>pattern.config.test(x));
  add(config.length?'pass':'missing','Analysis configuration',config.length?config.join(', '):'Add an environment or analysis configuration file (e.g. config/analysis.json).');
  const manifest=files.get(root+'repro-manifest.json'); let refs=[];
  if(!manifest)add('review','Figure manifest','Add repro-manifest.json to declare each figure, its data and its generating script.');
  else try{
    refs=await readManifest(input,manifest);
    add(refs.length?'pass':'review','Figure manifest',refs.length?refs.length+' declared route'+(refs.length===1?'':'s')+'.':'No figure routes declared; add a row for each figure.');
  }catch(err){add('missing','Figure manifest',err.message)}
  const mapped=new Set();
  for(const [i,row] of refs.entries()){
    if(!row||typeof row!=='object'||!['figure','data','script'].every(k=>safePath(row[k]))){
      add('missing','Manifest row '+(i+1),'Use safe relative paths in figure, data and script.');continue;
    }
    const label=String(row.id||row.figure).slice(0,150);
    if(mapped.has(row.figure)){add('review',label,'Duplicate figure mapping: '+row.figure);continue;}
    mapped.add(row.figure);
    const needed=['figure','data','script'].filter(k=>!known.has(row[k]));
    add(needed.length?'missing':'pass',label,needed.length?'Missing: '+needed.map(k=>k+' → '+row[k]).join('; '):row.figure+' ← '+row.data+' + '+row.script);
  }
  const untracked=paths.filter(x=>pattern.figure.test(x)&&!mapped.has(x));
  if(untracked.length)add('review','Unmapped figure files',untracked.slice(0,12).join(', ')+(untracked.length>12?' and '+(untracked.length-12)+' more':''));
  return {schema:'reprocheck/1',archive:name,fileCount:paths.length,root,checks,scope:'Checks package structure and declared file paths. Does not execute analyses or validate scientific results.'};
}
function markdown(r){return ['# ReproCheck report','','Archive: '+markdownEscape(r.archive),'Files inspected: '+r.fileCount,'',...r.checks.map(c=>'- **'+c.status.toUpperCase()+' · '+markdownEscape(c.label)+'**: '+markdownEscape(c.detail)),'',r.scope,''].join('\n')}
globalThis.ReproCheck={audit,markdown,limits};
})();

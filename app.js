(()=>{'use strict';
const $=id=>document.getElementById(id), zip=$('archive'),drop=$('drop'),status=$('status'),report=$('report'),empty=$('empty');
const summary=$('summary'),results=$('results');
let last=null,run=0;
function el(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e}
function notify(message,error=false){status.textContent=message;status.className=error?'error':''}
async function inspect(load,name){
  const turn=++run;last=null;report.hidden=true;empty.hidden=true;notify('Inspecting '+name+'…');
  try{const r=await ReproCheck.audit(await load(),name);if(turn!==run)return;last=r;render(r);notify('');report.hidden=false}
  catch(err){if(turn!==run)return;notify(err.message||'The archive could not be read.',true);empty.hidden=false}
}
function render(r){
  const title=el('div','archive-name');title.append(el('strong','',r.archive),el('small','', ' · '+r.fileCount+' files inspected'));
  const metrics=el('div','metrics');
  for(const [key,label] of [['pass','Found'],['missing','Missing'],['review','Needs review']]){
    const item=el('div','metric '+key);item.append(el('b','',r.checks.filter(c=>c.status===key).length),el('span','',label));metrics.append(item)
  }
  summary.replaceChildren(title,metrics);results.replaceChildren();
  for(const c of r.checks){const item=el('li','check'), body=el('div');
    body.append(el('strong','',c.label),el('p','',c.detail));item.append(el('span','flag '+c.status,c.status.toUpperCase()),body);results.append(item)}
}
function useFile(file){if(!file)return;inspect(async()=>{if(file.size>ReproCheck.limits.archive)throw new Error('This ZIP exceeds 32 MiB. Use a smaller archive.');return new Uint8Array(await file.arrayBuffer())},file.name)}
zip.addEventListener('change',()=>{useFile(zip.files[0]);zip.value=''});
for(const event of ['dragenter','dragover','dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.toggle('drag',event==='dragenter'||event==='dragover');if(event==='drop')useFile(e.dataTransfer.files[0])});
for(const [id,name,key] of [['demo-good','complete-example.zip','good'],['demo-gap','gapped-example.zip','gap']])
  $(id).addEventListener('click',()=>inspect(async()=>Uint8Array.from(atob(globalThis.demoZips[key]),c=>c.charCodeAt(0)),name));
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
$('export-md').onclick=()=>{if(last)download('reprocheck-report.md',ReproCheck.markdown(last),'text/markdown;charset=utf-8')};
$('export-json').onclick=()=>{if(last)download('reprocheck-report.json',JSON.stringify(last,null,2)+'\n','application/json')};
$('export-template').onclick=()=>download('repro-manifest.json',JSON.stringify({version:1,figures:[{id:'Figure 1',figure:'figures/fig1.svg',data:'data/example.csv',script:'scripts/plot.py'}]},null,2)+'\n','application/json');
})();

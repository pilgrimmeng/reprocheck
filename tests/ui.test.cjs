const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
class Element {
  constructor(tag){this.tag=tag; this.children=[];this._text='';this.events={};this.classList={toggle(){}};this.hidden=false;}
  set textContent(s){this._text=String(s);this.children=[]}
  get textContent(){return this._text+this.children.map(e=>e.textContent).join('')}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  addEventListener(event,fn){this.events[event]=fn;}
  click(){if(this.tag==='a')downloads.push({name:this.download,url:this.href});else return (this.onclick||this.events.click)?.({})}
  remove(){}
}
const downloads=[];
const doc={nodes:new Map(),body:new Element('body'),getElementById(id){if(!this.nodes.has(id))this.nodes.set(id,new Element(id));return this.nodes.get(id)},createElement(tag){return new Element(tag)}};
const $=id=>doc.getElementById(id);
test('UI wiring renders both demos and exports real reports',async()=>{
  global.document=doc;
  const blobs=new Map();
  const make=URL.createObjectURL;
  const nativeSetTimeout=global.setTimeout;
  URL.createObjectURL=blob=>{const u='blob:test/'+blobs.size;blobs.set(u,blob);return u};
  global.setTimeout=(fn,ms)=>{if(ms===30000)return 0;return nativeSetTimeout(fn,ms)};
  try{
    require('../audit.js');require('../demos.js');require('../app.js');
    await $('demo-good').click();
    assert.equal($('report').hidden,false);
    assert.equal($('results').children.length,5);
    assert.match($('summary').textContent,/7 files inspected/);
    await $('demo-gap').click();
    assert.match($('results').textContent,/Missing: figure → figures\/fig2.svg/);
    $('export-md').click();$('export-json').click();
    assert.deepEqual(downloads.map(x=>x.name),['reprocheck-report.md','reprocheck-report.json']);
    assert.equal(JSON.parse(await blobs.get(downloads[1].url).text()).fileCount,4);
    assert.match(await blobs.get(downloads[0].url).text(),/Figure 2/);
    const raw=readFileSync(new URL('../examples/complete-example.zip','file://'+__filename));
    $('archive').files=[new File([raw],'imported.zip')];
    $('archive').events.change();
    for(let i=0;i<20&&$('report').hidden;i++)await new Promise(r=>nativeSetTimeout(r,10));
    assert.match($('summary').textContent,/imported.zip/);
  }finally{URL.createObjectURL=make;global.setTimeout=nativeSetTimeout;delete global.document;}
});

const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../audit.js');
const sample=kind=>readFileSync(join(__dirname,'..','examples',kind+'-example.zip'));
test('complete ZIP and its wrapper folder are recognized',async()=>{
  const a=await ReproCheck.audit(sample('complete'),'one.zip');
  assert.equal(a.root,'complete-example/');
  assert.equal(a.fileCount,7);
  assert.equal(a.checks.length,5);
  assert.ok(a.checks.every(c=>c.status==='pass'));
  assert.match(ReproCheck.markdown(a),/Figure 2.*figures\/fig2/);
});
test('gapped archive spells out missing config, script, and figure',async()=>{
  const a=await ReproCheck.audit(sample('gapped'),'two.zip');
  assert.equal(a.checks.filter(c=>c.status==='missing').length,3);
  assert.match(a.checks.find(c=>c.label==='Figure 2').detail,/figures\/fig2.svg.*scripts\/plot.py/);
  assert.equal(JSON.parse(JSON.stringify(a)).archive,'two.zip');
});
test('empty, oversized and truncated input are rejected',async()=>{
  await assert.rejects(ReproCheck.audit(new Uint8Array(0)),/32 MiB/);
  await assert.rejects(ReproCheck.audit(new Uint8Array(ReproCheck.limits.archive+1)),/32 MiB/);
  await assert.rejects(ReproCheck.audit(sample('complete').subarray(0,-22)),/end record/);
});
test('a corrupted file header is rejected cleanly',async()=>{
  const bytes=sample('complete');bytes[0]=0;
  await assert.rejects(ReproCheck.audit(bytes),/Malformed ZIP file header/);
});
test('unknown extra markdown tokens are escaped in the report',()=>{
  const r={archive:'[demo]\n<script>',fileCount:1,checks:[],scope:'Scope'};
  assert.ok(ReproCheck.markdown(r).includes('Archive: '+String.fromCharCode(92)+'[demo')); 
});

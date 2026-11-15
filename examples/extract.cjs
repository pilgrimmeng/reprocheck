const {writeFileSync}=require('node:fs');
const {join}=require('node:path');
require('../demos.js');
for (const [key,name] of [['good','complete'],['gap','gapped']]) {
  writeFileSync(join(__dirname,name+'-example.zip'),Buffer.from(globalThis.demoZips[key],'base64'));
}

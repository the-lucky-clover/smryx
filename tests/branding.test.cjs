const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('retired branding is absent from all project files, including ignored bundles', () => {
  const root=path.join(__dirname,'..');
  const retiredNames=[[99,97,108,109,97,105],[99,97,105,109,97,105],[99,97,108,109,32,97,105]].map(codes=>String.fromCharCode(...codes));
  const matches=[];
  const visit=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(['.git','node_modules'].includes(entry.name)||entry.isSymbolicLink())continue;
      const filename=path.join(directory,entry.name);
      if(entry.isDirectory())visit(filename);
      else{
        const buffer=fs.readFileSync(filename);
        const text=buffer.toString('utf8').toLowerCase();
        const wideText=buffer.toString('utf16le').toLowerCase();
        if(retiredNames.some(name=>text.includes(name)||wideText.includes(name)))matches.push(path.relative(root,filename));
      }
    }
  };
  visit(root);
  assert.deepEqual(matches,[]);
});

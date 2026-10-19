const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspect,zipEntries}=require('../scripts/audit-retired-brand.cjs');
const retired=String.fromCharCode(99,97,108,109,97,105);
test('brand audit catches literal, joined, escaped, double-encoded and base64 strings',()=>{
  const forms=[retired.toUpperCase(),`https://${retired}.net`,JSON.stringify(retired.slice(0,3))+' + '+JSON.stringify(retired.slice(3)),
    [...retired].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''),
    [...retired].map(c=>'%25'+c.charCodeAt(0).toString(16)).join(''),
    [...retired].map(c=>'&#'+c.charCodeAt(0)+';').join(''),Buffer.from(`https://${retired}.net`).toString('base64')];
  for(const form of forms)assert.ok(inspect(Buffer.from(form)),form);
  assert.ok(inspect(Buffer.from(retired,'utf16le')));
  assert.ok(inspect(Buffer.concat([Buffer.from([0xfe,0xff]),Buffer.from(retired,'utf16le').swap16()])));
  assert.equal(inspect(Buffer.from('Sumyst uses https://chatgpt.com and keeps required third-party notices.')),null);
});
test('brand audit reads compressed ZIP entries and fails on unreadable archives',()=>{
  const content=Buffer.from(retired),compressed=require('node:zlib').deflateRawSync(content),name=Buffer.from('worker.js');
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(content.length,24);central.writeUInt16LE(name.length,28);
  const directory=Buffer.concat([central,name]),data=Buffer.concat([local,name,compressed]),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(data.length,16);
  const entries=zipEntries(Buffer.concat([data,directory,end]));
  assert.equal(entries.length,1);assert.ok(inspect(entries[0].content));
  assert.throws(()=>zipEntries(Buffer.from('not an archive')),/ZIP directory/);
});

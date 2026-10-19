const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../shared/popup-layout.js'),'utf8').replace(/^import[^\n]+\n/,'').replaceAll('export ', '');
function setup(storage){const ctx=vm.createContext({storage});vm.runInContext(source,ctx);return ctx;}
test('missing and unknown layout preferences retain Classic without writing defaults',async()=>{
  let writes=0;
  for(const stored of [undefined,null,'unknown','classic','city-console']){
    const api=setup({get:async()=>stored,set:async()=>writes++});
    assert.equal(await api.getPopupLayout(),stored==='city-console'?'city-console':'classic');
  }
  assert.equal(writes,0);
});
test('choosing a design only writes its own preference and rejects unknown designs',async()=>{
  const writes=[],api=setup({set:async(key,value)=>writes.push({key,value})});
  await api.setPopupLayout('city-console');
  assert.deepEqual(writes,[{key:'bm_popup_layout',value:'city-console'}]);
  await assert.rejects(api.setPopupLayout('invalid'),/available popup design/);
  assert.equal(writes.length,1);
});
test('live changes win over a stale startup read and clearing the preference restores Classic',async()=>{
  let resolve,listener;
  const applied=[],api=setup({get:()=>new Promise(r=>resolve=r),onChange:fn=>listener=fn});
  const ready=api.watchPopupLayout(value=>applied.push(value));
  listener({bm_popup_layout:{newValue:'city-console'}});
  resolve('classic');await ready;
  assert.deepEqual(applied,['city-console']);
  listener({bm_theme:{newValue:'dark'}});
  assert.equal(applied.length,1);
  listener({bm_popup_layout:{newValue:undefined}});
  assert.deepEqual(applied,['city-console','classic']);
});

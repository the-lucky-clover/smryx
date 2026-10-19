const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../background/batch-module.js'),'utf8');
function setup(existing=[],sourceTabs=[],rejectTabContext=false){
  const state={};let generated=0;
  const calls=[],listeners={},api={
    runtime:{getURL:file=>'chrome-extension://test/'+file,onInstalled:{addListener:fn=>listeners.install=fn},onStartup:{addListener:fn=>listeners.startup=fn}},
    contextMenus:{update:(id,properties,callback)=>{if(rejectTabContext&&properties.contexts.includes('tab'))throw new Error('Unsupported tab context');calls.push(['menu',id,properties]);callback();},onClicked:{addListener:fn=>listeners.click=fn}},
    storage:{local:{get:async key=>({[key]:state[key]}),set:async values=>Object.assign(state,values)}},
    tabs:{get:async id=>sourceTabs.find(tab=>tab.id===id),query:async query=>{calls.push(['query',query]);return query.url?existing:sourceTabs;},create:async values=>{calls.push(['create',values]);return{id:30};},update:async(id,values)=>calls.push(['tab',id,values])},
    windows:{update:async(id,values)=>calls.push(['window',id,values])}
  };
  const context=vm.createContext({chrome:api,console,URL,crypto:{randomUUID:()=>`id-${++generated}`}});vm.runInContext(source,context);return{context,calls,listeners,state};
}
test('the menu is registered for the pinned extension action context',()=>{
  const {calls,listeners}=setup();assert.equal(calls[0][1],'bm-batch-results');assert.equal(calls[0][2].title,'Batch Summaries');assert.deepEqual([...calls[0][2].contexts],['action']);assert.equal(typeof listeners.install,'function');assert.equal(typeof listeners.startup,'function');
});
test('native menuItemId opens the dedicated full tab and ignores unrelated menu clicks',async()=>{
  const {calls,listeners}=setup();const before=calls.length;listeners.click({menuItemId:'other'});assert.equal(calls.length,before);
  listeners.click({menuItemId:'bm-batch-results'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.find(call=>call[0]==='create')[1].url,'chrome-extension://test/popup/batch-results.html');
});
test('Add to Batch targets the clicked tab even when another tab is active',async()=>{
  const{context,listeners,state}=setup([],[{id:7,index:1,windowId:1,url:'https://example.com/target',title:'Clicked tab'},{id:9,index:0,windowId:1,url:'https://example.com/active',active:true}]);
  listeners.click({menuItemId:'bm-batch-add-tab'},{id:7,windowId:1});await new Promise(resolve=>setImmediate(resolve));
  const queued=await context.bmBatchCommands.get();assert.equal(queued.length,1);assert.equal(queued[0].tabs.length,1);assert.equal(queued[0].tabs[0].url,'https://example.com/target');
  await context.bmBatchCommands.acknowledge([queued[0].id]);assert.equal(state.bm_batch_requests.length,0);
});
test('Summarize all snapshots the left-to-right order before opening results',async()=>{
  const{context}=setup([],[{id:3,index:2,windowId:1,url:'https://example.com/third'},{id:1,index:0,windowId:1,url:'https://example.com/first'},{id:2,index:1,windowId:1,url:'https://example.com/second'},{id:4,index:3,windowId:1,url:'chrome://newtab'}]);
  await context.bmBatchCommands.enqueue({type:'BATCH_SUMMARIZE_ALL',windowId:1});const queued=await context.bmBatchCommands.get();assert.deepEqual(Array.from(queued[0].tabs,tab=>tab.tabId),[1,2,3]);
});
test('concurrent adds cannot overwrite each other in the durable inbox',async()=>{
  const{context}=setup([],[{id:1,index:0,windowId:1,url:'https://example.com/one'},{id:2,index:1,windowId:1,url:'https://example.com/two'}]);
  await Promise.all([context.bmBatchCommands.enqueue({type:'BATCH_ADD_TAB',tabId:1}),context.bmBatchCommands.enqueue({type:'BATCH_ADD_TAB',tabId:2})]);
  const queued=await context.bmBatchCommands.get();assert.equal(queued.length,2);assert.equal(new Set(Array.from(queued,command=>command.tabs[0].url)).size,2);
});
test('unsupported tab-strip menus fall back to the page menu without losing toolbar actions',()=>{
  const{calls}=setup([],[],true);const menus=calls.filter(call=>call[0]==='menu');assert.deepEqual([...menus.find(call=>call[1]==='bm-batch-add-tab')[2].contexts],['page']);assert.ok(menus.some(call=>call[1]==='bm-batch-all-window'));assert.ok(menus.some(call=>call[1]==='bm-batch-add-current'));
});
test('a newly opened tab can be queued from its pending URL before navigation commits',async()=>{
  const{context}=setup([],[{id:1,index:0,windowId:1,url:'',pendingUrl:'https://example.com/loading'}]);await context.bmBatchCommands.enqueue({type:'BATCH_ADD_TAB',tabId:1});assert.equal((await context.bmBatchCommands.get())[0].tabs[0].url,'https://example.com/loading');
});
test('all-window batches preserve left-to-right order within each window',async()=>{
  const{context}=setup([],[{id:4,index:1,windowId:2,url:'https://example.com/fourth'},{id:2,index:1,windowId:1,url:'https://example.com/second'},{id:3,index:0,windowId:2,url:'https://example.com/third'},{id:1,index:0,windowId:1,url:'https://example.com/first'}]);await context.bmBatchCommands.enqueue({type:'BATCH_SUMMARIZE_ALL',scope:'all',windowId:1});assert.deepEqual(Array.from((await context.bmBatchCommands.get())[0].tabs,tab=>tab.tabId),[1,2,3,4]);
});
test('repeated opens focus one existing results tab instead of duplicating it',async()=>{
  const {context,calls}=setup([{id:17,windowId:4}]);await Promise.all([context.bmOpenBatchResults(),context.bmOpenBatchResults()]);
  assert.equal(calls.filter(call=>call[0]==='query').length,1);assert.equal(calls.filter(call=>call[0]==='create').length,0);assert.equal(calls.find(call=>call[0]==='tab')[1],17);assert.equal(calls.find(call=>call[0]==='window')[1],4);
});
test('the shipped Chrome and Safari workers contain the current menu module',()=>{
  for(const file of ['background/index.js','SafariPort/SummarizeSafariExtension/Resources/background/index.js']){
    const worker=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert.equal(worker.slice(worker.indexOf('// BEGIN BATCH MENU MODULE\n')+'// BEGIN BATCH MENU MODULE\n'.length),source);
  }
});

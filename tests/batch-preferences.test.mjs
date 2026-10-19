import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLOSE_SOURCE_KEY,closeSavedSourceTab} from '../shared/batch-preferences.js';
const result={id:'saved',tabId:7,url:'https://example.com/article',status:'complete',summary:'A complete summary.',error:''};
function setup(state={},liveUrl=result.url){
  const removed=[],calls=[];
  const api={storage:{local:{get:async defaults=>{calls.push('read saved state');return{...defaults,...state};}}},tabs:{get:async id=>{calls.push('check source URL');return{id,url:liveUrl};},remove:async id=>{calls.push('close source');removed.push(id);}}};
  return{api,removed,calls};
}
test('closing tabs is off when the global setting is absent',async()=>{const{api,removed}=setup({bm_batch_results:[result]});assert.equal(await closeSavedSourceTab(api,result,99),false);assert.deepEqual(removed,[]);});
test('enabled closing requires a matching complete summary already saved',async()=>{
  for(const saved of [[],[{...result,status:'loading'}],[{...result,summary:'Old summary'}]]){
    const{api,removed}=setup({[CLOSE_SOURCE_KEY]:true,bm_batch_results:saved});assert.equal(await closeSavedSourceTab(api,result,99),false);assert.deepEqual(removed,[]);
  }
  const{api,removed,calls}=setup({[CLOSE_SOURCE_KEY]:true,bm_batch_results:[result]});assert.equal(await closeSavedSourceTab(api,result,99),true);assert.deepEqual(removed,[7]);assert.deepEqual(calls,['read saved state','check source URL','close source']);
});
test('failed, paused, navigated, and results tabs remain open',async()=>{
  for(const candidate of [{...result,status:'error',error:'Failed'},{...result,status:'paused'},result]){
    const{api,removed}=setup({[CLOSE_SOURCE_KEY]:true,bm_batch_results:[result]});assert.equal(await closeSavedSourceTab(api,candidate,7),false);assert.deepEqual(removed,[]);
  }
  const{api,removed}=setup({[CLOSE_SOURCE_KEY]:true,bm_batch_results:[result]},'https://example.com/new-work');assert.equal(await closeSavedSourceTab(api,result,99),false);assert.deepEqual(removed,[]);
});
test('storage failure never closes a tab',async()=>{const{api,removed}=setup();api.storage.local.get=async()=>{throw new Error('Storage unavailable');};await assert.rejects(closeSavedSourceTab(api,result,99),/Storage unavailable/);assert.deepEqual(removed,[]);});
test('a navigation that has started but not committed keeps its tab open',async()=>{const{api,removed}=setup({[CLOSE_SOURCE_KEY]:true,bm_batch_results:[result]});api.tabs.get=async()=>({id:7,url:result.url,pendingUrl:'https://example.com/new-work'});assert.equal(await closeSavedSourceTab(api,result,99),false);assert.deepEqual(removed,[]);});

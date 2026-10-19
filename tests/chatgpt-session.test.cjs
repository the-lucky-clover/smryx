const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../background/index.js'), 'utf8');
const helpers = source.slice(source.indexOf('let bmDeviceIdPromise;'), source.indexOf('async function ks('));
const transport = source.slice(source.indexOf('async function ks('), source.indexOf('async function ol('));
const provider = source.slice(source.indexOf('var fO=0,ud=class'), source.indexOf('var cd=class'));
function setup(initial = {}) {
  const state = {...initial}, writes = [], calls = [];
  let generated = 0;
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout,
    crypto:{randomUUID:() => `device-${++generated}`},
    al:{default:{storage:{local:{get:async () => state, set:async value => {writes.push(value); Object.assign(state,value);}}}}},
    xd:new Map(), vd:'accessToken', gr:{endpoint:'https://chatgpt.com'},
    Wt:{fireErrorEvent() {}},
    fetch:async (url, options) => {calls.push({url,options}); return {json:async () => ({accessToken:'test-token'})};},
    Br:class {constructor(token,model) {this.token=token;this.model=model;}},
    jt:{getConfig:() => ({endpoint:'https://chatgpt.com'})},
    Rs:() => 'test-message-id',
    ul:async () => {throw new Error('Model listing must not gate a ChatGPT request');},
  });
  vm.runInContext(helpers + transport + provider + '\nglobalThis.Provider=ud;', context);
  return {context,state,writes,calls};
}

test('stored device ID survives repeated and concurrent ChatGPT requests', async () => {
  const {context,writes} = setup({'oai-deviceId':'existing-device'});
  assert.deepEqual(await Promise.all([context.Ad(),context.Ad(),context.Ad()]), ['existing-device','existing-device','existing-device']);
  assert.equal(writes.length,0);
});

test('concurrent first requests create exactly one device ID', async () => {
  const {context,state,writes} = setup();
  assert.deepEqual(await Promise.all([context.Ad(),context.Ad(),context.Ad()]), ['device-1','device-1','device-1']);
  assert.equal(state['oai-deviceId'],'device-1');
  assert.equal(writes.length,1);
});

test('session and requirements requests include cookies and use the stored device', async () => {
  const {context,calls} = setup({'oai-deviceId':'existing-device'});
  await context.xo();
  await context.ks('test-token','POST','/sentinel/chat-requirements',{p:'requirements'});
  assert.equal(calls[0].options.credentials,'include');
  assert.equal(calls[1].options.credentials,'include');
  assert.equal(calls[1].options.headers['Oai-Device-Id'],'existing-device');
});

test('a rejected preparation request stops before submission and carries connection metadata', async () => {
  const {context} = setup();
  context.fetch=async () => ({ok:false,status:403,headers:{get:name=>name==='x-request-id'?'request-123':null},json:async()=>({error:{message:'Request rejected',code:'request_rejected'},token:'private-token'})});
  await assert.rejects(context.ks('test-token','POST','/sentinel/chat-requirements',{}), error => {
    assert.equal(error.message,'Request rejected');
    assert.equal(error.cause.phase,'requirements');
    assert.equal(error.cause.status,403);
    assert.equal(error.cause.code,'request_rejected');
    assert.equal(error.cause.requestId,'request-123');
    assert.equal(error.cause.token,undefined);
    return true;
  });
});

test('structured error messages decode HTML entities without rendering markup', () => {
  const {context} = setup();
  assert.equal(context.bmChatGPTErrorMessage({error:{message:'Hmm...something seems to have gone wrong.&#x20;'}}), 'Hmm...something seems to have gone wrong.');
  assert.equal(context.bmChatGPTErrorMessage({detail:{message:'Try&#32;again &amp; refresh'}}), 'Try again & refresh');
});

test('the reported generic failure retries once before an answer starts', async () => {
  const {context} = setup();
  const events = [];
  let attempts=0, refreshed=0;
  await context.bmRetryChatGPTRequest(async request => {
    if (++attempts===1) throw new Error('Hmm...something seems to have gone wrong.&#x20;');
    request.onEvent({type:'answer',data:{text:'Recovered summary'}});
    request.onEvent({type:'done'});
    return {};
  }, {onEvent:event => events.push(event)}, async () => {refreshed++;});
  assert.equal(attempts,2);
  assert.equal(refreshed,1);
  assert.equal(events[0].data.text,'Recovered summary');
  assert.equal(events.at(-1).type,'done');
});

test('the reported message stream error retries before text and preserves partial answers', async () => {
  for(const partial of [false,true]){
    const {context}=setup();
    const events=[];
    let attempts=0;
    const result=context.bmRetryChatGPTRequest(async request=>{
      attempts++;
      if(attempts===1){
        if(partial)request.onEvent({type:'answer',data:{text:'Partial answer'}});
        throw new Error('Error in message stream');
      }
      request.onEvent({type:'answer',data:{text:'Recovered answer'}});
      request.onEvent({type:'done'});
      return {};
    },{onEvent:event=>events.push(event)});
    if(partial){
      await assert.rejects(result,/Error in message stream/);
      assert.equal(attempts,1);
      assert.equal(events[0].data.text,'Partial answer');
    }else{
      await result;
      assert.equal(attempts,2);
      assert.equal(events[0].data.text,'Recovered answer');
    }
  }
});

test('repeated failures stop after two attempts and preserve the decoded error', async () => {
  const {context} = setup();
  let attempts=0;
  await assert.rejects(context.bmRetryChatGPTRequest(async () => {
    attempts++;
    throw new Error('Hmm...something seems to have gone wrong.&#x20;');
  }, {onEvent() {}}), error => error.message==='Hmm...something seems to have gone wrong.');
  assert.equal(attempts,2);
});

test('a partial answer or cancelled request is never automatically resent', async () => {
  for (const partial of [true,false]) {
    const {context} = setup();
    const controller=new AbortController();
    if (!partial) controller.abort();
    let attempts=0;
    await assert.rejects(context.bmRetryChatGPTRequest(async request => {
      attempts++;
      if (partial) request.onEvent({type:'answer',data:{text:'Partial summary'}});
      throw new Error('Something went wrong');
    }, {signal:controller.signal,onEvent() {}}), /Something went wrong/);
    assert.equal(attempts,1);
  }
});

for (const status of [400,403,500,503]) {
  test(`HTTP ${status} retries only when it is a temporary server failure`, async () => {
    const {context} = setup();
    let attempts=0;
    await assert.rejects(context.bmRetryChatGPTRequest(async () => {
      attempts++;
      throw new Error('Controlled HTTP failure',{cause:{status}});
    }, {onEvent() {}}), /Controlled HTTP failure/);
    assert.equal(attempts,status>=500?2:1);
  });
}

test('an expired session token refreshes once with cookies before resending', async () => {
  const {context,calls} = setup();
  context.xd.set('accessToken','expired-token');
  const instance=new context.Provider('expired-token','account-model');
  const tokens=[];
  instance.generateChatGPTAnswer=async () => {
    tokens.push(instance.token);
    if(tokens.length===1)throw new Error('Expired token',{cause:{status:401}});
    return {};
  };
  await instance.generateAnswer({onEvent() {}});
  assert.deepEqual(tokens,['expired-token','test-token']);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.credentials,'include');
});

test('request bodies use ChatGPT routing even with the reported rejected model passed to the provider', async () => {
  const {context} = setup();
  const instance=new context.Provider('test-token','gpt-5-3-mini');
  const body=JSON.parse(await instance.formBody({prompt:'Summarize this article.'}));
  assert.equal(instance.model,'auto');
  assert.equal(body.model,'auto');
  assert.equal(body.messages[0].content.parts[0],'Summarize this article.');
  assert.ok(!JSON.stringify(body).includes('gpt-5-3-mini'));
});

test('a rejected default request preserves its exact rejection without trying named models', async () => {
  const {context} = setup();
  const instance=new context.Provider('test-token','account-model');
  instance.generateChatGPTAnswer=async()=>{throw new Error('Model not found: account-model',{cause:{phase:'conversation',status:404,code:'model_not_found',requestId:'request-123'}});};
  await assert.rejects(instance.generateAnswer({onEvent() {}}),error=>{
    assert.equal(error.message,'Model not found: account-model');
    assert.equal(error.cause.model,'auto');
    assert.equal(error.cause.status,404);
    assert.equal(error.cause.code,'model_not_found');
    assert.equal(error.cause.requestId,'request-123');
    return true;
  });
});

test('stream errors retain their message and code; empty streams do not succeed', () => {
  const {context} = setup();
  const instance=new context.Provider('test-token','account-model');
  const events=[];
  const handler=instance.formMessageHandler({onEvent:event => events.push(event)},()=>{});
  assert.throws(() => handler(JSON.stringify({error:{message:'Hmm...something seems to have gone wrong.&#x20;',code:'upstream_failure'}})), error => error.message==='Hmm...something seems to have gone wrong.' && error.cause.code==='upstream_failure');
  assert.throws(() => handler('[DONE]'), /returned no response/);
  assert.equal(events.length,0);
});

test('a DONE marker quoted inside answer text does not truncate the stream', () => {
  const {context} = setup();
  const instance=new context.Provider('test-token','account-model');
  const events=[];
  const handler=instance.formMessageHandler({onEvent:event => events.push(event)},()=>{});
  handler(JSON.stringify({message:{id:'message',author:{role:'assistant'},content:{parts:['The marker is [DONE].']}},conversation_id:'conversation'}));
  handler('[DONE]');
  handler('[DONE]');
  assert.equal(events[0].data.text,'The marker is [DONE].');
  assert.equal(events.filter(event => event.type==='done').length,1);
});

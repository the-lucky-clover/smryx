const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');

// The shipped worker is an IIFE bundle. Exercise its actual shared provider
// factory and question adapter with deterministic provider streams.
const bundle = readFileSync(require('node:path').join(__dirname, '../background/index.js'), 'utf8');
const factory = bundle.slice(bundle.indexOf('async function bmCreateProvider('), bundle.indexOf('async function _O('));
const adapter = bundle.slice(bundle.indexOf('async function UD('), bundle.indexOf('var ld=0;'));
function setup(provider, generate) {
  const calls = [];
  const makeProvider = name => class {
    constructor(token, model) {calls.push({name, token, model});}
    generateAnswer(request) {return generate(request);}
  };
  const context = vm.createContext({
    AbortController, ud:makeProvider('web'), dd:makeProvider('api'), cd:makeProvider('deepseek-api'), pd:makeProvider('deepseek-chat'),
    xo:async () => 'web-token', ay:async () => 'deepseek-token',
    ul:async () => {throw new Error('Inference must not fetch the model catalog');},
    cy:async () => ({provider, model:'gpt-5-3-mini', apiKey:'test-key', selectedLanguage:'en'}),
    Wg:() => 'English', Wt:{fireEvent() {}}, Hr:(port, event) => port.events.push(event)
  });
  vm.runInContext(factory + adapter, context);
  return {context, calls};
}
function port() {
  const listeners = [];
  return {events:[], onDisconnect:{addListener:listener => listeners.push(listener)}, disconnect:() => listeners.forEach(listener => listener())};
}

for (const provider of ['api', 'web', 'deepseek-api', 'deepseek-chat']) {
  test(`questions use ChatGPT despite legacy ${provider} settings and stream cumulative text`, async () => {
    let request;
    const {context, calls} = setup(provider, async value => {
      request = value;
      value.onEvent({type:'answer', data:{text:'Blue'}});
      value.onEvent({type:'answer', data:{text:'Blue sensor'}});
      value.onEvent({type:'done'});
      return {};
    });
    const chat = port();
    await context.UD(chat, {text:'The blue sensor measures temperature.', question:'What does it measure?', history:[{role:'user', content:'Earlier question'}, {role:'assistant', content:'Earlier answer'}]});
    assert.equal(calls[0].name, 'web');
    assert.equal(calls[0].token, 'web-token');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'auto');
    assert.ok(request.prompt.includes('The blue sensor measures temperature.'));
    assert.ok(request.prompt.includes('Earlier answer'));
    assert.equal(chat.events[0].data.states.start, true);
    assert.equal(chat.events[2].data.tokens, 'Blue sensor');
    assert.equal(chat.events.at(-1).data.states.end, true);
    assert.equal(chat.events.at(-1).data.states.reference, undefined);
  });
}

test('disconnect aborts only that port even when two requests share source text', async () => {
  const requests = [], releases = [];
  const {context} = setup('api', request => new Promise(resolve => {requests.push(request); releases.push(resolve);}));
  const first = port(), second = port();
  const firstAnswer = context.UD(first, {text:'Same source', question:'First?'});
  const secondAnswer = context.UD(second, {text:'Same source', question:'Second?'});
  await new Promise(resolve => setImmediate(resolve));
  first.disconnect();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].signal.aborted, false);
  requests[0].onEvent({type:'answer', data:{text:'Must be ignored'}});
  requests[1].onEvent({type:'answer', data:{text:'Second reply'}});
  requests[1].onEvent({type:'done'});
  releases.forEach(resolve => resolve({}));
  await Promise.all([firstAnswer,secondAnswer]);
  assert.equal(first.events.length, 1);
  assert.equal(second.events[1].data.tokens, 'Second reply');
  assert.equal(second.events.at(-1).data.states.end, true);
});

test('provider failures propagate to the existing background error handler', async () => {
  const {context} = setup('web', async () => {throw new Error('Controlled failure');});
  await assert.rejects(context.UD(port(), {text:'A source', question:'Question?'}), /Controlled failure/);
});

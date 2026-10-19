const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../background/full-text.js'), 'utf8'), context);
const engine = context.bmFullText;
test('section boundaries preserve every character, including emoji and the ending', () => {
  const source = ('paragraph 😀\n'.repeat(3000)) + 'LAST IMPORTANT FINDING';
  const parts = engine.split(source);
  assert.equal(parts.join(''), source);
  assert.ok(parts.every(part => part.length <= 12000 && !/[\uD800-\uDBFF]$/.test(part)));
});
test('all sections contribute to one final streamed summary with original instructions', async () => {
  const calls = [], events = [], source = 'A'.repeat(12000) + 'FINAL FINDING';
  const provider = {async generateAnswer(request) {
    calls.push(request.prompt);
    const text = calls.length === 1 ? 'Opening evidence' : calls.length === 2 ? 'FINAL FINDING' : 'Complete summary';
    await request.onEvent({type:'answer', data:{text}});
    await request.onEvent({type:'done'});
    return {};
  }};
  await engine.generate(provider, {prompt:'original', systemMessage:'system', signal:new AbortController().signal, onEvent:event => events.push(event)}, {source, instructions:'Write two paragraphs in French.'});
  assert.equal(calls.length, 3);
  assert.match(calls[1], /FINAL FINDING/);
  assert.match(calls[2], /Opening evidence[\s\S]*FINAL FINDING/);
  assert.match(calls[2], /two paragraphs in French/);
  assert.deepEqual(events.filter(e => e.type === 'answer').map(e => e.data.text), ['Complete summary']);
  assert.equal(events.filter(e => e.type === 'done').length, 1);
});
test('interrupted sections fail without publishing partial summaries', async () => {
  const events = [];
  await assert.rejects(engine.generate({async generateAnswer(r) {await r.onEvent({type:'answer', data:{text:'partial'}});return {}; }},
    {signal:new AbortController().signal,onEvent:e => events.push(e)}, {source:'x'.repeat(15000)}), /before completion/);
  assert.ok(events.every(e => e.type === 'progress'));
});
test('cancellation prevents subsequent sections and synthesis', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(engine.generate({async generateAnswer(r) {calls++;controller.abort();await r.onEvent({type:'done'});}},
    {signal:controller.signal,onEvent(){}}, {source:'x'.repeat(30000)}), {name:'AbortError'});
  assert.equal(calls, 1);
});
test('oversized notes are reduced in bounded groups before final synthesis', async () => {
  let calls = 0;
  const provider = {async generateAnswer(r) {
    calls++;
    if (calls <= 2) await r.onEvent({type:'answer',data:{text:'N'.repeat(8000)}});
    else await r.onEvent({type:'answer',data:{text:'condensed evidence'}});
    await r.onEvent({type:'done'});
    return {};
  }};
  await engine.generate(provider, {signal:new AbortController().signal,onEvent(){}}, {source:'x'.repeat(18000),instructions:'Summary'});
  assert.equal(calls, 5); // Two source sections, two reduction groups, one final summary.
});

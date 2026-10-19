const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const background = read('background/index.js');
const helpers = background.slice(background.indexOf('async function bmGenerateSummary('), background.indexOf('var Br=class'));
const context = vm.createContext({});
vm.runInContext(helpers, context);
const inputContext = vm.createContext({});
vm.runInContext(read('popup/summary-input.js').replaceAll('export ', ''), inputContext);
test('instruction-only prompts always include source and translation placeholders', () => {
  const result = inputContext.prepareSummaryInput({CONTENT: 'Article'}, {question: 'Use five bullets.'});
  assert.match(result.question, /Use five bullets/);
  assert.match(result.question, /{{CONTENT}}/);
  assert.match(result.question, /{{SELECTED_LANGUAGE}}/);
});
test('source aliases are normalized without duplicating source placeholders', () => {
  for (const name of ['CONTENT', 'TEXT_CONTENT', 'VIDEO_SUBTITLES']) {
    const result = inputContext.prepareSummaryInput({[name]: 'Source'}, {question: `Summarize {{ ${name} }}.`});
    assert.equal(result.question.match(/{{CONTENT}}/g).length, 1);
    assert.doesNotMatch(result.question, /{{\s+(CONTENT|TEXT_CONTENT|VIDEO_SUBTITLES)/);
  }
});
test('empty source fails before a provider request', () => {
  assert.throws(() => inputContext.prepareSummaryInput({CONTENT: '  '}, {question: 'Summarize'}), /No source text/);
});
test('language options cover every packaged localization', () => {
  const languages = vm.runInContext('localizedLanguages', inputContext);
  for (const locale of require('node:fs').readdirSync(path.join(__dirname, '..', '_locales'))) {
    assert.ok(languages.includes(locale.replaceAll('_', '-')), locale);
  }
});
const chunk = (content, finish_reason = null) => JSON.stringify({id: 'summary', choices: [{delta: {content}, finish_reason}]});
async function summarize(chunks, result, aborted = false) {
  const events = [];
  const provider = {
    model: 'selected-model',
    config: {endpoint: '/default', models: [{model: 'selected-model', endpoint: '/selected'}]},
    async generateAPIanswer(request) {
      assert.equal(request.endPoint, '/selected');
      assert.deepEqual(JSON.parse(request.body).messages, [{role: 'system', content: 'Instructions'}, {role: 'user', content: 'Article'}]);
      for (const data of chunks) if (request.onMessage(data) === true) break;
      return result;
    }
  };
  await context.bmGenerateSummary.call(provider, {prompt: 'Article', systemMessage: 'Instructions', signal: {aborted}, onEvent: event => events.push(event)});
  return events;
}
test('streams text, ignores usage chunks, completes exactly once', async () => {
  const events = await summarize([chunk('Hello'), '{"choices":[],"usage":{}}', chunk(' world'), '[DONE]']);
  assert.equal(events.at(-2).data.text, 'Hello world');
  assert.equal(events.filter(event => event.type === 'done').length, 1);
});
test('finish reason completes without waiting for a DONE marker', async () => {
  const events = await summarize([chunk('Summary'), chunk('', 'stop'), '[DONE]']);
  assert.equal(events.at(-1).type, 'done');
  assert.equal(events.length, 2);
});
test('provider errors propagate instead of leaving the spinner running', async () => {
  await assert.rejects(summarize(['{"error":{"message":"Quota exceeded"}}']), /Quota exceeded/);
  await assert.rejects(summarize([], {error: {message: 'Invalid model'}}), /Invalid model/);
});
test('supports a nonstreaming JSON response', async () => {
  const events = await summarize([], {id: 'summary', choices: [{message: {content: 'Summary'}, finish_reason: 'stop'}]});
  assert.equal(events[0].data.text, 'Summary');
  assert.equal(events[1].type, 'done');
});
test('empty and interrupted responses fail visibly', async () => {
  await assert.rejects(summarize(['[DONE]']), /no summary/);
  await assert.rejects(summarize([chunk('Partial')]), /before completion/);
  await assert.rejects(summarize(['invalid json']), /JSON/);
});
test('truncation and filtering do not report a successful summary', async () => {
  await assert.rejects(summarize([chunk('Partial', 'length')]), /output limit/);
  await assert.rejects(summarize([chunk('', 'content_filter')]), /filtered/);
});
test('aborted requests emit no events', async () => {
  assert.deepEqual(await summarize([chunk('Text'), '[DONE]'], undefined, true), []);
});
test('cache isolates models, providers, and prompt boundaries', () => {
  const key = context.bmSummaryKey;
  const settings = {provider: 'api', model: 'one'};
  assert.notEqual(key(settings, {systemMessage: 'ab', question: 'c'}), key(settings, {systemMessage: 'a', question: 'bc'}));
  assert.notEqual(key(settings, {question: 'text'}), key({...settings, model: 'two'}, {question: 'text'}));
  assert.notEqual(key(settings, {question: 'text'}), key({...settings, provider: 'web'}, {question: 'text'}));
});
const content = read('content-script/index.js');
const extract = content.slice(content.indexOf('async function qt(){'), content.indexOf('oe.default.storage.local.get("showSummarizeButton")'));
for (const mode of ['null', 'empty', 'throws', 'article']) {
  test(`page extraction handles Readability returning ${mode}`, async () => {
    const ctx = vm.createContext({
      document: {cloneNode: () => ({}), location: {href: 'https://example.test'}, title: 'Page', dir: 'ltr', documentElement: {lang: 'en'}, body: {querySelector: () => ({innerText: 'Fallback text', innerHTML: '<p>Fallback text</p>'})}},
      window: {location: {href: 'https://example.test'}},
      mt: {Readability: class {parse() {if (mode === 'throws') throw Error('parse'); return mode === 'null' ? null : {textContent: mode === 'empty' ? '  ' : 'Article text'};}}},
      Ne: async () => undefined, Z: () => false, console: {log() {}, warn() {}}
    });
    vm.runInContext(extract, ctx);
    const result = await ctx.qt();
    assert.equal(result.textContent, mode === 'article' ? 'Article text' : 'Fallback text');
    assert.equal(result.url, 'https://example.test');
  });
}

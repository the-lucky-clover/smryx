const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePromise = import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../shared/default-prompt.js')).toString('base64'));
function store(initial = {}) {
  const state = structuredClone(initial);
  const writes = [];
  return {state, writes, get: async () => structuredClone(state), set: async update => {writes.push(update); Object.assign(state, update);}};
}
test('new default puts title above TL;DR and outline in section 3 with explicit source and language', async () => {
  const {DEFAULT_SUMMARY_PROMPT: prompt} = await modulePromise;
  assert.ok(prompt.indexOf('Begin with the title') < prompt.indexOf('1. **TL;DR'));
  assert.ok(prompt.indexOf('1. **TL;DR') < prompt.indexOf('2. **Bullet'));
  assert.ok(prompt.indexOf('2. **Bullet') < prompt.indexOf('3. **Structured Outline'));
  assert.ok(prompt.indexOf('3. **Structured Outline') < prompt.indexOf('4. **Full Link'));
  for (const token of ['{{TITLE}}', '{{URL}}', '{{CONTENT}}', '{{SELECTED_LANGUAGE}}']) assert.ok(prompt.includes(token));
});
test('unchanged legacy defaults upgrade without changing active selection or other prompts', async () => {
  const {migrateDefaultPrompt, DEFAULT_SUMMARY_PROMPT, LEGACY_SUMMARY_PROMPT} = await modulePromise;
  const storage = store({bmDetailedPromptV1: true, question: LEGACY_SUMMARY_PROMPT, promptSettings: {activePromptId: 'custom', prompts: [
    {id: 'default', title: 'Default Prompt', question: LEGACY_SUMMARY_PROMPT, systemMessage: 'Keep this system message'},
    {id: 'custom', title: 'Custom', question: 'My custom prompt'}
  ]}});
  await migrateDefaultPrompt(storage);
  assert.equal(storage.state.question, DEFAULT_SUMMARY_PROMPT);
  assert.equal(storage.state.promptSettings.prompts[0].question, DEFAULT_SUMMARY_PROMPT);
  assert.equal(storage.state.promptSettings.prompts[0].systemMessage, 'Keep this system message');
  assert.equal(storage.state.promptSettings.prompts[1].question, 'My custom prompt');
  assert.equal(storage.state.promptSettings.activePromptId, 'custom');
});
test('user-edited default and legacy question survive upgrade and repeated loads', async () => {
  const {migrateDefaultPrompt} = await modulePromise;
  const storage = store({question: 'My older custom prompt', promptSettings: {activePromptId: 'default', prompts: [{id: 'default', title: 'Default Prompt', question: 'My edited default'}]}});
  await migrateDefaultPrompt(storage);
  await migrateDefaultPrompt(storage);
  assert.equal(storage.state.question, 'My older custom prompt');
  assert.equal(storage.state.promptSettings.prompts[0].question, 'My edited default');
  assert.equal(storage.writes.length, 1);
});
test('fresh installation receives the revised default', async () => {
  const {migrateDefaultPrompt, DEFAULT_SUMMARY_PROMPT} = await modulePromise;
  const storage = store();
  await migrateDefaultPrompt(storage);
  assert.equal(storage.state.question, DEFAULT_SUMMARY_PROMPT);
  assert.equal(storage.state.bmDetailedPromptV2, true);
});
test('failed migration remains retryable', async () => {
  const {migrateDefaultPrompt} = await modulePromise;
  const storage = store();
  const write = storage.set;
  storage.set = async () => {throw new Error('Write failed');};
  await assert.rejects(migrateDefaultPrompt(storage), /Write failed/);
  assert.equal(storage.state.bmDetailedPromptV2, undefined);
  storage.set = write;
  await migrateDefaultPrompt(storage);
  assert.equal(storage.state.bmDetailedPromptV2, true);
});

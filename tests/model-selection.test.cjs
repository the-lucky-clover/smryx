const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise both shipped settings loaders: worker inference and popup/settings.
for (const [file, name, storageName, end] of [
  ['background/index.js', 'vo', '_o', 'var Gg=he'],
  ['chunk-KZLOIFVB.js', 'jr', 'fe', 'async function Vr('],
]) {
  const bundle = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const loader = bundle.slice(bundle.indexOf(`async function ${name}(`), bundle.indexOf(end));
  const methodStart = bundle.indexOf('static getDefaultModel(');
  const method = bundle.slice(methodStart, bundle.indexOf('static findModel(', methodStart));
  const registry = vm.runInNewContext(`(class {
    ${method}
    static getConfig() { throw new Error('Web routing must not consult the bundled catalog'); }
  })`);

  test(`${file}: default-model helper cannot reselect a catalog-listed unavailable model`, () => {
    for (const settings of [undefined, {models:[]}, {models:[{slug:'gpt-5-3-mini'}]}]) {
      assert.equal(registry.getDefaultModel('web', settings), 'auto');
    }
  });

  function setup(initial) {
    const state = {...initial}, writes = [];
    const storage = {
      get:async defaults => ({...defaults, ...state}),
      set:async updates => {writes.push(updates); Object.assign(state, updates);},
    };
    const context = vm.createContext({[storageName]:{default:{storage:{local:storage}}}});
    vm.runInContext(loader, context);
    return {load:() => context[name](), state, writes};
  }

  for (const provider of ['web', 'api', 'deepseek-api', 'deepseek-chat']) {
    test(`${file}: ignores ${provider} settings and clears the reported gpt-5-3-mini cache`, async () => {
      const {load, state, writes} = setup({provider, model:'gpt-5-3-mini', bmAutoChatGPTModel:'gpt-5-3-mini', apiKey:'old-key'});
      const settings = await load();
      assert.equal(settings.provider, 'web');
      assert.equal(settings.model, 'auto');
      assert.equal(settings.apiKey, '');
      assert.equal(state.provider, 'web');
      assert.equal(state.model, null);
      assert.equal(state.bmAutoChatGPTModel, null);
      await load();
      assert.equal(writes.length, 1, 'migration should not repeat');
    });
  }

  test(`${file}: clears an automatic choice even when the visible settings are already migrated`, async () => {
    const {load, state} = setup({provider:'web', model:null, bmAutoChatGPTModel:'gpt-5-3-mini'});
    assert.equal((await load()).model, 'auto');
    assert.equal(state.bmAutoChatGPTModel, null);
  });

  test(`${file}: first use needs no chosen or cached model`, async () => {
    const {load, writes} = setup({});
    assert.equal((await load()).model, 'auto');
    assert.equal(writes.length, 0);
  });
}

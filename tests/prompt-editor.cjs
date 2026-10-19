const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

function contrast(a, b) {
  function luminance(rgb) {
    const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(value => {
      const s = Number(value) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const defaults = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(root, 'shared/default-prompt.js')).toString('base64'));
  const context = await chromium.launchPersistentContext('', {channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]});
  context.setDefaultTimeout(15000);
  try {
    await context.route(/^https?:\/\//, route => route.fulfill({contentType: 'application/json', body: JSON.stringify({data: [{id: 'gpt-4o'}]})}));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async legacy => {
      await chrome.storage.local.set({provider: 'api', apiKey: 'test-key-not-a-real-credential', model: 'gpt-4o', bmDetailedPromptV1: true, bm_theme: 'light', promptSettings: {activePromptId: 'default', prompts: [
        {id: 'default', title: 'Default Prompt', question: legacy, systemMessage: ''},
        {id: 'custom', title: 'My prompt', question: 'Preserve my customized summary.', systemMessage: 'Be precise.'}
      ]}});
    }, defaults.LEGACY_SUMMARY_PROMPT);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(worker.url().replace('background/index.js', 'options/index.html'));
    const panel = page.getByRole('region', {name: 'Prompt settings', exact: true});
    const field = panel.getByRole('textbox', {name: 'Summarization prompt', exact: true});
    const save = panel.getByRole('button', {name: 'Save Prompt', exact: true});
    const status = message => panel.getByRole('status').getByText(message, {exact: true}).waitFor();
    const settings = () => worker.evaluate(async () => (await chrome.storage.local.get('promptSettings')).promptSettings);
    await field.waitFor();
    assert.equal(await field.inputValue(), defaults.DEFAULT_SUMMARY_PROMPT);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Edit Prompt', exact: true}).count(), 0);
    for (const theme of ['light', 'dark']) {
      await worker.evaluate(theme => chrome.storage.local.set({bm_theme: theme}), theme);
      await page.waitForFunction(theme => document.documentElement.dataset.bmTheme === theme, theme);
      const colors = await field.evaluate(el => {const style = getComputedStyle(el); return {text: style.color, bg: style.backgroundColor, caret: style.caretColor};});
      assert.ok(contrast(colors.text, colors.bg) >= 4.5, JSON.stringify(colors));
      assert.equal(colors.caret, colors.text);
      await field.click();
      assert.ok(await field.evaluate(el => document.activeElement === el));
      await panel.screenshot({path: path.join(__dirname, `prompt-editor-${theme}.png`)});
    }
    console.log('PASS: inline editor, no editing modal, and readable light/dark text and caret.');

    const edited = 'Summarize every individual step. Preserve all commands and version numbers.';
    await field.fill(edited);
    await save.click();
    await status('Prompt saved.');
    assert.equal((await settings()).prompts.find(prompt => prompt.id === 'default').question, edited);
    await page.reload();
    await field.waitFor();
    assert.equal(await field.inputValue(), edited);
    await field.fill('Unsaved changes');
    await panel.getByRole('button', {name: 'Discard changes', exact: true}).click();
    assert.equal(await field.inputValue(), edited);
    await field.fill('Keep this draft when switching prompts');
    await panel.getByLabel('Saved prompt', {exact: true}).selectOption('custom');
    assert.equal(await field.inputValue(), 'Preserve my customized summary.');
    assert.equal(await panel.getByLabel('System message', {exact: true}).inputValue(), 'Be precise.');
    await panel.getByLabel('Saved prompt', {exact: true}).selectOption('default');
    assert.equal(await field.inputValue(), 'Keep this draft when switching prompts');
    await panel.getByRole('button', {name: 'Discard changes', exact: true}).click();
    console.log('PASS: saves instruction-only prompts, persists after reload, discards changes, and preserves switched drafts.');

    await field.fill('{{#broken}}');
    await save.click();
    await panel.getByRole('alert').getByText('Template error:', {exact: false}).waitFor();
    assert.equal((await settings()).prompts.find(prompt => prompt.id === 'default').question, edited);
    const retryDraft = 'Keep edits when saving fails';
    await field.fill(retryDraft);
    await page.evaluate(() => {
      window.originalPromptStorageSet = chrome.storage.local.set;
      chrome.storage.local.set = () => {throw new Error('Simulated storage failure');};
    });
    await save.click();
    await panel.getByRole('alert').getByText('Your edits are still here', {exact: false}).waitFor();
    assert.equal(await field.inputValue(), retryDraft);
    assert.equal((await settings()).prompts.find(prompt => prompt.id === 'default').question, edited);
    await page.evaluate(() => {chrome.storage.local.set = window.originalPromptStorageSet;});
    await save.click();
    await status('Prompt saved.');
    assert.equal((await settings()).prompts.find(prompt => prompt.id === 'default').question, retryDraft);
    console.log('PASS: invalid templates and failed writes preserve saved data and drafts; retry succeeds.');

    await panel.getByRole('button', {name: 'Restore default prompt', exact: true}).click();
    assert.equal(await field.inputValue(), defaults.DEFAULT_SUMMARY_PROMPT);
    await save.click();
    await status('Prompt saved.');
    await panel.getByRole('button', {name: 'Copy prompt', exact: true}).click();
    await panel.getByLabel('Prompt title', {exact: true}).fill('Copied prompt');
    await field.fill('A copied prompt with a custom instruction.');
    await save.click();
    await status('Prompt saved.');
    const copyId = (await settings()).prompts.find(prompt => prompt.title === 'Copied prompt').id;
    await panel.getByRole('button', {name: 'Use this prompt', exact: true}).click();
    await status('Active prompt changed.');
    assert.equal((await settings()).activePromptId, copyId);
    await panel.getByRole('button', {name: 'Delete prompt', exact: true}).click();
    await status('Prompt deleted.');
    assert.equal((await settings()).activePromptId, 'default');
    assert.equal((await settings()).prompts.find(prompt => prompt.id === 'custom').question, 'Preserve my customized summary.');
    console.log('PASS: restore, copy, select active prompt, and delete work inline; custom prompts are preserved.');

    await panel.getByRole('button', {name: 'Add Prompt', exact: true}).click();
    await panel.getByLabel('Prompt title', {exact: true}).fill('New prompt');
    await save.click();
    await status('Prompt saved.');
    assert.ok((await settings()).prompts.some(prompt => prompt.title === 'New prompt'));
    await page.setViewportSize({width: 360, height: 800});
    await field.scrollIntoViewIfNeeded();
    assert.ok(await panel.evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    assert.ok(await field.evaluate(el => el.getBoundingClientRect().width > 150 && el.getBoundingClientRect().right <= innerWidth));
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(errors, []);
    await panel.screenshot({path: path.join(__dirname, 'prompt-editor-mobile.png')});
    console.log('PASS: add prompt, 360px layout, and no uncaught errors.');
  } finally {await context.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});

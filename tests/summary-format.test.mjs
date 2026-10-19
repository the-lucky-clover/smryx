import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanSummaryText, summaryParagraphs} from '../popup/summary-format.js';
import {DEFAULT_SUMMARY_PROMPT, PREVIOUS_SUMMARY_PROMPT, migrateDefaultPrompt} from '../shared/default-prompt.js';

const text = value => ({type:'text', value});
const paragraph = value => ({type:'paragraph', children:[text(value)]});
const title = () => ({type:'paragraph', children:[{type:'strong', children:[text('TL;DR Summary (3–15 sentences)')]}]});
const prose = 'Install the blue sensor. Connect its cable. Record the temperature. The result is twenty degrees Celsius.';
const contents = node => node.value ?? node.children.map(contents).join('');

test('UI icon markup becomes an emoji, while literal code stays intact', () => {
  const tag = '<icon name="clapperboard" color="secondary" inline />';
  assert.equal(cleanSummaryText(`Video ${tag}`), 'Video 🎬');
  assert.equal(cleanSummaryText('&lt;icon name="clapperboard" inline /&gt;'), '🎬');
  assert.equal(cleanSummaryText(`\`${tag}\`\n\n\`\`\`html\n${tag}\n\`\`\``), `\`${tag}\`\n\n\`\`\`html\n${tag}\n\`\`\``);
});

test('UI text wrappers retain their label without leaking component markup', () => {
  const label = 'Unverified — Vehicle search page';
  const tag = `<text color="secondary" weight="medium" size="xs">${label}</text>`;
  assert.equal(cleanSummaryText(tag), label);
  assert.equal(cleanSummaryText(tag.replaceAll('<', '&lt;').replaceAll('>', '&gt;')), label);
  assert.equal(cleanSummaryText(`<text color="secondary">**Unverified** — [Vehicle search page](https://example.com)</text>`), '**Unverified** — [Vehicle search page](https://example.com)');
  assert.equal(cleanSummaryText(`\`${tag}\`\n\n\`\`\`html\n${tag}\n\`\`\``), `\`${tag}\`\n\n\`\`\`html\n${tag}\n\`\`\``);
});

for (const format of ['heading', 'numbered', 'unindented']) {
  test(`TL;DR splits into two paragraphs for ${format} sections`, () => {
    const container = format === 'heading' ? {type:'root', children:[{type:'heading', depth:2, children:[text('TL;DR')]}, paragraph(prose)]}
      : format === 'numbered' ? {type:'listItem', children:[title(), paragraph(prose)]}
      : {type:'root', children:[{type:'list', children:[{type:'listItem', children:[title()]}]}, paragraph(prose)]};
    container.children.push({type:'heading', depth:2, children:[text('Structured Outline')]}, paragraph('Leave this section unchanged.'));
    summaryParagraphs()(container);
    const result = container.children.filter(node => node.data?.hProperties?.className.includes('bm-tldr-paragraph'));
    assert.equal(result.length, 2);
    assert.equal(result.map(contents).join('').replace(/\s+/g,' ').trim(), prose);
    assert.equal(contents(container.children.at(-1)), 'Leave this section unchanged.');
  });
}

test('splitting preserves emphasis, links, and inline code', () => {
  const linked = {type:'link', url:'https://example.com', children:[text('sensor documentation')]};
  const body = {type:'paragraph', children:[text('Install the '), {type:'strong', children:[text('blue sensor')]}, text('. Read the '), linked, text('. Execute '), {type:'inlineCode', value:'sensor.read()'}, text('. The result is twenty degrees Celsius.')]};
  const tree = {type:'root', children:[title(), body]};
  const original = contents(body);
  summaryParagraphs()(tree);
  assert.equal(tree.children.slice(1).map(contents).join(''), original);
  assert.ok(JSON.stringify(tree).includes('https://example.com'));
  assert.ok(JSON.stringify(tree).includes('inlineCode'));
});

test('a bold title followed immediately by prose still produces two paragraphs', () => {
  const heading = title();
  heading.children.push(text('\n' + prose));
  const tree = {type:'root', children:[heading]};
  summaryParagraphs()(tree);
  assert.equal(tree.children.filter(node => node.data?.hProperties?.className.includes('bm-tldr-paragraph')).length, 2);
});

test('an incomplete empty list during streaming does not crash the renderer', () => {
  assert.doesNotThrow(() => summaryParagraphs()({type:'root', children:[{type:'list', children:[{type:'listItem', children:[]}]}]}));
});

test('built-in prompt upgrades once and preserves user-authored prompts', async () => {
  const state = {bmDetailedPromptV2:true, question:PREVIOUS_SUMMARY_PROMPT, promptSettings:{activePromptId:'custom', prompts:[{id:'default', title:'Default Prompt', question:PREVIOUS_SUMMARY_PROMPT}, {id:'custom', title:'My Prompt', question:'Keep my custom wording'}]}};
  const storage = {get:async () => state, set:async updates => Object.assign(state,updates)};
  await migrateDefaultPrompt(storage);
  assert.equal(state.question, DEFAULT_SUMMARY_PROMPT);
  assert.equal(state.promptSettings.prompts[0].question, DEFAULT_SUMMARY_PROMPT);
  assert.equal(state.promptSettings.prompts[1].question, 'Keep my custom wording');
  assert.equal(state.promptSettings.activePromptId, 'custom');
  const saved = JSON.stringify(state);
  await migrateDefaultPrompt(storage);
  assert.equal(JSON.stringify(state), saved);
  const custom = {question:'My edited default', promptSettings:{prompts:[{title:'Default Prompt', question:'My other edited default'}]}};
  await migrateDefaultPrompt({get:async () => custom, set:async updates => Object.assign(custom,updates)});
  assert.equal(custom.question, 'My edited default');
  assert.equal(custom.promptSettings.prompts[0].question, 'My other edited default');
});

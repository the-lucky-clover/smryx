import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportSession,importSession,mergeResults,exportCSV,summaryParagraphs,splitSource,readStoredResults} from '../popup/batch-session.js';
const item=(updates={})=>({id:'one',tabId:50,windowId:2,url:'https://example.com/article',title:'A useful article',status:'complete',summary:'First paragraph. More information.\n\nSecond paragraph. An outcome.',startedAt:100,updatedAt:200,...updates});

test('sessions round-trip complete and unfinished pages with self-contained images',()=>{
  const results=[item({thumbnailData:'data:image/jpeg;base64,YQ==',imageKind:'screenshot'}),item({id:'two',status:'loading',summary:'Partial text',progress:35})];
  const restored=importSession(exportSession(results));
  assert.equal(restored[0].summary,results[0].summary);
  assert.equal(restored[0].thumbnailData,results[0].thumbnailData);
  assert.equal(restored[1].status,'paused');
  assert.equal(restored[1].progress,35);
  assert.ok(restored.every(result=>result.tabId===null&&result.windowId===null));
});
test('malformed or unsafe imports are rejected before touching stored results',()=>{
  for(const file of ['not JSON','{}',JSON.stringify({format:'other',version:1,results:[]}),exportSession([item()]).replace('https://example.com/article','javascript:alert(1)')])assert.throws(()=>importSession(file));
  const duplicate={format:'chatgpt-beast-mode-batch',version:1,results:[item(),item()]};
  assert.throws(()=>importSession(JSON.stringify(duplicate)),/duplicate/);
});
test('imports whitelist fields and cannot introduce executable image URLs',()=>{
  const restored=importSession(JSON.stringify({format:'chatgpt-beast-mode-batch',version:1,results:[item({apiKey:'secret',thumbnailData:'data:image/svg+xml,<svg onload="alert(1)"/>'})]}));
  assert.equal(restored[0].apiKey,undefined);assert.equal(restored[0].thumbnailData,'');
});
test('reimporting an old unfinished snapshot never overwrites a completed summary',()=>{
  const ready=item(), paused=item({status:'paused',summary:'',updatedAt:500});
  assert.equal(mergeResults([ready],[paused])[0],ready);
  assert.equal(mergeResults([paused],[item({updatedAt:600})])[0].status,'complete');
  assert.equal(mergeResults([ready],[ready]).length,1);
});
test('legacy storage migrates useful rows and ignores malformed rows',()=>{
  const rows=readStoredResults([{tabId:1,url:'https://example.com',title:'Legacy',summary:'A summary.'},{url:'javascript:alert(1)'},null]);
  assert.equal(rows.length,1);assert.equal(rows[0].status,'complete');assert.ok(rows[0].id);
});
test('CSV exports full summaries, escapes all cells, and neutralizes spreadsheet formulas',()=>{
  const csv=exportCSV([item({title:'=HYPERLINK("bad")',summary:'One, "two".\n\n'+'A long summary. '.repeat(100)})]);
  assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('""bad""'));assert.ok(csv.length>1500);assert.ok(csv.includes('One, ""two"".'));
});
test('TLDR extraction omits later outline sections and keeps two indented paragraph candidates',()=>{
  const text='A title\n\n1. **TL;DR Summary**\n\nFirst paragraph. More detail.\n\nSecond paragraph. Result.\n\n2. **Bullet Summary**\n\nNot the TLDR.';
  assert.deepEqual(summaryParagraphs(text),['First paragraph. More detail.','Second paragraph. Result.']);
  assert.deepEqual(summaryParagraphs('<text size="xs">One sentence. A second sentence.</text>'),['One sentence.','A second sentence.']);
});
test('source chunking retains the entire source, including its tail and Unicode',()=>{
  const source=('An international 🌍 example. '.repeat(1600))+'UNIQUE_TAIL';
  const chunks=splitSource(source);
  assert.ok(chunks.length>1);assert.ok(chunks.every(chunk=>chunk.length<=12000));
  assert.equal(chunks.join(' ').replace(/\s/g,''),source.replace(/\s/g,''));assert.ok(chunks.at(-1).endsWith('UNIQUE_TAIL'));
});

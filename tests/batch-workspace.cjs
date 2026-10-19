const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..'), fixture=fs.mkdtempSync(path.join(os.tmpdir(),'beast-batch-'));
  // Grant screenshot access only to this temporary test copy. The shipped
  // extension keeps debugger optional and asks on the user's submit gesture.
  const folders=new Set(['background','content-script','popup','shared','options','welcome','update','_locales','wasm']);
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    if(entry.isDirectory()&&folders.has(entry.name))fs.cpSync(path.join(root,entry.name),path.join(fixture,entry.name),{recursive:true});
    else if(entry.isFile()&&/\.(?:js|css|png|svg|json|wasm)$/.test(entry.name))fs.copyFileSync(path.join(root,entry.name),path.join(fixture,entry.name));
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json'),'utf8'));
  manifest.permissions.push('debugger');manifest.optional_permissions=manifest.optional_permissions.filter(value=>value!=='debugger');
  fs.writeFileSync(path.join(fixture,'manifest.json'),JSON.stringify(manifest));
  const server=createServer((req,res)=>{
    if(req.url==='/cover.png'){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));return;}
    const title=req.url==='/alpha'?'Alpha · Water temperature field notes':req.url==='/beta'?'Beta · A practical sensor installation':'Gamma · Climate research';
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="en"><head><title>${title}</title><meta property="og:image" content="/cover.png"><style>body{background:#eff6f1;color:#234435;font:18px/1.7 system-ui;padding:50px}article{max-width:760px}h1{font-size:40px}header{padding:30px;background:#d9ebde;border-radius:18px}</style></head><body><article><header><p>FIELD NOTES / 2026</p><h1>${title}</h1></header>${'<p>The blue sensor measures water temperature. Install its cable and record the temperature every minute. The measured result is twenty degrees Celsius.</p>'.repeat(16)}</article></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let context;
  try{
    context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${fixture}`,`--load-extension=${fixture}`],viewport:{width:1440,height:1000},acceptDownloads:true});
    context.setDefaultTimeout(20000);
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host, base=`http://127.0.0.1:${server.address().port}`;
    const tabMenuSupported=await worker.evaluate(()=>new Promise(resolve=>{
      try {chrome.contextMenus.create({id:'test-tab-context-probe',title:'Probe',contexts:['tab']},()=>{const failed=!!chrome.runtime.lastError;if(failed)resolve(false);else chrome.contextMenus.remove('test-tab-context-probe',()=>resolve(true));});}catch{resolve(false);}
    }));
    console.log('NATIVE TAB CONTEXT SUPPORTED:',tabMenuSupported);
    await worker.evaluate(async()=>{
      await chrome.storage.local.set({provider:'web',model:null,selectedLanguage:'en',showSummarizeButton:false,showYoutubeButton:false,bm_theme:'light',bm_batch_results:[]});
      globalThis.batchRequests=[];globalThis.holdSummaries=false;globalThis.failSources=[];
      const original=fetch;
      globalThis.fetch=async(input,options)=>{
        const url=String(input);
        if(url.endsWith('/api/auth/session'))return Response.json({accessToken:'controlled-batch-token'});
        if(url.includes('/accounts/check/'))return Response.json({accounts:{default:{features:[]}}});
        if(url.endsWith('/sentinel/chat-requirements'))return Response.json({token:'controlled-requirements'});
        if(url.includes('/backend-api/conversation/')&&options?.method==='PATCH')return Response.json({success:true});
        if(url.endsWith('/backend-api/conversation')){
          const body=JSON.parse(options.body);batchRequests.push(body);
          if(failSources.some(source=>body.messages[0].content.parts[0].includes(source)))return Response.json({error:{message:'Controlled source failure'}},{status:400});
          await new Promise((resolve,reject)=>{const timeout=setTimeout(resolve,holdSummaries?30000:1400);options.signal?.addEventListener('abort',()=>{clearTimeout(timeout);reject(new DOMException('Aborted','AbortError'));},{once:true});});
          const content='The **blue sensor** measures water temperature, with readings taken every minute. The field test reports a result of twenty degrees Celsius.\n\nInstall the sensor and connect its cable before recording measurements. The source describes a repeatable procedure and does not establish performance beyond the reported test.';
          return new Response(`data: ${JSON.stringify({message:{id:'batch-test',author:{role:'assistant'},content:{parts:[content]}},conversation_id:'batch-test'})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
        }
        if(url.startsWith('https:'))return Response.json({});
        return original(input,options);
      };
    });
    const articleA=await context.newPage();await articleA.goto(base+'/alpha');
    const articleB=await context.newPage();await articleB.goto(base+'/beta');
    const launcher=await context.newPage();await launcher.goto(`chrome-extension://${id}/popup/index.html`);
    const opened=context.waitForEvent('page');await launcher.evaluate(()=>chrome.runtime.sendMessage({type:'OPEN_BATCH_RESULTS',to:'background'}));
    const page=await opened;const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForURL('**/popup/batch-results.html');await page.locator('#empty-state').waitFor();await launcher.close();
    await page.locator('#new-batch:not(:disabled)').waitFor();
    await page.waitForFunction(()=>document.querySelector('#table-count').textContent==='0 of 0 pages');
    assert.equal(await page.locator('#toast').isVisible(),false);
    assert.equal(await page.locator('h1').innerText(),'Batch summaries.');
    assert.equal(await page.locator('table th').count(),2);
    await page.screenshot({path:path.join(os.tmpdir(),'beast-mode-batch-empty.png'),fullPage:true});
    await page.evaluate(()=>chrome.runtime.sendMessage({type:'OPEN_BATCH_RESULTS',to:'background'}));
    assert.equal((await page.evaluate(()=>chrome.tabs.query({url:chrome.runtime.getURL('popup/batch-results.html')+'*'}))).length,1);
    console.log('PASS: the background route opens one dedicated results tab; repeated opens focus it, with the empty state and two-column table ready.');

    await page.getByRole('button',{name:'New batch',exact:true}).click();
    await page.locator('#tab-selection input:checked').nth(1).waitFor();
    await page.locator('#capture-mode').selectOption('screenshot');
    await page.getByRole('button',{name:'Summarize pages',exact:false}).click();
    await page.locator('tr[data-status="loading"] .progress-track').first().waitFor();
    await page.waitForFunction(()=>{const fill=document.querySelector('tr[data-status="loading"] .progress-fill');return fill&&getComputedStyle(fill,':after').animationName==='shimmer';});
    await page.waitForFunction(()=>document.querySelectorAll('tr[data-status="complete"]').length===2&&document.querySelector('#run-status').hidden,{},{timeout:40000});
    const stored=await page.evaluate(()=>chrome.storage.local.get('bm_batch_results'));
    if(!stored.bm_batch_results.every(item=>item.imageKind==='screenshot'))console.log('IMAGE DIAGNOSTICS',stored.bm_batch_results.map(({imageKind,imageNote})=>({imageKind,imageNote})));
    assert.ok(stored.bm_batch_results.every(item=>item.imageKind==='screenshot'&&item.thumbnailData.startsWith('data:image/jpeg;base64,')));
    assert.equal(await page.locator('.site-image').count(),2);assert.equal(await page.locator('.progress-track').count(),0);
    assert.equal(await page.locator('td .summary-prose p').count(),4);
    const active=await page.evaluate(()=>chrome.tabs.query({active:true,currentWindow:true}));assert.ok(active[0].url.endsWith('/popup/batch-results.html'));
    const requests=await worker.evaluate(()=>batchRequests);assert.equal(requests.length,2);assert.ok(requests.every(request=>request.model==='auto'&&request.messages[0].content.parts[0].includes('twenty degrees Celsius')));
    assert.equal(await page.locator('#success-count').innerText(),'2');
    await page.screenshot({path:path.join(os.tmpdir(),'beast-mode-batch-table-light.png'),fullPage:true});
    console.log('PASS: real source extraction uses the existing ChatGPT engine; animated progress becomes actual background screenshots without changing the active tab, and every row has two TLDR paragraphs.');

    await page.locator('#search').fill('Alpha');assert.equal(await page.locator('#results-body tr').count(),1);
    await page.locator('#search').fill('');await page.locator('#sort').selectOption('az');assert.ok((await page.locator('.page-title').first().innerText()).startsWith('Alpha'));
    await page.locator('[data-filter="error"]').click();await page.locator('#no-matches').waitFor();await page.locator('#reset-filters').click();
    await page.getByRole('button',{name:'Read summary',exact:true}).first().click();await page.locator('#reader[open]').waitFor();assert.equal(await page.locator('#reader-body p').count(),2);await page.getByRole('button',{name:'Close summary',exact:true}).click();
    await page.locator('#export-menu-button').click();let downloadEvent=page.waitForEvent('download');await page.locator('#export-session').click();let download=await downloadEvent;
    const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.results.length,2);assert.ok(exported.results.every(result=>result.thumbnailData));
    await page.locator('#export-menu-button').click();downloadEvent=page.waitForEvent('download');await page.locator('#export-csv').click();download=await downloadEvent;assert.ok(fs.readFileSync(await download.path(),'utf8').includes('The **blue sensor**'));
    console.log('PASS: search, sorting, filtering, the reading panel, real JSON downloads with images, and complete CSV exports work.');

    const imported={...exported,results:[...exported.results,{id:'unfinished-page',url:base+'/gamma',title:'Unfinished climate research',status:'loading',progress:35,summary:'',startedAt:Date.now(),updatedAt:Date.now()}]};
    await page.locator('#import-file').setInputFiles({name:'unfinished-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.locator('tr[data-status="paused"]').waitFor();assert.equal(await page.locator('#results-body tr').count(),3);assert.equal(await worker.evaluate(()=>batchRequests.length),2);
    await page.locator('#resume-batch').click();await page.waitForFunction(()=>document.querySelectorAll('tr[data-status="complete"]').length===3&&document.querySelector('#run-status').hidden,{},{timeout:30000});
    assert.equal(await worker.evaluate(()=>batchRequests.length),3);assert.equal((await page.evaluate(()=>chrome.tabs.query({active:true,currentWindow:true})))[0].url,`chrome-extension://${id}/popup/batch-results.html`);
    await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await page.getByRole('status').getByText(/not valid JSON/).waitFor();assert.equal(await page.locator('#results-body tr').count(),3);
    console.log('PASS: importing merges completed results, turns interrupted work into paused rows, and resumes only the unfinished page in a background tab; invalid imports leave the library intact.');

    await page.locator('#theme-toggle').click();await page.locator('html[data-bm-theme="dark"]').waitFor();await page.screenshot({path:path.join(os.tmpdir(),'beast-mode-batch-table-dark.png'),fullPage:true});
    for(const width of [800,420]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await page.screenshot({path:path.join(os.tmpdir(),'beast-mode-batch-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
    await page.locator('#clear-all').click();await page.locator('#clear-dialog[open]').waitFor();await page.getByRole('button',{name:'Keep results',exact:true}).click();assert.equal(await page.locator('#results-body tr').count(),3);
    await page.locator('#clear-all').click();await page.locator('#confirm-clear').click();await page.locator('#empty-state').waitFor();assert.deepEqual((await page.evaluate(()=>chrome.storage.local.get('bm_batch_results'))).bm_batch_results,[]);
    console.log('PASS: light/dark layouts and two responsive widths fit; Clear all preserves data when cancelled and clears storage only after confirmation.');

    await worker.evaluate(()=>{holdSummaries=true;});
    await page.evaluate(async base=>{await chrome.tabs.create({url:base+'/pause-one',active:false});await chrome.tabs.create({url:base+'/pause-two',active:false});},base);
    await page.waitForFunction(async base=>(await chrome.tabs.query({})).filter(tab=>tab.url?.startsWith(base+'/pause-')&&tab.status==='complete').length===2,base);
    await page.locator('#new-batch').click();await page.locator('#capture-mode').selectOption('preview');await page.locator('#start-batch').click();
    await page.locator(`tr[data-status="loading"]:has(.page-domain[href="${base}/pause-one"])`).waitFor();await page.locator('#stop-batch').click();await page.locator('#run-status').waitFor({state:'hidden'});
    assert.ok(await page.locator('tr[data-status="paused"]').count());
    await page.locator('#export-menu-button').click();downloadEvent=page.waitForEvent('download');await page.locator('#export-session').click();download=await downloadEvent;
    const paused=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.ok(paused.results.some(result=>result.status==='paused'));assert.ok(paused.results.some(result=>result.status==='queued'));
    await page.locator('#clear-all').click();await page.locator('#confirm-clear').click();await page.locator('#empty-state').waitFor();
    await worker.evaluate(()=>{holdSummaries=false;});
    const sourceIds=await page.evaluate(async base=>(await chrome.tabs.query({})).filter(tab=>tab.url?.startsWith(base)).map(tab=>tab.id),base);
    await page.evaluate(ids=>chrome.tabs.remove(ids),sourceIds);
    const newSource=async path=>{const id=await page.evaluate(async url=>(await chrome.tabs.create({url,active:false})).id,base+path);await page.waitForFunction(async id=>(await chrome.tabs.get(id)).status==='complete',id);return id;};
    const first=await newSource('/ordered/first'), second=await newSource('/ordered/second'), third=await newSource('/ordered/third');
    // Change real tab-strip order independently of URL/title or creation order.
    await page.evaluate(async ids=>{await chrome.tabs.move(ids[2],{index:0});await chrome.tabs.move(ids[0],{index:1});await chrome.tabs.move(ids[1],{index:2});},[first,second,third]);
    await page.evaluate(tabId=>chrome.runtime.sendMessage({type:'BATCH_ADD_TAB',tabId,to:'background'}),second);
    await page.waitForFunction(()=>document.querySelectorAll('tr[data-status="complete"]').length===1&&document.querySelector('#run-status').hidden,{},{timeout:30000});
    assert.equal((await page.evaluate(()=>chrome.storage.local.get('bm_batch_results'))).bm_batch_results.length,1);
    assert.equal((await page.evaluate(id=>chrome.tabs.get(id),second)).id,second,'default-off closing must preserve the source');
    assert.equal(await page.locator('.page-domain').getAttribute('href'),base+'/ordered/second');
    await page.locator('#clear-all').click();await page.locator('#confirm-clear').click();await page.locator('#empty-state').waitFor();
    const beforeOrdered=await worker.evaluate(()=>batchRequests.length);
    const orderedTabs=await page.evaluate(async base=>(await chrome.tabs.query({currentWindow:true})).filter(tab=>tab.url?.startsWith(base)).sort((a,b)=>a.index-b.index).map(tab=>tab.url),base);
    await page.evaluate(()=>chrome.runtime.sendMessage({type:'BATCH_SUMMARIZE_ALL',scope:'window',to:'background'}));
    await page.locator('tr[data-status="loading"]').first().waitFor();
    const appended=await newSource('/ordered/appended');
    await page.evaluate(tabId=>chrome.runtime.sendMessage({type:'BATCH_ADD_TAB',tabId,to:'background'}),appended);
    await page.waitForFunction(()=>document.querySelectorAll('tr[data-status="complete"]').length===4&&document.querySelector('#run-status').hidden,{},{timeout:60000});
    const orderedRequests=await worker.evaluate(start=>batchRequests.slice(start).map(request=>request.messages[0].content.parts[0].match(/Source URL: ([^\n]+)/)?.[1]),beforeOrdered);
    // The previously summarized page can come from the shared cache.
    const expected=orderedTabs.filter(url=>!url.endsWith('/ordered/second')).concat(base+'/ordered/appended');
    assert.deepEqual(orderedRequests,expected);
    assert.deepEqual(await page.locator('.page-domain').evaluateAll(links=>links.map(link=>link.href)),orderedTabs.concat(base+'/ordered/appended'));
    assert.equal((await page.evaluate(()=>chrome.tabs.query({url:chrome.runtime.getURL('popup/batch-results.html')+'*'}))).length,1);
    console.log('PASS: adding one clicked URL preserves other source tabs, Summarize all follows real tab-strip order, and a new URL joins the live queue without interrupting it.');

    const optionsEvent=context.waitForEvent('page');await page.locator('#settings').click();const options=await optionsEvent;
    const closeSetting=options.getByRole('checkbox',{name:'Close source tabs after successful summaries'});await closeSetting.waitFor();assert.equal(await closeSetting.isChecked(),false);await closeSetting.check();
    await page.locator('#new-batch').click();assert.equal(await page.locator('#close-source-tabs').isChecked(),true);await page.getByRole('button',{name:'Close new batch',exact:true}).click();await options.close();
    await page.locator('#clear-all').click();await page.locator('#confirm-clear').click();await page.locator('#empty-state').waitFor();
    await page.evaluate(async base=>chrome.tabs.remove((await chrome.tabs.query({})).filter(tab=>tab.url?.startsWith(base)).map(tab=>tab.id)),base);
    const good=await newSource('/close/success'),bad=await newSource('/close/fail'),changed=await newSource('/close/navigate');
    await worker.evaluate(()=>{failSources=['/close/fail'];});
    await page.evaluate(()=>chrome.runtime.sendMessage({type:'BATCH_SUMMARIZE_ALL',scope:'window',to:'background'}));
    await page.waitForFunction(url=>[...document.querySelectorAll('tr[data-status="loading"] .page-domain')].some(link=>link.href===url),base+'/close/navigate',{timeout:45000});
    await page.waitForFunction(url=>{const row=[...document.querySelectorAll('tr[data-status="loading"]')].find(row=>row.querySelector('.page-domain')?.href===url);return row?.querySelector('.preview-loading strong')?.textContent==='Writing your TL;DR';},base+'/close/navigate');
    await page.evaluate(({id,url})=>chrome.tabs.update(id,{url}),{id:changed,url:base+'/changed'});
    await page.locator('#run-status').waitFor({state:'hidden',timeout:30000});
    const tabState=await page.evaluate(async ids=>Promise.all(ids.map(async id=>{try{return(await chrome.tabs.get(id)).url;}catch{return null;}})),[good,bad,changed]);
    assert.equal(tabState[0],null);assert.equal(tabState[1],base+'/close/fail');assert.equal(tabState[2],base+'/changed');
    assert.equal((await page.evaluate(()=>chrome.storage.local.get('bm_batch_results'))).bm_batch_results.find(result=>result.tabId===good).status,'complete');
    assert.equal(await page.locator(`.page-domain[href="${base}/close/success"]`).count(),1);
    assert.ok((await page.evaluate(()=>chrome.tabs.getCurrent())).url.endsWith('/popup/batch-results.html'));
    console.log('PASS: the default-off global preference syncs between Settings and the batch dialog; enabling it closes only saved successes, preserves failed/navigated tabs, and keeps original result URLs.');
    assert.deepEqual(errors,[]);console.log('PASS: pausing aborts active work, preserves queued pages, and exports an unfinished session; no page errors.');
  }finally{
    server.closeAllConnections();
    if(context){const browser=context.browser(),cdp=await browser.newBrowserCDPSession();const{processInfo}=await cdp.send('SystemInfo.getProcessInfo');const process=processInfo.find(value=>value.type==='browser');await cdp.detach();const timeout=setTimeout(()=>{if(process)try{global.process.kill(process.id);}catch{}},5000);try{await browser.close();}finally{clearTimeout(timeout);}}
    await new Promise(resolve=>server.close(resolve));
    if(path.dirname(path.resolve(fixture))===path.resolve(os.tmpdir())&&path.basename(fixture).startsWith('beast-batch-'))fs.rmSync(fixture,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

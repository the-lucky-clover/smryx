const {chromium} = require('playwright');
const {createServer} = require('node:http');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const article = '<!doctype html><html><head><title>A clearer reading</title></head><body style="margin:0;padding:40px;background:#eeeae3;color:#30463e;font:18px/1.8 system-ui"><main style="max-width:740px;margin:auto"><h1>Room for a good idea.</h1><p id="reading">' + 'An interesting page deserves a little attention. Sumyst helps keep the ideas, the details, and the next question together. '.repeat(6) + '</p></main></body></html>';
(async () => {
  const server = createServer((req,res) => {
    if(req.url === '/article') {res.setHeader('Content-Type','text/html');res.end(article);return;}
    const route = decodeURIComponent(req.url.split('?')[0]);
    const base = path.join(root,'docs');
    const file = path.resolve(base, '.' + (route.endsWith('/') ? route+'index.html' : route));
    if(!file.startsWith(base + path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000}});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({bm_analytics_enabled:false,showSummarizeButton:true,showYoutubeButton:true});
      globalThis.fetch=async input=>{
        const url=String(input);
        if(url.endsWith('/api/auth/session'))return Response.json({accessToken:'controlled-presentation-token'});
        if(url.endsWith('/sentinel/chat-requirements'))return Response.json({token:'controlled-requirements'});
        if(url.endsWith('/backend-api/conversation'))return new Response('data: '+JSON.stringify({message:{id:'demo',author:{role:'assistant'},content:{parts:['A clear summary of the selected passage.\n\nThe details stay together with the next question.']}},conversation_id:'demo'})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
        return Response.json({accounts:{default:{features:[]}}});
      };
    });
    await context.route('https://**/*',route=>route.fulfill({status:200,body:'{}',contentType:'application/json'}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole('heading',{name:/Keep the insight/}).waitFor();
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:1000});
      if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) console.log(await page.locator("body *").evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,10)));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`marketing overflow at ${width}`);
      assert.ok(await page.locator('img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)));
      await page.screenshot({path:path.join(root,`artifacts/sumyst-site-${width}.png`),fullPage:true});
    }
    await page.getByRole('button',{name:'Get Sumyst',exact:false}).first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button',{name:'Safari & iOS',exact:true}).click();
    assert.ok(await page.getByRole('link',{name:'Open Safari build guide'}).isVisible());
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'The reading',exact:true}).click();
    assert.ok(await page.locator('#example-source').isVisible());
    await page.getByRole('button',{name:'The clarity',exact:true}).click();
    assert.ok(await page.locator('#example-summary').isVisible());
    await page.getByText('Does it read every part of a long page?',{exact:true}).click();
    assert.ok(await page.getByText(/It processes all of the extracted text/).isVisible());
    console.log('PASS: marketing layouts at 320–1440px, images, installation dialog, browser tabs, example switcher, and FAQ.');
    const id=new URL(worker.url()).host;
    await page.goto(`chrome-extension://${id}/welcome/index.html`);
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`onboarding overflow at ${width}`);
    }
    assert.equal(await page.locator('video').count(),0);
    await page.getByRole('button',{name:'Skip →',exact:true}).click();
    await page.getByRole('link',{name:'Open ChatGPT'}).waitFor();
    await page.getByRole('button',{name:'Next →',exact:true}).click();
    await page.getByRole('link',{name:'Options',exact:true}).waitFor();
    await page.locator('#usage-statistics').check();
    await page.locator('#usage-statistics').uncheck();
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('bm_analytics_enabled'))).bm_analytics_enabled,false);
    await page.reload();
    assert.equal(await page.locator('#usage-statistics').isChecked(),false);
    await page.screenshot({path:path.join(root,'artifacts/sumyst-onboarding.png'),fullPage:true});
    console.log('PASS: responsive screenshot onboarding, three setup steps, ChatGPT-only connection, and persistent analytics preference.');
    await page.setViewportSize({width:1000,height:700});
    await page.goto(`http://127.0.0.1:${server.address().port}/article`);
    await page.waitForTimeout(200);
    await page.locator('#reading').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
    const floating=page.getByRole('button',{name:'Generate Summary of selected text',exact:true});
    await floating.waitFor();
    assert.equal(await floating.innerText(),'Generate Summary');
    await floating.screenshot({path:path.join(root,'artifacts/sumyst-floating-button.png')});
    assert.notEqual(await floating.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await floating.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
    await floating.click();
    await page.locator('#chatgpt-summarize-popup').waitFor();
    assert.ok((await page.evaluate(()=>getSelection().toString())).length>160,'button preserves the selected passage');
    await context.route('https://www.youtube.com/watch?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="padding:70px;background:#fafafa"><segmented-like-dislike-button-view-model>Video actions</segmented-like-dislike-button-view-model></body></html>'}));
    await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
    await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-finish')));
    const video=page.getByRole('button',{name:'Generate Summary',exact:true});
    await video.waitFor();
    assert.equal(await video.innerText(),'Generate Summary');
    await video.screenshot({path:path.join(root,'artifacts/sumyst-video-button.png')});
    console.log('PASS: glass video/selection buttons, new labels, selected-text preservation, working popup action, and reduced-motion support.');
    assert.deepEqual(errors,[]);
  } finally {
    server.closeAllConnections();server.close();
    if(context){const browser=context.browser(),session=await browser.newBrowserCDPSession();const {processInfo}=await session.send('SystemInfo.getProcessInfo');const processId=processInfo.find(p=>p.type==='browser')?.id;await session.detach();const timer=setTimeout(()=>{try{if(processId)process.kill(processId);}catch{}},5000);await context.close();clearTimeout(timer);}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

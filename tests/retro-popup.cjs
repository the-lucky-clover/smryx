const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
  const article='<!doctype html><html><head><meta charset="utf-8"><title>A city built for reading</title></head><body><main><h1>A city built for reading</h1>'+('<p>Good planning starts with observing how people move through a city. Public space, reliable transport, and readable street layouts work together to make everyday life easier. Preserve the source details and ask questions when a conclusion needs more context.</p>'.repeat(12))+'</main></body></html>';
  const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(article);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let context;
  try{
    context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1280,height:900}});
    context.setDefaultTimeout(15000);
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async()=>{
      await chrome.storage.local.set({bm_analytics_enabled:false,bm_theme:'light',showSummarizeButton:false,selectedLanguage:'en',provider:'web',model:'auto',question:'Summarize in two paragraphs with key insights.',systemMessage:''});
      globalThis.summaryCount=0;globalThis.fixtureRequests=[];
      globalThis.fetch=async(input,options)=>{
        const url=String(input);fixtureRequests.push(url);
        if(url.endsWith('/api/auth/session'))return Response.json({accessToken:'retro-fixture'});
        if(url.endsWith('/sentinel/chat-requirements'))return Response.json({token:'retro-requirements'});
        if(url.endsWith('/backend-api/conversation')){
          summaryCount++;
          const body=JSON.parse(options.body),prompt=body.messages[0].content.parts[0];
          const text=prompt.includes('User question:')?'The source highlights public space, reliable transport, and readable street layouts.':
            '1. **TL;DR Summary**\n\nGood cities make room for people. Public space, reliable transport, and readable streets help everyday life work better.\n\nStart with observation, then check the details behind each conclusion. A short summary is a starting point for understanding the original source.\n\n2. **Key insights**\n\n- Design for the people using the city.\n- Keep the source details close.\n- Ask a follow-up question when you need more context.\n\nRead the [source guide](https://example.test/guide).';
          return new Response('data: '+JSON.stringify({message:{id:'retro-response',author:{role:'assistant'},content:{parts:[text]}},conversation_id:'retro-session'})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
        }
        return Response.json({accounts:{default:{features:[]}}});
      };
    });
    await context.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/article`;
    await page.goto(url);await page.bringToFront();
    await worker.evaluate(async url=>{const[tab]=await chrome.tabs.query({url});await chrome.tabs.sendMessage(tab.id,{type:'OPEN_POPUP',to:'content-script'});},url);
    const frame=page.frameLocator('#chatgpt-summarize-popup');
    try { await frame.locator('#gpt-answer').getByText('Good cities make room for people.',{exact:false}).waitFor(); } catch(e) {console.log('INITIAL POPUP',await frame.locator('body').innerText());console.log('REQUESTS',await worker.evaluate(()=>fixtureRequests));throw e;}
    await frame.locator('html[data-bm-layout="classic"]').waitFor();
    assert.equal(await frame.locator('.city-control-dock').count(),0);
    assert.equal(await worker.evaluate(async()=>Object.hasOwn(await chrome.storage.local.get('bm_popup_layout'),'bm_popup_layout')),false);
    const initial=await page.locator('#chatgpt-summarize-popup').boundingBox();
    assert.equal(initial.width,910);assert.equal(initial.height,780);
    assert.equal(await frame.locator('html').evaluate(el=>getComputedStyle(el).fontSize),'18px');
    await frame.locator('#text-size-btn').click();await frame.locator('#text-size-slider').press('End');
    assert.equal(await frame.locator('#gpt-answer').evaluate(el=>getComputedStyle(el).fontSize),'36px');
    assert.ok(await frame.locator('.popup-container').evaluate(el=>getComputedStyle(el).backgroundImage.includes('gradient')));
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:900});
      await page.locator('#chatgpt-summarize-popup').evaluate(el=>el._clampDrag?.());
      assert.ok(await frame.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Classic large type must not overflow');
    }
    await page.setViewportSize({width:1280,height:900});
    await frame.locator('#text-size-slider').fill('120');
    await frame.locator('#text-size-slider').dispatchEvent('input');
    await frame.locator('#text-size-btn').click();
    const content=await frame.locator('#gpt-answer').innerText();
    const settings=await context.newPage();settings.on('pageerror',e=>errors.push(e.message));
    await settings.goto(`chrome-extension://${new URL(worker.url()).host}/options/index.html`);
    const radio=settings.getByRole('radio',{name:'City Console',exact:false});
    await radio.check();
    await settings.waitForFunction(()=>!document.getElementById('popup-design-choices').disabled);
    assert.equal(await radio.evaluate(el=>el===document.activeElement),true,'Design selection keeps keyboard focus');
    await frame.locator('html[data-bm-layout="city-console"]').waitFor();
    await page.bringToFront();
    assert.equal(await frame.locator('.city-control-dock .header-actions').count(),1);
    assert.equal(await frame.locator('#gpt-answer').innerText(),content);
    assert.equal(await worker.evaluate(()=>summaryCount),1,'changing design must not request another summary');
    await page.locator('#chatgpt-summarize-popup').screenshot({path:path.join(root,'artifacts/smryx-city-console-light.png'),animations:'disabled'});
    await frame.locator('#theme-toggle-btn').click();
    await frame.locator('html[data-bm-layout="city-console"][data-bm-theme="dark"]').waitFor();
    assert.equal(await frame.locator('.bm-app').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 39, 34)');
    await page.locator('#chatgpt-summarize-popup').screenshot({path:path.join(root,'artifacts/smryx-city-console-dark.png'),animations:'disabled'});
    await frame.locator('#text-size-btn').click();
    await frame.locator('#text-size-slider').press('End');
    await frame.locator('#text-size-slider').evaluate(el=>{if(el.value!=='240')throw Error('Expected 240%, got '+el.value);});
    assert.equal(await frame.locator('#text-size-value').innerText(),'240');
    assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('bm_font_scale')).bm_font_scale),240);
    await frame.locator('#text-size-btn').click();
    for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024]]){
      await page.setViewportSize({width,height});
      await page.locator('#chatgpt-summarize-popup').evaluate(el=>{el.style.width='calc(100vw - 24px)';el.style.height='calc(100vh - 24px)';});
      const child=page.frames().find(item=>item.url().includes('/popup/index.html'));
      await child.waitForFunction(size=>innerWidth===size[0]-24&&innerHeight===size[1]-24,[width,height]);
      const box=await frame.locator('.popup-container').evaluate(el=>({width:el.scrollWidth,available:innerWidth,height:el.scrollHeight,h:innerHeight}));
      assert.ok(box.width<=box.available+1&&box.height<=box.h+1,JSON.stringify({width,height,...box}));
      const viewport=await frame.locator('html').evaluate(()=>({w:innerWidth,h:innerHeight}));
      for(const control of ['#theme-toggle-btn','#text-size-btn','#settings-btn','#close-btn']){
        const rect=await frame.locator(control).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});
        assert.ok(rect.w>=43.9&&rect.h>=43.9&&rect.x>=0&&rect.x+rect.w<=viewport.w+1&&rect.y+rect.h<=viewport.h+1,JSON.stringify({control,width,height,rect,viewport}));
      }
      const tabs=await frame.locator('[role="tab"]').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,right:r.right};}));
      assert.ok(tabs.every(tab=>tab.x>=0&&tab.right<=viewport.w+1),JSON.stringify({width,tabs,viewport}));
      if(width<=390){const heading=await frame.locator('#gpt-answer>h1').boundingBox();assert.ok(heading.width>160&&heading.height<360,'Title must not collapse into single-letter columns');}
      await frame.locator('#text-size-btn').click();
      const pop=await frame.locator('#text-size-popover').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
      assert.ok(pop.x>=0&&pop.y>=0&&pop.right<=viewport.w+1&&pop.bottom<=viewport.h+1,JSON.stringify({width,height,pop,viewport}));
      await frame.locator('#text-size-btn').click();
      await page.locator('#chatgpt-summarize-popup').screenshot({path:path.join(root,`artifacts/smryx-city-console-${width}.png`),animations:'disabled'});
    }
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#chatgpt-summarize-popup').evaluate(el=>{el.style.width='700px';el.style.height='650px';});
    await page.bringToFront();
    await frame.getByRole('tab',{name:/Ask question/i}).click();
    await frame.getByRole('textbox').fill('What makes the city easier to use?');
    await frame.getByRole('textbox').press('Enter');
    await frame.getByText('The source highlights public space, reliable transport, and readable street layouts.',{exact:false}).waitFor();
    await frame.getByRole('tab',{name:'Summarize',exact:true}).click();
    await frame.locator('#gpt-answer').getByText('Good cities make room for people.',{exact:false}).waitFor();
    assert.equal(await frame.locator('#gpt-answer').innerText(),content);
    assert.equal(await frame.locator('#gpt-answer a[href="https://example.test/guide"]').count(),1);
    await radio.check();
    await settings.reload();assert.equal(await settings.getByRole('radio',{name:'City Console',exact:false}).isChecked(),true);
    // Custom palettes remain independent of the layout preference.
    await settings.locator('.ts-card').nth(1).locator('[data-action="apply"]').click();
    await frame.locator('html[data-bm-palette][data-bm-layout="city-console"]').waitFor();
    assert.equal(await frame.locator('.bm-app').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 246, 251)');
    await frame.locator('#theme-toggle-btn').click();
    await frame.locator('html[data-bm-layout="city-console"]:not([data-bm-palette])').waitFor();
    await settings.getByRole('radio',{name:/Classic · default/}).check();
    await frame.locator('html[data-bm-layout="classic"]').waitFor();
    assert.equal(await frame.locator('.popup-header .header-actions').count(),1);
    assert.equal(await frame.locator('.city-control-dock').count(),0);
    assert.equal(await frame.locator('#gpt-answer').innerText(),content);
    await settings.getByRole('radio',{name:'City Console',exact:false}).check();
    await frame.locator('html[data-bm-layout="city-console"]').waitFor();
    await frame.locator('#settings-btn').click();
    await frame.locator('#close-btn').click();
    await page.locator('#chatgpt-summarize-popup').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    console.log('PASS: Classic remains default; live design switching preserves results, mode/palettes, questions, text size, links, Settings and Close.');
    console.log('PASS: City Console light/dark screenshots, 320px portrait through tablet/landscape, 240% type, 44px controls, and upward text-size popover.');
  }finally{
    server.closeAllConnections();server.close();
    if(context){const s=await context.browser().newBrowserCDPSession();const {processInfo}=await s.send('SystemInfo.getProcessInfo');const pid=processInfo.find(p=>p.type==='browser')?.id;await s.detach();const timer=setTimeout(()=>{try{if(pid)process.kill(pid);}catch{}},5000);await context.close();clearTimeout(timer);}
  }
})().catch(e=>{console.error(e);process.exitCode=1});

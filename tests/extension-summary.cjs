const { chromium } = require('playwright');
const { createServer } = require('node:http');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const article = '<!doctype html><html lang="en"><head><title>Local summary verification</title></head><body><main><article><h1>Local summary verification</h1>' + '<p>The test system uses a blue sensor to measure water temperature. Install the sensor, connect its cable, and record the temperature every minute. The measured result is twenty degrees Celsius.</p>'.repeat(20) + '</article></main></body></html>';
  const server = createServer((req, res) => {res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.url === "/reading-demo" ? article.replaceAll("Local summary verification", "The ocean’s hidden climate work").replaceAll("The test system uses a blue sensor to measure water temperature. Install the sensor, connect its cable, and record the temperature every minute. The measured result is twenty degrees Celsius.", "The ocean stores and moves heat, helping regulate Earth’s climate. Scientists combine satellites, research vessels, and autonomous floats to understand long-term changes in temperature and sea level.") : req.url === "/long-article" ? article.replace("</article>", "<p>" + "Full source coverage. ".repeat(1600) + "TAIL_EVIDENCE_927: the final section reverses the opening conclusion.</p></article>") : article);});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
      viewport: {width: 1280, height: 900}
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    context.setDefaultTimeout(15000);
    await worker.evaluate(async () => {
      await chrome.storage.local.set({bm_analytics_enabled:false});
      await chrome.storage.local.set({provider: 'api', model: 'gpt-5-3-mini', bmAutoChatGPTModel:'gpt-5-3-mini', apiKey: 'test-key-not-a-real-credential', selectedLanguage:'en', question: 'Return a TL;DR and five key points.', showSummarizeButton: false, showYoutubeButton: false});
      globalThis.summaryRequests = [];
      globalThis.answerRequests = [];
      globalThis.failNextAnswer = false;
      globalThis.failNextSummary = true;
      globalThis.failAllSummaries = false;
      globalThis.requirementsDeviceId = null;
      globalThis.chatGPTRequests = [];
      globalThis.analyticsRequests = [];
      globalThis.availableWebModels = [{slug:'gpt-5-3-mini',title:'Listed but unavailable',max_tokens:8192}];
      globalThis.rejectAllSummaryModels = false;
      globalThis.rejectNextAnswerModel = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, options) => {
        const url = String(input);
        if (url === 'https://analytics.test/events') {
          analyticsRequests.push(JSON.parse(options.body));
          return new Response(null, {status:204});
        }
        if(url.startsWith('https://chatgpt.com/'))chatGPTRequests.push({url,credentials:options?.credentials,deviceId:options?.headers?.['Oai-Device-Id']});
        if (url.endsWith('/backend-api/models')) return Response.json({models:availableWebModels});
        if (url.endsWith('/api/auth/session')) return Response.json({accessToken: 'browser-test-token'});
        if (url.includes('/accounts/check/')) return Response.json({accounts: {default: {features: []}}});
        if (url.endsWith('/sentinel/chat-requirements')) {requirementsDeviceId=options.headers['Oai-Device-Id'];return Response.json({token:'browser-test-requirements'});}
        if (url.includes('/backend-api/conversation/') && options?.method === 'PATCH') return Response.json({success: true});
        if (url.endsWith('/chat/completions') || url.endsWith('/backend-api/conversation')) {
          const body = JSON.parse(options.body);
          const prompt = body.messages?.find(message => message.role === 'user')?.content || body.messages?.[0]?.content?.parts?.[0] || '';
          const isAnswer = prompt.includes('User question:');
          (isAnswer ? answerRequests : summaryRequests).push({url, ...body});
          if(options.headers['Oai-Device-Id']!==requirementsDeviceId)throw new Error('Device identity changed between requirements and conversation');
          // Reproduce the reported server contract: a catalog-listed model can
          // still reject inference. Only the default router succeeds here.
          if(body.model!=='auto')return Response.json({error:{message:'Model not found',code:'model_unavailable'}},{status:404});
          if(!isAnswer&&(failNextSummary||failAllSummaries)){
            failNextSummary=false;
            const error={error:{message:'Hmm...something seems to have gone wrong.&#x20;',code:'temporary_failure'}};
            return new Response(`data: ${JSON.stringify(error)}\n\n`,{headers:{'Content-Type':'text/event-stream','x-request-id':'browser-test-request'}});
          }
          if(isAnswer&&rejectNextAnswerModel){
            rejectNextAnswerModel=false;
            return Response.json({error:{message:'Model not found: '+body.model,code:'model_not_found'}},{status:404});
          }
          if (!isAnswer && rejectAllSummaryModels) {
            return Response.json({error:{message:'Model not found: '+body.model,code:'model_not_found'}}, {status:404,headers:{'x-request-id':'model-rejection-request'}});
          }
          await new Promise(resolve => setTimeout(resolve, isAnswer ? 250 : 1800));
          if (isAnswer && failNextAnswer) {failNextAnswer = false; return Response.json({error: {message: 'Controlled provider failure'}}, {status: 400});}
          const content = isAnswer ? 'The blue sensor records water temperature. The result is twenty degrees Celsius.' : globalThis.productCapture ? '1. **TL;DR Summary**\n\nThe ocean stores and moves heat, helping regulate Earth’s climate. It absorbs energy that would otherwise warm the atmosphere, but this comes with rising ocean temperatures and stress on marine ecosystems.\n\nLong-term observations reveal changes that a single surface measurement can miss. Combining satellite readings, research vessels, and autonomous floats gives scientists a clearer picture of the planet’s energy balance.\n\n2. **Key insights**\n\n- Ocean heat is a useful measure of long-term climate change.\n- Warmer water expands, contributing to rising sea levels.\n- Different observing tools reveal different parts of the picture.' :
            'Verified summary: <icon name="clapperboard" color="secondary" inline />\n\n<text color="secondary" weight="medium" size="xs">Unverified — Vehicle search page</text>\n\n1. **TL;DR Summary (3–15 sentences)**\n\nThe test system uses a **blue sensor** to measure water temperature. Install the sensor and connect its cable. Record the temperature every minute. The measured result is twenty degrees Celsius.\n\n2. **Bullet Summary**\n\n- Preserve [sensor documentation](https://example.com/sensor) and `sensor.read()`.';
          const payload = url.endsWith('/backend-api/conversation')
            ? {message: {id: 'browser-smoke', author: {role: 'assistant'}, content: {parts: [content]}}, conversation_id: 'browser-smoke'}
            : {id: 'browser-smoke', choices: [{delta: {content}, finish_reason: null}]};
          return new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`, {headers: {'Content-Type': 'text/event-stream'}});
        }
        if (url === 'https://api.openai.com/v1/models') return Response.json({data: [{id: 'gpt-4o'}]});
        if (/google-analytics/.test(url)) return new Response('{}', {headers: {'Content-Type': 'application/json'}});
        if (url.startsWith('https:')) return Response.json({});
        return originalFetch(input, options);
      };
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.popupEntranceAnimations = [];
      const observer = new MutationObserver(() => {
        const popup = document.getElementById('chatgpt-summarize-popup');
        if (!popup) return;
        observer.disconnect();
        popup.addEventListener('load', () => {
          requestAnimationFrame(() => {
            popupEntranceAnimations = popup.getAnimations().map(animation => ({keyframes: animation.effect.getKeyframes()}));
          });
        });
      });
      observer.observe(document, {childList: true, subtree: true});
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE', message.text().slice(0, 500)); });
    const url = `http://127.0.0.1:${server.address().port}/article`;
    if (process.env.SMRYX_FULLTEXT_ONLY) {await verifyFullText();return;}
    await page.goto(url);
    await page.bringToFront();
    await worker.evaluate(async url => {
      const [tab] = await chrome.tabs.query({url});
      await chrome.tabs.sendMessage(tab.id, {type: 'OPEN_POPUP', to: 'content-script'});
    }, url);
    const frame = page.frameLocator('#chatgpt-summarize-popup');
    await frame.locator('.bm-progress-track').first().waitFor();
    assert.notEqual(await frame.locator('.bm-progress-fill').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    try {
      await frame.locator('#gpt-answer').getByText('Verified summary:', {exact: false}).waitFor({timeout: 20000});
    } catch (error) {
      console.log('PAGE ERRORS', errors);
      for (const f of page.frames()) console.log('FRAME', f.url(), (await f.locator('body').innerText().catch(() => '')).slice(0, 2500));
      console.log('REQUEST COUNT', await worker.evaluate(() => summaryRequests.length));
      console.log('SETTINGS', await worker.evaluate(() => chrome.storage.local.get(['provider', 'model'])));
      const popupFrame = page.frames().find(f => f.url().includes('/popup/index.html'));
      if (popupFrame) console.log('POPUP STATE', await popupFrame.evaluate(async () => ({ visibility: document.visibilityState, mode: document.documentElement.dataset.bmTheme, headerError: document.querySelector('#bm-header-status')?.textContent, storage: await Promise.race([chrome.storage.local.get(['provider', 'model']), new Promise(r => setTimeout(() => r('timeout'), 2000))]), width: innerWidth, app: document.querySelector('#app').getBoundingClientRect().width })));
      throw error;
    }
    assert.equal(await frame.locator('.popup-header').count(), 1);
    assert.equal(await frame.locator('#batch-tab-btn').count(), 0);
    assert.deepEqual(await frame.locator('.header-actions button').evaluateAll(buttons=>buttons.map(button=>button.id)), ['theme-toggle-btn','text-size-btn','settings-btn','close-btn']);
    const logoAlignment=await frame.locator('.header-wordmark').evaluate(el=>{
      const logo=el.querySelector('.logo').getBoundingClientRect();
      const emoji=el.querySelector('.logo-emoji').getBoundingClientRect();
      const title=el.querySelector('.header-title').getBoundingClientRect();
      return {horizontal:Math.abs(logo.x+logo.width/2-emoji.x-emoji.width/2),vertical:Math.abs(logo.y+logo.height/2-emoji.y-emoji.height/2),title:Math.abs(logo.y+logo.height/2-title.y-title.height/2)};
    });
    assert.ok(Object.values(logoAlignment).every(offset=>offset<1),JSON.stringify(logoAlignment));
    assert.equal(await frame.locator('nav').count(), 1);
    await frame.locator('.bm-progress').waitFor({state:'detached'});
    assert.equal(await frame.locator('.bm-tldr-paragraph').count(), 2);
    assert.equal(await frame.locator('.popup-container').evaluate(el => getComputedStyle(el).animationName), 'bm-popup-enter');
    assert.equal(await frame.locator('#settings-btn').evaluate(el => getComputedStyle(el).animationName), 'bm-element-enter');
    const entrances = await page.evaluate(() => popupEntranceAnimations);
    assert.equal(entrances.length, 1);
    assert.equal(Number(entrances[0].keyframes[0].opacity), 0);
    assert.equal(entrances[0].keyframes[1].scale, '1');
    for (const paragraph of await frame.locator('.bm-tldr-paragraph').all()) {
      assert.ok(await paragraph.evaluate(el => {const css=getComputedStyle(el); return parseFloat(css.textIndent) === 2 * parseFloat(css.fontSize);}));
    }
    assert.ok(!(await frame.locator('#gpt-answer').innerText()).includes('<icon'));
    assert.ok(!(await frame.locator('#gpt-answer').innerText()).includes('<text'));
    await frame.locator('#gpt-answer').getByText('Unverified — Vehicle search page', {exact:true}).waitFor();
    assert.ok((await frame.locator('#gpt-answer').innerText()).includes('🎬'));
    assert.equal(await frame.locator('.bm-tldr-paragraph strong').innerText(), 'blue sensor');
    assert.equal(await frame.locator('#gpt-answer a[href="https://example.com/sensor"]').count(), 1);
    assert.equal(await frame.locator('#gpt-answer code').innerText(), 'sensor.read()');
    const popup = page.locator('#chatgpt-summarize-popup');
    const outerGaps = await popup.evaluate(el => {
      const rect=el.getBoundingClientRect();
      return {top:rect.top,right:document.documentElement.clientWidth-rect.right};
    });
    assert.equal(outerGaps.top,12);
    assert.equal(outerGaps.right,12);
    const animatedGaps = await worker.evaluate(async url => {
      const [tab]=await chrome.tabs.query({url});
      // Content-script DOM properties belong to its isolated execution world.
      const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
        const el=document.getElementById('chatgpt-summarize-popup');
        const animation=el.animate([{scale:'.8'},{scale:'.8'}],{duration:1000});
        el._resetDrag();
        animation.cancel();
        const rect=el.getBoundingClientRect();
        return {top:rect.top,right:document.documentElement.clientWidth-rect.right};
      }});
      return result;
    },url);
    assert.deepEqual(animatedGaps,{top:12,right:12});

    const paragraph=frame.locator('.bm-tldr-paragraph').first();
    const originalFontSize=await paragraph.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    const verifyTextSize=async percent=>{
      await frame.locator('#text-size-value').getByText(String(percent),{exact:true}).waitFor();
      const measured=await paragraph.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      assert.ok(Math.abs(measured-originalFontSize*percent/100)<.03,`Text at ${percent}%: ${measured}px, base ${originalFontSize}px`);
    };
    await frame.locator('#text-size-btn').click();
    const slider=frame.locator('#text-size-slider');
    await slider.press('Home');
    await verifyTextSize(85);
    const sliderBox=await slider.boundingBox();
    await slider.click({position:{x:sliderBox.width*.7,y:sliderBox.height/2}});
    const clickedScale=Number(await slider.inputValue());
    assert.ok(clickedScale>100&&clickedScale<130);
    await verifyTextSize(clickedScale);
    await slider.press('End');
    await frame.locator('#text-size-value').getByText('130', {exact:true}).waitFor();
    await verifyTextSize(130);
    assert.equal(await frame.locator('html').evaluate(el => el.style.getPropertyValue('--font-scale')), '1.3');
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('bm_font_scale'))).bm_font_scale,130);
    await frame.locator('.popup-header').screenshot({path:path.join(os.tmpdir(),'beast-mode-popup-header-light.png'),animations:'disabled'});
    await frame.locator('#text-size-btn').click();
    await frame.locator('#text-size-popover').waitFor({state:'hidden'});
    console.log('PASS: removed batch header button, theme precedes text size, robot is centered with the wordmark, and pointer/keyboard slider changes resize actual summary text and persist the preference.');
    const requests = await worker.evaluate(() => summaryRequests);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(request=>request.model==='auto'));
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('bmAutoChatGPTModel'))).bmAutoChatGPTModel,null);
    assert.ok(requests[0].url.includes('chatgpt.com/backend-api/conversation'));
    assert.ok(requests[0].messages[0].content.parts[0].includes('blue sensor'));
    assert.ok(requests[0].messages[0].content.parts[0].includes('entire summary in English'));
    const language = frame.getByRole('button', {name: 'Summary language', exact: true});
    await language.getByText('English', {exact: true}).waitFor();
    await language.click();
    await frame.getByRole('option', {name: new Intl.DisplayNames(['en'], {type: 'language'}).of('es-419'), exact: true}).waitFor();
    await frame.getByRole('option', {name: 'Spanish', exact: true}).click();
    await language.getByText('Spanish', {exact: true}).waitFor();
    await frame.locator('.bm-progress').waitFor({state: 'detached'});
    assert.equal(await worker.evaluate(() => summaryRequests.length), 3);
    const translated = await worker.evaluate(() => summaryRequests[2]);
    assert.ok(translated.messages[0].content.parts[0].includes('entire summary in Spanish') && translated.messages[0].content.parts[0].includes('blue sensor'));
    await frame.locator('.bm-progress').waitFor({state: 'detached'});
    const geometry = await frame.locator('#app').evaluate(el => ({width: el.getBoundingClientRect().width, viewport: innerWidth}));
    assert.equal(geometry.width, geometry.viewport);
    assert.deepEqual(errors, []);
    await worker.evaluate(async () => {
      const vars = {bgPrimary:'#fff6fb',bgSecondary:'#fdeef7',bgTertiary:'#f7e0f0',textPrimary:'#3a1f33',textSecondary:'#7a4d6e',textMuted:'#a781a0',accentPrimary:'#ff6fae',accentHover:'#ff4f97',accentLight:'#ffe0ef',borderColor:'#f3d4ea'};
      await chrome.storage.local.set({bm_theme:'light',bm_active_theme_id:'season-spring-bloom-bestie',bm_active_theme_vars:vars});
    });
    await frame.locator('html[data-bm-palette]').waitFor();
    await frame.locator('#theme-toggle-btn').click();
    await frame.locator('html[data-bm-theme="dark"]:not([data-bm-palette])').waitFor();
    assert.equal(await frame.locator('.bm-app').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(28, 29, 32)');
    await frame.locator('.popup-header').screenshot({path:path.join(os.tmpdir(),'beast-mode-popup-header-dark.png'),animations:'disabled'});
    await frame.locator('#theme-toggle-btn').click();
    await frame.locator('html[data-bm-theme="light"]').waitFor();
    assert.equal(await frame.locator('.bm-app').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    for (const [width,height] of [[1000,800],[500,500]]) {
      await page.locator('#chatgpt-summarize-popup').evaluate((el,size) => {el.style.width = size[0]+'px'; el.style.height = size[1]+'px';}, [width,height]);
      const measured = await frame.locator('#gpt-answer').evaluate(el => ({width:el.getBoundingClientRect().width,available:innerWidth}));
      assert.ok(measured.width >= measured.available - 40, JSON.stringify(measured));
      await page.waitForFunction(() => {
        const rect=document.getElementById('chatgpt-summarize-popup').getBoundingClientRect();
        return rect.top>=12&&document.documentElement.clientWidth-rect.right>=12;
      });
    }
    await page.setViewportSize({width:900,height:700});
    await page.waitForFunction(() => {
      const rect=document.getElementById('chatgpt-summarize-popup').getBoundingClientRect();
      return rect.top>=12&&document.documentElement.clientWidth-rect.right>=12&&document.documentElement.clientHeight-rect.bottom>=12;
    });
    await page.setViewportSize({width:1280,height:900});
    console.log('PASS: UI text wrappers retain their labels; top/right gaps are 12px on opening and after an animated reset, with viewport and popup resizing kept inside the buffer.');
    await page.screenshot({path: path.join(os.tmpdir(), 'beast-mode-extension-summary.png')});
    // Use the real popup port and background handlers with controlled provider HTTP.
    await frame.getByRole('tab', {name: /Ask question/i}).click();
    const questionInput = frame.getByPlaceholder('Type your message here...');
    for (const [provider, model] of [['api','gpt-4o'], ['deepseek-api','deepseek-chat'], ['web','gpt-4o']]) {
      await worker.evaluate(async settings => {await chrome.storage.local.set({...settings, bmAutoChatGPTModel:'gpt-5-3-mini', selectedLanguage:'en'});}, {provider, model});
      await questionInput.fill(`What does the sensor do? (${provider})`);
      await questionInput.press('Enter');
      await questionInput.waitFor({state:'visible'});
      await page.waitForFunction(() => !document.querySelector('#chatgpt-summarize-popup')?.hidden);
      await frame.locator('input[type="text"]:not([disabled])').waitFor();
      const replies = frame.getByText('The blue sensor records water temperature. The result is twenty degrees Celsius.', {exact:true});
      const replyIndex = ['api', 'deepseek-api', 'web'].indexOf(provider);
      try {await replies.nth(replyIndex).waitFor();}
      catch (error) {console.log('CHAT DIAGNOSTICS', provider, await frame.locator('body').innerText(), await worker.evaluate(() => answerRequests)); throw error;}
      assert.equal(await replies.count(), replyIndex + 1);
    }
    const answers = await worker.evaluate(() => answerRequests);
    assert.equal(answers.length, 3);
    assert.ok(answers.every(answer=>answer.model==='auto'));
    assert.ok(answers.every(answer => answer.url.includes('chatgpt.com/backend-api/conversation')));
    assert.ok(answers[2].messages[0].content.parts[0].includes('Previous conversation (JSON)'));
    assert.ok(answers[2].messages[0].content.parts[0].includes('blue sensor'));
    assert.ok(!(await frame.locator('body').innerText()).includes('only working with OpenAI'));
    // Provider errors must release the input so another question can be submitted.
    await worker.evaluate(async () => {failNextAnswer = true; await chrome.storage.local.set({provider:'api',model:'gpt-4o'});});
    await questionInput.fill('Trigger a provider error');
    await questionInput.press('Enter');
    await frame.getByText('Controlled provider failure', {exact:true}).waitFor();
    await frame.locator('input[type="text"]:not([disabled])').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: two indented TL;DR paragraphs, safe icon normalization, preserved Markdown, and summaries and Ask question use only ChatGPT despite legacy API/DeepSeek settings; history and errors verified.');
    for (const cachedModel of ['gpt-5-3-mini', 'gpt-4o']) {
      const before = await worker.evaluate(async cachedModel => {
        availableWebModels = cachedModel==='gpt-5-3-mini' ? [{slug:cachedModel,max_tokens:8192}] : [];
        await chrome.storage.local.set({provider:'web',model:cachedModel,bmAutoChatGPTModel:cachedModel,selectedLanguage:'en'});
        await chrome.storage.session.clear();
        return summaryRequests.length;
      }, cachedModel);
      const popupDocument = page.frames().find(candidate => candidate.url().includes('/popup/index.html'));
      await popupDocument.goto(popupDocument.url());
      await frame.locator('#gpt-answer').getByText('Verified summary:', {exact:false}).waitFor();
      await frame.locator('.bm-progress').waitFor({state:'detached'});
      assert.equal(await frame.locator('#text-size-slider').inputValue(),'130');
      assert.ok(Math.abs(await frame.locator('.bm-tldr-paragraph').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))-originalFontSize*1.3)<.03);
      const recovered = await worker.evaluate(() => ({requests:summaryRequests}));
      const settings = await worker.evaluate(() => chrome.storage.local.get(['model','bmAutoChatGPTModel']));
      assert.equal(settings.model, null);
      assert.equal(settings.bmAutoChatGPTModel, null);
      assert.equal(recovered.requests.at(-1).model, 'auto');
      assert.equal(recovered.requests.length - before, 1);
      assert.ok(!(await frame.locator('body').innerText()).includes('Please select a supported model'));
      assert.equal(await frame.locator('.bm-tldr-paragraph').count(), 2);
    }
    assert.ok(!(await worker.evaluate(()=>chatGPTRequests)).some(request=>request.url.endsWith('/backend-api/models')));
    console.log('PASS: the reported gpt-5-3-mini cache is cleared; summaries and questions send auto, with no model-catalog dependency or named-model retries.');
    const failureStart = await worker.evaluate(async () => {failAllSummaries=true;await chrome.storage.session.clear();return summaryRequests.length;});
    const failureDocument = page.frames().find(candidate => candidate.url().includes('/popup/index.html'));
    await failureDocument.goto(failureDocument.url());
    const statusLink = frame.getByRole('link',{name:'OpenAI status',exact:true});
    await statusLink.waitFor();
    assert.equal(await statusLink.getAttribute('href'),'https://status.openai.com/');
    await frame.getByText('Connection details',{exact:true}).waitFor();
    const diagnostics=JSON.parse(await frame.locator('details[open] pre').innerText());
    assert.equal(diagnostics.stage,'Receiving the response');
    assert.equal(diagnostics.httpStatus,200);
    assert.equal(diagnostics.code,'temporary_failure');
    assert.equal(diagnostics.requestId,'browser-test-request');
    assert.ok(!JSON.stringify(diagnostics).includes('blue sensor'));
    assert.ok(!JSON.stringify(diagnostics).includes('browser-test-token'));

    assert.ok((await frame.locator('body').innerText()).includes('Hmm...something seems to have gone wrong.'));
    assert.ok(!(await frame.locator('body').innerText()).includes('&#x20;'));
    assert.equal(await worker.evaluate(() => summaryRequests.length)-failureStart,2);
    await worker.evaluate(() => {failAllSummaries=false;});
    await frame.getByRole('button',{name:'Retry',exact:true}).click();
    await frame.locator('#gpt-answer').getByText('Verified summary:',{exact:false}).waitFor();
    await frame.locator('.bm-progress').waitFor({state:'detached'});
    const transport = await worker.evaluate(() => chatGPTRequests);
    assert.ok(transport.every(request=>request.credentials==='include'));
    const deviceIds=transport.filter(request=>request.deviceId).map(request=>request.deviceId);
    assert.ok(deviceIds.length>5);
    assert.equal(new Set(deviceIds).size,1);
    console.log('PASS: reported generic ChatGPT error retries once, persistent failure stops cleanly, official status link is correct, HTML entities are decoded, and all requests retain cookies and one device ID.');
    const modelFailureStart=await worker.evaluate(async()=>{
      failAllSummaries=false;
      rejectAllSummaryModels=true;
      availableWebModels=[{slug:'account-model-one',max_tokens:8192},{slug:'account-model-two',max_tokens:8192}];
      await chrome.storage.local.set({bmAutoChatGPTModel:'account-model-one'});
      await chrome.storage.session.clear();
      return summaryRequests.length;
    });
    const modelFailureDocument=page.frames().find(candidate=>candidate.url().includes('/popup/index.html'));
    await modelFailureDocument.goto(modelFailureDocument.url());
    await frame.getByText('Model not found: auto',{exact:false}).first().waitFor();
    const rejectionDetails=JSON.parse(await frame.locator('details[open] pre').innerText());
    assert.equal(rejectionDetails.httpStatus,404);
    assert.equal(rejectionDetails.code,'model_not_found');
    assert.equal(rejectionDetails.requestId,'model-rejection-request');
    assert.equal(rejectionDetails.automaticModel,'auto');
    assert.equal(rejectionDetails.extensionVersion,'1.9.9');
    assert.equal(await worker.evaluate(()=>summaryRequests.length)-modelFailureStart,1);
    assert.ok(!(await frame.locator('body').innerText()).includes('could not start a response after retrying'));
    await worker.evaluate(()=>{rejectAllSummaryModels=false;});
    await frame.getByRole('button',{name:'Retry',exact:true}).click();
    await frame.locator('#gpt-answer').getByText('Verified summary:',{exact:false}).waitFor();
    await frame.locator('.bm-progress').waitFor({state:'detached'});
    await frame.getByRole('tab',{name:/Ask question/i}).click();
    await worker.evaluate(()=>{rejectNextAnswerModel=true;});
    await frame.getByPlaceholder('Type your message here...').fill('Test a rejected question');
    await frame.getByPlaceholder('Type your message here...').press('Enter');
    await frame.getByText('Model not found: auto',{exact:true}).waitFor();
    await frame.locator('input[type="text"]:not([disabled])').waitFor();
    console.log('PASS: a rejected default request preserves its actual error without switching models; manual Retry and rejected Ask question requests recover their controls.');
    const [settingsPage] = await Promise.all([context.waitForEvent('page'), frame.locator('#settings-btn').click()]);
    await settingsPage.getByRole('heading', {name:'ChatGPT connection',exact:true}).waitFor();
    await settingsPage.getByText('Signed in to ChatGPT', {exact:true}).waitFor();
    const analyticsToggle = settingsPage.locator('#analytics-enabled');
    await analyticsToggle.waitFor();
    assert.equal(await analyticsToggle.isChecked(), false);
    await settingsPage.getByText('Usage analytics is off.', {exact:true}).waitFor();
    assert.equal(await worker.evaluate(() => analyticsRequests.length), 0);
    // Connect only this temporary worker to a mocked relay, never to live GA.
    await worker.evaluate(() => {globalThis.bmAnalyticsConfig = {measurementId:'G-WV65497MC0', endpoint:'https://analytics.test/events'};});
    await analyticsToggle.check();
    await settingsPage.waitForFunction(async () => (await chrome.storage.local.get('bm_analytics_enabled')).bm_analytics_enabled === true);
    const delivered = await settingsPage.evaluate(() => chrome.runtime.sendMessage({type:'BM_ANALYTICS_EVENT',to:'background',name:'batch_started',params:{count:3,url:'private-url',text:'private-text',question:'private-question'}}));
    assert.equal(delivered, true);
    const event = await worker.evaluate(() => analyticsRequests.at(-1));
    assert.equal(event.name, 'batch_started'); assert.equal(event.params.count, 3);
    assert.ok(!JSON.stringify(event).includes('private-'));
    await analyticsToggle.uncheck();
    await settingsPage.waitForFunction(async () => !(await chrome.storage.local.get('bm_analytics_client_id')).bm_analytics_client_id);
    assert.equal(await settingsPage.evaluate(() => chrome.runtime.sendMessage({type:'BM_ANALYTICS_EVENT',to:'background',name:'settings_opened'})), false);
    console.log('PASS: a saved analytics opt-out is respected; real Settings opt-in reaches only a mocked relay with content stripped, and opt-out clears its independent ID and stops sends.');
    assert.equal(await settingsPage.locator('select[name="provider"], select[name="model"], input[name="apiKey"]').count(), 0);
    assert.equal(await settingsPage.getByRole('link', {name:'Open ChatGPT',exact:true}).getAttribute('href'), 'https://chatgpt.com/');
    assert.ok(!(await settingsPage.locator('body').innerText()).includes('Select model'));
    assert.ok(!(await settingsPage.locator('body').innerText()).includes('DeepSeek'));
    const welcomePage = await context.newPage();
    await welcomePage.goto(settingsPage.url().replace('/options/index.html','/welcome/index.html'));
    await welcomePage.locator('main').waitFor();
    const skip = welcomePage.getByRole('button', {name:/Skip/});
    if (await skip.count()) await skip.click();
    await welcomePage.getByText('Use your signed-in ChatGPT session to summarize pages and ask questions. Continue to connect ChatGPT.', {exact:true}).waitFor();
    assert.equal(await welcomePage.locator('input[name="provider"], input[name="apiKey"], select[name="model"]').count(), 0);
    await welcomePage.getByRole('button', {name:/Next/}).click();
    await welcomePage.getByRole('link', {name:'Options', exact:true}).waitFor();
    await welcomePage.close();
    console.log('PASS: Settings and onboarding expose only the ChatGPT connection, with no provider, model, or API key controls.');
    await frame.locator('#close-btn').click();
    await page.locator('#chatgpt-summarize-popup').waitFor({state:'hidden'});
    console.log('PASS: single header, working Settings/Close, saved text-size setting, animated loading progress, and progress removal on completion.');
    console.log('PASS: header theme toggle changes real summary surfaces even after a custom palette; summary uses full width at two resized dimensions.');
    await verifyFullText();
    async function verifyFullText() {
    const longStart = await worker.evaluate(async () => {await chrome.storage.session.clear();return summaryRequests.length;});
    const longUrl = url.replace('/article', '/long-article');
    await page.goto(longUrl);
    await page.bringToFront();
    await worker.evaluate(async url => {
      const [tab] = await chrome.tabs.query({url});
      await chrome.tabs.sendMessage(tab.id, {type:'OPEN_POPUP',to:'content-script'});
    }, longUrl);
    await page.frameLocator('#chatgpt-summarize-popup').locator('#gpt-answer').getByText('Verified summary:', {exact:false}).waitFor({timeout:45000});
    const longRequests = await worker.evaluate(start => summaryRequests.slice(start).map(r => r.messages[0].content.parts[0]), longStart);
    assert.ok(longRequests.length >= 4, 'long articles require every section plus synthesis');
    assert.ok(longRequests.slice(0,-1).some(prompt => prompt.includes('TAIL_EVIDENCE_927')), 'final source section reaches the engine');
    assert.ok(longRequests.at(-1).includes('notes cover every source section'), 'popup renders a final synthesis');
    if (process.env.SMRYX_CAPTURE_ASSETS) {
      await worker.evaluate(async () => {globalThis.productCapture=true;await chrome.storage.session.clear();});
      const demoUrl = url.replace('/article','/reading-demo');
      await page.goto(demoUrl);
      await page.bringToFront();
      await worker.evaluate(async url => {const [tab]=await chrome.tabs.query({url});await chrome.tabs.sendMessage(tab.id,{type:'OPEN_POPUP',to:'content-script'});},demoUrl);
      await page.frameLocator('#chatgpt-summarize-popup').getByText('The ocean stores and moves heat,', {exact:false}).waitFor();
      await page.locator('#chatgpt-summarize-popup').screenshot({path:path.join(root,'welcome/assets/summary.png')});
    }
    console.log('PASS: full-text popup processes the final section of a long article and synthesizes one summary automatically.');
    }
    console.log('PASS: real unpacked extension extracts article text, sends the model request, renders the streamed summary, and fills the popup width. Provider response is controlled; no real API credentials used.');
  } finally {
    server.closeAllConnections();
    if (context) {
      const browser = context.browser();
      const session = await browser.newBrowserCDPSession();
      const {processInfo} = await session.send('SystemInfo.getProcessInfo');
      const browserProcess = processInfo.find(entry => entry.type === 'browser');
      await session.detach();
      // Windows can stall graceful browser shutdown after extension pages open.
      // Bound cleanup to this temporary browser's exact PID, obtained over CDP.
      const shutdown = setTimeout(() => {
        if (browserProcess) try {process.kill(browserProcess.id);} catch (error) {if (error.code !== 'ESRCH') console.error(error);}
      }, 5000);
      try {await browser.close();} finally {clearTimeout(shutdown);}
    }
    await new Promise(resolve => server.close(resolve));
    console.log("PASS: browser and local server closed.");
  }
})().catch(error => {console.error(error); process.exitCode = 1;});

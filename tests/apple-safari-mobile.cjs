const {chromium} = require("playwright");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const {createServer} = require("node:http");
const assert = require("node:assert/strict");
(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "beast-apple-test-"));
  const root = path.resolve(__dirname, "..");
  fs.cpSync(path.join(root,"AppleSafari/WebExtension"), fixture, {recursive:true});
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture,"manifest.json"),"utf8"));
  fs.writeFileSync(path.join(fixture,"test-background.js"), `importScripts(${manifest.background.scripts.map(file=>JSON.stringify(file)).join(",")});`);
  manifest.background = {service_worker:"test-background.js"};
  fs.writeFileSync(path.join(fixture,"manifest.json"),JSON.stringify(manifest));
  const server = createServer((req,res)=>{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Portrait field notes</title><main><h1>Portrait field notes</h1>'+"<p>The blue sensor measures water temperature every minute. Connect its cable and record the measurements.</p>".repeat(25)+"</main>");});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext("", {channel:"chromium",headless:true,args:[`--disable-extensions-except=${fixture}`,`--load-extension=${fixture}`],viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"});
    context.setDefaultTimeout(15000);
    const worker=context.serviceWorkers()[0]||await context.waitForEvent("serviceworker");
    await worker.evaluate(async()=>{
      await chrome.storage.local.set({bm_analytics_enabled:false,showSummarizeButton:false,showYoutubeButton:false,selectedLanguage:"en",bm_theme:"light"});
      globalThis.shareAttempts=0;globalThis.shareApproved=false;
      chrome.runtime.sendNativeMessage=async()=>{shareAttempts++;if(!shareApproved)return {ok:false};shareApproved=false;return {ok:true};};
      const original=fetch;
      globalThis.fetch=async(input,options)=>{
        const url=String(input);
        if(url.endsWith("/api/auth/session"))return Response.json({accessToken:"controlled-apple-test"});
        if(url.includes("/accounts/check/"))return Response.json({accounts:{default:{features:[]}}});
        if(url.endsWith("/sentinel/chat-requirements"))return Response.json({token:"controlled-test"});
        if(url.endsWith("/backend-api/conversation")){
          const text="The blue sensor measures water temperature every minute. Connect its cable before recording measurements.\n\nThe page describes a simple monitoring procedure. It does not provide independent evidence about accuracy.";
          return new Response(`data: ${JSON.stringify({message:{id:"apple-test",author:{role:"assistant"},content:{parts:[text]}},conversation_id:"apple-test"})}\n\ndata: [DONE]\n\n`,{headers:{"Content-Type":"text/event-stream"}});
        }
        if(url.startsWith("https:"))return Response.json({});
        return original(input,options);
      };
    });
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/article`);
    await page.addScriptTag({content:fs.readFileSync(path.join(root,"AppleSafari/Native/Share/SharePreprocessor.js"),"utf8")});
    const token="12345678-1234-1234-1234-123456789abc";
    const finalize=()=>page.evaluate(token=>ExtensionPreprocessingJS.finalize({command:"open-summary",url:location.href,token}),token);
    await finalize();
    for(let attempt=0;attempt<100;attempt++){
      if(await worker.evaluate(()=>shareAttempts===1))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(await worker.evaluate(()=>shareAttempts),1);
    assert.equal(await page.locator("#chatgpt-summarize-popup").count(),0);
    await worker.evaluate(()=>{shareApproved=true;});await finalize();
    const frame=page.frameLocator("#chatgpt-summarize-popup");
    await frame.locator("#gpt-answer").getByText("The blue sensor measures",{exact:false}).waitFor();
    await frame.locator(".bm-progress").waitFor({state:"detached"});
    console.log("PASS: Share finalization opens the current page's real summary panel only after mocked native approval; engine response is controlled.");
    for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390],[768,1024]]){
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>{const r=document.getElementById("chatgpt-summarize-popup").getBoundingClientRect();return r.width<=innerWidth-23&&r.height<=innerHeight-23;});
      const box=await page.locator("#chatgpt-summarize-popup").boundingBox();
      const placement=await page.locator("#chatgpt-summarize-popup").evaluate(el=>{const s=getComputedStyle(el);return {top:s.top,right:s.right,left:s.left,transform:s.transform,viewport:innerWidth}});
      assert.ok(box.x>=11&&box.y>=11&&box.x+box.width<=width-11&&box.y+box.height<=height-11,JSON.stringify({width,height,box,placement}));
      const metrics=await frame.locator("body").evaluate(body=>{
        const header=document.querySelector(".header-content"),h=header.getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>innerWidth,headerFits:h.right<=innerWidth&&h.left>=0,buttons:[...document.querySelectorAll(".header-actions button")].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,right:r.right,left:r.left}})};
      });
      assert.equal(metrics.overflow,false,JSON.stringify({width,metrics}));assert.ok(metrics.headerFits);
      assert.ok(metrics.buttons.every(b=>b.width>=44&&b.height>=44&&b.left>=0&&b.right<=box.width),JSON.stringify({width,metrics}));
      await frame.locator("#text-size-btn").click();
      const popover=await frame.locator("#text-size-popover").evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth}});
      assert.ok(popover.left>=0&&popover.right<=popover.viewport,JSON.stringify({width,popover}));
      await frame.locator("#text-size-btn").click();
      if(width===390||width===844)await page.screenshot({path:path.join(os.tmpdir(),width===390?"beast-safari-portrait.png":"beast-safari-landscape.png")});
      console.log(`PASS: ${width}×${height}: panel stays inside viewport, header fits, touch controls are 44px, and text-size popover stays on screen.`);
    }
    await page.setViewportSize({width:320,height:568});
    await worker.evaluate(()=>chrome.storage.local.set({bm_font_scale:130}));
    await frame.locator("#text-size-value").getByText("130",{exact:true}).waitFor({state:"attached"});
    const tabs=await frame.locator('[role="tablist"]').evaluate(el=>({viewport:innerWidth,nav:{width:el.getBoundingClientRect().width,wrap:getComputedStyle(el).flexWrap},tabs:[...el.querySelectorAll('[role="tab"]')].map(tab=>{const r=tab.getBoundingClientRect();return {left:r.left,right:r.right,whiteSpace:getComputedStyle(tab).whiteSpace}})}));
    assert.ok(tabs.tabs.every(tab=>tab.left>=0&&tab.right<=tabs.viewport),"Tabs remain reachable: "+JSON.stringify(tabs));
    await frame.locator("#theme-toggle-btn").click();
    await frame.locator('html[data-bm-theme="dark"]').waitFor();
    console.log("PASS: largest text setting keeps tabs reachable at 320px; dark mode still works.");
    await worker.evaluate(()=>chrome.storage.local.set({bm_font_scale:100}));
    await page.setViewportSize({width:390,height:844});
    // Apply the simulation in the content script's isolated world, whose DOM
    // wrappers are separate from the webpage's own JavaScript wrappers.
    await worker.evaluate(async url=>{
      const [tab]=await chrome.tabs.query({url});
      await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
        Object.defineProperty(visualViewport,"height",{value:400,configurable:true});
        visualViewport.dispatchEvent(new Event("resize"));
      }});
    },page.url());
    await page.waitForFunction(()=>document.getElementById("chatgpt-summarize-popup").getBoundingClientRect().bottom<=389);
    console.log("PASS: simulated keyboard shrink keeps the panel inside the visible viewport.");
    const nativePopup=await context.newPage();
    await nativePopup.goto(`chrome-extension://${new URL(worker.url()).host}/popup/index.html`);
    await nativePopup.waitForFunction(()=>document.getElementById("app").childElementCount>0);
    assert.ok(await nativePopup.locator("html").evaluate(el=>el.classList.contains("bm-safari-native-popup")));
    console.log("PASS: the Safari toolbar-popover bootstrap mounts the application without an iframe parent.");
  } finally {
    if(context){
      const browser=context.browser(),session=await browser.newBrowserCDPSession();
      const {processInfo}=await session.send("SystemInfo.getProcessInfo");
      const browserProcess=processInfo.find(item=>item.type==="browser");await session.detach();
      const timeout=setTimeout(()=>{if(browserProcess)try{process.kill(browserProcess.id);}catch(error){if(error.code!=="ESRCH")console.error(error);}},5000);
      try{await browser.close();}finally{clearTimeout(timeout);}
    }
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(path.dirname(fixture)===os.tmpdir()&&path.basename(fixture).startsWith("beast-apple-test-"))fs.rmSync(fixture,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

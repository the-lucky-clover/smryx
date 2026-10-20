const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),base=path.join(root,'docs');
 const server=createServer((req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(base,'.'+(route.endsWith('/')?route+'index.html':route));
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'chromium'});
  const context=await browser.newContext(),page=await context.newPage(),tags=[],errors=[];
  await context.route('https://www.googletagmanager.com/**',route=>{tags.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:'window.__testTagLoaded=true;'});});
  await context.route('https://*.google-analytics.com/**',route=>route.abort());
  page.on('pageerror',e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin+'/?private=DO_NOT_SEND#secret');
  await page.getByRole('button',{name:'Keep analytics off',exact:true}).waitFor();assert.equal(tags.length,0);
  await page.getByRole('button',{name:'Keep analytics off',exact:true}).click();
  await page.reload();assert.equal(tags.length,0);
  await page.goto(origin+'/privacy.html');assert.equal(tags.length,0);
  assert.equal(await page.locator('.website-analytics-choice').isVisible(),false);
  await page.getByRole('button',{name:'Analytics choices',exact:true}).click();
  await page.getByRole('button',{name:'Allow analytics',exact:true}).click();
  await page.waitForFunction(()=>window.__testTagLoaded);
  assert.equal(tags.length,1);assert.ok(tags[0].endsWith('id=G-WV65497MC0'));
  const commands=await page.evaluate(()=>dataLayer.map(entry=>Array.from(entry)));
  const defaults=commands.find(c=>c[0]==='consent'&&c[1]==='default')[2];
  assert.equal(defaults.analytics_storage,'denied');assert.equal(defaults.ad_storage,'denied');
  const update=commands.find(c=>c[0]==='consent'&&c[1]==='update')[2];
  assert.equal(update.analytics_storage,'granted');assert.equal(update.ad_personalization,'denied');
  const config=commands.find(c=>c[0]==='config')[2];
  assert.equal(config.allow_google_signals,false);assert.equal(config.send_page_view,false);
  const views=commands.filter(c=>c[0]==='event'&&c[1]==='page_view');assert.equal(views.length,1);
  assert.equal(views[0][2].surface,'website');assert.equal(views[0][2].page_location,'https://smryx.com/privacy.html');
  assert.ok(!JSON.stringify(commands).includes('DO_NOT_SEND'));
  await page.goto(origin+'/?private=DO_NOT_SEND#secret');await page.waitForFunction(()=>window.__testTagLoaded);
  await page.getByRole('button',{name:'Get SmryX',exact:false}).first().click();
  const events=await page.evaluate(()=>dataLayer.filter(c=>c[0]==='event').map(c=>Array.from(c)));
  assert.equal(events.filter(c=>c[1]==='website_install_opened').length,1);
  assert.equal(events.find(c=>c[1]==='page_view')[2].page_location,'https://smryx.com/');
  // Prevent navigation while exercising the real download link and event handler.
  await page.evaluate(()=>document.querySelector('a[href$="main.zip"]').addEventListener('click',e=>e.preventDefault()));
  await page.getByRole('link',{name:'Download source ZIP'}).click();
  assert.equal(await page.evaluate(()=>dataLayer.filter(c=>c[0]==='event'&&c[1]==='website_download_clicked'&&c[2].platform==='chrome').length),1);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{document.cookie='smryx_ga=test; Path=/';document.cookie='unrelated=keep; Path=/';});
  await page.getByRole('button',{name:'Analytics choices',exact:true}).click();
  const before=tags.length;
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Keep analytics off',exact:true}).click()]);
  assert.equal(tags.length,before,'withdrawal must not reload Google tag');
  const cookies=await page.evaluate(()=>document.cookie);assert.ok(!cookies.includes('smryx_ga='));assert.ok(cookies.includes('unrelated=keep'));
  assert.equal(await page.locator('.website-analytics-choice').isVisible(),false);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'Analytics choices',exact:true}).click();
   const bounds=await page.locator('.website-analytics-choice').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1);
   await page.getByRole('button',{name:'Keep analytics off',exact:true}).click();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: no tag before consent or after rejection; saved choice, one page view, sanitized URLs, install/download events, withdrawal/cookie cleanup and mobile controls. Google is mocked; no test analytics sent.');
 }finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

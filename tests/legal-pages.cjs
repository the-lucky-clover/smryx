const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),base=path.join(root,'docs');
  const server=createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(base,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
    const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,channel:'chromium'});
    const page=await browser.newPage(),errors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)failed.push(response.url());});
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const route of ['/','/privacy.html','/terms.html']){
      await page.goto(origin+route);
      for(const width of [320,390,768,1440]){
        await page.setViewportSize({width,height:900});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route}: overflow at ${width}`);
        const footer=page.locator('footer.corporate-footer');
        assert.equal(await footer.getByRole('link',{name:'Privacy Policy',exact:true}).getAttribute('href'),'privacy.html');
        assert.equal(await footer.getByRole('link',{name:'Terms of Use',exact:true}).getAttribute('href'),'terms.html');
        await footer.scrollIntoViewIfNeeded();
        assert.ok(await footer.getByRole('link',{name:'Contact & support ↗',exact:true}).isVisible());
      }
      if(route!=='/'){
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:path.join(root,'artifacts',route.includes('privacy')?'sumyst-privacy-mobile.png':'sumyst-terms-mobile.png'),fullPage:true});
        const anchors=await page.locator('.legal-toc a').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
        for(const anchor of anchors)assert.equal(await page.locator(anchor).count(),1,`Missing policy section ${anchor}`);
      }
    }
    await page.goto(origin+'/');
    await page.locator('footer').getByRole('link',{name:'Privacy Policy',exact:true}).click();
    assert.equal(await page.title(),'Privacy Policy — Sumyst');
    assert.match(await page.locator('main').innerText(),/enabled unless you have saved an opt-out/);
    assert.match(await page.locator('main').innerText(),/does not automatically erase events/);
    await page.locator('footer').getByRole('link',{name:'Terms of Use',exact:true}).click();
    assert.equal(await page.title(),'Terms of Use — Sumyst');
    assert.match(await page.locator('main').innerText(),/does not grant permission to use a third-party service/);
    assert.match(await page.locator('main').innerText(),/Mandatory consumer protections/);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log('PASS: landing page and both legal pages fit 320–1440px; footer navigation, policy sections and disclosures work without page errors.');
  }finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

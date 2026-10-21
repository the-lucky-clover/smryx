const {chromium}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.setContent('<iframe style="width:700px;height:600px;border:0;position:fixed" srcdoc="<header style=\'height:70px;background:gray\'>Drag</header>"></iframe>');
await page.addScriptTag({content:fs.readFileSync('shared/popup-window.js','utf8')+';it(document.querySelector("iframe"),"test");'});
const frame=page.locator('iframe');const rect=()=>frame.boundingBox();
await page.frames()[1].evaluate(()=>{const h=document.querySelector('header');h.onpointerdown=e=>{h.setPointerCapture(e.pointerId);parent.postMessage({type:'POPUP_DRAG_START',runtimeId:'test',screenX:e.screenX,screenY:e.screenY},'*');};h.onpointermove=e=>{if(e.buttons)parent.postMessage({type:'POPUP_DRAG_MOVE',runtimeId:'test',screenX:e.screenX,screenY:e.screenY,buttons:e.buttons},'*');};h.onpointerup=()=>parent.postMessage({type:'POPUP_DRAG_END',runtimeId:'test'},'*');});
let r=await rect();await page.mouse.move(r.x+100,r.y+35);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.move(220,300,{steps:35});await page.mouse.up();let moved=await rect();assert.ok(moved.x<200&&moved.y>200,JSON.stringify(moved));
for(const edge of ['n','s','e','w','ne','nw','se','sw']){
 await page.evaluate(()=>{const f=document.querySelector('iframe');f.style.width='500px';f.style.height='400px';f._resetDrag();});
 // Move away from boundaries before exercising all eight directions.
 r=await rect();await page.mouse.move(r.x+100,r.y+35);await page.mouse.down();await page.waitForTimeout(20);await page.mouse.move(500,300,{steps:10});await page.mouse.up();
 const before=await rect();const handle=page.locator(`[data-edge="${edge}"]`);const h=await handle.boundingBox();
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+(edge.includes('w')?-60:edge.includes('e')?60:0),h.y+h.height/2+(edge.includes('n')?-50:edge.includes('s')?50:0),{steps:10});await page.mouse.up();
 const after=await rect();assert.ok(edge==='n'||edge==='s'?after.height>before.height+40:after.width>before.width+50,edge+JSON.stringify({before,after}));
 if(edge.includes('w'))assert.ok(Math.abs(after.x+after.width-before.x-before.width)<2,edge+' opposite edge moved');
 if(edge.includes('n'))assert.ok(Math.abs(after.y+after.height-before.y-before.height)<2,edge+' opposite edge moved');
}
await frame.evaluate(f=>f.style.display='none');await page.waitForTimeout(20);assert.equal(await page.locator('[data-smryx-window-controls]').isVisible(),false);
await frame.evaluate(f=>f.remove());await page.waitForTimeout(20);assert.equal(await page.locator('[data-smryx-window-controls]').count(),0);
console.log('PASS: continuous cross-iframe drag, all eight resize directions, anchored opposite edges, hide and removal cleanup.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname, "../AppleSafari");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const token = "12345678-1234-1234-1234-123456789abc";
test("Apple copy contains both host apps, both web extensions, and the iOS Share target", () => {
  const project = JSON.parse(read("project.json"));
  assert.equal(Object.keys(project.targets).length, 5);
  assert.deepEqual(project.targets.BeastModeIOS.dependencies.map(item => item.target), ["BeastModeIOSExtension", "BeastModeIOSShare"]);
  const share = project.targets.BeastModeIOSShare.info.properties.NSExtension;
  assert.equal(share.NSExtensionPointIdentifier, "com.apple.share-services");
  assert.equal(share.NSExtensionAttributes.NSExtensionJavaScriptPreprocessingFile, "SharePreprocessor");
  assert.equal(share.NSExtensionAttributes.NSExtensionActivationRule.NSExtensionActivationSupportsWebPageWithMaxCount, 1);
});
test("Safari runtime copy has complete local imports/resources and a classic background", () => {
  const base = path.join(root, "WebExtension"), manifest = JSON.parse(read("WebExtension/manifest.json"));
  assert.ok(manifest.permissions.includes("nativeMessaging"));
  assert.ok(!manifest.permissions.includes("webRequest"));
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.background.type, undefined);
  assert.equal(manifest.background.service_worker, undefined);
  const resourceFiles = [...manifest.background.scripts, manifest.action.default_popup, manifest.options_ui.page, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(item => [...item.js, ...item.css]), ...manifest.web_accessible_resources.flatMap(item => item.resources)];
  for (const file of resourceFiles) assert.ok(fs.existsSync(path.join(base, file)), file);
  const worker = read("WebExtension/background/index.js");
  assert.ok(!worker.includes("importScripts("));
  assert.ok(!worker.includes("webRequest.onBeforeRequest.addListener"));
  const walk = folder => fs.readdirSync(folder, {withFileTypes:true}).flatMap(item => item.isDirectory() ? walk(path.join(folder,item.name)) : [path.join(folder,item.name)]);
  for (const file of walk(base)) {
    if (!/\.(?:js|html)$/.test(file)) continue;
    const source = fs.readFileSync(file,"utf8");
    const pattern = file.endsWith(".js") ? /(?:from\s*|import\s*)["'](\.\.?\/[^"']+)["']/g : /(?:src|href)=["'](\.\.?\/[^"']+|[^:"'#\/][^"']*\.(?:js|css))["']/g;
    for (const match of source.matchAll(pattern)) assert.ok(fs.existsSync(path.resolve(path.dirname(file), match[1])), file+" → "+match[1]);
  }
});
test("Share preprocessing returns page metadata and finalizes only the same URL", () => {
  const posts = [], location = {href:"https://example.com/page?x=1&y=2", protocol:"https:", origin:"https://example.com"};
  const context = vm.createContext({location, document:{title:"A page"}, window:{postMessage:(...args)=>posts.push(args)}});
  vm.runInContext(read("Native/Share/SharePreprocessor.js"), context);
  let metadata; context.ExtensionPreprocessingJS.run({completionFunction:value=>{metadata=value;}});
  assert.equal(metadata.url, location.href); assert.equal(metadata.supported, true);
  context.ExtensionPreprocessingJS.finalize({command:"open-summary",url:"https://other.example",token});
  assert.equal(posts.length,0);
  context.ExtensionPreprocessingJS.finalize({command:"open-summary",url:location.href,token});
  assert.equal(posts.length,1); assert.equal(posts[0][1],location.origin);
});
test("Safari toolbar popovers start the existing app without a parent iframe", () => {
  let listener; const posts=[], classes=[];
  const window={};window.top=window;window.addEventListener=(name,handler)=>{listener=handler;};window.removeEventListener=()=>{};window.postMessage=(...args)=>posts.push(args);
  const context=vm.createContext({window,document:{documentElement:{classList:{add:value=>classes.push(value)}}},location:{origin:"safari-web-extension://test"},chrome:{runtime:{id:"test"}}});
  vm.runInContext(read("Adapters/popup-launch.js"),context);
  assert.ok(classes.includes("bm-safari-native-popup"));
  listener({source:window,data:{type:"READY",runtimeId:"different"}});assert.equal(posts.length,0);
  listener({source:window,data:{type:"READY",runtimeId:"test"}});assert.equal(posts[0][0].type,"START");
});
test("iPad desktop-mode compatibility skips unsupported menus and window focus in both namespaces", async () => {
  const namespace=()=>({runtime:{},contextMenus:{create(){throw Error("Unsupported on iOS");}},windows:{update(){throw Error("Unsupported on iOS");}}});
  const chrome=namespace(),browser=namespace();
  const context=vm.createContext({chrome,browser,navigator:{userAgent:"Macintosh",platform:"MacIntel",maxTouchPoints:5}});
  vm.runInContext(read("Adapters/background-compat.js"),context);
  for(const api of [chrome,browser]){
    assert.equal(api.contextMenus.create({id:"test"}),"test");
    assert.equal(await api.windows.update(1,{focused:true}),undefined);
    assert.equal(typeof api.runtime.onStartup.addListener,"function");
  }
});
test("Share bridge requires native approval, correct tab URL, and a top-level frame", async () => {
  let listener, approval=false; const opened=[];
  const context=vm.createContext({URL,chrome:{runtime:{onMessage:{addListener:value=>{listener=value;}},sendNativeMessage:async()=>({ok:approval})},tabs:{sendMessage:async(...args)=>opened.push(args)}}});
  vm.runInContext(read("Adapters/share-background.js"),context);
  const message={to:"safari-share",type:"BM_SAFARI_SHARE_OPEN",token,url:"https://example.com/page"};
  const sender={frameId:0,url:message.url,tab:{id:3}};
  assert.equal((await listener(message,sender)).ok,false);
  approval=true;
  assert.equal((await listener(message,{...sender,frameId:1})).ok,false);
  assert.equal((await listener(message,{...sender,url:"https://other.example"})).ok,false);
  assert.equal((await listener(message,sender)).ok,true);
  assert.equal(opened.length,1); assert.equal(opened[0][1].type,"OPEN_POPUP");
});
test("Webpage messages are restricted to the same window, origin, and page URL", async () => {
  let listener; const calls=[];
  const window={};window.top=window;window.addEventListener=(name,handler)=>{listener=handler;};
  const location={href:"https://example.com/page",origin:"https://example.com"};
  const context=vm.createContext({window,location,chrome:{runtime:{sendMessage:async message=>calls.push(message)}}});
  vm.runInContext(read("Adapters/share-content.js"),context);
  const message={type:"BM_SAFARI_SHARE_OPEN",token,url:location.href};
  listener({source:{},origin:location.origin,data:message});
  listener({source:window,origin:"https://other.example",data:message});
  assert.equal(calls.length,0);
  listener({source:window,origin:location.origin,data:message});
  assert.equal(calls.length,1);
});

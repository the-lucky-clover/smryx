// Embedded in the shipped worker by scripts/sync-batch-worker.cjs.
(() => {
  const menuId = "bm-batch-results";
  const inboxKey = "bm_batch_requests";
  let opening;
  let commands = Promise.resolve();
  const serial = operation => {
    const next = commands.catch(() => {}).then(operation);
    commands = next.catch(() => {});
    return next;
  };
  const webUrl = value => {try {const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return "";}};
  const ordered = tabs => [...tabs].sort((a,b)=>(a.windowId-b.windowId)||(a.index-b.index));
  globalThis.bmOpenBatchResults = () => {
    if (opening) return opening;
    opening = (async () => {
      const url = chrome.runtime.getURL("popup/batch-results.html");
      const tabs = await chrome.tabs.query({url: url + "*"});
      if (tabs[0]?.id != null) {
        await chrome.tabs.update(tabs[0].id, {active: true});
        await chrome.windows.update(tabs[0].windowId, {focused: true});
        return {tabId: tabs[0].id};
      }
      const tab = await chrome.tabs.create({url, active: true});
      return {tabId: tab.id};
    })().finally(() => {opening = undefined;});
    return opening;
  };
  globalThis.bmBatchCommands = {
    async enqueue(request) {
      let tabs;
      if(request.type === "BATCH_ADD_TAB") {
        if(!Number.isInteger(request.tabId))throw new Error("Choose a source tab to add to the batch.");
        tabs=[await chrome.tabs.get(request.tabId)];
      } else {
        const windowId=Number.isInteger(request.windowId)?request.windowId:(await chrome.windows.getLastFocused()).id;
        tabs=ordered(await chrome.tabs.query(request.scope==="all"?{}:{windowId}));
      }
      tabs=tabs.filter(tab=>Number.isInteger(tab?.id)&&webUrl(tab.pendingUrl||tab.url));
      if(!tabs.length)throw new Error("No supported web pages were found to summarize.");
      const command={id:crypto.randomUUID(),createdAt:Date.now(),tabs:tabs.map(tab=>({id:crypto.randomUUID(),tabId:tab.id,windowId:tab.windowId,tabIndex:tab.index,url:webUrl(tab.pendingUrl||tab.url),title:tab.title||tab.pendingUrl||tab.url}))};
      await serial(async()=>{
        const state=await chrome.storage.local.get(inboxKey);
        await chrome.storage.local.set({[inboxKey]:[...(Array.isArray(state[inboxKey])?state[inboxKey]:[]),command]});
      });
      await globalThis.bmOpenBatchResults();
      return {queued:tabs.length,commandId:command.id};
    },
    get:()=>serial(async()=>{const state=await chrome.storage.local.get(inboxKey);return Array.isArray(state[inboxKey])?state[inboxKey]:[];}),
    acknowledge:ids=>serial(async()=>{
      const state=await chrome.storage.local.get(inboxKey), done=new Set(Array.isArray(ids)?ids:[]);
      await chrome.storage.local.set({[inboxKey]:(state[inboxKey]||[]).filter(command=>!done.has(command.id))});
      return {success:true};
    }),
    clear:()=>serial(async()=>{await chrome.storage.local.set({[inboxKey]:[]});return {success:true};}),
  };
  function ensureItem(id,properties,fallback) {
    const failed=error=>{
      if(fallback)ensureItem(id,fallback);
      else console.debug("Batch menu:",error?.message||String(error));
    };
    try {
      chrome.contextMenus.update(id,properties,()=>{
        if(!chrome.runtime.lastError)return;
        try {chrome.contextMenus.create({id,...properties},()=>{if(chrome.runtime.lastError)failed(chrome.runtime.lastError);});}
        catch(error){failed(error);}
      });
    }catch(error){failed(error);}
  }
  const ensureMenu = () => {
    ensureItem(menuId,{title:"Batch Summaries",contexts:["action"]});
    ensureItem("bm-batch-add-tab",{title:"Add to Batch",contexts:["tab","page"]},{title:"Add to Batch",contexts:["page"]});
    ensureItem("bm-batch-add-current",{title:"Add this tab to Batch",contexts:["action"]});
    ensureItem("bm-batch-all-window",{title:"Summarize all tabs in this window",contexts:["action"]});
    ensureItem("bm-batch-all-windows",{title:"Summarize all tabs in all windows",contexts:["action"]});
  };
  chrome.runtime.onInstalled.addListener(ensureMenu);
  chrome.runtime.onStartup.addListener(ensureMenu);
  chrome.contextMenus.onClicked.addListener((info,tab) => {
    if (info.menuItemId === menuId) globalThis.bmOpenBatchResults().catch(console.error);
    else if(["bm-batch-add-tab","bm-batch-add-current"].includes(info.menuItemId))globalThis.bmBatchCommands.enqueue({type:"BATCH_ADD_TAB",tabId:tab?.id}).catch(console.error);
    else if(["bm-batch-all-window","bm-batch-all-windows"].includes(info.menuItemId))globalThis.bmBatchCommands.enqueue({type:"BATCH_SUMMARIZE_ALL",scope:info.menuItemId==="bm-batch-all-windows"?"all":"window",windowId:tab?.windowId}).catch(console.error);
  });
  ensureMenu();
})();

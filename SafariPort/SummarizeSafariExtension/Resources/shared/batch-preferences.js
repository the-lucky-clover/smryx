export const CLOSE_SOURCE_KEY = "bm_close_tab_after_summary";

// All controls read/write the same preference. An absent value means off.
export async function bindCloseSourceSetting(input, report=()=>{}) {
  if(!input)return;
  input.disabled=true;
  try {
    input.checked=(await chrome.storage.local.get({[CLOSE_SOURCE_KEY]:false}))[CLOSE_SOURCE_KEY]===true;
  } finally {input.disabled=false;}
  input.addEventListener("change",async()=>{
    const next=input.checked;input.disabled=true;
    try {await chrome.storage.local.set({[CLOSE_SOURCE_KEY]:next});}
    catch(error){input.checked=!next;report(error.message);}
    finally {input.disabled=false;}
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==="local"&&changes[CLOSE_SOURCE_KEY])input.checked=changes[CLOSE_SOURCE_KEY].newValue===true;
  });
}

export async function closeSavedSourceTab(api,result,resultsTabId) {
  if(result.status!=="complete"||!result.summary||result.error||!Number.isInteger(result.tabId)||result.tabId===resultsTabId)return false;
  const state=await api.storage.local.get({[CLOSE_SOURCE_KEY]:false,bm_batch_results:[]});
  if(state[CLOSE_SOURCE_KEY]!==true)return false;
  // A successful write must be observable before closing a source tab.
  if(!state.bm_batch_results.some(saved=>saved.id===result.id&&saved.status==="complete"&&saved.url===result.url&&saved.summary===result.summary&&!saved.error))return false;
  let tab;
  try {tab=await api.tabs.get(result.tabId);}catch{return false;}
  if(tab.url!==result.url||(tab.pendingUrl&&tab.pendingUrl!==result.url))return false;
  await api.tabs.remove(result.tabId);
  return true;
}

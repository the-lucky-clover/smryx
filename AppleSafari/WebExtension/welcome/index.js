let step = 1;
function showStep(next) {
  step = Math.min(3, Math.max(1, next));
  for (let index = 1; index <= 3; index++) {
    document.getElementById(`step-${index}`).hidden = index !== step;
    const indicator = document.querySelector(`[data-step="${index}"]`);
    if (index === step) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  }
  document.querySelector(`#step-${step} h1`).setAttribute('tabindex', '-1');
  document.querySelector(`#step-${step} h1`).focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => showStep(step + 1)));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(step - 1)));
const extension = globalThis.browser || globalThis.chrome;
const statistics = document.getElementById('usage-statistics');
try {
  const saved = await extension.storage.local.get('bm_analytics_enabled');
  statistics.checked = saved.bm_analytics_enabled !== false;
} catch { statistics.disabled = true; }
statistics.addEventListener('change', async () => {
  try { await extension.storage.local.set({bm_analytics_enabled:statistics.checked}); }
  catch { statistics.checked = !statistics.checked; }
});
document.getElementById('open-batch').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await extension.runtime.sendMessage({type:'OPEN_BATCH_RESULTS',to:'background'}); }
  catch { document.getElementById('setup-status').textContent = 'Open Batch summaries from the extension icon’s right-click menu.'; }
  finally { button.disabled = false; }
});

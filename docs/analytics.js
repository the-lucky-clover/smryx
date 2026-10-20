// Public web tag only. The extension's server-side secret never enters this site.
(() => {
  const id = 'G-WV65497MC0', key = 'smryx_website_analytics';
  const maxAge = 180 * 24 * 60 * 60 * 1000;
  const canonical = 'https://smryx.com/';
  const paths = {'index.html':'', 'privacy.html':'privacy.html', 'terms.html':'terms.html'};
  const titles = {'':'SmryX', 'privacy.html':'Privacy Policy — SmryX', 'terms.html':'Terms of Use — SmryX'};
  const name = location.pathname.split('/').pop() || 'index.html';
  const route = paths[name] ?? '';
  let loaded = false, allowed = false;
  function choice() {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if(stored && ['granted','denied'].includes(stored.value) && Date.now()-stored.at>=0 && Date.now()-stored.at<maxAge)return stored.value;
      localStorage.removeItem(key);return null;
    } catch { return null; }
  }
  function save(value) {try {localStorage.setItem(key, JSON.stringify({value,at:Date.now()}));} catch { /* Current-page choice still works. */ }}
  function gtag(){window.dataLayer.push(arguments);}
  function track(event, params = {}) {
    if (!allowed) return;
    gtag('event',event,{send_to:id,surface:'website',...params});
  }
  function start() {
    allowed = true;
    window[`ga-disable-${id}`] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('set','ads_data_redaction',true);
    gtag('js',new Date());
    const referrer = (()=>{try {return new URL(document.referrer).origin;}catch{return '';}})();
    const page = {page_location:canonical+route,page_title:titles[route],page_referrer:referrer};
    gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
      cookie_prefix:'smryx',cookie_path:'/',cookie_expires:180*24*60*60,...page});
    track('page_view',page);
    const script=document.createElement('script');
    script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.append(script);
  }
  function clearCookies() {
    // Remove only this site's prefixed cookies, never unrelated site cookies.
    for(const cookie of document.cookie.split(';')) {
      const cookieName=cookie.trim().split('=')[0];
      if(cookieName!=='smryx_ga'&&!cookieName.startsWith('smryx_ga_'))continue;
      for(const cookiePath of ['/','/smryx','/smryx/'])for(const domain of ['',`; Domain=${location.hostname}`])
        document.cookie=`${cookieName}=; Max-Age=0; Path=${cookiePath}${domain}; SameSite=Lax`;
    }
  }
  function stop() {
    allowed=false;
    window[`ga-disable-${id}`]=true;
    clearCookies();
    if(loaded)location.reload(); // Unload the tag as well as disabling collection.
  }
  const notice=document.createElement('section');
  notice.className='website-analytics-choice';notice.setAttribute('aria-label','Website analytics choices');
  notice.innerHTML='<div><b>A little insight, with your say.</b><p>Allow Google Analytics to measure visits to this website and install-link clicks? Advertising features stay off. This choice is separate from extension usage statistics. <a href="privacy.html#website-analytics">Privacy details</a></p></div><div class="analytics-choice-actions"><button type="button" data-web-analytics="granted">Allow analytics</button><button type="button" data-web-analytics="denied">Keep analytics off</button></div>';
  document.body.append(notice);
  for(const button of notice.querySelectorAll('[data-web-analytics]'))button.addEventListener('click',()=>{
    const value=button.dataset.webAnalytics;save(value);notice.hidden=true;
    if(value==='granted')start();else stop();
  });
  document.querySelectorAll('[data-analytics-choices]').forEach(button=>{
    button.hidden=false;
    button.addEventListener('click',()=>{notice.hidden=false;notice.querySelector('[data-web-analytics="granted"]').focus({preventScroll:true});});
  });
  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element))return;
    if(event.target.closest('[data-install]'))track('website_install_opened');
    const link=event.target.closest('a[href]');
    if(link?.href==='https://github.com/the-lucky-clover/smryx/archive/refs/heads/main.zip')track('website_download_clicked',{platform:'chrome'});
    if(link?.href==='https://github.com/the-lucky-clover/smryx/tree/main/AppleSafari')track('website_download_clicked',{platform:'safari'});
  });
  window.addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    if(choice()==='granted'){notice.hidden=true;start();}else{notice.hidden=choice()==='denied';stop();}
  });
  const saved=choice();notice.hidden=Boolean(saved);
  if(saved==='granted')start();else clearCookies();
})();

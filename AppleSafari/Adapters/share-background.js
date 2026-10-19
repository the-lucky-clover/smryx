(() => {
  const api = globalThis.chrome || globalThis.browser;
  api.runtime.onMessage.addListener((message, sender) => {
    if (message?.to !== "safari-share" || message.type !== "BM_SAFARI_SHARE_OPEN") return;
    return (async () => {
      if (sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || sender.url !== message.url) return {ok: false};
      let url;
      try {url = new URL(message.url);} catch {return {ok: false};}
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !/^[0-9a-f-]{36}$/i.test(message.token || "")) return {ok: false};
      try {
        const approved = await api.runtime.sendNativeMessage("com.luckyclover.chatgptbeastmode", {type: "CONSUME_SHARE_REQUEST", token: message.token, url: message.url});
        if (approved?.ok !== true) return {ok: false};
        await api.tabs.sendMessage(sender.tab.id, {type: "OPEN_POPUP", to: "content-script"});
        return {ok: true};
      } catch {return {ok: false};}
    })();
  });
})();

var BeastModeSharePreprocessor = function () {};
BeastModeSharePreprocessor.prototype = {
  run: function (args) {
    args.completionFunction({url: location.href, title: document.title, supported: /^https?:$/.test(location.protocol)});
  },
  finalize: function (args) {
    if (args.command !== "open-summary" || args.url !== location.href || !/^[0-9a-f-]{36}$/i.test(args.token || "")) return;
    window.postMessage({type: "BM_SAFARI_SHARE_OPEN", token: args.token, url: location.href}, location.origin);
  },
};
var ExtensionPreprocessingJS = new BeastModeSharePreprocessor();

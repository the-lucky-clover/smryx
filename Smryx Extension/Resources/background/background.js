/* Smryx background page.
 *
 * Orchestrates one summarize request:
 *   popup --("summarize", length)--> background
 *     1. query active tab, ask its content script to extract the article
 *     2. sendNativeMessage("summarize") to the containing app — the native
 *        side checks the free tier, calls the user's AI endpoint with the
 *        Keychain-stored API key, and returns the summary
 *     3. hand the result back to the popup
 *
 * Uses the sendResponse + return-true pattern, the reliable async-message
 * pattern in Safari web extensions.
 */
(function () {
  "use strict";

  // The containing app's bundle ID. Safari routes this to the Smryx
  // app extension's SafariWebExtensionHandler regardless.
  var NATIVE_APP = "com.luckyclover.smryx";

  function extractFromActiveTab() {
    return browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      if (!tabs || !tabs.length) throw new Error("No active tab.");
      var tab = tabs[0];
      if (!/^https?:/.test(tab.url || "")) {
        throw new Error("Smryx works on regular web pages (http/https).");
      }
      return browser.tabs.sendMessage(tab.id, { type: "extract" }).then(function (resp) {
        if (!resp || !resp.ok || !resp.article) {
          throw new Error(resp && resp.error ? resp.error : "Could not extract this page.");
        }
        return resp.article;
      });
    });
  }

  function summarize(article, length) {
    return browser.runtime
      .sendNativeMessage(NATIVE_APP, {
        action: "summarize",
        title: article.title,
        url: article.url,
        text: article.text,
        length: length,
      })
      .then(function (resp) {
        return { ok: true, result: resp, article: article };
      });
  }

  browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== "summarize") {
      sendResponse({ ok: false, error: "unknown_request" });
      return true;
    }
    extractFromActiveTab()
      .then(function (article) {
        return summarize(article, message.length || "medium");
      })
      .then(function (out) {
        sendResponse(out);
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true;
  });
})();

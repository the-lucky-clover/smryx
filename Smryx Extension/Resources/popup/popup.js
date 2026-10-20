/* Smryx popup logic.
 *
 * On open: asks the native side for status (API key saved? Pro? usage left)
 * and shows an honest notice when something is missing.
 *
 * Summarize: background page extracts the article, native side summarizes.
 * Copy: clipboard. Save: native side writes to the shared library.
 */
(function () {
  "use strict";

  var NATIVE_APP = "com.luckyclover.smryx";

  var $ = function (id) { return document.getElementById(id); };

  var lastResult = null;   // {summary, model, usedThisMonth, freeLimit, isPro}
  var lastArticle = null;  // {title, url}
  var lastLength = "medium";

  function show(id) { $(id).classList.remove("hidden"); }
  function hide(id) { $(id).classList.add("hidden"); }

  function setError(msg) {
    if (!msg) { hide("error"); $("error").textContent = ""; return; }
    $("error").textContent = msg;
    show("error");
  }

  function setNotice(msg) {
    if (!msg) { hide("notice"); $("notice").textContent = ""; return; }
    $("notice").textContent = msg;
    show("notice");
  }

  function usageText(status) {
    if (status.isPro) return "Pro · unlimited";
    return (status.freeLimit - status.usedThisMonth) + " of " + status.freeLimit + " free left";
  }

  function refreshStatus() {
    browser.runtime.sendNativeMessage(NATIVE_APP, { action: "getStatus" }).then(function (s) {
      if (!s || !s.ok) {
        setNotice("The Smryx app isn't reachable. Open the Smryx app once, then try again.");
        $("summarizeBtn").disabled = true;
        return;
      }
      $("usage").textContent = usageText(s);
      if (!s.hasKey) {
        setNotice("No API key yet. Open the Smryx app → Settings and add your key (it stays in your Mac's Keychain).");
        $("summarizeBtn").disabled = true;
      } else if (!s.isPro && (s.freeLimit - s.usedThisMonth) <= 0) {
        setNotice("You've used your " + s.freeLimit + " free summaries this month. Go Pro in the Smryx app for unlimited.");
        $("summarizeBtn").disabled = true;
      } else {
        setNotice(null);
        $("summarizeBtn").disabled = false;
      }
    }).catch(function () {
      setNotice("The Smryx app isn't reachable. Open the Smryx app once, then try again.");
      $("summarizeBtn").disabled = true;
    });
  }

  function selectedLength() {
    var checked = document.querySelector('input[name="length"]:checked');
    return checked ? checked.value : "medium";
  }

  $("summarizeBtn").addEventListener("click", function () {
    setError(null);
    lastLength = selectedLength();
    hide("idle"); hide("result"); show("summarizing");

    browser.runtime.sendMessage({ type: "summarize", length: lastLength }).then(function (out) {
      hide("summarizing");
      if (!out || !out.ok) {
        show("idle");
        setError((out && out.error) || "Summarizing failed.");
        return;
      }
      var r = out.result;
      if (!r.ok) {
        show("idle");
        setError(r.message || "Summarizing failed.");
        return;
      }
      lastResult = r;
      lastArticle = out.article;

      $("resultTitle").textContent = out.article.title || "Summary";
      $("summaryText").textContent = r.summary;
      $("truncatedNote").classList.toggle("hidden", !r.wasTruncated);
      $("meta").textContent =
        "Model " + (r.model || "") + " · " +
        (r.isPro ? "Pro" : (r.freeLimit - r.usedThisMonth) + " of " + r.freeLimit + " free left");
      $("usage").textContent = r.isPro ? "Pro · unlimited"
        : (r.freeLimit - r.usedThisMonth) + " of " + r.freeLimit + " free left";
      $("copyBtn").textContent = "Copy";
      $("saveBtn").textContent = "Save to library";
      $("saveBtn").disabled = false;
      show("result");
    }).catch(function (err) {
      hide("summarizing"); show("idle");
      setError(String((err && err.message) || err));
    });
  });

  $("copyBtn").addEventListener("click", function () {
    if (!lastResult) return;
    navigator.clipboard.writeText(lastResult.summary).then(function () {
      $("copyBtn").textContent = "Copied ✓";
    });
  });

  $("saveBtn").addEventListener("click", function () {
    if (!lastResult || !lastArticle) return;
    $("saveBtn").disabled = true;
    browser.runtime.sendNativeMessage(NATIVE_APP, {
      action: "saveSummary",
      title: lastArticle.title,
      url: lastArticle.url,
      summary: lastResult.summary,
      length: lastLength,
      model: lastResult.model,
    }).then(function (resp) {
      $("saveBtn").textContent = resp && resp.ok ? "Saved ✓" : "Save failed";
    }).catch(function () {
      $("saveBtn").textContent = "Save failed";
      $("saveBtn").disabled = false;
    });
  });

  $("againBtn").addEventListener("click", function () {
    hide("result"); show("idle"); setError(null);
    refreshStatus();
  });

  document.addEventListener("DOMContentLoaded", refreshStatus);
})();

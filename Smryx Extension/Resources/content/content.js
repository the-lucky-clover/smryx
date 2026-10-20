/* Smryx article extractor — content script.
 *
 * Original implementation of the classic Arc90-style readability algorithm:
 * scores paragraph containers by text length, comma density and link density,
 * with class/id name weighting. No page content is ever sent anywhere by this
 * script — it only returns the extracted article to the extension background
 * page, which hands it to the native side for summarization.
 *
 * Drop-in note: Mozilla's Readability.js (Apache 2.0) can replace the
 * extraction below later; the message contract ("extract" → {title, url,
 * text, excerpt}) stays the same.
 */
(function () {
  "use strict";

  var CHAR_THRESHOLD = 500;      // minimum article chars for a successful parse
  var MAX_CHARS = 24000;         // matches AppConfig.maxArticleCharacters in Swift

  var UNLIKELY = /-ad-|ai2html|banner|combx|comment|community|cover-wrap|disqus|extra|foot|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i;
  var LIKELY = /and|article|body|column|main|shadow/i;
  var POSITIVE = /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i;
  var NEGATIVE = /hidden|^hid$| lock|masthead|media|metadata|modal|nav|navigation|overlay|promo|related|scroll|share|shoutbox|sidebar|skyscraper|social|sponsor|shopping|tag|tool|widget|footer|footnote|subscribe|newsletter|comment/i;
  var DIV_TO_P = /<(a|blockquote|dl|div|img|ol|p|pre|table|ul)/i;

  function cleanTitle(doc) {
    var title = doc.title || "";
    var h1 = doc.querySelector("h1");
    // Prefer og:title
    var og = doc.querySelector('meta[property="og:title"]');
    if (og && og.getAttribute("content")) return og.getAttribute("content").trim();
    if (h1 && h1.textContent.trim().length > 10) return h1.textContent.trim();
    // Strip site-name suffixes: "Headline | Site", "Headline - Site"
    var cleaned = title.replace(/\s*[|–—-]\s*[^-|–—]{1,60}$/, "").trim();
    return cleaned || title;
  }

  function linkDensity(el) {
    var links = el.getElementsByTagName("a");
    var textLen = (el.textContent || "").length;
    if (!textLen) return 0;
    var linkLen = 0;
    for (var i = 0; i < links.length; i++) linkLen += (links[i].textContent || "").length;
    return linkLen / textLen;
  }

  function classWeight(el) {
    var weight = 0;
    var cls = (el.className || "") + " " + (el.id || "");
    if (POSITIVE.test(cls)) weight += 25;
    if (NEGATIVE.test(cls)) weight -= 25;
    return weight;
  }

  function extract() {
    var doc = document;
    var url = location.href;
    var title = cleanTitle(doc);

    // Clone: extraction mutates the DOM (removes junk).
    var root = doc.documentElement.cloneNode(true);
    var body = root.querySelector("body") || root;

    // Strip obvious junk up front.
    var junk = body.querySelectorAll(
      "script, style, noscript, nav, footer, header, aside, form, button, input, " +
      "select, textarea, iframe, canvas, video, audio, [role='banner'], " +
      "[role='navigation'], [role='complementary'], [role='contentinfo'], " +
      ".ad, .ads, .advertisement, .share, .social, .newsletter, .paywall-meter, .comments"
    );
    for (var j = 0; j < junk.length; j++) {
      var p = junk[j].parentNode;
      if (p) p.removeChild(junk[j]);
    }

    // Turn divs without block children into paragraphs.
    var divs = root.querySelectorAll("div");
    for (var d = 0; d < divs.length; d++) {
      var div = divs[d];
      if (!DIV_TO_P.test(div.innerHTML)) {
        var pEl = doc.createElement("p");
        pEl.innerHTML = div.innerHTML;
        div.parentNode.replaceChild(pEl, div);
      }
    }

    // Score candidate containers.
    var paragraphs = root.querySelectorAll("p, h2, h3, pre");
    for (var i = 0; i < paragraphs.length; i++) {
      var para = paragraphs[i];
      var innerText = (para.textContent || "").trim();
      if (innerText.length < 25) continue;

      var parent = para.parentNode;
      var grandParent = parent ? parent.parentNode : null;
      if (!parent || !parent.tagName) continue;

      var score = 1;
      score += Math.min(Math.floor(innerText.length / 100), 3);
      var commas = innerText.split(",").length - 1;
      score += Math.min(commas, 3);

      function bump(node, factor) {
        if (!node || !node.tagName) return;
        if (!node.__smryxScore) node.__smryxScore = 0;
        node.__smryxScore += score * factor;
      }
      bump(parent, 1);
      bump(grandParent, 0.5);
    }

    var topCandidate = null;
    var all = root.querySelectorAll("*");
    for (var k = 0; k < all.length; k++) {
      var el = all[k];
      if (!el.__smryxScore) continue;
      var adjusted = el.__smryxScore * (1 - linkDensity(el));
      adjusted += classWeight(el);
      if (!topCandidate || adjusted > topCandidate.__smryxAdjusted) {
        topCandidate = el;
        el.__smryxAdjusted = adjusted;
      }
    }

    var text = "";
    if (topCandidate) {
      var nodes = topCandidate.querySelectorAll("p, h2, h3, li, blockquote");
      var parts = [];
      for (var n = 0; n < nodes.length; n++) {
        var t = (nodes[n].textContent || "").replace(/\s+/g, " ").trim();
        if (t.length < 20) continue;
        // Skip bylines/boilerplate inside the candidate.
        if (/^(share|subscribe|sign up|follow us|advertisement)/i.test(t)) continue;
        parts.push(t);
      }
      text = parts.join("\n\n");
    }

    // Fallbacks: <article>/<main>, then cleaned body text.
    if (text.length < CHAR_THRESHOLD) {
      var article = doc.querySelector("article, main, [role='main']");
      if (article) {
        text = (article.textContent || "").replace(/\s+/g, " ").trim();
      }
    }
    if (text.length < CHAR_THRESHOLD) {
      text = (body.textContent || "").replace(/\s+/g, " ").trim();
    }

    var wasTruncated = text.length > MAX_CHARS;
    if (wasTruncated) text = text.slice(0, MAX_CHARS);

    var excerpt = text.length > 220 ? text.slice(0, 220).trim() + "…" : text;

    return {
      title: title,
      url: url,
      text: text,
      excerpt: excerpt,
      length: text.length,
      wasTruncated: wasTruncated,
    };
  }

  // Listen for extraction requests from the background page.
  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message && message.type === "extract") {
        try {
          sendResponse({ ok: true, article: extract() });
        } catch (e) {
          sendResponse({ ok: false, error: String(e && e.message || e) });
        }
      }
      return true; // async response
    });
  }
})();

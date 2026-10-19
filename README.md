# Sumyst

Sumyst summarizes webpages, YouTube videos and PDFs using your signed-in ChatGPT session. Ask follow-up questions, or collect pages into a batch workspace with previews, saved results and portable sessions.

[Visit the Sumyst website](https://the-lucky-clover.github.io/sumyst/). The static site lives in `docs/` and publishes through `.github/workflows/pages.yml`. Onboarding uses current product screenshots instead of a video. Video and selected-text actions share the jade/violet glass surface in `shared/glass-button.css`; run `node scripts/sync-glass-button.cjs` after editing that stylesheet.

In **Settings → Popup design**, choose **City Console** for an optional 1950s-style Bakelite reading console with brass trim and tactile red controls. **Classic** remains the default. The layout preference is independent of light/dark mode and custom palettes, updates open popups immediately, and preserves summaries and question support. Run `npm run test:popup-layout` for its browser regression.

## Install in Chrome or Chromium

1. Download/clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the repository root containing `manifest.json`.
4. Sign in to [ChatGPT](https://chatgpt.com/) in the same browser, then open a webpage and click Sumyst.

The extension uses ChatGPT's web interface with automatic routing. It does not require an API key or a model selection. ChatGPT session availability and service changes can affect requests.

Long sources are processed automatically in complete sections, then combined into one summary using your prompt and selected language. Progress shows which section is being read. This covers the extracted article, available transcript, or imported text; content that the page has not loaded or made accessible is unavailable. Long sources require multiple ChatGPT requests.

## Batch workspace

Right-click the pinned extension icon to open Batch summaries, add the current tab, or summarize tabs in their browser order. Add individual pages through the page context menu; native tab-strip menus depend on browser support. The full-tab workspace includes progress, page images, two-paragraph summaries, source links, search, filters, confirmed clearing, CSV export and JSON session import/export.

Closing source tabs after successful summaries is a separate global setting and is **off by default**. A tab closes only after its completed summary has been saved. Chrome background screenshots request optional debugger permission; site preview images are available without it.

## Safari on Mac, iPhone and iPad

Use [AppleSafari](AppleSafari/README.md), the prepared macOS and iOS/iPadOS source copy. It includes native host apps, Safari extension targets, and an iOS Share-menu action. Its popup is portrait-first with responsive layouts and keyboard viewport handling. Build/sign and validate on a Mac with Xcode. `SafariPort` is the older reference port; use `AppleSafari` for the current packaging instructions.

## Usage analytics

Usage statistics are **enabled by default** unless the user has saved an opt-out. The setting is visible under **Settings → Usage analytics**; turning it off stops sends and clears local analytics identifiers. Allowlisted analytics events contain feature names/counts, a random installation ID, session ID and extension version. They exclude page URLs/text, summaries, questions, ChatGPT credentials and raw error messages.

The Cloudflare relay and GA4 property are configured through [shared/analytics-config.js](shared/analytics-config.js). The GA API secret stays in the server's private environment. See [analytics-server](analytics-server/README.md) for hosting, readiness checks, platform limitations and activation. The relay's public extension-origin allowlist must match the browser installation. Safari analytics requires additional origin support on the relay.

## Development and validation

Install Node.js 22 or newer and run:

```sh
npm install
npm test
npx playwright install chromium
npm run test:popup
npm run test:batch
npm run test:safari-mobile
```

Browser playtests use temporary profiles, controlled ChatGPT responses and, for Apple tests, mocked native approval. They do not establish live ChatGPT or native Safari compatibility. On Windows, browser playtests may require permission to launch Chromium subprocesses.

After changing the readable batch-menu source, run `node scripts/sync-batch-worker.cjs`. Refresh the Apple runtime copy with `node scripts/build-apple-safari.cjs`. Existing storage keys, batch session format identifiers, native bundle IDs and deployed relay URLs are retained for compatibility with earlier builds.

Bundled third-party license notices remain in their source files. No new license grant is implied by this repository's rename.

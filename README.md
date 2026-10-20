# Smryx

**Summarize any article in Safari, with your own AI key.**

Smryx is a macOS app + Safari Web Extension for the Mac App Store. You own
[smryx.com](https://smryx.com). This repo is the v1 scaffold: complete,
real functionality, ready to open in Xcode and build on a Mac.

---

## How it works

```
┌──────────────┐   click    ┌───────────────┐  extract  ┌────────────┐
│ Safari page  │──────────▶ │ popup (JS)    │──────────▶│ content.js │
└──────────────┘            └──────┬────────┘           │ (article)  │
                                  │ runtime message     └────────────┘
                                  ▼
                           ┌───────────────┐  sendNativeMessage
                           │ background.js │──────────────┐
                           └───────────────┘              ▼
                                        ┌──────────────────────────────┐
                                        │ SafariWebExtensionHandler    │
                                        │ (Swift, native side)         │
                                        │  • free-tier check           │
                                        │  • API key from Keychain     │
                                        │  • URLSession → user's AI    │
                                        └──────┬───────────────┬───────┘
                                               ▼               ▼
                                        user's endpoint    shared App
                                        (OpenAI-compatible   Group files
                                         or local Ollama)    (library)
```

**The privacy story, and it's a real one:**

- There is **no Smryx server**. Nothing to deploy, nothing collecting data.
- Summaries are **BYOK** (bring your own key): the user pastes an
  OpenAI-compatible API key in Settings. It is stored **only in the Mac
  Keychain** — never in UserDefaults, never in a file, never in JavaScript.
  The native Swift handler makes the API call; the key never enters the
  web extension's JS at all.
- **Ollama** is supported as a fully local path (no key, no network beyond
  `localhost`).
- Saved summaries live as JSON files in the shared App Group container on
  the user's own Mac.

## The flow

1. Toolbar button → popup opens → popup asks the native side for status
   (key present? Pro? free summaries left?) and says so plainly.
2. Background page asks the content script to extract the article
   (Readability-style scoring, see below) from the active tab.
3. Native handler checks the free tier, then calls the configured endpoint
   (`POST {endpoint}/chat/completions`) with Short / Medium / Long
   instructions.
4. Popup shows the summary with **Copy** and **Save to library**. Saved
   summaries show up in the Mac app.

## Article extraction

`content/content.js` is an **original implementation of the classic
Arc90-style readability algorithm**: paragraph scoring by text length and
comma density, propagated to parent/grandparent containers, weighted by
class/id name heuristics, multiplied by (1 − link density). Junk subtrees
(nav, footer, ads, share widgets, comments) are stripped first; there are
`<article>`/`<main>` and cleaned-body fallbacks. Extraction caps the text
at `AppConfig.maxArticleCharacters` (24,000) and the popup tells the user
when an article was truncated — no silent cuts.

*Future swap:* Mozilla's `Readability.js` (Apache 2.0) can replace the
extractor without changing the message contract.

## Monetization — PROVISIONAL, all in one file

Everything money-related reads from **`Smryx/Config/Monetization.swift`**:

| Setting | Provisional value | Notes |
|---|---|---|
| Free tier | **10 summaries / month** | Steven's call to change |
| Monthly product | `com.luckyclover.smryx.pro.monthly` | Create in App Store Connect at **$4.99/mo** |
| Yearly product | `com.luckyclover.smryx.pro.yearly` | Create in App Store Connect at **$39.99/yr** |
| Subscription group | `Smryx Pro` | |

Honesty rules baked in:

- Prices are displayed from StoreKit (`product.displayPrice`) — **never
  hard-coded**.
- If the products don't exist in App Store Connect yet, the paywall says
  "Pro isn't available yet" instead of showing fake buttons.
- No countdowns, no fake urgency, no dark patterns. Restore Purchases is
  implemented (Apple requires it).

## Config — also provisional, also in one place

**`Smryx/Config/AppConfig.swift`** holds the AI defaults: endpoint
(`https://api.openai.com/v1`), Ollama endpoint (`http://localhost:11434/v1`),
default model (`gpt-4o-mini`), model presets, and the 24,000-character
article cap. Users can change endpoint and model freely in Settings.

## Project layout

```
Smryx.xcodeproj/                  Xcode project (2 targets, shared scheme "Smryx")
Smryx/                            macOS app target (bundle com.luckyclover.smryx)
  SmryxApp.swift                  @main SwiftUI app
  Config/Monetization.swift       ★ provisional pricing & free tier
  Config/AppConfig.swift          ★ provisional AI defaults
  Models/SavedSummary.swift       shared with the extension
  Services/SharedConstants.swift  App Group / bundle IDs (shared)
  Services/KeychainHelper.swift   API key in Keychain (shared)
  Services/UsageTracker.swift     free-tier counter + settings (shared)
  Services/LibraryStore.swift     saved summaries in App Group files (shared)
  Services/SummarizerClient.swift OpenAI-compatible client (shared)
  Services/StoreManager.swift     StoreKit 2 (app only)
  Views/                            ContentView, Library, Settings, Paywall,
                                    Onboarding, GlassCard (glass house look)
  Assets.xcassets/                App icon (generated "Sx" mark) + accent color
  Smryx.entitlements              App Groups + Keychain Sharing + sandbox
Smryx Extension/                  Safari extension appex (bundle …smryx.extension)
  SafariWebExtensionHandler.swift native message handler (getStatus /
                                  summarize / saveSummary)
  Resources/manifest.json         Manifest V2 (Apple's supported template shape)
  Resources/popup/                popup.html / .css / .js — plain system UI, fast
  Resources/content/content.js    article extractor
  Resources/background/           summarize orchestrator
  Resources/icons/                toolbar icons 16–128
BUILD_GUIDE.md                    baby-steps build & submit guide
```

Shared Swift files are compiled into **both** targets (target membership in
the project), so the app and the extension can never drift apart.

## Honest limitations (v1)

- **Built but not compiled here.** This scaffold was written and statically
  checked on Linux (JSON/XML valid, JS syntax-checked, project cross-refs
  verified). There is no Xcode on this machine — **the first compile happens
  on Steven's Mac** (BUILD_GUIDE.md, Part 4). Treat any first-build error as
  expected; the guide says what to send back.
- **Bundle ID `com.luckyclover.smryx` is a suggestion in code only.**
  Nothing has been registered anywhere. If it's taken, that's a
  10-minute fix in one config file + the project settings.
- **Signing needs Steven's Apple Developer Team** (Xcode → Settings →
  Accounts). Until he picks a team, the project can't run or archive.
- **The free-tier counter lives on one Mac.** No server = no cross-device
  sync and no server-side enforcement; a determined user could reset local
  defaults. Acceptable for v1 BYOK; noted, not hidden.
- **Paywall can't be end-to-end tested** until the two subscription
  products exist in App Store Connect and a build is uploaded (StoreKit
  sandbox). The code path is complete; the store side is Steven's clicks.
- **Manifest V2** is used because that's the shape Apple's own Safari
  extension templates ship and it is fully supported by current Safari.
  MV3 migration is a later cleanup, not a v1 blocker.
- Articles only in v1. PDFs and YouTube transcripts are v2 candidates.
- The App Group + Keychain Sharing capabilities must be added in Xcode
  (the entitlements files already declare them; BUILD_GUIDE.md Part 3
  walks through the clicks so Xcode registers them with the team).

## Why BYOK instead of a cloud tier

No server to run, no API bill for us, no user data to protect, and the app
works the moment it builds. The tradeoff — users bring a key — is stated
honestly in onboarding. A hosted tier can come later if the product earns it.

# Sumyst — macOS Safari and iOS/iPadOS Safari

This is a separate, self-contained Apple source copy of extension version **1.9.9**. The existing Chrome project and older `SafariPort` folder are preserved. This is **not a signed `.app` or `.ipa`**: Apple SDK compilation, signing and real Safari/device testing must be completed on a Mac with Xcode. No Apple Developer account credentials are included.

## What is included

- Complete current web-extension resources, including Settings, shared JS chunks, streaming summaries, Ask question, batch results/import/export, themes, text sizing, and the intermittent header reflection.
- A macOS app and Safari web extension, plus an iPhone/iPad app, Safari web extension, and native iOS Share extension. Minimum deployment targets: **macOS 14** and **iOS/iPadOS 17**.
- Safari toolbar/page-menu activation. The toolbar popover has its own startup handshake; it does not rely on the Chrome in-page iframe parent.
- An iOS Safari **Share → Sumyst → Open summary in Safari** path. The Share extension returns to the original page via Safari's JavaScript finalization hook. It uses an expiring, single-use native token in an App Group before the content script can open the panel. Page content is extracted and summarized by the existing web extension after returning to Safari, rather than running a long inference inside the Share extension.
- Portrait-first mobile styling: stacked header at narrow widths, 44-pixel touch targets, system-font reading text, safe-area margins, bounded text-size popover, scrolling content, landscape/iPad expansion and Visual Viewport handling for the on-screen keyboard.

## Build on your Mac

1. Install full **Xcode**, launch it once, and select it in Xcode → Settings → Locations → Command Line Tools.
2. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen` (if Homebrew is available).
3. Copy/unzip this entire `AppleSafari` folder onto the Mac. In Terminal, change into it and run:

   ```sh
   sh prepare-mac.sh
   open SumystSafari.xcodeproj
   ```

   The script generates the Xcode project from the included `project.json`. The prepared `WebExtension` folder is already included; Node is not needed just to build this copy on the Mac.

4. In **Signing & Capabilities**, select your Development Team for all five targets. Review the bundle identifiers. If they are unavailable in your account, change their prefixes consistently; the extension bundle IDs must start with their containing app's ID. If changing the Mac extension's identifier, also update the identifier in `Native/App/ContentView.swift` used by the Open Settings button.
5. Register/enable App Groups and use the same **`group.com.luckyclover.chatgptbeastmode`** group in the iOS app, Safari extension, and Share extension. The matching entitlements and `BeastModeAppGroup` Info values are supplied. If your team needs another group, update `Native/iOS.entitlements`, `Native/macOS.entitlements`, and the three extension Info property dictionaries in `project.json`, then regenerate. Provisioning profiles must authorize your actual group. A group container synchronizes these components **on the same device**; this is not iCloud sync between devices.
6. Select **Sumyst macOS** with **My Mac**, or **Sumyst iOS** with an iPhone/iPad simulator or connected device, then Run. Trust/sign the development app on a physical device as required by Xcode.

XcodeGen embeds the correct extensions into each host app. The web-extension targets copy the complete `WebExtension` directory into their bundle resource roots before signing, preserving all relative import paths. Release distribution also needs App Icons, signing/provisioning, native device validation and App Store metadata/privacy details; these sources are not an App Store submission.

## Enable and use

**Mac:** Run the app, open Safari → Settings → Extensions, enable Sumyst, and grant website access. Open ChatGPT in Safari and sign in. Visit an article and click Sumyst in the Safari toolbar.

**iPhone/iPad:** Run the app, open Settings → Apps → Safari → Extensions (Settings → Safari on older iOS), enable Sumyst, and allow website access. Sign in to ChatGPT in Safari. Use Safari's page menu → Extensions → Sumyst. For Share activation, tap Safari **Share → Sumyst → Open summary in Safari**; add Sumyst under More/Edit Actions if necessary. Enable the Safari extension before using its Share action.

The Share action needs a regular Safari webpage so Safari can run the preprocessing/finalization scripts. Sharing a bare URL from another app displays instructions to open the page in Safari; it does not pretend to launch a Safari extension from that app. macOS activation uses Safari's toolbar, not the iOS-only finalization hook.

If the page navigates while the share sheet is open, the old request does not open on the new page. Restricted browser pages cannot be summarized. Website access must include the source page and ChatGPT. Session/cookie behavior and production ChatGPT inference still require validation in actual Safari.

## Platform differences

- Safari uses a nonpersistent classic background script. The Chrome `importScripts` worker entry is adapted, and all its dependencies are loaded in manifest order. The complete Settings/chunk assets missing in the old port are present here.
- No Chrome `debugger` screenshot permission is requested. Batch results use site preview images in Safari. YouTube captions use content-script discovery rather than Chrome's network interception; verify caption availability on real Safari.
- iOS has no desktop tab-strip/extension-icon context menus or browser-window focus operation. The popup and full-tab batch controls remain available. Keep the batch tab open and Safari active while it runs; iOS can suspend background apps/tabs.
- GA property/configuration and the analytics default/opt-out are copied. The currently deployed relay allowlist is configured for the Chrome installation, not Safari's extension origins. Apple analytics routing needs a Safari-aware relay allowlist before collecting events; do not infer that a Settings toggle means GA accepted an event. This copy does not embed a GA API secret or send page content through analytics.

## Refresh from the Chrome working tree

On the development machine, run `node scripts/build-apple-safari.cjs` from the project root. It copies only runtime assets, applies the Safari adapters, and records the source worker hash in `COPY_INFO.json`. It does not copy `.git`, server secrets or test profiles. Keep native changes in `Native`, compatibility changes in `Adapters`, and project configuration in `project.json`; direct edits inside `WebExtension` are overwritten on the next refresh. Clean/rebuild in Xcode after removing or renaming runtime assets so stale bundle resources do not remain.

## Validation performed here

- Native Swift files pass the Swift parser. They have **not** been type-checked against Apple SDKs, signed, or installed on an Apple device.
- `node --test --test-isolation=none tests/apple-safari.test.cjs` checks project targets, resource/import completeness, share-message validation and toolbar startup.
- `node tests/apple-safari-mobile.cjs` loads the copied runtime in a temporary Chromium fixture with controlled ChatGPT responses and mocked native approval. It checks the in-page Share handoff, 320×568, 375×667, 390×844, 430×932, 844×390 and 768×1024 layouts, 44-pixel header targets, popover bounds, 130% text at 320px, dark mode, a simulated keyboard viewport and standalone toolbar startup. This is not a native Safari Share-sheet test.

Before distributing, test both activation paths, source extraction/ChatGPT login, summaries/questions, theme/text size, batch persistence, rotation, actual keyboard/notch behavior, Dynamic Type/VoiceOver, permission denial and Share cancellation on real Mac/iPhone/iPad hardware. Run real inferences with your own signed-in Safari session. A native Share target and registered App Group cannot be validated from Windows.

Apple references: [Safari web extensions](https://developer.apple.com/safari/extensions/), [Share preprocessing and iOS finalization](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html), [native messaging](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension).

# Safari Web Extension Port - Complete Setup Guide

## 📁 Project Structure Created

```
SafariPort/
├── SummarizeSafari/                    # Host App (SwiftUI)
│   ├── SummarizeSafariApp.swift
│   ├── ContentView.swift
│   ├── Info.plist
│   └── SummarizeSafari.entitlements
├── SummarizeSafariExtension/           # Safari Web Extension
│   ├── SafariWebExtensionHandler.swift
│   ├── Info.plist
│   ├── SummarizeSafariExtension.entitlements
│   └── Resources/
│       ├── manifest.json
│       ├── _locales/en/messages.json
│       ├── popup/          (copy from ChatGPT-Beast-Mode-Dev/popup/)
│       ├── content-script/ (copy from ChatGPT-Beast-Mode-Dev/content-script/)
│       ├── background/     (copy from ChatGPT-Beast-Mode-Dev/background/)
│       ├── shared/         (copy from ChatGPT-Beast-Mode-Dev/shared/)
│       ├── _locales/       (copy from ChatGPT-Beast-Mode-Dev/_locales/)
│       └── icons/          (logo-16.png, 32.png, 48.png, 128.png)
├── SummarizeSafariShareExtension/      # iOS Share Sheet
│   ├── ShareViewController.swift
│   ├── ShareViewController.storyboard
│   ├── Info.plist
│   └── SummarizeSafariShareExtension.entitlements
```

## 🚀 Xcode Setup Steps

### 1. Create Project
```
File → New → Project → macOS → App
Product Name: SummarizeSafari
Team: (your Apple ID)
Org Identifier: com.stevenpounds
Bundle ID: com.stevenpounds.summarizesafari
Interface: SwiftUI
Language: Swift
Testing: None
Storage: None
CloudKit: Unchecked
```

### 2. Add Safari Web Extension Target
```
File → New → Target → macOS → Safari Web Extension
Product Name: SummarizeSafariExtension
Target Embedded In: SummarizeSafari
```

### 3. Add iOS Share Extension Target
```
File → New → Target → iOS → Share Extension
Product Name: SummarizeSafariShareExtension
Target Embedded In: SummarizeSafari
```

### 4. Copy Resources
Drag these folders into **SummarizeSafariExtension/Resources/** in Xcode:
- `popup/` (from ChatGPT-Beast-Mode-Dev/popup/)
- `content-script/` (from ChatGPT-Beast-Mode-Dev/content-script/)
- `background/` (from ChatGPT-Beast-Mode-Dev/background/)
- `shared/` (from ChatGPT-Beast-Mode-Dev/shared/)
- `_locales/` (from ChatGPT-Beast-Mode-Dev/_locales/)
- `icons/` (logo-16.png, logo-32.png, logo-48.png, logo-128.png)

**Important**: Select all copied files → File Inspector → Target Membership → ✅ SummarizeSafariExtension

### 5. Configure Signing & Capabilities
**All targets** (SummarizeSafari, SummarizeSafariExtension, SummarizeSafariShareExtension):
- Signing & Capabilities → Automatically manage signing ✅
- + Capability → App Groups → `group.com.stevenpounds.summarizesafari`

### 6. Build & Test
- **macOS**: Product → Run (⌘R) → Safari opens with extension
- **iOS**: Select iPhone simulator → Run → Safari → Share Sheet → "SmryX"

## 🔑 Key Features Implemented

| Feature | Implementation |
|---------|----------------|
| **Popup Summarization** | SafariWebExtensionHandler bridges JS ↔ Swift |
| **YouTube Captions** | Native Swift fetch via `ytInitialPlayerResponse` parsing |
| **iOS Share Sheet** | ShareViewController extracts URL/text → deep link to extension |
| **Cross-platform Sync** | App Groups for shared settings/history |
| **Universal Purchase** | Single bundle ID for macOS + iOS |

## 🎯 Share Sheet Flow (iOS)

1. User visits webpage in Safari
2. Tap Share → "SmryX"
3. ShareViewController extracts URL
4. Opens `summarizesafari://summarize?url=...` 
5. Host app handles deep link → opens extension popup with page pre-loaded

## 📝 Deep Link Handler (Add to SummarizeSafariApp.swift)

```swift
import SwiftUI

@main
struct SummarizeSafariApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }
    
    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "summarizesafari",
              url.host == "summarize",
              let query = url.query,
              let urlParam = query.split(separator: "&").first(where: { $0.hasPrefix("url=") }),
              let encodedURL = queryParam.split(separator: "=").last,
              let pageURL = encodedURL.removingPercentEncoding else { return }
        
        // Notify extension to open with this URL
        NotificationCenter.default.post(name: .openSummarizePopup, object: pageURL)
    }
}

extension Notification.Name {
    static let openSummarizePopup = Notification.Name("openSummarizePopup")
}
```

## 📦 Build for App Store

1. **Archive** → Distribute App → App Store Connect
2. **Universal Purchase**: Enable in App Store Connect → Features → Universal Purchase
3. **In-App Purchases** (if monetizing):
   - `pro_monthly` ($3.99/mo, auto-renewable)
   - `pro_yearly` ($29.99/yr, auto-renewable)  
   - `pro_lifetime` ($69.99, non-consumable)
4. **TestFlight** → Internal → External (10k testers)
5. **Submit for Review** → 24-48hrs typical

## ✅ Checklist

- [ ] Create Xcode project with 3 targets
- [ ] Copy all MV3 resources to Resources/
- [ ] Set Target Membership on all resource files
- [ ] Configure App Groups on all targets
- [ ] Add deep link handling to host app
- [ ] Test on macOS Safari
- [ ] Test on iOS Safari + Share Sheet
- [ ] Archive & upload to App Store Connect
- [ ] Configure Universal Purchase
- [ ] Submit for Review

## 🎨 Assets Needed

Copy from existing project:
- `logo-16.png`, `logo-32.png`, `logo-48.png`, `logo-128.png` → `Resources/icons/`
- App Icon set (1024x1024) → `Assets.xcassets/AppIcon.appiconset/`

---

**All source files are in `C:\Users\lbs1\ChatGPT-Beast-Mode-Dev\SafariPort\`** — copy this folder to your Mac and open in Xcode.
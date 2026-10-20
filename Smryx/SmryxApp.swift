import SwiftUI

/// Smryx — the Mac app half of the product. The Safari extension (Smryx
/// Extension target) does the page work; this app owns Settings (your API
/// key), the saved-summary library, onboarding, and the Pro paywall.
@main
struct SmryxApp: App {

    @StateObject private var store = StoreManager()
    @AppStorage("smryx.hasOnboarded") private var hasOnboarded = false

    var body: some Scene {
        WindowGroup {
            if hasOnboarded {
                ContentView()
                    .environmentObject(store)
            } else {
                OnboardingView()
            }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 860, height: 620)
    }
}

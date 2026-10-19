import SwiftUI

@main
struct BeastModeApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
        #if os(macOS)
        .windowResizability(.contentSize)
        #endif
    }
}

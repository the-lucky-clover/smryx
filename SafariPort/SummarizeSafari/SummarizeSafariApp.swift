// SummarizeSafariApp.swift
// Main entry point for macOS/iOS host app

import SwiftUI

@main
struct SummarizeSafariApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
    }
}
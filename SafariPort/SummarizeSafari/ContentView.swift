// ContentView.swift
// Minimal host app UI - just a preferences window

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "safari.fill")
                .font(.system(size: 60))
                .foregroundStyle(.green)
            
            Text("SmryX")
                .font(.title)
                .fontWeight(.bold)
            
            Text("AI-powered summarization for Safari")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            Divider()
            
            VStack(alignment: .leading, spacing: 12) {
                Label("Enable in Safari → Settings → Extensions", systemImage: "1.circle.fill")
                Label("Allow access to websites you visit", systemImage: "2.circle.fill")
                Label("Use Share Sheet → Summarize on iOS", systemImage: "3.circle.fill")
            }
            .font(.callout)
            
            Spacer()
            
            Link("Privacy Policy", destination: URL(string: "https://the-lucky-clover.github.io/chatgpt-beast-mode/privacy")!)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(30)
        .frame(width: 400, height: 400)
    }
}
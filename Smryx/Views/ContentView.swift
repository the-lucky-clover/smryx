import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: StoreManager
    @State private var showingPaywall = false

    var body: some View {
        TabView {
            LibraryView()
                .tabItem { Label("Library", systemImage: "books.vertical") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if store.isPro {
                    Label("Pro", systemImage: "crown.fill")
                        .foregroundStyle(.yellow)
                } else {
                    Button("Go Pro") { showingPaywall = true }
                }
            }
        }
        .sheet(isPresented: $showingPaywall) {
            PaywallView()
                .environmentObject(store)
        }
        .task {
            await store.loadProducts()
            await store.refreshEntitlements()
        }
    }
}

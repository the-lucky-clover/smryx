import SwiftUI

/// Settings: provider, endpoint, model, API key (Keychain), usage, Pro,
/// and the honest "about" block.
struct SettingsView: View {
    @EnvironmentObject var store: StoreManager
    @State private var showingPaywall = false

    @State private var provider: AIProvider = SharedSettings.provider
    @State private var endpoint: String = SharedSettings.endpoint
    @State private var model: String = SharedSettings.model
    @State private var apiKeyInput: String = ""
    @State private var keySaved: Bool = KeychainHelper.hasAPIKey
    @State private var savedFlash = false

    private var tracker: UsageTracker { .shared }

    var body: some View {
        Form {
            Section("AI provider") {
                Picker("Provider", selection: $provider) {
                    ForEach(AIProvider.allCases) { p in
                        Text(p.displayName).tag(p)
                    }
                }
                .onChange(of: provider) { newValue in
                    SharedSettings.provider = newValue
                    // Sensible endpoint defaults; the field below stays editable.
                    if newValue == .ollama {
                        endpoint = AppConfig.ollamaEndpoint
                        SharedSettings.endpoint = endpoint
                    } else if endpoint == AppConfig.ollamaEndpoint {
                        endpoint = AppConfig.defaultEndpoint
                        SharedSettings.endpoint = endpoint
                    }
                }

                TextField("API endpoint", text: $endpoint)
                    .onSubmit(saveEndpoint)
                    .onChange(of: endpoint) { _ in saveEndpoint() }
                Text(endpointHint)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Picker("Model", selection: $model) {
                    ForEach(AppConfig.modelPresets, id: \.self) { preset in
                        Text(preset).tag(preset)
                    }
                    if !AppConfig.modelPresets.contains(model) {
                        Text(model).tag(model)
                    }
                }
                TextField("Or type any model your endpoint serves", text: $model)
                    .onSubmit { SharedSettings.model = model }
                    .onChange(of: model) { _ in SharedSettings.model = model }
            }

            Section("API key") {
                if provider.requiresAPIKey {
                    SecureField("Paste your API key", text: $apiKeyInput)
                    HStack {
                        Button("Save key to Keychain") {
                            KeychainHelper.saveAPIKey(apiKeyInput)
                            apiKeyInput = ""
                            keySaved = KeychainHelper.hasAPIKey
                            savedFlash = true
                        }
                        .disabled(apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        if keySaved {
                            Text(savedFlash ? "Saved ✓" : "Key stored ✓")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                        Spacer()
                        Button("Remove key", role: .destructive) {
                            KeychainHelper.deleteAPIKey()
                            keySaved = false
                        }
                        .disabled(!keySaved)
                    }
                    Text("Stored only in your Mac's Keychain. Never leaves your Mac except to the endpoint above, inside your own summarize requests.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Ollama runs on this Mac — no API key needed. Make sure Ollama is running (ollama serve) with a model pulled.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Usage") {
                HStack {
                    Text("This month")
                    Spacer()
                    Text(usageLine)
                        .foregroundStyle(.secondary)
                }
                Text("Free tier resets on the 1st of each month.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Smryx Pro") {
                HStack {
                    Text("Status")
                    Spacer()
                    Text(store.isPro ? "Pro ✓" : "Free")
                        .foregroundStyle(store.isPro ? .green : .secondary)
                }
                if !store.isPro {
                    Button("See Pro options") { showingPaywall = true }
                }
                Button("Restore purchases") {
                    Task { await store.restore() }
                }
            }

            Section("About") {
                Text("Smryx has no server. Summaries are made by the AI service you configure, with your key, on your Mac. Saved summaries live in this Mac's shared app container.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack {
                    Text("Version")
                    Spacer()
                    Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Settings")
        .sheet(isPresented: $showingPaywall) {
            PaywallView().environmentObject(store)
        }
        .task {
            await store.refreshEntitlements()
        }
    }

    private var endpointHint: String {
        provider == .ollama
            ? "Ollama's OpenAI-compatible endpoint. Default: \(AppConfig.ollamaEndpoint)"
            : "Any OpenAI-compatible /chat/completions endpoint. Default: \(AppConfig.defaultEndpoint)"
    }

    private var usageLine: String {
        if store.isPro { return "Unlimited (Pro)" }
        return "\(tracker.usedThisMonth) of \(Monetization.freeSummariesPerMonth) free used"
    }

    private func saveEndpoint() {
        let trimmed = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            SharedSettings.endpoint = trimmed
        }
    }
}

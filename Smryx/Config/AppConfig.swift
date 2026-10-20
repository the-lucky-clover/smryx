import Foundation

// ─────────────────────────────────────────────────────────────────────────────
//  Smryx AI configuration — PROVISIONAL defaults, Steven's to change.
//
//  Smryx is bring-your-own-key (BYOK). There is no Smryx server. The
//  extension asks the native side to call the endpoint configured here with
//  the API key the user saved in Settings (stored in the Keychain, never in
//  this file, never in UserDefaults).
// ─────────────────────────────────────────────────────────────────────────────

enum AppConfig {

    /// Default OpenAI-compatible endpoint (no trailing slash).
    static let defaultEndpoint = "https://api.openai.com/v1"

    /// Local Ollama endpoint (OpenAI-compatible). No API key required.
    static let ollamaEndpoint = "http://localhost:11434/v1"

    /// Default model name sent to the endpoint.
    static let defaultModel = "gpt-4o-mini"

    /// Presets offered in Settings. The field is free text — any model the
    /// user's endpoint serves will work.
    static let modelPresets = [
        "gpt-4o-mini",
        "gpt-4o",
        "gpt-4.1-mini",
        "llama3.1",
        "qwen2.5",
    ]

    /// Hard cap on extracted article characters sent to the model.
    /// Anything longer is truncated (the popup tells the user when it happens).
    static let maxArticleCharacters = 24_000
}

/// Which provider the user picked in Settings. Raw values are what gets
/// stored in the shared UserDefaults.
enum AIProvider: String, CaseIterable, Identifiable {
    case openAICompatible = "openai"
    case ollama = "ollama"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .openAICompatible: return "OpenAI-compatible API"
        case .ollama: return "Ollama (local, on this Mac)"
        }
    }

    /// Whether this provider requires an API key.
    var requiresAPIKey: Bool {
        switch self {
        case .openAICompatible: return true
        case .ollama: return false
        }
    }
}

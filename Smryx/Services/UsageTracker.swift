import Foundation

/// Tracks the free-tier summary count and the cached Pro entitlement in the
/// shared App Group defaults, so the app and the extension's native handler
/// always agree. The count rolls over on the 1st of each calendar month.
final class UsageTracker {

    static let shared = UsageTracker()

    private let defaults: UserDefaults

    init() {
        // Falls back to standard defaults if the App Group isn't configured
        // yet — the app still runs, the extension just won't see the same
        // numbers until the capability is added (BUILD_GUIDE.md, Step 6).
        defaults = UserDefaults(suiteName: SharedConstants.appGroupID) ?? .standard
    }

    // MARK: - Month handling

    private var currentMonth: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    private func rollMonthIfNeeded() {
        if defaults.string(forKey: SharedDefaultsKey.usageMonth) != currentMonth {
            defaults.set(currentMonth, forKey: SharedDefaultsKey.usageMonth)
            defaults.set(0, forKey: SharedDefaultsKey.usageCount)
        }
    }

    // MARK: - Usage

    var usedThisMonth: Int {
        rollMonthIfNeeded()
        return defaults.integer(forKey: SharedDefaultsKey.usageCount)
    }

    var remainingFree: Int {
        max(0, Monetization.freeSummariesPerMonth - usedThisMonth)
    }

    func recordSummary() {
        rollMonthIfNeeded()
        defaults.set(usedThisMonth + 1, forKey: SharedDefaultsKey.usageCount)
    }

    // MARK: - Pro entitlement (cached by StoreManager in the app)

    var isPro: Bool {
        get { defaults.bool(forKey: SharedDefaultsKey.isPro) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.isPro) }
    }

    var canSummarize: Bool { isPro || remainingFree > 0 }
}

/// The user's AI settings, stored in the shared defaults (endpoint + model
/// are not secrets; the API key is, and lives in the Keychain instead).
enum SharedSettings {

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: SharedConstants.appGroupID) ?? .standard
    }

    static var provider: AIProvider {
        get {
            AIProvider(rawValue: defaults.string(forKey: SharedDefaultsKey.settingsProvider) ?? "") ?? .openAICompatible
        }
        set { defaults.set(newValue.rawValue, forKey: SharedDefaultsKey.settingsProvider) }
    }

    static var endpoint: String {
        get {
            let saved = defaults.string(forKey: SharedDefaultsKey.settingsEndpoint) ?? ""
            return saved.isEmpty ? AppConfig.defaultEndpoint : saved
        }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.settingsEndpoint) }
    }

    static var model: String {
        get {
            let saved = defaults.string(forKey: SharedDefaultsKey.settingsModel) ?? ""
            return saved.isEmpty ? AppConfig.defaultModel : saved
        }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.settingsModel) }
    }
}

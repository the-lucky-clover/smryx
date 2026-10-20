import Foundation

/// Identifiers shared by the Smryx app and its Safari extension.
/// If the bundle ID ever changes, it changes HERE and in the Xcode project —
/// nowhere else.
enum SharedConstants {
    /// App Group both targets belong to. Must match the App Groups capability
    /// added to BOTH targets in Xcode (see BUILD_GUIDE.md).
    static let appGroupID = "group.com.luckyclover.smryx"

    static let appBundleID = "com.luckyclover.smryx"
    static let extensionBundleID = "com.luckyclover.smryx.extension"
}

/// Keys for the App Group UserDefaults suite, shared app ↔ extension.
enum SharedDefaultsKey {
    static let usageCount = "usage.count"
    static let usageMonth = "usage.month"
    static let isPro = "entitlement.isPro"
    static let settingsEndpoint = "settings.endpoint"
    static let settingsModel = "settings.model"
    static let settingsProvider = "settings.provider"
}

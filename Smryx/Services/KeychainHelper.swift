import Foundation
import Security

/// Stores the user's AI API key in the Keychain — the only place it ever
/// lives. Both the app (Settings) and the extension's native handler use this
/// helper, and both processes share one keychain access group (granted by the
/// Keychain Sharing capability in Xcode, see BUILD_GUIDE.md), so a key saved
/// in the app is readable by the extension.
///
/// The API key is NEVER written to UserDefaults, a file, or a log.
enum KeychainHelper {

    private static let service = "com.luckyclover.smryx.apikey"
    private static let account = "ai-api-key"

    // MARK: - Access group

    /// The current process's first keychain access group. With the Keychain
    /// Sharing capability set to the shared group on both targets, this is
    /// that shared group for both processes. Discovered via a probe item so
    /// no team prefix is ever hard-coded.
    private static let accessGroup: String = {
        let probeAccount = "smryx-access-group-probe"
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: probeAccount,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        var status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            query[kSecValueData as String] = Data([0])
            SecItemAdd(query as CFDictionary, nil)
            query.removeValue(forKey: kSecValueData as String)
            status = SecItemCopyMatching(query as CFDictionary, &item)
        }
        if status == errSecSuccess,
           let attrs = item as? [String: Any],
           let group = attrs[kSecAttrAccessGroup as String] as? String {
            return group
        }
        return ""
    }()

    private static func baseQuery() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if !accessGroup.isEmpty {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }

    // MARK: - Public API

    static func saveAPIKey(_ key: String) {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            deleteAPIKey()
            return
        }
        var query = baseQuery()
        let data = Data(trimmed.utf8)
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecSuccess {
            SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        } else {
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(query as CFDictionary, nil)
        }
    }

    static func apiKey() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let key = String(data: data, encoding: .utf8),
              !key.isEmpty else {
            return nil
        }
        return key
    }

    static var hasAPIKey: Bool { apiKey() != nil }

    static func deleteAPIKey() {
        SecItemDelete(baseQuery() as CFDictionary)
    }
}

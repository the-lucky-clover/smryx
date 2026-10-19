import Foundation

enum ShareRequestError: Error { case unavailable, invalid }

enum ShareRequestStore {
    private struct Request: Codable { let url: String; let createdAt: Date }

    private static func directory() throws -> URL {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "BeastModeAppGroup") as? String,
              let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            throw ShareRequestError.unavailable
        }
        let folder = root.appendingPathComponent("ShareRequests", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    static func issue(for url: URL) throws -> String {
        guard ["http", "https"].contains(url.scheme?.lowercased() ?? ""), url.host != nil,
              url.user == nil, url.password == nil else { throw ShareRequestError.invalid }
        let folder = try directory()
        // Expire abandoned requests. Page contents and credentials are never stored.
        for file in (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            if let date = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
               Date().timeIntervalSince(date) > 300 { try? FileManager.default.removeItem(at: file) }
        }
        let token = UUID().uuidString
        let data = try JSONEncoder().encode(Request(url: url.absoluteString, createdAt: Date()))
        try data.write(to: folder.appendingPathComponent(token + ".json"), options: .atomic)
        return token
    }

    static func consume(token: String, url: String) -> Bool {
        guard let identifier = UUID(uuidString: token), let folder = try? directory() else { return false }
        let source = folder.appendingPathComponent(identifier.uuidString + ".json")
        let claimed = folder.appendingPathComponent(UUID().uuidString + ".claimed")
        // An atomic rename prevents concurrent native requests reusing one token.
        do { try FileManager.default.moveItem(at: source, to: claimed) } catch { return false }
        defer { try? FileManager.default.removeItem(at: claimed) }
        guard let data = try? Data(contentsOf: claimed),
              let request = try? JSONDecoder().decode(Request.self, from: data), request.url == url else { return false }
        let age = Date().timeIntervalSince(request.createdAt)
        return age >= -5 && age <= 300
    }
}

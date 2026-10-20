import Foundation

/// The saved-summary library: one JSON file per summary inside a "Summaries"
/// folder in the shared App Group container, so the extension can save and
/// the app can browse/search/delete.
final class LibraryStore {

    static let shared = LibraryStore()

    private let fileManager = FileManager.default

    private var directory: URL {
        let base = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: SharedConstants.appGroupID
        ) ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Summaries", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private var encoder: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }

    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    // MARK: - CRUD

    func all() -> [SavedSummary] {
        guard let files = try? fileManager.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil
        ) else { return [] }
        let summaries = files
            .filter { $0.pathExtension == "json" }
            .compactMap { url -> SavedSummary? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? decoder.decode(SavedSummary.self, from: data)
            }
        return summaries.sorted { $0.createdAt > $1.createdAt }
    }

    @discardableResult
    func save(_ summary: SavedSummary) -> Bool {
        let url = directory.appendingPathComponent("\(summary.id.uuidString).json")
        guard let data = try? encoder.encode(summary) else { return false }
        return (try? data.write(to: url, options: .atomic)) != nil
    }

    func delete(id: UUID) {
        let url = directory.appendingPathComponent("\(id.uuidString).json")
        try? fileManager.removeItem(at: url)
    }
}

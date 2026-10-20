import Foundation

/// One saved summary in the library. Stored as its own JSON file in the
/// shared App Group container so both the app and the extension can read it.
struct SavedSummary: Codable, Identifiable, Equatable {
    var id: UUID
    var title: String
    var url: String
    var summary: String
    /// "short" | "medium" | "long"
    var length: String
    /// The model that produced it, e.g. "gpt-4o-mini".
    var model: String
    var createdAt: Date

    init(id: UUID = UUID(),
         title: String,
         url: String,
         summary: String,
         length: String,
         model: String,
         createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.url = url
        self.summary = summary
        self.length = length
        self.model = model
        self.createdAt = createdAt
    }
}

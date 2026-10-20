import Foundation

/// Summary length options the user picks in the extension popup.
enum SummaryLength: String, CaseIterable {
    case short
    case medium
    case long

    var displayName: String {
        switch self {
        case .short: return "Short"
        case .medium: return "Medium"
        case .long: return "Long"
        }
    }

    /// The instruction the model receives for each length.
    var instruction: String {
        switch self {
        case .short:
            return "Summarize in 2–4 sentences, about 60 words. Just the essentials."
        case .medium:
            return "Summarize in about 150–200 words: a short paragraph followed by the key points as bullets."
        case .long:
            return "Summarize thoroughly in about 300–400 words with clear sections: overview, key points (bullets), and takeaway."
        }
    }
}

enum SummarizerError: LocalizedError {
    case missingAPIKey
    case emptyArticle
    case http(status: Int, body: String)
    case badResponse(String)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "No API key saved. Open the Smryx app → Settings and add your API key first."
        case .emptyArticle:
            return "No article text was extracted from this page. Try a different page."
        case .http(let status, let body):
            return "The AI service returned an error (HTTP \(status)): \(body.prefix(220))"
        case .badResponse(let detail):
            return "The AI service sent back an unreadable response: \(detail)"
        case .transport(let error):
            return "Couldn't reach the AI service: \(error.localizedDescription)"
        }
    }
}

/// Calls an OpenAI-compatible chat-completions endpoint with the user's own
/// API key. No Smryx server is involved — the request goes straight from this
/// Mac to the endpoint the user configured. The key comes from the Keychain
/// and never touches a log, a file, or JavaScript.
struct SummarizerClient {

    struct Result {
        let summary: String
        /// True when the article was longer than the cap and got cut.
        let wasTruncated: Bool
        let model: String
    }

    func summarize(title: String, url: String, text: String, length: SummaryLength) async throws -> Result {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw SummarizerError.emptyArticle }

        let provider = SharedSettings.provider
        let apiKey = KeychainHelper.apiKey()
        if provider.requiresAPIKey, (apiKey ?? "").isEmpty {
            throw SummarizerError.missingAPIKey
        }

        let endpoint = SharedSettings.endpoint
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let model = SharedSettings.model.trimmingCharacters(in: .whitespacesAndNewlines)

        let wasTruncated = trimmed.count > AppConfig.maxArticleCharacters
        let articleText = String(trimmed.prefix(AppConfig.maxArticleCharacters))

        let system = """
        You are a precise summarizer. \(length.instruction)
        Summarize only the provided article. Do not invent facts. If the article \
        is paywalled, incomplete, or mostly navigation text, say so plainly in one \
        line instead of guessing.
        """

        let user = """
        Article title: \(title)
        Article URL: \(url)

        Article text:
        \(articleText)
        """

        let payload: [String: Any] = [
            "model": model,
            "temperature": 0.3,
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
        ]

        guard let requestURL = URL(string: endpoint + "/chat/completions") else {
            throw SummarizerError.badResponse("The endpoint URL is not valid: \(endpoint)")
        }
        var request = URLRequest(url: requestURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey, !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw SummarizerError.transport(error)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(status) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SummarizerError.http(status: status, body: body)
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let choices = json["choices"] as? [[String: Any]],
            let message = choices.first?["message"] as? [String: Any],
            let content = message["content"] as? String,
            !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw SummarizerError.badResponse("missing choices[0].message.content")
        }

        return Result(
            summary: content.trimmingCharacters(in: .whitespacesAndNewlines),
            wasTruncated: wasTruncated,
            model: model
        )
    }
}

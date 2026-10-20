import SafariServices
import os.log

/// The Safari extension's native message handler.
///
/// The extension's JavaScript can NEVER touch the API key (it lives in the
/// Keychain) or the free-tier counters. Instead, JS calls
/// `browser.runtime.sendNativeMessage(...)` and this handler does the
/// privileged work:
///
///   getStatus    → whether a key is saved, Pro state, usage left, model
///   summarize    → usage check → API call via SummarizerClient → usage+1
///   saveSummary  → writes the summary into the shared library container
///
/// This runs inside the extension process; it shares the App Group defaults
/// and the Keychain access group with the Smryx app (capabilities in Xcode).
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let log = Logger(
        subsystem: SharedConstants.extensionBundleID,
        category: "SafariWebExtensionHandler"
    )

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]
        let action = message["action"] as? String ?? ""

        Task {
            let response = await self.handle(action: action, message: message)
            let responseItem = NSExtensionItem()
            responseItem.userInfo = [SFExtensionMessageKey: response]
            context.completeRequest(returningItems: [responseItem], completionHandler: nil)
        }
    }

    // MARK: - Actions

    private func handle(action: String, message: [String: Any]) async -> [String: Any] {
        switch action {
        case "getStatus":
            return statusPayload()
        case "summarize":
            return await summarize(message: message)
        case "saveSummary":
            return saveSummary(message: message)
        default:
            return ["ok": false, "error": "unknown_action",
                    "message": "Unknown action: \(action)"]
        }
    }

    private func statusPayload() -> [String: Any] {
        let tracker = UsageTracker.shared
        return [
            "ok": true,
            "hasKey": KeychainHelper.hasAPIKey || SharedSettings.provider == .ollama,
            "provider": SharedSettings.provider.rawValue,
            "isPro": tracker.isPro,
            "usedThisMonth": tracker.usedThisMonth,
            "freeLimit": Monetization.freeSummariesPerMonth,
            "model": SharedSettings.model,
        ]
    }

    private func summarize(message: [String: Any]) async -> [String: Any] {
        let tracker = UsageTracker.shared
        guard tracker.canSummarize else {
            return ["ok": false, "error": "free_limit_reached",
                    "message": "You've used your \(Monetization.freeSummariesPerMonth) free summaries this month. Go Pro in the Smryx app for unlimited."]
        }

        let title = message["title"] as? String ?? "Untitled"
        let url = message["url"] as? String ?? ""
        let text = message["text"] as? String ?? ""
        let length = SummaryLength(rawValue: (message["length"] as? String ?? "medium")) ?? .medium

        do {
            let result = try await SummarizerClient().summarize(
                title: title, url: url, text: text, length: length
            )
            tracker.recordSummary()
            return [
                "ok": true,
                "summary": result.summary,
                "wasTruncated": result.wasTruncated,
                "model": result.model,
                "usedThisMonth": tracker.usedThisMonth,
                "freeLimit": Monetization.freeSummariesPerMonth,
                "isPro": tracker.isPro,
            ]
        } catch {
            return ["ok": false, "error": "summarize_failed",
                    "message": (error as? LocalizedError)?.errorDescription ?? error.localizedDescription]
        }
    }

    private func saveSummary(message: [String: Any]) -> [String: Any] {
        let summary = SavedSummary(
            title: message["title"] as? String ?? "Untitled",
            url: message["url"] as? String ?? "",
            summary: message["summary"] as? String ?? "",
            length: message["length"] as? String ?? "medium",
            model: message["model"] as? String ?? SharedSettings.model
        )
        let ok = LibraryStore.shared.save(summary)
        return ["ok": ok, "id": summary.id.uuidString]
    }
}

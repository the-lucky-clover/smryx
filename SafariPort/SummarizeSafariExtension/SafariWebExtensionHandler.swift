// SafariWebExtensionHandler.swift
// Bridge between Safari Web Extension JS and native Swift code
// Handles: GET_PAGE_INFO, GET_PAGE_SUBTITLES, OPEN_POPUP, SUMMARIZE_TEXT, MARK_CONTENT

import SafariServices
import os.log
import UniformTypeIdentifiers

let log = OSLog(subsystem: "com.stevenpounds.summarizesafari", category: "ExtensionHandler")

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let userInfo = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let type = userInfo["type"] as? String else {
            os_log("Invalid message format", log: log, type: .error)
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }
        
        os_log("Received message: %{public}@", log: log, type: .info, type)
        
        switch type {
        case "GET_PAGE_INFO":
            handleGetPageInfo(context: context, userInfo: userInfo)
        case "GET_PAGE_SUBTITLES":
            handleGetPageSubtitles(context: context, userInfo: userInfo)
        case "OPEN_POPUP":
            handleOpenPopup(context: context, userInfo: userInfo)
        case "SUMMARIZE_TEXT":
            handleSummarizeText(context: context, userInfo: userInfo)
        case "MARK_CONTENT":
            handleMarkContent(context: context, userInfo: userInfo)
        default:
            os_log("Unknown message type: %{public}@", log: log, type: .error, type)
            context.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
    
    private func handleGetPageInfo(context: NSExtensionContext, userInfo: [String: Any]) {
        // Inject content script to extract page content
        let script = """
        (function() {
            try {
                const readability = new Readability(document.cloneNode(true));
                const article = readability.parse();
                if (article && article.textContent?.trim()) {
                    return {
                        title: article.title,
                        byline: article.byline,
                        dir: article.dir,
                        lang: article.lang,
                        content: article.content,
                        textContent: article.textContent,
                        length: article.length,
                        excerpt: article.excerpt,
                        siteName: article.siteName,
                        publishedTime: article.publishedTime,
                        url: window.location.href
                    };
                }
            } catch (e) {
                console.error('Readability error:', e);
            }
            // Fallback
            const main = document.querySelector('main') || document.body;
            return {
                title: document.title,
                dir: document.dir || 'ltr',
                content: main?.innerHTML,
                textContent: main?.innerText || main?.textContent || '',
                url: window.location.href,
                lang: document.documentElement.lang
            };
        })();
        """
        
        SFSafariApplication.getActiveWindow { window in
            window?.getActiveTab { tab in
                tab?.pagePropertiesWithCompletionHandler { properties in
                    tab?.dispatchMessageToScript(withName: "getPageInfo", userInfo: [:]) { result in
                        var response: [String: Any] = ["type": "GET_PAGE_INFO"]
                        if let result = result as? [String: Any] {
                            response["data"] = result
                        }
                        self.sendResponse(context: context, response: response)
                    }
                }
            }
        }
        
        // Fallback timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            self.sendResponse(context: context, response: ["type": "GET_PAGE_INFO", "error": "Timeout"])
        }
    }
    
    private func handleGetPageSubtitles(context: NSExtensionContext, userInfo: [String: Any]) {
        // Extract YouTube video ID and fetch captions
        guard let urlString = userInfo["url"] as? String,
              let videoId = extractYouTubeVideoId(from: urlString) else {
            sendResponse(context: context, response: ["type": "GET_PAGE_SUBTITLES", "data": nil])
            return
        }
        
        // Try to get captions from YouTube
        fetchYouTubeCaptions(videoId: videoId) { captions in
            let response: [String: Any] = [
                "type": "GET_PAGE_SUBTITLES",
                "data": captions.map { ["text": $0, "videoId": videoId] } ?? [:]
            ]
            self.sendResponse(context: context, response: response)
        }
    }
    
    private func handleOpenPopup(context: NSExtensionContext, userInfo: [String: Any]) {
        // Popup opens automatically via action, just acknowledge
        sendResponse(context: context, response: ["type": "OPEN_POPUP", "success": true])
    }
    
    private func handleSummarizeText(context: NSExtensionContext, userInfo: [String: Any]) {
        // Forward to popup for summarization
        sendResponse(context: context, response: ["type": "SUMMARIZE_TEXT", "success": true])
    }
    
    private func handleMarkContent(context: NSExtensionContext, userInfo: [String: Any]) {
        // Highlight text in page
        sendResponse(context: context, response: ["type": "MARK_CONTENT", "success": true])
    }
    
    private func sendResponse(context: NSExtensionContext, response: [String: Any]) {
        let item = NSExtensionItem()
        item.userInfo = [SFExtensionMessageKey: response]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
    
    private func extractYouTubeVideoId(from url: String) -> String? {
        let patterns = [
            "(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|v\\/)|youtu\\.be\\/)([\\w-]{11})",
            "youtube\\.com\\/shorts\\/([\\w-]{11})"
        ]
        for pattern in patterns {
            let regex = try? NSRegularExpression(pattern: pattern)
            let range = NSRange(location: 0, length: url.utf16.count)
            if let match = regex?.firstMatch(in: url, options: [], range: range),
               let range = Range(match.range(at: 1), in: url) {
                return String(url[range])
            }
        }
        return nil
    }
    
    private func fetchYouTubeCaptions(videoId: String, completion: @escaping (String?) -> Void) {
        // Try multiple caption URL formats
        let urls = [
            "https://www.youtube.com/api/timedtext?v=\(videoId)&fmt=json3",
            "https://www.youtube.com/api/timedtext?v=\(videoId)&fmt=srv3",
            "https://www.youtube.com/api/timedtext?v=\(videoId)&lang=en",
            "https://www.youtube.com/api/timedtext?v=\(videoId)&lang=en-US"
        ]
        
        tryNext(urls: urls, completion: completion)
    }
    
    private func tryNext(urls: [String], completion: @escaping (String?) -> Void) {
        guard let urlString = urls.first, let url = URL(string: urlString) else {
            completion(nil)
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                os_log("Caption fetch error: %{public}@", log: log, type: .error, error.localizedDescription)
                self.tryNext(urls: Array(urls.dropFirst()), completion: completion)
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  let data = data,
                  let text = String(data: data, encoding: .utf8),
                  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                self.tryNext(urls: Array(urls.dropFirst()), completion: completion)
                return
            }
            
            // Validate caption content
            if self.isValidCaption(text: text) {
                completion(text)
            } else {
                self.tryNext(urls: Array(urls.dropFirst()), completion: completion)
            }
        }.resume()
    }
    
    private func isValidCaption(text: String) -> Bool {
        // Check for JSON format (events with segs)
        if text.hasPrefix("{") || text.hasPrefix("[") {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let events = json["events"] as? [[String: Any]] {
                return events.contains { event in
                    (event["segs"] as? [[String: Any]])?.contains { seg in
                        (seg["utf8"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                    } ?? false
                }
            }
        }
        // Check for XML format
        if text.contains("<transcript>") || text.contains("<text") {
            return text.contains(">") && text.contains("</")
        }
        return false
    }
}
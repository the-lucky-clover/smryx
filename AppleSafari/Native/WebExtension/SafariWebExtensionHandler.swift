import Foundation
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any]
        var approved = false
        if message?["type"] as? String == "CONSUME_SHARE_REQUEST",
           let token = message?["token"] as? String, let url = message?["url"] as? String {
            approved = ShareRequestStore.consume(token: token, url: url)
        }
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["ok": approved]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

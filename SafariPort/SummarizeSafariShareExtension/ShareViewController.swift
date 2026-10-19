// ShareViewController.swift
// iOS Share Sheet Extension - handles "Share → Sumyst"

import UIKit
import Social
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {
    
    private var extractedURL: String?
    private var extractedText: String?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        placeholder = "Summarize this page..."
        characterLimit = 500
        
        // Extract URL from shared content
        extractSharedContent()
    }
    
    override func isContentValid() -> Bool {
        return extractedURL != nil || extractedText != nil
    }
    
    override func didSelectPost() {
        guard let url = extractedURL, let encodedURL = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }
        
        // Open Safari with the extension's deep link or universal link
        let summarizeURL = URL(string: "summarizesafari://summarize?url=\(encodedURL)")!
        var responseItem = NSExtensionItem()
        responseItem.attachments = [NSItemProvider(object: summarizeURL as NSURL)]
        
        extensionContext?.completeRequest(returningItems: [responseItem], completionHandler: nil)
    }
    
    override func configurationItems() -> [Any]! {
        // Add custom configuration if needed
        return []
    }
    
    private func extractSharedContent() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else { return }
        
        let group = DispatchGroup()
        
        for provider in attachments {
            // Try to get URL
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
                    if let url = item as? URL {
                        self?.extractedURL = url.absoluteString
                    }
                    group.leave()
                }
            }
            
            // Try to get text
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, error in
                    if let text = item as? String {
                        self?.extractedText = text
                    }
                    group.leave()
                }
            }
            
            // Try to get web page metadata
            if provider.hasItemConformingToTypeIdentifier("com.apple.webarchive") {
                group.enter()
                provider.loadItem(forTypeIdentifier: "com.apple.webarchive", options: nil) { [weak self] item, error in
                    if let data = item as? Data {
                        // Parse webarchive for URL
                    }
                    group.leave()
                }
            }
        }
        
        group.notify(queue: .main) { [weak self] in
            self?.textViewDidChange(self?.textView ?? UITextView())
        }
    }
}
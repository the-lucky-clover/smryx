import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let messageLabel = UILabel()
    private let openButton = UIButton(type: .system)
    private var pageURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        preferredContentSize = CGSize(width: 520, height: 320)
        view.backgroundColor = .systemBackground
        let title = UILabel()
        title.text = "Sumyst"
        title.font = .preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true
        messageLabel.numberOfLines = 0
        messageLabel.font = .preferredFont(forTextStyle: .body)
        messageLabel.text = "Checking this Safari page…"
        openButton.setTitle("Open summary in Safari", for: .normal)
        openButton.isEnabled = false
        openButton.addTarget(self, action: #selector(openSummary), for: .touchUpInside)
        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.addTarget(self, action: #selector(cancelShare), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, messageLabel, openButton, cancel])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16)
        ])
        loadSafariPage()
    }

    private func loadSafariPage() {
        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        guard let provider = items.flatMap({ $0.attachments ?? [] }).first(where: { $0.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) }) else {
            messageLabel.text = "Open this webpage in Safari, then choose Sumyst from Safari’s Share menu. Enable the Sumyst Safari extension and allow access to this website first."
            return
        }
        provider.loadItem(forTypeIdentifier: UTType.propertyList.identifier, options: nil) { [weak self] item, _ in
            let values = (item as? NSDictionary)?[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any]
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard values?["supported"] as? Bool == true,
                      let address = values?["url"] as? String, let url = URL(string: address),
                      ["http", "https"].contains(url.scheme?.lowercased() ?? ""), url.host != nil else {
                    self.messageLabel.text = "This page cannot be summarized. Try a regular webpage in Safari."
                    return
                }
                self.pageURL = url
                self.messageLabel.text = "Return to \(url.host ?? "this page") and open its summary panel. The Sumyst Safari extension must be enabled with access to this site, and ChatGPT must be signed in."
                self.openButton.isEnabled = true
            }
        }
    }

    @objc private func openSummary() {
        guard let url = pageURL else { return }
        openButton.isEnabled = false
        do {
            let token = try ShareRequestStore.issue(for: url)
            let values: [String: Any] = [NSExtensionJavaScriptFinalizeArgumentKey: ["command": "open-summary", "url": url.absoluteString, "token": token]]
            let item = NSExtensionItem()
            item.attachments = [NSItemProvider(item: values as NSDictionary, typeIdentifier: UTType.propertyList.identifier)]
            extensionContext?.completeRequest(returningItems: [item], completionHandler: nil)
        } catch {
            openButton.isEnabled = true
            messageLabel.text = "The shared app group is unavailable. Check signing and App Groups for the app and both extensions in Xcode."
        }
    }

    @objc private func cancelShare() {
        extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
    }
}

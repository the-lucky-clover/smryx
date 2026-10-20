import SwiftUI
#if os(macOS)
import SafariServices
#endif

struct ContentView: View {
    @State private var status = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("🤖 SmryX").font(.title.bold())
                Text("Summaries and questions, in Safari.").foregroundStyle(.secondary)
                #if os(macOS)
                Text("1. Enable SmryX in Safari → Settings → Extensions.\n2. Allow access to the websites you want to summarize.\n3. Sign in to ChatGPT in Safari.\n4. Open a webpage and click SmryX in Safari’s toolbar.")
                Button("Open Safari Extension Settings") {
                    SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.luckyclover.chatgptbeastmode.mac.extension") { error in
                        DispatchQueue.main.async { status = error?.localizedDescription ?? "" }
                    }
                }
                #else
                Text("1. Open Settings → Apps → Safari → Extensions (or Settings → Safari on older iOS), and enable SmryX.\n2. Allow access to the websites you want to summarize.\n3. Sign in to ChatGPT in Safari.\n4. In Safari, use the page menu → Extensions → SmryX. Or use Share → SmryX → Open summary in Safari.")
                Text("If SmryX is missing from Share, use More or Edit Actions to add it. Enable the Safari extension before using the Share action.").foregroundStyle(.secondary)
                #endif
                Link("Sign in to ChatGPT", destination: URL(string: "https://chatgpt.com/")!)
                Text("Use the extension’s gear button for settings and usage analytics. Batch results open in a separate Safari tab. On iPhone and iPad, keep that tab open while a batch runs.").font(.callout)
                if !status.isEmpty { Text(status).foregroundStyle(.red) }
            }
            .padding(28)
            .frame(maxWidth: 560, alignment: .leading)
        }
        #if os(macOS)
        .frame(width: 560, height: 480)
        #endif
    }
}

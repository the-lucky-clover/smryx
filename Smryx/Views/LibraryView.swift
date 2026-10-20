import SwiftUI
import AppKit

/// The saved-summary library: search, read, copy, open the original, delete.
struct LibraryView: View {
    @State private var summaries: [SavedSummary] = []
    @State private var searchText = ""
    @State private var selection: SavedSummary.ID?

    private var filtered: [SavedSummary] {
        guard !searchText.isEmpty else { return summaries }
        let q = searchText.lowercased()
        return summaries.filter {
            $0.title.lowercased().contains(q) || $0.summary.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationSplitView {
            Group {
                if summaries.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No saved summaries yet")
                            .font(.headline)
                        Text("Summarize an article in Safari, then tap Save.\nIt lands here.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filtered, selection: $selection) { summary in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(summary.title)
                                .font(.headline)
                                .lineLimit(2)
                            Text(summary.createdAt, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .tag(summary.id)
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search summaries")
            .navigationTitle("Library")
        } detail: {
            if let selected = filtered.first(where: { $0.id == selection }) {
                SummaryDetailView(summary: selected, onDelete: {
                    LibraryStore.shared.delete(id: selected.id)
                    selection = nil
                    reload()
                })
            } else {
                Text("Select a summary")
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear(perform: reload)
    }

    private func reload() {
        summaries = LibraryStore.shared.all()
    }
}

private struct SummaryDetailView: View {
    let summary: SavedSummary
    let onDelete: () -> Void

    @State private var copied = false
    @State private var confirmingDelete = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(summary.title)
                    .font(.title2)
                    .bold()
                HStack(spacing: 12) {
                    Text(summary.createdAt, style: .date)
                    Text("·")
                    Text(summary.length.capitalized)
                    Text("·")
                    Text(summary.model)
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                GlassCard {
                    Text(summary.summary)
                        .font(.body)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack {
                    Button(copied ? "Copied ✓" : "Copy summary") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(summary.summary, forType: .string)
                        copied = true
                    }
                    if let url = URL(string: summary.url) {
                        Link("Open original article", destination: url)
                    }
                    Spacer()
                    Button("Delete", role: .destructive) { confirmingDelete = true }
                }
            }
            .padding()
        }
        .confirmationDialog("Delete this summary?", isPresented: $confirmingDelete) {
            Button("Delete", role: .destructive, action: onDelete)
        }
    }
}

import SwiftUI

/// First-run onboarding. Says the honest things up front: what Smryx does,
/// that your API key and its cost are yours (BYOK), and exactly what the
/// free tier is.
struct OnboardingView: View {
    @AppStorage("smryx.hasOnboarded") private var hasOnboarded = false

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            GlassCard {
                VStack(spacing: 14) {
                    Text("Smryx")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    Text("Summaries of any article,\nright inside Safari.")
                        .font(.title3)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: 420)
            }

            VStack(alignment: .leading, spacing: 16) {
                OnboardingRow(
                    icon: "doc.text.magnifyingglass",
                    title: "One click in Safari",
                    body: "The Smryx toolbar button extracts the article and summarizes it. Nothing else runs in your browser."
                )
                OnboardingRow(
                    icon: "key.fill",
                    title: "Your key, your bill",
                    body: "Smryx uses your own AI API key — saved in your Mac's Keychain, never sent to us (there is no us: there's no Smryx server). Your provider bills you per use, usually pennies."
                )
                OnboardingRow(
                    icon: "gift",
                    title: "Free, honestly",
                    body: "\(Monetization.freeSummariesPerMonth) summaries a month, free. No credit card, no trial countdown. Pro is unlimited."
                )
            }
            .frame(maxWidth: 460)

            Button("Get started") { hasOnboarded = true }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

            Text("Next: enable the extension in Safari → Settings → Extensions, then add your API key here in Settings.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 440)

            Spacer()
        }
        .padding()
        .frame(minWidth: 640, minHeight: 560)
    }
}

private struct OnboardingRow: View {
    let icon: String
    let title: String
    let body: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .frame(width: 30)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(body).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}

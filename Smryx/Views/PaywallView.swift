import SwiftUI

/// The Pro paywall. Honest rules:
/// • Prices come from the App Store (`product.displayPrice`) — never hard-coded.
/// • If the products don't exist in App Store Connect yet, the paywall says
///   so plainly instead of showing fake buttons.
/// • No countdowns, no fake urgency, no dark patterns.
struct PaywallView: View {
    @EnvironmentObject var store: StoreManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            GlassCard {
                VStack(spacing: 12) {
                    Image(systemName: "crown.fill")
                        .font(.largeTitle)
                        .foregroundStyle(.yellow)
                    Text("Smryx Pro")
                        .font(.largeTitle)
                        .bold()
                    Text("Unlimited summaries, every month.")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: 380)
            }

            if store.isLoadingProducts {
                ProgressView("Loading Pro options…")
            } else if store.products.isEmpty {
                // Honest empty state: the products were never created.
                VStack(spacing: 8) {
                    Text("Pro isn't available yet")
                        .font(.headline)
                    Text("The subscription products haven't been created in App Store Connect. Free tier (\(Monetization.freeSummariesPerMonth)/month) still works.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }
            } else {
                ForEach(store.products) { product in
                    Button {
                        Task { await store.purchase(product) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(product.displayName).bold()
                                Text(product.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(product.displayPrice)
                                .bold()
                        }
                        .padding()
                        .frame(maxWidth: 380)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
            }

            if let error = store.purchaseError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 380)
            }

            Button("Restore purchases") {
                Task { await store.restore() }
            }
            .font(.footnote)

            Button("Not now") { dismiss() }
                .buttonStyle(.bordered)

            Spacer()
        }
        .padding()
        .frame(minWidth: 480, minHeight: 520)
        .task { await store.loadProducts() }
    }
}

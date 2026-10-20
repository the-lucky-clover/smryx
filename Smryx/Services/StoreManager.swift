import Foundation
import StoreKit

/// StoreKit 2 subscription management for Smryx Pro.
///
/// The products it asks for come from `Monetization.proProductIDs`. Those
/// products MUST be created in App Store Connect with exactly those IDs
/// (BUILD_GUIDE.md, Part 5). If they aren't, `products` stays empty and the
/// paywall tells the user Pro isn't available yet — it never shows a fake
/// price or a fake purchase button.
@MainActor
final class StoreManager: ObservableObject {

    @Published private(set) var products: [Product] = []
    @Published private(set) var isPro = false
    @Published private(set) var isLoadingProducts = false
    @Published var purchaseError: String?

    private var transactionListener: Task<Void, Never>?

    init() {
        isPro = UsageTracker.shared.isPro
        transactionListener = listenForTransactions()
    }

    deinit {
        transactionListener?.cancel()
    }

    // MARK: - Products

    func loadProducts() async {
        isLoadingProducts = true
        defer { isLoadingProducts = false }
        do {
            products = try await Product.products(for: Monetization.proProductIDs)
                .sorted { $0.price < $1.price }
        } catch {
            products = []
            purchaseError = "Couldn't load Pro products: \(error.localizedDescription)"
        }
    }

    // MARK: - Purchase / restore

    func purchase(_ product: Product) async {
        purchaseError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                await refreshEntitlements()
                await transaction.finish()
            case .userCancelled:
                break
            case .pending:
                purchaseError = "Purchase is pending (e.g. parental approval). It will complete outside the app."
            @unknown default:
                break
            }
        } catch {
            purchaseError = "Purchase failed: \(error.localizedDescription)"
        }
    }

    /// Apple requires a Restore Purchases path for every non-consumable and
    /// auto-renewable subscription.
    func restore() async {
        purchaseError = nil
        do {
            try await AppStore.sync()
        } catch {
            purchaseError = "Restore failed: \(error.localizedDescription)"
            return
        }
        await refreshEntitlements()
    }

    // MARK: - Entitlements

    func refreshEntitlements() async {
        var entitled = false
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? verified(result),
                  Monetization.proProductIDs.contains(transaction.productID),
                  transaction.revocationDate == nil else { continue }
            entitled = true
            break
        }
        isPro = entitled
        UsageTracker.shared.isPro = entitled
    }

    // MARK: - Private

    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if let transaction = try? self.verified(result) {
                    await self.refreshEntitlements()
                    await transaction.finish()
                }
            }
        }
    }

    private nonisolated func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw StoreError.unverified
        }
    }
}

private enum StoreError: LocalizedError {
    case unverified
    var errorDescription: String? { "The App Store transaction couldn't be verified." }
}

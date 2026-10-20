import Foundation

// ─────────────────────────────────────────────────────────────────────────────
//  Smryx monetization — PROVISIONAL VALUES. These are Steven's to change.
//
//  Everything money-related in the app and the extension reads from THIS file.
//  Change a number here and it changes everywhere.
//
//  • Free tier: `freeSummariesPerMonth` summaries per calendar month.
//  • Pro: a StoreKit auto-renewable subscription. The two product IDs below
//    must be created in App Store Connect with EXACTLY these identifiers and
//    the prices noted, or the paywall will honestly report that Pro is not
//    available yet. Nothing fakes a purchase or a price.
// ─────────────────────────────────────────────────────────────────────────────

enum Monetization {

    /// PROVISIONAL — free summaries per calendar month before the paywall.
    static let freeSummariesPerMonth = 10

    /// PROVISIONAL — create in App Store Connect at $4.99 / month.
    static let monthlyProductID = "com.luckyclover.smryx.pro.monthly"

    /// PROVISIONAL — create in App Store Connect at $39.99 / year.
    static let yearlyProductID = "com.luckyclover.smryx.pro.yearly"

    /// PROVISIONAL — the subscription group name to create in App Store Connect.
    static let subscriptionGroupName = "Smryx Pro"

    static var proProductIDs: [String] { [monthlyProductID, yearlyProductID] }
}

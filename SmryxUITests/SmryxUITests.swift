import XCTest

/// Minimal smoke test for Smryx (macOS app + Safari extension).
/// Launches the app and proves a real window comes up.
final class SmryxUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppLaunchesAndShowsWindow() throws {
        let app = XCUIApplication()
        app.launch()

        let window = app.windows.firstMatch
        XCTAssertTrue(
            window.waitForExistence(timeout: 20),
            "Smryx launched but no window appeared."
        )

        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Smryx main window after launch"
        shot.lifetime = .keepAlways
        add(shot)
    }
}

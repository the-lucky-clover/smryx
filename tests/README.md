# Automated Playtests for Sumyst

## Self-contained regression checks

Run from the repository root:

```powershell
node --test --test-isolation=none tests/summary-format.test.mjs tests/background-answer.test.cjs tests/model-selection.test.cjs tests/chatgpt-session.test.cjs tests/branding.test.cjs tests/connection-diagnostics.test.mjs
node tests/extension-summary.cjs
node --test --test-isolation=none tests/batch-menu.test.cjs tests/batch-session.test.mjs tests/batch-preferences.test.mjs
node tests/batch-workspace.cjs
```

The first command checks Markdown formatting, prompt migration, ChatGPT-only routing,
streaming, cancellation, and removal of stale model selections without network access. The browser check uses
Playwright Chromium to load the unpacked extension and verify formatting,
entrance animations, summaries, and Ask question with controlled ChatGPT web
responses. It also checks that Settings and onboarding have no provider, model,
or API key controls and that legacy provider settings cannot change inference.
It also reproduces transient and persistent ChatGPT errors, checks stable device identity and cookies, and verifies the official status link. A source scan checks all project files for retired branding, including ignored bundles. It uses no real API credentials. The browser screenshot
is written to the system temporary directory.

The batch workspace check opens the dedicated results tab through the background
router and tests its two-column table, progress-to-image transition, actual
background screenshots, search, filters, reader, JSON/CSV downloads, session
merge and resume, pause, and confirmed clearing. It runs a temporary copy of the
extension with screenshot access pre-granted; the installed extension requests
the optional debugger permission only when background screenshots are selected.
ChatGPT responses are controlled. Source extraction, screenshots, storage,
downloads, and tab behavior use real browser APIs. Screenshots of desktop,
mobile, light, and dark layouts are saved in the system temporary directory.

The browser check also verifies single-tab additions to a running queue,
left-to-right batch order, and the global default-off close preference. It
checks that only saved successes close; failed or navigated source tabs and
the results tab remain open. Native tab-strip menus are registered where the
browser supports them; older Chromium builds use the page menu and the pinned
extension's "Add this tab to Batch" action.

After editing `background/batch-module.js`, run
`node scripts/sync-batch-worker.cjs` to embed it in both shipped workers.

## Setup

```bash
cd tests
npm install
npx playwright install chromium
```

## Configuration

Set your extension ID before running:

```bash
# Windows PowerShell
$env:EXTENSION_ID = "your-extension-id-here"
npx playwright test

# Or add to playwright.config.ts
```

## Running Tests

```bash
# All tests
npm test

# Headed mode (see browser)
npm run test:headed

# Interactive UI
npm run test:ui

# Specific test groups
npm run test:ask-question
npm run test:batch
npm run test:providers
```

## Test Coverage

| Test Suite | Coverage |
|------------|----------|
| **Ask Question Tab** | Opens, streams answer, handles errors, keyboard shortcuts |
| **Batch Summarization** | Toolbar context menu, dedicated results tab, screenshots, session recovery, exports |
| **ChatGPT session** | Web-only inference, legacy settings migration, ChatGPT default routing |

## Key Test Scenarios

### Ask Question Tab
- Opens and streams answer via ChatGPT web interface
- Works without OpenAI API key (uses ChatGPT web)
- Handles network errors gracefully
- Ctrl+B keyboard shortcut toggles tab
- No "OpenAI provider only" error

### Batch Summarization
- Right-clicking the extension action offers Batch Summaries
- Opens or focuses one dedicated results tab
- Two-column table shows preview images and two TL;DR paragraphs per page
- Animated loading bars become completed site images
- Optional background screenshots leave source tabs inactive
- Search, status filters, sorting, and a full reading panel
- JSON sessions retain images, completed summaries, and unfinished rows
- Imports merge results and resume unfinished pages without repeating completed work
- Complete CSV exports and confirmed Clear all
- Pause aborts active work and preserves the remaining queue

### ChatGPT session
- Uses the signed-in ChatGPT web session for all inference
- Ignores old API and DeepSeek provider settings
- Sends `auto` for ChatGPT to route each request; never selects a named model from a catalog
- Clears cached model IDs, including the reported `gpt-5-3-mini` failure
- Removes provider, model, and API key controls from Settings and onboarding

## Running in CI

```yaml
# .github/workflows/test.yml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: '20' }
- run: cd tests && npm ci
- run: npx playwright install --with-deps chromium
- run: npx playwright test
  env:
    EXTENSION_ID: ${{ secrets.EXTENSION_ID }}
```

## Debugging

```bash
# Run single test with debug
npx playwright test tests/playtest-ask-question.spec.ts -g "Ask Question tab opens" --debug

# Generate trace
npx playwright test --trace on
```

## Extension ID

Get your extension ID from `chrome://extensions` (Developer mode → Details → Extension ID).

Set as environment variable or update `playwright.config.ts`:
```typescript
export default defineConfig({
  use: { 
    baseURL: `chrome-extension://${process.env.EXTENSION_ID}/popup/index.html`
  }
});
```

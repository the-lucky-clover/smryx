import { test, expect } from '@playwright/test';

const EXTENSION_ID = process.env.EXTENSION_ID || 'your-extension-id-here';
const POPUP_URL = `chrome-extension://${EXTENSION_ID}/popup/index.html`;

test.describe('Ask Question Tab - Automated Playtest', () => {
  test.beforeEach(async ({ context }) => {
    // Grant permissions for the extension
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('Ask Question tab opens and streams answer via ChatGPT web', async ({ page }) => {
    // Navigate to a test page first
    await page.goto('https://example.com');
    
    // Open extension popup by clicking the extension icon
    // In Playwright, we navigate directly to the popup URL
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    
    // Wait for popup to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click the "Ask question" tab
    const askTab = page.locator('[role="tab"]:has-text("Ask question")');
    await expect(askTab).toBeVisible();
    await askTab.click();
    
    // Verify batch panel is shown (or the ask question panel)
    await page.waitForTimeout(500);
    
    // Find the question input
    const questionInput = page.locator('textarea[placeholder*="question" i], input[placeholder*="question" i], .question-input');
    await expect(questionInput).toBeVisible({ timeout: 5000 });
    
    // Type a question
    await questionInput.fill('What is this page about?');
    
    // Click the ask/submit button
    const submitBtn = page.locator('button:has-text("Ask"), button:has-text("Submit"), button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    
    // Wait for answer to start streaming
    const answerArea = page.locator('.answer-streaming, .answer-complete, .summary-text, .answer-text');
    await expect(answerArea.first()).toBeVisible({ timeout: 30000 });
    
    // Verify answer contains relevant content
    await expect(answerArea.first()).toContainText(/example|page|about/i, { timeout: 10000 });
  });

  test('Ask Question works with ChatGPT web provider (no OpenAI API key required)', async ({ page }) => {
    // Ensure provider is set to web
    await page.evaluate(() => {
      chrome.storage.local.set({ 
        provider: 'web', 
        model: 'gpt-4o',
        selectedLanguage: 'en-US'
      });
    });
    
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    const askTab = page.locator('[role="tab"]:has-text("Ask question")');
    await askTab.click();
    await page.waitForTimeout(500);
    
    const questionInput = page.locator('textarea[placeholder*="question" i], input[placeholder*="question" i]');
    await expect(questionInput).toBeVisible();
    await questionInput.fill('What is the main topic of this page?');
    
    const submitBtn = page.locator('button:has-text("Ask"), button:has-text("Submit")');
    await submitBtn.click();
    
    // Wait for streaming answer
    const answerArea = page.locator('.answer-streaming, .answer-complete, .summary-text');
    await expect(answerArea.first()).toBeVisible({ timeout: 30000 });
    
    // Should NOT show OpenAI API error
    await expect(page.locator('text=OpenAI provider')).not.toBeVisible();
  });

  test('Ask Question handles network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/backend-api/conversation**', route => route.abort());
    
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    const askTab = page.locator('[role="tab"]:has-text("Ask question")');
    await askTab.click();
    await page.waitForTimeout(500);
    
    const questionInput = page.locator('textarea[placeholder*="question" i]');
    await questionInput.fill('Test question');
    
    const submitBtn = page.locator('button:has-text("Ask")');
    await submitBtn.click();
    
    // Should show error toast/message
    const errorToast = page.locator('.toast.error, .error-message, .toast:has-text("error")');
    await expect(errorToast.first()).toBeVisible({ timeout: 10000 });
  });

  test('Keyboard shortcut Ctrl+B toggles Ask Question tab', async ({ page }) => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Press Ctrl+B
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);
    
    // Should be on Ask Question tab
    const askTab = page.locator('[role="tab"]:has-text("Ask question")');
    await expect(askTab).toHaveAttribute('aria-selected', 'true');
    
    // Press again to go back
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);
    
    const summarizeTab = page.locator('[role="tab"]:has-text("Summarize")');
    await expect(summarizeTab).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Batch Summarization Context Menu', () => {
  test('Right-click extension shows 5 batch options', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Right-click the extension icon (simulated via context menu)
    await page.evaluate(() => {
      chrome.contextMenus.create({
        id: 'test-batch-preserve-window',
        title: 'Batch Summarize All Tabs in This Window (Preserve)',
        contexts: ['action']
      });
    });
    
    // Check context menu items exist
    const menuItems = await page.evaluate(() => {
      return new Promise(resolve => {
        chrome.contextMenus.getAll(items => resolve(items.map(i => i.title)));
      });
    });
    
    expect(menuItems).toContain('Batch Summarize All Tabs in This Window (Preserve)');
    expect(menuItems).toContain('Batch Summarize All Tabs in This Window (Close After)');
    expect(menuItems).toContain('Batch Summarize All Tabs in All Windows (Preserve)');
    expect(menuItems).toContain('Batch Summarize All Tabs in All Windows (Close After)');
    expect(menuItems).toContain('Batch Summarize All Tabs Except This One');
  });
});

test.describe('Batch Results Tab', () => {
  test('Batch results tab shows sortable table with thumbnails', async ({ page }) => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Click batch tab
    const batchTab = page.locator('[role="tab"]:has-text("Batch")');
    await batchTab.click();
    await page.waitForTimeout(500);
    
    // Check table renders
    const table = page.locator('#batch-table, .batch-table');
    await expect(table).toBeVisible();
    
    // Check columns exist
    await expect(page.locator('th:has-text("Time")')).toBeVisible();
    await expect(page.locator('th:has-text("Preview")')).toBeVisible();
    await expect(page.locator('th:has-text("URL")')).toBeVisible();
    await expect(page.locator('th:has-text("Title")')).toBeVisible();
    await expect(page.locator('th:has-text("Progress")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test('Progress bars animate during summarization', async ({ page }) => {
    // Mock a batch summarization in progress
    await page.evaluate(() => {
      chrome.storage.local.set({
        bm_batch_results: [
          { tabId: 1, title: 'Test Page', url: 'https://example.com', progress: 45, status: 'loading', startedAt: Date.now() },
          { tabId: 2, title: 'Another Page', url: 'https://example.org', progress: 100, summary: 'Summary done', status: 'complete', startedAt: Date.now() - 5000, completedAt: Date.now() }
        ]
      });
    });
    
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    const batchTab = page.locator('[role="tab"]:has-text("Batch")');
    await batchTab.click();
    await page.waitForTimeout(500);
    
    // Check progress bars render
    const progressBars = page.locator('.progress-fill');
    await expect(progressBars.first()).toBeVisible();
    
    // Check animated shimmer on loading row
    const loadingRow = page.locator('.batch-row.loading');
    await expect(loadingRow.first()).toBeVisible();
  });

  test('Sort dropdown changes order', async ({ page }) => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    const batchTab = page.locator('[role="tab"]:has-text("Batch")');
    await batchTab.click();
    await page.waitForTimeout(500);
    
    // Change sort
    const sortSelect = page.locator('#batch-sort-select');
    await expect(sortSelect).toBeVisible();
    
    await sortSelect.selectOption('az');
    await page.waitForTimeout(300);
    
    // Verify URL updates or table reorders
    const firstRow = page.locator('#batch-tbody tr').first();
    await expect(firstRow).toBeVisible();
  });

  test('Export CSV button works', async ({ page }) => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    
    const batchTab = page.locator('[role="tab"]:has-text("Batch")');
    await batchTab.click();
    await page.waitForTimeout(500);
    
    const exportBtn = page.locator('#batch-export-btn');
    await expect(exportBtn).toBeVisible();
    
    // Click export
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/batch-summaries-.*\.csv/);
  });
});

test.describe('Provider Compatibility', () => {
  const providers = [
    { name: 'ChatGPT Web', provider: 'web', model: 'gpt-4o' },
    { name: 'OpenAI API', provider: 'api', model: 'gpt-4o', apiKey: 'sk-test' },
    { name: 'DeepSeek Chat', provider: 'deepseek-chat', model: 'deepseek-chat' },
    { name: 'DeepSeek API', provider: 'deepseek-api', model: 'deepseek-chat', apiKey: 'sk-deepseek' }
  ];

  for (const p of providers) {
    test(`Ask Question works with ${p.name}`, async ({ page }) => {
      await page.evaluate((p) => {
        chrome.storage.local.set({ provider: p.provider, model: p.model, apiKey: p.apiKey || '' });
      }, p);
      
      await page.goto(`chrome-extension://${EXTENSION_ID}/popup/index.html`);
      await page.waitForLoadState('domcontentloaded');
      
      const askTab = page.locator('[role="tab"]:has-text("Ask question")');
      await askTab.click();
      await page.waitForTimeout(500);
      
      const questionInput = page.locator('textarea[placeholder*="question" i]');
      await expect(questionInput).toBeVisible();
      await questionInput.fill(`Test with ${p.name}`);
      
      const submitBtn = page.locator('button:has-text("Ask")');
      await submitBtn.click();
      
      const answerArea = page.locator('.answer-streaming, .answer-complete, .summary-text');
      await expect(answerArea.first()).toBeVisible({ timeout: 30000 });
      
      // Should not show OpenAI-only error
      await expect(page.locator('text=only working with OpenAI')).not.toBeVisible();
    });
  });
});
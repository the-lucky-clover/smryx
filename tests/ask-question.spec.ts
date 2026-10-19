import { test, expect } from '@playwright/test';

test.describe('ChatGPT Beast Mode - Ask Question Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Load the extension
    const extensionPath = './dist'; // or wherever the built extension is
    await page.goto('chrome-extension://<extension-id>/popup/index.html');
  });

  test('Ask Question tab opens and allows querying', async ({ page }) => {
    // Navigate to a test page
    await page.goto('https://example.com');
    
    // Click extension icon to open popup
    // Note: This requires the extension to be loaded in the browser context
    // For actual testing, you'd use page.evaluate to trigger the extension
    
    // Simulate clicking the "Ask Question" tab
    await page.click('[role="tab"]:has-text("Ask question")');
    
    // Wait for tab to activate
    await expect(page.locator('#batch-panel')).toBeHidden();
    await expect(page.locator('#app')).toBeVisible(); // main summarize panel hidden
    // batch panel should be visible now
    
    // Type a question
    await page.fill('textarea[placeholder*="question"], input[placeholder*="question"]', 'What is this page about?');
    
    // Submit
    await page.click('button:has-text("Ask"), button:has-text("Submit")');
    
    // Wait for answer to stream in
    await expect(page.locator('.answer-streaming, .answer-complete')).toBeVisible({ timeout: 30000 });
  });

  test('Ask Question works with ChatGPT web provider', async ({ page }) => {
    // Mock the background message passing
    await page.evaluate(() => {
      // Override chrome.runtime.sendMessage to simulate web provider
      chrome.runtime.sendMessage = (msg, cb) => {
        if (msg.type === 'answer') {
          // Simulate streaming response
          setTimeout(() => cb({ 
            type: 'answer', 
            data: { text: 'This page is about example.com', messageId: '1', conversationId: '1' } 
          }), 100);
          setTimeout(() => cb({ type: 'done' }), 200);
        }
      };
    });
    
    // Open popup and test
    await page.goto('chrome-extension://<extension-id>/popup/index.html');
    await page.click('[role="tab"]:has-text("Ask question")');
    await page.fill('textarea', 'What is this page about?');
    await page.click('button:has-text("Ask")');
    
    await expect(page.locator('.answer-text')).toContainText('example.com');
  });

  test('Ask Question handles errors gracefully', async ({ page }) => {
    await page.evaluate(() => {
      chrome.runtime.sendMessage = (msg, cb) => {
        if (msg.type === 'answer') {
          setTimeout(() => cb({ 
            type: 'error', 
            data: 'Failed to connect to ChatGPT' 
          }), 100);
        }
      };
    });
    
    await page.goto('chrome-extension://<extension-id>/popup/index.html');
    await page.click('[role="tab"]:has-text("Ask question")');
    await page.fill('textarea', 'Test question');
    await page.click('button:has-text("Ask")');
    
    await expect(page.locator('.error-message, .toast.error')).toContainText('Failed to connect');
  });

  test('Ask Question tab persists across popup close/open', async ({ page }) => {
    await page.goto('chrome-extension://<extension-id>/popup/index.html');
    await page.click('[role="tab"]:has-text("Ask question")');
    await page.fill('textarea', 'Persistent question');
    
    // Close and reopen
    await page.reload();
    await page.click('[role="tab"]:has-text("Ask question")');
    
    // Question should persist or be restorable
    await expect(page.locator('textarea')).toHaveValue('Persistent question');
  });
});

test.describe('Batch Summarization Context Menu', () => {
  test('Context menu shows 5 batch options', async ({ page }) => {
    await page.contextMenu('extension-icon');
    await expect(page.locator('.context-menu')).toContainText([
      'Batch Summarize All Tabs in This Window (Preserve)',
      'Batch Summarize All Tabs in This Window (Close After)',
      'Batch Summarize All Tabs in All Windows (Preserve)',
      'Batch Summarize All Tabs in All Windows (Close After)',
      'Batch Summarize All Tabs Except This One'
    ]);
  });

  test('Batch summarization creates results tab', async ({ page }) => {
    // Mock tabs
    await page.evaluate(() => {
      chrome.tabs.query = () => Promise.resolve([
        { id: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, title: 'Tab 2', url: 'https://example.com/2' }
      ]);
      chrome.runtime.sendMessage = (msg, cb) => {
        if (msg.type === 'BM_BATCH_RETRY') cb({ success: true });
      };
    });
    
    // Trigger batch summarize
    await page.click('context-menu-item:has-text("Batch Summarize All Tabs in This Window (Preserve)")');
    
    // Results tab should open
    await expect(page.locator('#batch-panel')).toBeVisible();
    await expect(page.locator('#batch-table tbody tr')).toHaveCount(2);
  });
});

test.describe('Provider Compatibility', () => {
  test('Works with ChatGPT web provider', async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.set({ provider: 'web', model: 'gpt-4o' });
    });
    // Test that Ask Question works
  });

  test('Works with OpenAI API provider', async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.set({ provider: 'api', model: 'gpt-4o', apiKey: 'sk-test' });
    });
    // Test that Ask Question works
  });

  test('Works with DeepSeek provider', async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.set({ provider: 'deepseek-chat', model: 'deepseek-chat' });
    });
    // Test that Ask Question works
  });
});
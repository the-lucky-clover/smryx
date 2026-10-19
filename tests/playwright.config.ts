import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `chrome-extension://${process.env.EXTENSION_ID || 'your-extension-id'}/popup/index.html`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'echo "Extension must be loaded in browser separately"',
    url: 'http://localhost:9222',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
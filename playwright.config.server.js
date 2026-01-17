// Configuração para rodar no servidor (headless)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  timeout: 10 * 60 * 1000, // 10 minutos
  use: {
    trace: 'on',
    headless: true, // IMPORTANTE: headless no servidor
    screenshot: 'on',
    video: 'on',
    slowMo: 500,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results',
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 420000, // 7 minutos por teste (processos longos)
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html']],
  use: {
    headless: false, // Mostrar o navegador
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    launchOptions: {
      slowMo: 500, // Velocidade equilibrada
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});

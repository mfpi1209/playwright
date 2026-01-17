// Configuração para rodar no servidor (headless) - SIMULA HUMANO
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  timeout: 15 * 60 * 1000, // 15 minutos
  use: {
    trace: 'off', // Desabilitado no servidor para evitar erros de disco
    headless: true,
    screenshot: 'off', // Desabilitado no servidor
    video: 'off', // Desabilitado no servidor
    slowMo: 300, // Delay entre ações para parecer humano
    actionTimeout: 30000,
    navigationTimeout: 60000,
    // Configurações para parecer mais humano
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chromium',
      },
    },
  ],
  outputDir: 'test-results',
});

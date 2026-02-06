require('dotenv').config();
const { test } = require('@playwright/test');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT: Upload de Arquivos no Kommo via Playwright
// Faz login no Kommo e anexa arquivos ao lead automaticamente
// ═══════════════════════════════════════════════════════════════════════════

// Seletores base dos campos de arquivo no Kommo
const FIELD_SELECTORS = {
  'Aceite_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(47)',
  'Boleto_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(48)'
};

// Seletor do botão "Substituir" dentro do menu de cada campo
const SUBSTITUIR_SELECTORS = {
  'Aceite_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(47) > div.linked-form__field__value > div > div.js-tip-holder > div > div > div.tips-item.js-tips-item.drive-field__substitute.js-drive-field-substitute > label',
  'Boleto_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(48) > div.linked-form__field__value > div > div.js-tip-holder > div > div > div.tips-item.js-tips-item.drive-field__substitute.js-drive-field-substitute > label'
};

test('Upload arquivos para Kommo', async ({ page }) => {
  const KOMMO_EMAIL = process.env.KOMMO_EMAIL || 'adm@eduit.com.br';
  const KOMMO_PASSWORD = process.env.KOMMO_PASSWORD;
  const LEAD_ID = process.env.LEAD_ID || '20412541';
  const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH;
  const BOLETO_PATH = process.env.BOLETO_PATH;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📤 UPLOAD DE ARQUIVOS NO KOMMO');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`📋 Lead ID: ${LEAD_ID}`);
  console.log(`📸 Screenshot: ${SCREENSHOT_PATH || '(nenhum)'}`);
  console.log(`📄 Boleto: ${BOLETO_PATH || '(nenhum)'}`);
  console.log('');

  if (!KOMMO_PASSWORD) {
    console.error('❌ KOMMO_PASSWORD não configurado!');
    throw new Error('KOMMO_PASSWORD não configurado. Configure no .env do servidor.');
  }

  try {
    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 1: Login no Kommo
    // ═════════════════════════════════════════════════════════════════════
    console.log('🔐 Fazendo login no Kommo...');
    await page.goto('https://admamoeduitcombr.kommo.com/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[placeholder="Login"]').first().fill(KOMMO_EMAIL);
    await page.locator('input[placeholder="Password"]').first().fill(KOMMO_PASSWORD);

    await page.locator('button[type="submit"], button:has-text("Entrar"), input[type="submit"]').first().click();
    await page.waitForURL('**/chats/**|**/leads/**', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('   ✅ Login OK');

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 2: Navegar até o lead
    // ═════════════════════════════════════════════════════════════════════
    console.log(`🔍 Abrindo lead ${LEAD_ID}...`);
    await page.goto(`https://admamoeduitcombr.kommo.com/leads/detail/${LEAD_ID}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Fecha popup "Você atingiu o limite de sessões" se aparecer
    try {
      const closePopup = page.locator('.modal-body__close, .modal__close, [class*="modal"] .icon-close').first();
      if (await closePopup.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   ⚠️  Popup de limite de sessões, fechando...');
        await closePopup.click();
        await page.waitForTimeout(1500);
      }
    } catch (e) { /* ignora */ }

    // Scroll até os campos de arquivo
    const aceiteField = page.locator('text=Aceite_Inscricao').first();
    await aceiteField.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(async () => {
      for (let i = 0; i < 15; i++) {
        await page.evaluate(() => {
          document.querySelectorAll('[style*="overflow"], [class*="scroll"], .card-columns__column').forEach(el => el.scrollTop += 300);
          window.scrollBy(0, 300);
        });
        await page.waitForTimeout(400);
        if (await page.locator('text=Aceite_Inscricao').first().isVisible().catch(() => false)) break;
      }
    });
    await page.waitForTimeout(1000);

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 3: Upload dos arquivos
    // ═════════════════════════════════════════════════════════════════════
    if (SCREENSHOT_PATH) {
      console.log('📸 Processando Aceite_Inscricao...');
      await uploadParaCampo(page, SCREENSHOT_PATH, 'Aceite_Inscricao');
    }

    if (BOLETO_PATH) {
      console.log('📄 Processando Boleto_Inscricao...');
      await uploadParaCampo(page, BOLETO_PATH, 'Boleto_Inscricao');
    }

    console.log('');
    console.log('✅ UPLOAD CONCLUÍDO COM SUCESSO!');
    await page.waitForTimeout(1000);

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 4: Logoff do Kommo (liberar sessão)
    // ═════════════════════════════════════════════════════════════════════
    await fazerLogoff(page);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await page.screenshot({ path: `erro-kommo-upload-${Date.now()}.png`, fullPage: true }).catch(() => {});
    // Tenta logoff mesmo em caso de erro
    await fazerLogoff(page);
    throw error;
  }
});

/**
 * Upload de arquivo para um campo do Kommo.
 * 
 * Se já existe arquivo: clica no arquivo → abre menu → clica "Substituir" (CSS exato) → file chooser
 * Se campo vazio: clica no botão de upload → file chooser
 */
async function uploadParaCampo(page, filePath, nomeCampo) {
  const absolutePath = path.resolve(filePath);
  const fieldBase = FIELD_SELECTORS[nomeCampo];

  // Verifica se já tem arquivo no campo
  const temArquivo = await page.locator(`${fieldBase} .drive-field__controls_aligned`).first()
    .isVisible({ timeout: 3000 }).catch(() => false);

  let fileChooser = null;

  if (temArquivo) {
    // ─── Campo com arquivo: abrir menu e clicar "Substituir" ───
    console.log(`   → Arquivo existente detectado, abrindo menu...`);

    // Clica no arquivo para abrir o menu dropdown
    const fileArea = page.locator(`${fieldBase} .drive-field__controls_aligned`).first();
    await fileArea.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(500);
    await fileArea.click();
    await page.waitForTimeout(1500);

    // Clica em "Substituir" usando o seletor CSS exato
    const substituirBtn = page.locator(SUBSTITUIR_SELECTORS[nomeCampo]);
    const subVisible = await substituirBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (subVisible) {
      console.log(`   → Clicando "Substituir"...`);
      try {
        [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 15000 }),
          substituirBtn.click()
        ]);
        console.log(`   → File chooser aberto via "Substituir"`);
      } catch (e) {
        console.log(`   → "Substituir" clicou mas file chooser não abriu: ${e.message.substring(0, 50)}`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
      }
    } else {
      console.log(`   → Menu "Substituir" não visível, fechando menu...`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  if (!fileChooser) {
    // ─── Campo vazio ou Substituir falhou: upload direto ───
    console.log(`   → Upload direto no botão do campo...`);
    const uploadBtn = page.locator(`${fieldBase} .drive-field__controls div div`).first();
    await uploadBtn.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    try {
      [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        uploadBtn.click()
      ]);
    } catch (e) {
      throw new Error(`Não foi possível abrir file chooser para ${nomeCampo}: ${e.message.substring(0, 80)}`);
    }
  }

  // Envia o arquivo
  await fileChooser.setFiles(absolutePath);
  console.log(`   → Arquivo enviado, aguardando processamento...`);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `kommo-uploaded-${nomeCampo}.png` });
  console.log(`   ✅ ${nomeCampo}: ${path.basename(absolutePath)} anexado`);
}

/**
 * Faz logoff do Kommo para liberar a sessão ativa.
 * Navega para /logout ou clica no menu do perfil → Sair.
 */
async function fazerLogoff(page) {
  try {
    console.log('🔓 Fazendo logoff do Kommo...');
    await page.goto('https://admamoeduitcombr.kommo.com/logout', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ Logoff realizado com sucesso');
  } catch (e) {
    console.log(`   ⚠️  Logoff falhou (${e.message.substring(0, 50)}), sessão pode continuar ativa`);
  }
}

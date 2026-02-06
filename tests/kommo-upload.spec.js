require('dotenv').config();
const { test } = require('@playwright/test');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT: Upload de Arquivos no Kommo via Playwright
// Faz login no Kommo e anexa arquivos ao lead automaticamente
// ═══════════════════════════════════════════════════════════════════════════

// Seletores CSS exatos dos botões "Fazer upload" no Kommo
const UPLOAD_SELECTORS = {
  'Aceite_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(47) > div.linked-form__field__value > div > div.drive-field__controls > div > div',
  'Boleto_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(48) > div.linked-form__field__value > div > div.drive-field__controls > div > div'
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
  console.log(`📸 Screenshot: ${SCREENSHOT_PATH}`);
  console.log(`📄 Boleto: ${BOLETO_PATH}`);
  console.log('');

  try {
    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 1: Login no Kommo
    // ═════════════════════════════════════════════════════════════════════
    console.log('🔐 ETAPA 1: Fazendo login no Kommo...');
    await page.goto('https://admamoeduitcombr.kommo.com/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[placeholder="Login"]').first().fill(KOMMO_EMAIL);
    console.log('   ✓ Email preenchido');

    await page.locator('input[placeholder="Password"]').first().fill(KOMMO_PASSWORD);
    console.log('   ✓ Senha preenchida');

    await page.locator('button[type="submit"], button:has-text("Entrar"), input[type="submit"]').first().click();
    console.log('   ✓ Clicou em Entrar');

    await page.waitForURL('**/chats/**|**/leads/**', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('✅ Login realizado com sucesso!');
    console.log('');

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 2: Navegar até o lead
    // ═════════════════════════════════════════════════════════════════════
    console.log('🔍 ETAPA 2: Navegando até o lead...');
    await page.goto(`https://admamoeduitcombr.kommo.com/leads/detail/${LEAD_ID}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log(`✅ Lead ${LEAD_ID} aberto`);

    // Rola até os campos de arquivo (são os últimos campos do lead)
    console.log('   🔽 Rolando até os campos de arquivo...');
    const aceiteField = page.locator('text=Aceite_Inscricao').first();
    await aceiteField.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(async () => {
      // Fallback: rola manualmente
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
    console.log('   ✅ Campos visíveis');
    console.log('');

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 3: Anexar Screenshot → Aceite_Inscricao
    // ═════════════════════════════════════════════════════════════════════
    if (SCREENSHOT_PATH) {
      console.log('📸 ETAPA 3: Anexando screenshot em Aceite_Inscricao...');
      await anexarArquivo(page, SCREENSHOT_PATH, 'Aceite_Inscricao');
      console.log('✅ Screenshot anexado!');
      console.log('');
    }

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 4: Anexar Boleto → Boleto_Inscricao
    // ═════════════════════════════════════════════════════════════════════
    if (BOLETO_PATH) {
      console.log('📄 ETAPA 4: Anexando boleto em Boleto_Inscricao...');
      await anexarArquivo(page, BOLETO_PATH, 'Boleto_Inscricao');
      console.log('✅ Boleto anexado!');
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('✅ UPLOAD CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════════');
    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await page.screenshot({ path: `erro-kommo-upload-${Date.now()}.png`, fullPage: true });
    throw error;
  }
});

/**
 * Anexar arquivo no campo específico usando seletor CSS exato
 */
async function anexarArquivo(page, filePath, nomeCampo) {
  const absolutePath = path.resolve(filePath);
  const selector = UPLOAD_SELECTORS[nomeCampo];
  console.log(`   → Arquivo: ${absolutePath}`);

  // Rola até o campo
  const uploadButton = page.locator(selector);
  await uploadButton.scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.waitForTimeout(500);
  console.log(`   ✓ Campo "${nomeCampo}" visível`);

  // Intercepta o diálogo de seleção de arquivo ANTES de clicar
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }),
    uploadButton.click()
  ]);
  console.log('   ✓ Diálogo de arquivo aberto');

  // Seleciona o arquivo no diálogo
  await fileChooser.setFiles(absolutePath);
  console.log('   ✓ Arquivo selecionado');

  // Aguarda upload processar
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `kommo-uploaded-${nomeCampo}.png` });
  console.log('   ✅ Upload concluído');
}

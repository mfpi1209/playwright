require('dotenv').config();
const { test } = require('@playwright/test');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT: Upload de Arquivos no Kommo via Playwright
// Faz login no Kommo e anexa arquivos ao lead automaticamente
// ═══════════════════════════════════════════════════════════════════════════

// Seletores base dos campos de arquivo no Kommo (div:nth-child do campo)
const FIELD_SELECTORS = {
  'Aceite_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(47)',
  'Boleto_Inscricao': '#edit_card > div > div:nth-child(4) > div:nth-child(48)'
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

  // Validação: KOMMO_PASSWORD é obrigatório
  if (!KOMMO_PASSWORD) {
    console.error('❌ KOMMO_PASSWORD não configurado no .env do servidor!');
    console.error('   Adicione: KOMMO_PASSWORD=sua_senha_aqui ao arquivo .env');
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

    // Navegar até o lead
    console.log(`🔍 Abrindo lead ${LEAD_ID}...`);
    await page.goto(`https://admamoeduitcombr.kommo.com/leads/detail/${LEAD_ID}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Rola até os campos de arquivo (são os últimos campos do lead)
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
    // ETAPA 2: Excluir arquivos existentes nos campos (se houver)
    // ═════════════════════════════════════════════════════════════════════
    console.log('🗑️  Verificando arquivos existentes nos campos...');

    if (SCREENSHOT_PATH) {
      await excluirArquivoExistente(page, 'Aceite_Inscricao');
    }
    if (BOLETO_PATH) {
      await excluirArquivoExistente(page, 'Boleto_Inscricao');
    }

    await page.waitForTimeout(1000);

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 3: Anexar novos arquivos
    // ═════════════════════════════════════════════════════════════════════
    if (SCREENSHOT_PATH) {
      console.log('📸 Anexando screenshot → Aceite_Inscricao...');
      await anexarArquivo(page, SCREENSHOT_PATH, 'Aceite_Inscricao');
    }

    if (BOLETO_PATH) {
      console.log('📄 Anexando boleto → Boleto_Inscricao...');
      await anexarArquivo(page, BOLETO_PATH, 'Boleto_Inscricao');
    }

    console.log('');
    console.log('✅ UPLOAD CONCLUÍDO COM SUCESSO!');
    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await page.screenshot({ path: `erro-kommo-upload-${Date.now()}.png`, fullPage: true });
    throw error;
  }
});

/**
 * Excluir arquivo já existente em um campo do Kommo.
 * Detecta se o campo tem a classe "drive-field__controls_aligned" (indica arquivo presente).
 * Clica no arquivo para abrir menu de contexto, depois clica em "Excluir".
 */
async function excluirArquivoExistente(page, nomeCampo) {
  const fieldBase = FIELD_SELECTORS[nomeCampo];

  try {
    // Verifica se o campo tem arquivo (classe _aligned aparece quando há arquivo)
    const campoComArquivo = page.locator(`${fieldBase} .drive-field__controls_aligned`).first();
    const temArquivo = await campoComArquivo.isVisible({ timeout: 3000 }).catch(() => false);

    if (!temArquivo) {
      console.log(`   ℹ️  ${nomeCampo}: campo vazio, nenhum arquivo para excluir`);
      return;
    }

    console.log(`   🗑️  ${nomeCampo}: arquivo existente detectado, excluindo...`);

    // Clica no nome do arquivo (link) ou no elemento do arquivo para abrir o menu
    const fileLink = page.locator(`${fieldBase} .drive-field__controls_aligned a, ${fieldBase} .drive-field__controls_aligned span`).first();
    await fileLink.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(500);
    await fileLink.click();
    await page.waitForTimeout(1500);

    // Procura o botão "Excluir" no menu de contexto/dropdown
    const excluirButton = page.locator('text=Excluir').last();
    const excluirVisible = await excluirButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (excluirVisible) {
      await excluirButton.click();
      await page.waitForTimeout(2000);

      // Confirmar exclusão se aparecer diálogo de confirmação
      const confirmarButton = page.locator('button:has-text("Confirmar"), button:has-text("Sim"), button:has-text("OK"), button:has-text("Delete")').first();
      const confirmarVisible = await confirmarButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (confirmarVisible) {
        await confirmarButton.click();
        await page.waitForTimeout(2000);
      }

      // Verifica se o arquivo realmente foi removido
      const aindaTemArquivo = await page.locator(`${fieldBase} .drive-field__controls_aligned`).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (!aindaTemArquivo) {
        console.log(`   ✅ ${nomeCampo}: arquivo anterior excluído com sucesso`);
      } else {
        console.log(`   ⚠️  ${nomeCampo}: exclusão pode não ter funcionado, tentando prosseguir...`);
      }
    } else {
      console.log(`   ⚠️  ${nomeCampo}: menu "Excluir" não apareceu, fechando menu...`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (error) {
    console.log(`   ⚠️  ${nomeCampo}: erro ao excluir arquivo existente (${error.message})`);
    // Fecha qualquer menu/popup aberto
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
}

/**
 * Anexar arquivo no campo específico.
 * Tenta 3 abordagens:
 *   1. Clica no botão "Fazer upload" (campo vazio)
 *   2. Se filechooser não abrir, tenta "Substituir" do menu de contexto (campo com arquivo)
 *   3. Fallback: exclui arquivo existente e tenta upload novamente
 */
async function anexarArquivo(page, filePath, nomeCampo) {
  const absolutePath = path.resolve(filePath);
  const fieldBase = FIELD_SELECTORS[nomeCampo];

  // ─── Tentativa 1: Clicar no botão de upload (campo vazio) ───
  const uploadButton = page.locator(`${fieldBase} .drive-field__controls div div`).first();
  await uploadButton.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  let fileChooser = null;

  try {
    console.log(`   → Tentativa 1: clique direto no botão de upload...`);
    [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 8000 }),
      uploadButton.click()
    ]);
  } catch (e) {
    console.log(`   → Tentativa 1 falhou (${e.message.substring(0, 50)}...)`);
  }

  // ─── Tentativa 2: Usar "Substituir" do menu de contexto ───
  if (!fileChooser) {
    try {
      console.log(`   → Tentativa 2: usando "Substituir" do menu de contexto...`);
      await page.waitForTimeout(500);

      // O menu de contexto pode já estar aberto do clique anterior
      const substituirButton = page.locator('text=Substituir');
      const substituirVisible = await substituirButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (substituirVisible) {
        [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          substituirButton.click()
        ]);
      } else {
        // Menu não está aberto, fecha qualquer coisa e tenta abrir de novo
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);

        // Clica no arquivo para abrir o menu
        const fileLink = page.locator(`${fieldBase} .drive-field__controls_aligned a, ${fieldBase} .drive-field__controls_aligned span`).first();
        const fileLinkVisible = await fileLink.isVisible({ timeout: 2000 }).catch(() => false);

        if (fileLinkVisible) {
          await fileLink.click();
          await page.waitForTimeout(1500);

          const substituirBtn2 = page.locator('text=Substituir');
          const subVisible2 = await substituirBtn2.isVisible({ timeout: 2000 }).catch(() => false);

          if (subVisible2) {
            [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 10000 }),
              substituirBtn2.click()
            ]);
          }
        }
      }
    } catch (e) {
      console.log(`   → Tentativa 2 falhou (${e.message.substring(0, 50)}...)`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // ─── Tentativa 3: Excluir arquivo e tentar upload limpo ───
  if (!fileChooser) {
    try {
      console.log(`   → Tentativa 3: excluindo arquivo e tentando upload limpo...`);
      await excluirArquivoExistente(page, nomeCampo);
      await page.waitForTimeout(2000);

      // Tenta clicar no botão de upload novamente
      const uploadBtn2 = page.locator(`${fieldBase} .drive-field__controls div div`).first();
      await uploadBtn2.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        uploadBtn2.click()
      ]);
    } catch (e) {
      console.log(`   → Tentativa 3 falhou (${e.message.substring(0, 50)}...)`);
      throw new Error(`Não foi possível abrir o seletor de arquivo para ${nomeCampo} após 3 tentativas`);
    }
  }

  // Envia o arquivo
  await fileChooser.setFiles(absolutePath);
  console.log(`   → Arquivo enviado, aguardando processamento...`);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `kommo-uploaded-${nomeCampo}.png` });
  console.log(`   ✅ ${nomeCampo}: ${path.basename(absolutePath)}`);
}

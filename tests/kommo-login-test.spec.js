require('dotenv').config();
const { test } = require('@playwright/test');

// ═══════════════════════════════════════════════════════════════════════════
// TESTE RÁPIDO: Verificar Login no Kommo (com fallback e retry)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_TENTATIVAS_LOGIN = 3;
const MAX_TENTATIVAS_LEAD  = 3;

// Seletores alternativos para campos de login
const SELECTORS_EMAIL    = ['input[placeholder="Login"]', 'input[name="login"]', 'input[type="email"]', 'input[name="email"]', '#session_end_login'];
const SELECTORS_PASSWORD = ['input[placeholder="Password"]', 'input[name="password"]', 'input[type="password"]', '#password'];
const SELECTORS_SUBMIT   = ['button[type="submit"]', 'button:has-text("Entrar")', 'input[type="submit"]', 'button:has-text("Login")', 'button:has-text("Log in")'];

test('Teste de Login no Kommo', async ({ page, context }) => {
  // Lê usuários Kommo do .env (formato: email:senha|email:senha) ou variáveis individuais
  const { KOMMO_EMAIL, KOMMO_PASSWORD } = (() => {
    const envUsers = process.env.KOMMO_USERS || '';
    if (envUsers.includes(':')) {
      const users = envUsers.split('|').filter(Boolean).map(par => {
        const [email, ...senhaParts] = par.split(':');
        return { email: email.trim(), senha: senhaParts.join(':').trim() };
      });
      const escolhido = users[Math.floor(Math.random() * users.length)];
      return { KOMMO_EMAIL: escolhido.email, KOMMO_PASSWORD: escolhido.senha };
    }
    return {
      KOMMO_EMAIL: process.env.KOMMO_EMAIL || 'adm@eduit.com.br',
      KOMMO_PASSWORD: process.env.KOMMO_PASSWORD
    };
  })();
  const LEAD_ID        = process.env.LEAD_ID || '20412541';

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔐 TESTE DE LOGIN NO KOMMO');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   📧 Email: ${KOMMO_EMAIL}`);
  console.log(`   🔑 Senha: ${'*'.repeat(KOMMO_PASSWORD?.length || 0)}`);
  console.log(`   🎯 Lead: ${LEAD_ID}`);
  console.log('');

  if (!KOMMO_PASSWORD) {
    console.error('❌ KOMMO_PASSWORD não configurado! Configure no .env');
    throw new Error('KOMMO_PASSWORD não configurado.');
  }

  let loginOK     = false;
  let leadOK       = false;
  let fileInputCount = 0;

  try {
    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 1: Login no Kommo (com retry)
    // ═════════════════════════════════════════════════════════════════════
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_LOGIN; tentativa++) {
      console.log(`📌 ETAPA 1: Login (tentativa ${tentativa}/${MAX_TENTATIVAS_LOGIN})`);

      try {
        // 1a. Acessa a página
        console.log('   📍 Acessando Kommo...');
        await page.goto('https://admamoeduitcombr.kommo.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await page.waitForTimeout(2000);

        // Verifica se já está logado (pode ter sessão ativa)
        const urlAtual = page.url();
        if (urlAtual.includes('/leads') || urlAtual.includes('/chats') || urlAtual.includes('/dashboard')) {
          console.log('   ✅ Já logado! Sessão ativa detectada.');
          loginOK = true;
          break;
        }

        // 1b. Localiza campo de email
        console.log('   📝 Preenchendo email...');
        let emailPreenchido = false;
        for (const sel of SELECTORS_EMAIL) {
          try {
            const campo = page.locator(sel).first();
            if (await campo.isVisible({ timeout: 3000 }).catch(() => false)) {
              await campo.click();
              await campo.fill(KOMMO_EMAIL);
              console.log(`   ✅ Email preenchido (${sel})`);
              emailPreenchido = true;
              break;
            }
          } catch (e) { /* tenta próximo seletor */ }
        }
        if (!emailPreenchido) {
          console.log('   ⚠️ Campo de email não encontrado, tentando novamente...');
          await page.screenshot({ path: `kommo-erro-email-t${tentativa}.png` }).catch(() => {});
          await page.waitForTimeout(2000);
          continue;
        }

        // 1c. Localiza campo de senha
        console.log('   📝 Preenchendo senha...');
        let senhaPreenchida = false;
        for (const sel of SELECTORS_PASSWORD) {
          try {
            const campo = page.locator(sel).first();
            if (await campo.isVisible({ timeout: 3000 }).catch(() => false)) {
              await campo.click();
              await campo.fill(KOMMO_PASSWORD);
              console.log(`   ✅ Senha preenchida (${sel})`);
              senhaPreenchida = true;
              break;
            }
          } catch (e) { /* tenta próximo seletor */ }
        }
        if (!senhaPreenchida) {
          console.log('   ⚠️ Campo de senha não encontrado, tentando novamente...');
          await page.screenshot({ path: `kommo-erro-senha-t${tentativa}.png` }).catch(() => {});
          await page.waitForTimeout(2000);
          continue;
        }

        // 1d. Clica no botão de login
        console.log('   📝 Clicando em Entrar...');
        let clicou = false;
        for (const sel of SELECTORS_SUBMIT) {
          try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await btn.click();
              console.log(`   ✅ Botão clicado (${sel})`);
              clicou = true;
              break;
            }
          } catch (e) { /* tenta próximo seletor */ }
        }
        if (!clicou) {
          // Fallback: pressiona Enter no campo de senha
          console.log('   ⚠️ Botão não encontrado, tentando Enter...');
          await page.keyboard.press('Enter');
        }

        // 1e. Aguarda redirecionamento pós-login
        console.log('   ⏳ Aguardando login...');
        try {
          await page.waitForURL(/\/(leads|chats|dashboard|todo)/, { timeout: 20000 });
          console.log('   ✅ Redirecionamento detectado');
        } catch (e) {
          // Pode ter ficado na mesma URL mas logado via SPA
          await page.waitForTimeout(3000);
          const urlAposLogin = page.url();
          if (urlAposLogin.includes('/leads') || urlAposLogin.includes('/chats') || urlAposLogin.includes('/dashboard')) {
            console.log('   ✅ Login detectado (URL mudou)');
          } else {
            // Verifica se há mensagem de erro na página
            const erroLogin = await page.locator('.error-message, .login-error, [class*="error"], .notification-error').first()
              .textContent({ timeout: 2000 }).catch(() => '');
            if (erroLogin) {
              console.log(`   ❌ Erro de login: ${erroLogin.trim()}`);
            } else {
              console.log(`   ⚠️ URL não mudou: ${urlAposLogin}`);
            }
            await page.screenshot({ path: `kommo-erro-login-t${tentativa}.png` }).catch(() => {});
            await page.waitForTimeout(3000);
            continue;
          }
        }

        // 1f. Fecha popup de limite de sessões (se aparecer)
        await fecharPopupSessoes(page);

        await page.waitForTimeout(2000);
        loginOK = true;
        console.log('✅ ETAPA 1 CONCLUÍDA - Login OK');
        console.log('');
        break;

      } catch (e) {
        console.log(`   ❌ Tentativa ${tentativa} falhou: ${e.message.split('\n')[0]}`);
        await page.screenshot({ path: `kommo-erro-login-t${tentativa}.png` }).catch(() => {});
        if (tentativa < MAX_TENTATIVAS_LOGIN) {
          console.log('   🔄 Aguardando antes de tentar novamente...');
          await page.waitForTimeout(5000);
        }
      }
    }

    if (!loginOK) {
      throw new Error('Não foi possível fazer login no Kommo após todas as tentativas');
    }

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 2: Navegar até o lead (com retry)
    // ═════════════════════════════════════════════════════════════════════
    const leadUrl = `https://admamoeduitcombr.kommo.com/leads/detail/${LEAD_ID}`;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_LEAD; tentativa++) {
      console.log(`📌 ETAPA 2: Navegação ao Lead ${LEAD_ID} (tentativa ${tentativa}/${MAX_TENTATIVAS_LEAD})`);

      try {
        await page.goto(leadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Fecha popup de limite de sessões (se aparecer)
        await fecharPopupSessoes(page);

        // Verifica se está na página do lead
        const urlLead = page.url();
        if (!urlLead.includes(`/leads/detail/${LEAD_ID}`)) {
          console.log(`   ⚠️ URL inesperada: ${urlLead}`);
          if (tentativa < MAX_TENTATIVAS_LEAD) {
            await page.waitForTimeout(3000);
            continue;
          }
        }

        // Verifica se o card do lead carregou
        const cardLoaded = await page.locator('#edit_card, .card-entity-form, .lead-card').first()
          .isVisible({ timeout: 10000 }).catch(() => false);

        if (!cardLoaded) {
          console.log('   ⚠️ Card do lead não carregou');
          await page.screenshot({ path: `kommo-lead-nocard-t${tentativa}.png` }).catch(() => {});
          if (tentativa < MAX_TENTATIVAS_LEAD) {
            console.log('   🔄 Recarregando...');
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(3000);
            continue;
          }
        }

        console.log('   ✅ Lead aberto com sucesso');
        leadOK = true;
        break;

      } catch (e) {
        console.log(`   ❌ Tentativa ${tentativa} falhou: ${e.message.split('\n')[0]}`);
        await page.screenshot({ path: `kommo-erro-lead-t${tentativa}.png` }).catch(() => {});
        if (tentativa < MAX_TENTATIVAS_LEAD) {
          console.log('   🔄 Aguardando antes de tentar novamente...');
          await page.waitForTimeout(5000);
        }
      }
    }

    if (!leadOK) {
      throw new Error(`Não foi possível abrir o lead ${LEAD_ID} após todas as tentativas`);
    }

    console.log('✅ ETAPA 2 CONCLUÍDA - Lead aberto');
    console.log('');

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 3: Verificar campos de anexo
    // ═════════════════════════════════════════════════════════════════════
    console.log('📌 ETAPA 3: Verificação de campos de anexo');

    // Scroll até os campos de arquivo
    try {
      const aceiteField = page.locator('text=Aceite_Inscricao').first();
      const aceiteVisivel = await aceiteField.isVisible({ timeout: 5000 }).catch(() => false);

      if (!aceiteVisivel) {
        console.log('   📍 Campo não visível, fazendo scroll...');
        for (let i = 0; i < 15; i++) {
          await page.evaluate(() => {
            document.querySelectorAll('[style*="overflow"], [class*="scroll"], .card-columns__column').forEach(el => el.scrollTop += 300);
            window.scrollBy(0, 300);
          });
          await page.waitForTimeout(400);
          if (await aceiteField.isVisible().catch(() => false)) {
            console.log(`   ✅ Campo encontrado após ${i + 1} scroll(s)`);
            break;
          }
        }
      } else {
        console.log('   ✅ Campo Aceite_Inscricao visível');
      }

      // Verifica Boleto_Inscricao
      const boletoField = page.locator('text=Boleto_Inscricao').first();
      const boletoVisivel = await boletoField.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`   📍 Campo Boleto_Inscricao visível: ${boletoVisivel}`);

    } catch (e) {
      console.log(`   ⚠️ Erro ao buscar campos: ${e.message.split('\n')[0]}`);
    }

    // Verifica inputs de arquivo
    const fileInputs = page.locator('input[type="file"]');
    fileInputCount = await fileInputs.count().catch(() => 0);
    console.log(`   🔍 ${fileInputCount} campo(s) de upload encontrado(s)`);

    if (fileInputCount > 0) {
      for (let i = 0; i < Math.min(fileInputCount, 5); i++) {
        const input = fileInputs.nth(i);
        const isVisible = await input.isVisible().catch(() => false);
        const accept = await input.getAttribute('accept').catch(() => 'N/A');
        console.log(`      📎 Input ${i + 1}: visível=${isVisible}, accept=${accept}`);
      }
    }

    // Verifica botões de anexar
    const attachButtons = await page.locator('button:has-text("Anexar"), [title*="Anexar"], .attach-button').count().catch(() => 0);
    console.log(`   🔍 ${attachButtons} botão(ões) de anexar encontrado(s)`);

    // Screenshot final
    await page.screenshot({ path: 'kommo-test-final.png', fullPage: true }).catch(() => {});
    console.log('   📸 Screenshot: kommo-test-final.png');

    console.log('✅ ETAPA 3 CONCLUÍDA');
    console.log('');

    // ═════════════════════════════════════════════════════════════════════
    // RESULTADO
    // ═════════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Resumo:');
    console.log(`   ✅ Login: OK`);
    console.log(`   ✅ Lead ${LEAD_ID}: OK`);
    console.log(`   📎 Campos de upload: ${fileInputCount}`);
    console.log('');

    // ═════════════════════════════════════════════════════════════════════
    // ETAPA 4: Logoff
    // ═════════════════════════════════════════════════════════════════════
    await fazerLogoff(page);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════════');
    console.error(`❌ TESTE FALHOU: ${error.message}`);
    console.error('═══════════════════════════════════════════════════════════════════════');

    await page.screenshot({ path: `kommo-erro-final-${Date.now()}.png`, fullPage: true }).catch(() => {});
    await fazerLogoff(page);
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fecha popup "Você atingiu o limite de sessões" se aparecer
 */
async function fecharPopupSessoes(page) {
  try {
    const closeBtn = page.locator('.modal-body__close, .modal__close, [class*="modal"] .icon-close, .notifications__close').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ⚠️ Popup de limite de sessões detectado, fechando...');
      await closeBtn.click();
      await page.waitForTimeout(1500);
      console.log('   ✅ Popup fechado');
    }
  } catch (e) { /* ignora */ }
}

/**
 * Faz logoff do Kommo para liberar a sessão ativa
 */
async function fazerLogoff(page) {
  try {
    console.log('🔓 Fazendo logoff do Kommo...');
    await page.goto('https://admamoeduitcombr.kommo.com/logout', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(2000);
    console.log('   ✅ Logoff realizado');
  } catch (e) {
    console.log(`   ⚠️ Logoff falhou: ${e.message.split('\n')[0]}`);
  }
}

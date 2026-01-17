// inscricaocompleta.js
import { chromium } from 'playwright';

(async () => {
  // Inicia o navegador
  const browser = await chromium.launch({ 
    headless: false // Muda para true se não quiser ver o navegador
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Acessa página de login
    console.log('Acessando página de login...');
    await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
    
    // 2. Preenche e-mail
    console.log('Preenchendo e-mail...');
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill('marcelo.pinheiro1876@polo.cruzeirodosul.edu.br');
    
    // 3. Clica em continuar
    await page.getByRole('button', { name: 'Continuar' }).click();
    
    // 4. Aguarda campo de senha aparecer e preenche
    console.log('Preenchendo senha...');
    const senhaInput = page.getByRole('textbox', { name: 'Senha' });
    await senhaInput.waitFor({ state: 'visible' });
    await senhaInput.fill('MFPedu!t678@!');
    
    // 5. Clica em continuar para fazer login
    await page.getByRole('button', { name: 'Continuar' }).click();
    
    // 6. Aguarda navegação completar
    console.log('Fazendo login...');
    await page.waitForLoadState('networkidle');
    
    // 7. Navega para página de graduação
    console.log('Navegando para graduação...');
    await page.goto('https://cruzeirodosul.myvtex.com/graduacao');
    
    // 8. Aceita cookies
    try {
      await page.getByLabel('Aceitar todos').click({ timeout: 5000 });
      console.log('Cookies aceitos');
    } catch (error) {
      console.log('Banner de cookies não encontrado');
    }
    
    // 9. Fecha modal
    try {
      await page.getByRole('button', { name: '✕' }).click({ timeout: 3000 });
      console.log('Modal fechado');
    } catch (error) {
      console.log('Modal não encontrado');
    }
    
    console.log('✅ Script executado com sucesso!');
    console.log(`URL atual: ${page.url()}`);
    
    // Aguarda 5 segundos antes de fechar
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Erro ao executar script:', error.message);
  } finally {
    await browser.close();
  }
})();

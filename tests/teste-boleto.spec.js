// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const CPF = '26415424041';
const CURSO = 'MBA EM GESTÃO PÚBLICA';

test('captura-boleto-direto', async ({ page, context }) => {
  const timestamp = Date.now();
  let pdfBuffer = null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCEPTAÇÃO DE REDE PARA CAPTURAR O PDF DIRETAMENTE
  // ═══════════════════════════════════════════════════════════════════════════
  await context.route('**/boleto/getBoletoDiversos**', async (route) => {
    const pdfUrl = route.request().url();
    console.log(`🎯 URL do PDF interceptada: ${pdfUrl.substring(0, 80)}...`);
    
    // Faz a requisição e captura a resposta
    const response = await route.fetch();
    const body = await response.body();
    
    console.log(`📄 Content-Type: ${response.headers()['content-type']}`);
    console.log(`📦 Tamanho: ${body.length} bytes`);
    
    // Se começa com %PDF, é o PDF real
    if (body.slice(0, 5).toString().includes('%PDF')) {
      pdfBuffer = body;
      console.log('✅ PDF capturado com sucesso via interceptação!');
    }
    
    // Continua a requisição normalmente para o browser
    await route.fulfill({ response });
  });
  
  // Navega direto para o SIAA
  await page.goto('https://siaa.cruzeirodosul.edu.br/vestibular-inscricao/resultado/index.jsf?codigoEmpresa=7');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // Preenche CPF
  const campoCpf = page.locator('input[id*="cpf"], input[name*="cpf"]').first();
  await campoCpf.click();
  await campoCpf.clear();
  await campoCpf.type(CPF, { delay: 50 });
  await page.waitForTimeout(500);
  console.log(`✅ CPF preenchido: ${CPF}`);
  
  // Clica em Próximo
  const btnProximo = page.getByRole('button', { name: /Próximo/i });
  await btnProximo.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  
  // Se tiver modal de seleção, seleciona o curso correto
  const modalResultados = page.locator('text=Resultados das Inscrições').first();
  if (await modalResultados.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('📋 Modal de seleção detectado');
    
    // Clica no trigger do dropdown PrimeFaces para abrir
    const dropdownTrigger = page.locator('.ui-selectonemenu-trigger').first();
    await dropdownTrigger.click({ force: true });
    await page.waitForTimeout(1000);
    console.log('   📂 Dropdown aberto');
    
    // Lista as opções visíveis no painel do dropdown
    const opcoes = page.locator('.ui-selectonemenu-item');
    const count = await opcoes.count();
    console.log(`   Opções disponíveis: ${count}`);
    
    let cursoEncontrado = false;
    for (let i = 0; i < count; i++) {
      const texto = await opcoes.nth(i).textContent();
      console.log(`   ${i + 1}. ${texto.substring(0, 80)}...`);
      
      // Procura pelo curso MBA EM GESTÃO PÚBLICA
      if (texto.toUpperCase().includes('MBA') && texto.toUpperCase().includes('GESTÃO PÚBLICA')) {
        await opcoes.nth(i).click();
        console.log(`   ✅ Curso selecionado: ${CURSO}`);
        cursoEncontrado = true;
        break;
      }
    }
    
    if (!cursoEncontrado) {
      console.log('   ⚠️ Curso não encontrado, selecionando última opção');
      await opcoes.last().click();
    }
    
    await page.waitForTimeout(1500);
    
    // Clica em Acessar
    const btnAcessar = page.locator('button:has(span:has-text("Acessar")), span.ui-button-text:has-text("Acessar")').first();
    await btnAcessar.click({ force: true });
    console.log('   ✅ Botão Acessar clicado');
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  }
  
  console.log(`📍 URL: ${page.url()}`);
  
  // Verifica se está na página de aprovação
  const textoParabens = page.locator('text=Parabéns').first();
  if (await textoParabens.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('✅ Página de aprovação confirmada');
  }
  
  // Scroll para encontrar o botão Emitir Boleto
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1000);
  
  // Clica em Emitir Boleto
  const btnEmitir = page.locator('#formulario\\:acm\\:emissao_boleto, button[id*="emissao_boleto"]').first();
  
  if (await btnEmitir.isVisible({ timeout: 5000 })) {
    console.log('📄 Clicando em Emitir Boleto...');
    await btnEmitir.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Aguarda nova página
    const [boletoPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 20000 }),
      btnEmitir.click({ force: true })
    ]);
    
    await boletoPage.waitForLoadState('load');
    await boletoPage.waitForTimeout(3000);
    
    const urlBoleto = boletoPage.url();
    console.log(`📍 URL do boleto: ${urlBoleto.substring(0, 80)}...`);
    
    // Verifica se capturou o PDF via interceptação
    if (pdfBuffer) {
      const pdfPath = `boleto-${timestamp}.pdf`;
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('✅ BOLETO PDF BAIXADO DIRETAMENTE VIA INTERCEPTAÇÃO!');
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log(`📁 Arquivo: ${pdfPath}`);
      console.log(`📦 Tamanho: ${pdfBuffer.length} bytes`);
      
      // Verifica se o PDF foi salvo corretamente
      const stats = fs.statSync(pdfPath);
      console.log(`📊 Verificação: ${stats.size} bytes no disco`);
      
      // Tenta extrair linha digitável do conteúdo do PDF
      try {
        const pdfText = pdfBuffer.toString('latin1');
        const codigoMatch = pdfText.match(/\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14}/);
        if (codigoMatch) {
          console.log(`📊 Linha digitável: ${codigoMatch[0]}`);
        }
      } catch (e) {}
      
      console.log('═══════════════════════════════════════════════════════════════════════════');
    } else {
      console.log('❌ PDF não capturado via interceptação');
    }
    
    await boletoPage.close();
  } else {
    console.log('❌ Botão Emitir Boleto não encontrado');
    await page.screenshot({ path: 'erro-emitir.png', fullPage: true });
  }
  
  // Remove a interceptação
  await context.unroute('**/boleto/getBoletoDiversos**');
});

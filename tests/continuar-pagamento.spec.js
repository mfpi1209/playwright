// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Dados do cliente
const CLIENTE = {
  cpf: '44220806873',
  nome: 'Monique Mendes dos Santos'
};

const ORDER_ID = '1608773147449';

test('continuar-pagamento', async ({ page, context }) => {
  test.setTimeout(300000); // 5 minutos
  
  const timestamp = Date.now();
  let pdfBuffer = null;
  
  console.log('📌 Continuando fluxo de pagamento...');
  console.log(`   CPF: ${CLIENTE.cpf}`);
  console.log(`   Pedido: ${ORDER_ID}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCEPTAÇÃO DE REDE PARA CAPTURAR O PDF DO BOLETO DIRETAMENTE
  // ═══════════════════════════════════════════════════════════════════════════
  await context.route('**/boleto/getBoletoDiversos**', async (route) => {
    const pdfUrl = route.request().url();
    console.log(`   🎯 URL do PDF interceptada: ${pdfUrl.substring(0, 80)}...`);
    
    // Faz a requisição e captura a resposta
    const response = await route.fetch();
    const body = await response.body();
    
    console.log(`   📄 Content-Type: ${response.headers()['content-type']}`);
    console.log(`   📦 Tamanho: ${body.length} bytes`);
    
    // Se começa com %PDF, é o PDF real
    if (body.slice(0, 5).toString().includes('%PDF')) {
      pdfBuffer = body;
      console.log('   ✅ PDF capturado com sucesso via interceptação!');
    }
    
    // Continua a requisição normalmente para o browser
    await route.fulfill({ response });
  });
  
  // Navega para a página de confirmação do pedido
  await page.goto(`https://cruzeirodosul.myvtex.com/checkout/orderPlaced/?og=${ORDER_ID}`);
  await page.waitForTimeout(3000);
  
  // Login admin se necessário
  const loginField = page.getByRole('textbox', { name: 'Email' });
  if (await loginField.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   📝 Fazendo login admin...');
    await loginField.fill('fabio.boas50@polo.cruzeirodosul.edu.br');
    await loginField.press('Enter');
    await page.waitForTimeout(2000);
    
    const senhaField = page.getByRole('textbox', { name: 'Senha' });
    if (await senhaField.isVisible({ timeout: 3000 })) {
      await senhaField.fill('Eduit777');
      await senhaField.press('Enter');
      await page.waitForTimeout(5000);
    }
  }
  
  // Aceita cookies se aparecer
  try {
    const cookies = page.getByText('Aceitar todos');
    if (await cookies.isVisible({ timeout: 3000 })) {
      await cookies.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: CLICAR EM REALIZAR PAGAMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Realizar Pagamento');
  
  let siaaPage = null;
  
  try {
    // Aguarda o link aparecer
    const btnRealizarPagamento = page.getByRole('link', { name: 'Realizar pagamento' });
    await btnRealizarPagamento.waitFor({ state: 'visible', timeout: 15000 });
    
    console.log('   📝 Clicando em "Realizar pagamento"...');
    
    // Captura a nova página que será aberta
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }),
      btnRealizarPagamento.click()
    ]);
    
    siaaPage = newPage;
    await siaaPage.waitForLoadState('domcontentloaded');
    console.log(`   ✅ Nova aba aberta: ${siaaPage.url()}`);
  } catch (e) {
    console.log(`   ❌ Erro: ${e.message}`);
    await page.screenshot({ path: 'erro-realizar-pagamento.png', fullPage: true });
    return;
  }
  
  console.log('✅ ETAPA 1 CONCLUÍDA');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: PREENCHER CPF NO SIAA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Preencher CPF no SIAA');
  
  await siaaPage.waitForTimeout(3000);
  
  try {
    // Preenche o CPF (seletor da gravação)
    const campoCpf = siaaPage.getByRole('textbox', { name: 'CPF' });
    await campoCpf.click();
    await campoCpf.fill(CLIENTE.cpf);
    console.log(`   ✅ CPF preenchido: ${CLIENTE.cpf}`);
    
    await siaaPage.waitForTimeout(1000);
    
    // Clica em Próximo
    const btnProximo = siaaPage.getByRole('button', { name: 'Próximo' });
    await btnProximo.click();
    console.log('   ✅ Botão "Próximo" clicado');
    
    await siaaPage.waitForTimeout(5000);
  } catch (e) {
    console.log(`   ❌ Erro: ${e.message}`);
    await siaaPage.screenshot({ path: 'erro-cpf-siaa.png', fullPage: true });
  }
  
  console.log(`   📍 URL SIAA: ${siaaPage.url()}`);
  console.log('✅ ETAPA 2 CONCLUÍDA');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: CAPTURAR SCREENSHOT ESPECÍFICO DO ACEITE (Parabéns + Tabela)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 3: Capturar Tela de Aceite');
  
  await siaaPage.waitForTimeout(3000);
  await siaaPage.waitForLoadState('networkidle').catch(() => {});
  
  const screenshotPath = `aceite-${CLIENTE.cpf}-${timestamp}.png`;
  const boletoPath = `boleto-${CLIENTE.cpf}-${timestamp}.pdf`;
  
  // Verifica se está na página de aprovação (texto "Parabéns")
  const textoAprovado = siaaPage.locator('text=Parabéns').first();
  
  try {
    if (await textoAprovado.isVisible({ timeout: 10000 })) {
      console.log('   ✅ Página de aprovação detectada (Parabéns)');
      
      // Scroll para o topo
      await siaaPage.evaluate(() => window.scrollTo(0, 0));
      await siaaPage.waitForTimeout(1000);
      
      // Configura viewport grande
      await siaaPage.setViewportSize({ width: 1600, height: 1400 });
      await siaaPage.waitForTimeout(500);
      
      // Calcula área de captura (apenas Parabéns + tabela, sem sidebar)
      let clipArea = null;
      
      try {
        // Localiza elementos para calcular a área de captura
        const cardParabens = siaaPage.locator('#formulario\\:j_idt90, [id*="j_idt90"], .card:has-text("Parabéns")').first();
        const tabelaPagamento = siaaPage.locator('#formulario\\:informacoes_pagamento, [id*="informacoes_pagamento"], .ui-datatable').first();
        
        const boundingParabens = await cardParabens.boundingBox().catch(() => null);
        const boundingTabela = await tabelaPagamento.boundingBox().catch(() => null);
        
        if (boundingParabens && boundingTabela) {
          const yInicio = Math.max(0, boundingParabens.y - 20);
          const yFim = boundingTabela.y + boundingTabela.height + 30;
          const xInicio = Math.max(0, boundingParabens.x - 10);
          const larguraConteudo = boundingParabens.width + 50;
          
          clipArea = {
            x: xInicio,
            y: yInicio,
            width: Math.max(850, larguraConteudo),
            height: yFim - yInicio
          };
          
          console.log(`   📐 Área de captura: x=${clipArea.x.toFixed(0)}, y=${clipArea.y.toFixed(0)}, w=${clipArea.width.toFixed(0)}, h=${clipArea.height.toFixed(0)}`);
        } else if (boundingParabens) {
          const xInicio = Math.max(0, boundingParabens.x - 10);
          clipArea = {
            x: xInicio,
            y: Math.max(0, boundingParabens.y - 20),
            width: boundingParabens.width + 50,
            height: 750
          };
          console.log(`   📐 Área de captura (fallback): x=${clipArea.x.toFixed(0)}, y=${clipArea.y.toFixed(0)}`);
        } else {
          // Fallback total: área fixa começando após sidebar
          clipArea = { x: 270, y: 200, width: 900, height: 750 };
          console.log(`   📐 Área de captura (padrão): x=${clipArea.x}, y=${clipArea.y}`);
        }
      } catch (e) {
        console.log(`   ⚠️ Erro ao calcular área: ${e.message}`);
        clipArea = { x: 270, y: 200, width: 900, height: 750 };
      }
      
      // Captura screenshot ESPECÍFICO (apenas área do aceite)
      await siaaPage.screenshot({ path: screenshotPath, clip: clipArea });
      console.log(`   ✅ Screenshot aceite salvo: ${screenshotPath}`);
      
      // Extrai informações da aprovação
      try {
        const infoAprovacao = await siaaPage.locator('text=NOME:').first().textContent().catch(() => '');
        if (infoAprovacao) {
          console.log(`   📋 ${infoAprovacao.substring(0, 100)}...`);
        }
      } catch (e) {}
      
    } else {
      console.log('   ⚠️ Texto "Parabéns" não encontrado, capturando tela atual...');
      await siaaPage.screenshot({ path: screenshotPath, fullPage: false });
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao capturar aceite: ${e.message}`);
    await siaaPage.screenshot({ path: screenshotPath, fullPage: false });
  }
  
  console.log('✅ ETAPA 3 CONCLUÍDA');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: DOWNLOAD DO BOLETO (via interceptação de rede)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 4: Download do Boleto');
  
  await siaaPage.waitForTimeout(2000);
  
  // Scroll para encontrar o botão Emitir Boleto
  await siaaPage.evaluate(() => {
    // Busca por ID primeiro
    let btn = document.querySelector('button[id*="emissao_boleto"]');
    // Fallback: busca por texto
    if (!btn) {
      const botoes = document.querySelectorAll('button');
      for (const b of botoes) {
        if (b.textContent && b.textContent.includes('Emitir Boleto')) {
          btn = b;
          break;
        }
      }
    }
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await siaaPage.waitForTimeout(1000);
  
  // Lista botões disponíveis
  const botoes = await siaaPage.locator('button, input[type="submit"]').all();
  console.log(`   📋 ${botoes.length} botões encontrados na página`);
  for (let i = 0; i < Math.min(botoes.length, 10); i++) {
    const texto = await botoes[i].textContent().catch(() => '');
    const visivel = await botoes[i].isVisible().catch(() => false);
    if (visivel && texto.trim()) {
      console.log(`      ${i+1}. "${texto.trim().substring(0, 50)}"`);
    }
  }
  
  // Tenta encontrar e clicar no botão de Emitir Boleto
  let boletoPage = null;
  
  try {
    // Seletores para o botão de boleto (em ordem de prioridade)
    const seletoresBoleto = [
      '#formulario\\:acm\\:emissao_boleto',
      'button[id*="emissao_boleto"]',
      'button:has-text("Emitir Boleto")',
      'input[value*="Emitir Boleto"]'
    ];
    
    let btnBoleto = null;
    for (const seletor of seletoresBoleto) {
      const btn = siaaPage.locator(seletor).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        btnBoleto = btn;
        console.log(`   📝 Botão encontrado: ${seletor}`);
        break;
      }
    }
    
    // Fallback: busca por texto
    if (!btnBoleto) {
      btnBoleto = siaaPage.getByRole('button', { name: /Emitir Boleto/i });
      if (await btnBoleto.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   📝 Botão encontrado via getByRole');
      } else {
        btnBoleto = null;
      }
    }
    
    if (btnBoleto) {
      console.log('   📝 Clicando em "Emitir Boleto"...');
      await btnBoleto.scrollIntoViewIfNeeded();
      await siaaPage.waitForTimeout(500);
      
      // Tenta capturar nova página que pode abrir
      try {
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }),
          btnBoleto.click({ force: true })
        ]);
        
        boletoPage = newPage;
        await boletoPage.waitForLoadState('load');
        await boletoPage.waitForTimeout(3000);
        console.log(`   ✅ Nova janela do boleto: ${boletoPage.url().substring(0, 80)}...`);
        
      } catch (e) {
        console.log('   ℹ️ Boleto não abriu em nova aba, verificando página atual...');
        await siaaPage.waitForTimeout(5000);
      }
    } else {
      console.log('   ⚠️ Botão "Emitir Boleto" não encontrado');
    }
  } catch (e) {
    console.log(`   ⚠️ Erro no boleto: ${e.message}`);
  }
  
  // Salva o PDF se foi interceptado
  if (pdfBuffer) {
    fs.writeFileSync(boletoPath, pdfBuffer);
    console.log(`   ✅ BOLETO PDF BAIXADO: ${boletoPath}`);
    console.log(`   📦 Tamanho: ${pdfBuffer.length} bytes`);
    
    // Verifica se o arquivo foi salvo
    if (fs.existsSync(boletoPath)) {
      const stats = fs.statSync(boletoPath);
      console.log(`   ✅ Arquivo verificado: ${stats.size} bytes`);
    }
  } else {
    console.log('   ⚠️ PDF não foi interceptado');
    
    // Fallback: captura screenshot da página do boleto
    if (boletoPage) {
      const boletoPng = boletoPath.replace('.pdf', '.png');
      await boletoPage.screenshot({ path: boletoPng, fullPage: true });
      console.log(`   📸 Screenshot do boleto: ${boletoPng}`);
    }
  }
  
  // Screenshot final
  const screenshotFinal = `final-${CLIENTE.cpf}-${timestamp}.png`;
  if (boletoPage) {
    await boletoPage.screenshot({ path: screenshotFinal, fullPage: true });
  } else {
    await siaaPage.screenshot({ path: screenshotFinal, fullPage: true });
  }
  console.log(`   📸 Screenshot final: ${screenshotFinal}`);
  
  console.log('✅ ETAPA 4 CONCLUÍDA');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 FLUXO FINALIZADO');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`📋 CPF: ${CLIENTE.cpf}`);
  console.log(`📋 Pedido: ${ORDER_ID}`);
  console.log(`📸 Screenshot aceite: ${screenshotPath}`);
  console.log(`📄 Boleto PDF: ${boletoPath}`);
  console.log(`📸 Screenshot final: ${screenshotFinal}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  // Fecha páginas
  if (boletoPage) {
    await boletoPage.close().catch(() => {});
  }
});

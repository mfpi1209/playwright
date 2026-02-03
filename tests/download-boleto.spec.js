// @ts-check
const { test } = require('@playwright/test');
const fs = require('fs');

test('download-boleto-direto', async ({ page, context }) => {
  const timestamp = Date.now();
  let pdfUrl = null;
  let pdfBuffer = null;
  
  // Intercepta requisições para capturar a URL real do PDF
  await context.route('**/boleto/getBoletoDiversos**', async (route) => {
    pdfUrl = route.request().url();
    console.log(`🎯 URL do PDF interceptada: ${pdfUrl}`);
    
    // Continua a requisição normalmente
    const response = await route.fetch();
    const body = await response.body();
    
    console.log(`📄 Content-Type: ${response.headers()['content-type']}`);
    console.log(`📦 Tamanho: ${body.length} bytes`);
    console.log(`📋 Header: ${body.slice(0, 10).toString()}`);
    
    // Se começa com %PDF, é o PDF real
    if (body.slice(0, 5).toString().includes('%PDF')) {
      pdfBuffer = body;
      console.log('✅ PDF capturado com sucesso!');
    }
    
    await route.fulfill({ response });
  });
  
  // Navega para página de resultado
  console.log('📍 Navegando para página de resultado...');
  await page.goto('https://siaa.cruzeirodosul.edu.br/vestibular-inscricao/resultado/dados.jsf?inicio=1&codigoEmpresa=7&cpfCandidato=26415424041&inicio=1&nrInscricao=265191841');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // Clica em Emitir Boleto
  console.log('🔘 Clicando em Emitir Boleto...');
  const btnEmitir = page.locator('#formulario\\:acm\\:emissao_boleto, button[id*="emissao_boleto"]').first();
  await btnEmitir.scrollIntoViewIfNeeded();
  
  const [boletoPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 20000 }),
    btnEmitir.click({ force: true })
  ]);
  
  console.log('📄 Nova página aberta, aguardando carregamento...');
  await boletoPage.waitForLoadState('load');
  await boletoPage.waitForTimeout(3000);
  
  console.log(`📍 URL da página do boleto: ${boletoPage.url()}`);
  
  // Verifica se capturou o PDF
  if (pdfBuffer) {
    const pdfPath = `boleto-direto-${timestamp}.pdf`;
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`\n✅ PDF BAIXADO COM SUCESSO!`);
    console.log(`📁 Arquivo: ${pdfPath}`);
    console.log(`📦 Tamanho: ${pdfBuffer.length} bytes`);
    
    // Verifica se o arquivo existe e tem conteúdo
    const stats = fs.statSync(pdfPath);
    console.log(`📊 Verificação: ${stats.size} bytes no disco`);
  } else if (pdfUrl) {
    console.log('\n⚠️ PDF não foi capturado pelo interceptor, tentando download direto...');
    
    // Tenta fazer request direto para a URL capturada
    const response = await boletoPage.request.get(pdfUrl);
    const body = await response.body();
    
    console.log(`📄 Content-Type: ${response.headers()['content-type']}`);
    console.log(`📦 Tamanho: ${body.length} bytes`);
    
    if (body.slice(0, 5).toString().includes('%PDF')) {
      const pdfPath = `boleto-direto-${timestamp}.pdf`;
      fs.writeFileSync(pdfPath, body);
      console.log(`✅ PDF baixado: ${pdfPath}`);
    } else {
      console.log('❌ Resposta não é PDF');
      console.log(`Preview: ${body.slice(0, 200).toString()}`);
    }
  } else {
    console.log('\n❌ Nenhuma URL de PDF foi interceptada');
    console.log('URLs capturadas durante navegação podem ter sido perdidas');
  }
  
  await boletoPage.close();
});

test('download-boleto-via-request', async ({ page, context }) => {
  const timestamp = Date.now();
  
  // Primeiro navega para obter cookies de sessão
  console.log('📍 Navegando para página de resultado...');
  await page.goto('https://siaa.cruzeirodosul.edu.br/vestibular-inscricao/resultado/dados.jsf?inicio=1&codigoEmpresa=7&cpfCandidato=26415424041&inicio=1&nrInscricao=265191841');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // Captura URL do boleto via network
  let capturedPdfUrl = null;
  
  page.on('request', (request) => {
    if (request.url().includes('/boleto/getBoletoDiversos')) {
      capturedPdfUrl = request.url();
      console.log(`🎯 URL capturada: ${capturedPdfUrl}`);
    }
  });
  
  page.on('response', async (response) => {
    if (response.url().includes('/boleto/getBoletoDiversos')) {
      console.log(`📄 Response Content-Type: ${response.headers()['content-type']}`);
      console.log(`📄 Response Status: ${response.status()}`);
    }
  });
  
  // Clica em Emitir Boleto
  console.log('🔘 Clicando em Emitir Boleto...');
  const btnEmitir = page.locator('#formulario\\:acm\\:emissao_boleto, button[id*="emissao_boleto"]').first();
  await btnEmitir.scrollIntoViewIfNeeded();
  
  const [boletoPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 20000 }),
    btnEmitir.click({ force: true })
  ]);
  
  // Configura listener na nova página também
  boletoPage.on('request', (request) => {
    if (request.url().includes('/boleto/getBoletoDiversos')) {
      capturedPdfUrl = request.url();
      console.log(`🎯 URL capturada (nova página): ${capturedPdfUrl}`);
    }
  });
  
  console.log('📄 Aguardando carregamento...');
  await boletoPage.waitForLoadState('load');
  await boletoPage.waitForTimeout(5000);
  
  if (capturedPdfUrl) {
    console.log(`\n📥 Tentando download da URL: ${capturedPdfUrl}`);
    
    // Faz request usando o contexto do browser (com cookies)
    const response = await boletoPage.request.get(capturedPdfUrl);
    const body = await response.body();
    
    console.log(`📄 Content-Type: ${response.headers()['content-type']}`);
    console.log(`📦 Tamanho: ${body.length} bytes`);
    console.log(`📋 Início: ${body.slice(0, 20).toString()}`);
    
    if (body.slice(0, 5).toString().includes('%PDF')) {
      const pdfPath = `boleto-request-${timestamp}.pdf`;
      fs.writeFileSync(pdfPath, body);
      console.log(`\n✅ PDF BAIXADO COM SUCESSO!`);
      console.log(`📁 Arquivo: ${pdfPath}`);
    } else {
      console.log('❌ Resposta não é PDF direto');
    }
  } else {
    console.log('❌ URL do PDF não foi capturada');
  }
  
  await boletoPage.close();
});

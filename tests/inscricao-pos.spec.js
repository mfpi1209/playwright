import { test, expect } from '@playwright/test';
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const https = require('https');
const http = require('http');

// Função para fazer download HTTP de um arquivo
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      // Segue redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Remove arquivo parcial
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT DE INSCRIÇÃO - PÓS-GRADUAÇÃO
// Baseado na gravação do Playwright Codegen
// ═══════════════════════════════════════════════════════════════════════════

function capitalizarNome(nome) {
  if (!nome) return nome;
  return nome.toLowerCase().split(' ').map(palavra => 
    palavra.charAt(0).toUpperCase() + palavra.slice(1)
  ).join(' ');
}

function formatarTelefone(telefone) {
  if (!telefone) return telefone;
  let numeros = telefone.replace(/\D/g, '');
  if (numeros.startsWith('55') && numeros.length > 11) {
    numeros = numeros.substring(2);
  }
  return numeros;
}

const CLIENTE = {
  nome: capitalizarNome(process.env.CLIENTE_NOME || 'Carlos Eduardo Mendes'),
  cpf: process.env.CLIENTE_CPF || '26415424041',
  email: (process.env.CLIENTE_EMAIL || 'teste@gmail.com').toLowerCase(),
  telefone: formatarTelefone(process.env.CLIENTE_TELEFONE || '11974562318'),
  nascimento: process.env.CLIENTE_NASCIMENTO || '12/09/1980',
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || '33',
  estado: process.env.CLIENTE_ESTADO || 'São Paulo',
  cidade: process.env.CLIENTE_CIDADE || 'São Paulo',
  curso: process.env.CLIENTE_CURSO || 'Engenharia de Produção',
  duracao: process.env.CLIENTE_DURACAO || '6', // Duração em meses (ex: 6, 9, 3)
  polo: process.env.CLIENTE_POLO || 'barra funda',
  campanha: process.env.CLIENTE_CAMPANHA || '',
  matricula: process.env.CLIENTE_MATRICULA || '99', // Valor da matrícula em reais
  mensalidade: process.env.CLIENTE_MENSALIDADE || '184', // Valor da mensalidade em reais
};

// Função para manter o cursor na tela (evita modal "Antes de Você Sair")
async function manterCursorNaTela(page) {
  try {
    // Move o cursor para o centro da página
    await page.mouse.move(500, 400);
  } catch (e) {}
}

// Função de espera que mantém o cursor na tela
async function aguardar(page, ms) {
  await manterCursorNaTela(page);
  await page.waitForTimeout(ms);
  await manterCursorNaTela(page);
}

// Função para fechar modal "Antes de Você Sair" se aparecer
async function fecharModalSair(page) {
  try {
    const modalSair = page.locator('text=Antes de Você Sair');
    if (await modalSair.isVisible({ timeout: 500 })) {
      console.log('   🔄 Modal "Antes de Você Sair" detectado, fechando...');
      // Usa o seletor exato do botão X
      const btnFechar = page.locator('button.cruzeirodosul-store-theme-3-x-popupExitClose');
      if (await btnFechar.isVisible({ timeout: 1000 })) {
        await btnFechar.click();
        console.log('   ✅ Modal fechado');
      } else {
        // Fallback: ESC
        await page.keyboard.press('Escape');
        console.log('   ✅ Modal fechado (ESC)');
      }
      await page.waitForTimeout(300);
      await manterCursorNaTela(page);
      return true;
    }
  } catch (e) {}
  return false;
}

// Função para fechar qualquer modal/popup bloqueante
async function fecharModais(page) {
  // Mantém cursor na tela primeiro
  await manterCursorNaTela(page);
  
  // Modal "Antes de Você Sair"
  await fecharModalSair(page);
  
  // Cookies
  try {
    const cookies = page.getByText('Aceitar todos');
    if (await cookies.isVisible({ timeout: 500 })) {
      await cookies.click();
      await page.waitForTimeout(300);
    }
  } catch (e) {}
}

test('inscricao-pos', async ({ page, context }) => {
  
  console.log('');
  console.log('📋 DADOS DO CLIENTE (PÓS-GRADUAÇÃO):');
  console.log(`   Nome: ${CLIENTE.nome}`);
  console.log(`   CPF: ${CLIENTE.cpf}`);
  console.log(`   Email: ${CLIENTE.email}`);
  console.log(`   Telefone: ${CLIENTE.telefone}`);
  console.log(`   Nascimento: ${CLIENTE.nascimento}`);
  console.log(`   CEP: ${CLIENTE.cep}`);
  console.log(`   Número: ${CLIENTE.numero}`);
  console.log(`   Curso: ${CLIENTE.curso}`);
  console.log(`   Duração: ${CLIENTE.duracao} meses`);
  console.log(`   Polo: ${CLIENTE.polo}`);
  console.log(`   Campanha: ${CLIENTE.campanha}`);
  console.log(`   Matrícula esperada: R$ ${CLIENTE.matricula},00`);
  console.log(`   Mensalidade esperada: R$ ${CLIENTE.mensalidade},00`);
  console.log('');

  let numeroInscricao = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  
  await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
  await page.waitForTimeout(1000);
  
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('marcelo.pinheiro1876@polo.cruzeirodosul.edu.br');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(1000);
  
  await page.getByRole('textbox', { name: 'Senha' }).fill('MFPedu!t678@!');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(2000);
  
  console.log('✅ ETAPA 1 CONCLUÍDA - Login admin');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO E COOKIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Pós-Graduação');
  
  // Tenta navegar para pós-graduação com retry
  let navegacaoOk = false;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await page.goto('https://cruzeirodosul.myvtex.com/pos-graduacao', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      navegacaoOk = true;
      break;
    } catch (e) {
      console.log(`   ⚠️ Tentativa ${tentativa} de navegação falhou, retentando...`);
      await page.waitForTimeout(2000);
    }
  }
  
  if (!navegacaoOk) {
    // Tenta navegar pelo menu
    console.log('   🔄 Tentando navegação alternativa via menu...');
    try {
      await page.getByText('Cursos').first().click();
      await page.waitForTimeout(1000);
      await page.getByText('Pós-Graduação', { exact: false }).first().click();
    } catch (e) {
      console.log('   ⚠️ Navegação alternativa também falhou');
    }
  }
  
  await page.waitForTimeout(2000);
  
  // Aceitar cookies
  try {
    const aceitarCookies = page.getByText('Aceitar todos');
    if (await aceitarCookies.isVisible({ timeout: 3000 })) {
      await aceitarCookies.click();
      console.log('   ✅ Cookies aceitos');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  console.log('✅ ETAPA 2 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: LOGIN CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 3: Login como Cliente');
  
  // Mantém cursor na tela para evitar modal de saída
  await manterCursorNaTela(page);
  
  // Fecha modais bloqueantes
  await fecharModais(page);
  
  // Primeiro aceita cookies se estiverem bloqueando
  try {
    const cookieBanner = page.locator('text=Aceitar todos, text=Aceitar cookies, button:has-text("Aceitar")').first();
    if (await cookieBanner.isVisible({ timeout: 3000 })) {
      await cookieBanner.click();
      console.log('   ✅ Cookies aceitos');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Verifica se já está logado (procura "Olá" no header)
  let jaLogado = false;
  try {
    const headerOla = page.locator('text=/Olá,/i').first();
    if (await headerOla.isVisible({ timeout: 2000 })) {
      console.log('   ✅ Cliente já está logado');
      jaLogado = true;
    }
  } catch (e) {}
  
  if (!jaLogado) {
    await manterCursorNaTela(page);
    
    // PASSO 1: Clica em "Entrar como cliente"
    console.log('   📝 Clicando em "Entrar como cliente"...');
    const btnEntrarCliente = page.locator('div.cruzeirodosul-telemarketing-2-x-loginAsText');
    if (await btnEntrarCliente.isVisible({ timeout: 3000 })) {
      await btnEntrarCliente.click();
      console.log('   ✅ Clicou em "Entrar como cliente"');
    } else {
      // Fallback
      await page.getByText('Entrar como cliente').first().click();
      console.log('   ✅ Clicou em "Entrar como cliente" (fallback)');
    }
    
    await page.waitForTimeout(1500);
    await manterCursorNaTela(page);
    
    // PASSO 2: Preenche o email
    console.log('   📝 Preenchendo email...');
    const campoEmail = page.locator('input[placeholder*="example@mail" i], input[placeholder*="Ex:" i]').first();
    if (await campoEmail.isVisible({ timeout: 3000 })) {
      await campoEmail.click();
      await campoEmail.fill(CLIENTE.email);
      console.log(`   ✅ Email preenchido: ${CLIENTE.email}`);
    } else {
      console.log('   ⚠️ Campo de email não encontrado');
      await page.screenshot({ path: 'erro-login-cliente.png', fullPage: true });
    }
    
    await page.waitForTimeout(500);
    await manterCursorNaTela(page);
    
    // PASSO 3: Clica em Entrar
    console.log('   📝 Clicando em Entrar...');
    const btnEntrar = page.getByRole('button', { name: 'Entrar' });
    if (await btnEntrar.isVisible({ timeout: 2000 })) {
      await btnEntrar.click();
      console.log('   ✅ Botão Entrar clicado');
    }
    
    await page.waitForTimeout(3000);
    await manterCursorNaTela(page);
    
    // Fecha modal de saída se aparecer
    await fecharModalSair(page);
    
    // Aceita cookies de novo se aparecer após login
    try {
      const cookieBanner2 = page.getByText('Aceitar todos');
      if (await cookieBanner2.isVisible({ timeout: 2000 })) {
        await cookieBanner2.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Verifica se login funcionou
    try {
      const headerOla = page.locator('text=/Olá,/i').first();
      if (await headerOla.isVisible({ timeout: 5000 })) {
        console.log('   ✅ Login do cliente confirmado');
      } else {
        console.log('   ⚠️ Login pode não ter funcionado');
        await page.screenshot({ path: 'erro-login-confirmacao.png', fullPage: true });
      }
    } catch (e) {}
  }
  
  // Fecha modais que possam ter aparecido
  await fecharModais(page);
  
  console.log('✅ ETAPA 3 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: BUSCA DO CURSO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 4: Busca e Seleção do Curso');
  
  // Mantém cursor na tela e fecha modais
  await manterCursorNaTela(page);
  await fecharModais(page);
  
  // PASSO 1: Pesquisar o curso
  console.log(`   🔍 Pesquisando curso: "${CLIENTE.curso}"`);
  
  // Mantém cursor na tela
  await manterCursorNaTela(page);
  
  const searchInput = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
  await searchInput.click({ force: true });
  await manterCursorNaTela(page);
  await searchInput.fill(CLIENTE.curso);
  await searchInput.press('Enter');
  
  // PASSO 2: Aguardar os resultados carregarem
  console.log('   ⏳ Aguardando resultados carregarem...');
  await aguardar(page, 3000);
  
  // Aguarda aparecer os cards de resultado
  try {
    await page.waitForSelector('a[href*="/pos-"][href$="/p"]', { timeout: 10000 });
    console.log('   ✅ Resultados carregados');
  } catch (e) {
    console.log('   ⚠️ Timeout aguardando resultados');
  }
  await aguardar(page, 2000);
  
  // PASSO 3: Selecionar o card do curso com a duração específica
  const duracaoDesejada = `${CLIENTE.duracao} meses`;
  console.log(`   🎯 Buscando curso com duração: "${duracaoDesejada}"`);
  
  // Normaliza o nome do curso para busca
  const cursoNormalizado = CLIENTE.curso.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palavrasChaveCurso = cursoNormalizado.split(' ').filter(p => p.length > 3);
  
  let cursoClicado = false;
  
  // Busca todos os cards de curso
  const todosCards = page.locator('a[href*="/pos-"][href$="/p"]');
  const countCards = await todosCards.count();
  console.log(`   📋 Encontrados ${countCards} cursos de pós-graduação`);
  
  // Primeiro, tenta encontrar o card que tenha o nome do curso E a duração correta
  for (let i = 0; i < countCards; i++) {
    const card = todosCards.nth(i);
    const href = await card.getAttribute('href') || '';
    const texto = await card.textContent() || '';
    const textoNormalizado = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hrefNormalizado = href.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Verifica se o card contém o nome do curso
    const matchNomeCurso = palavrasChaveCurso.every(palavra => 
      textoNormalizado.includes(palavra) || hrefNormalizado.includes(palavra)
    );
    
    // Verifica se o card contém a duração desejada (ex: "9 meses")
    const matchDuracao = textoNormalizado.includes(`${CLIENTE.duracao} meses`) || 
                         textoNormalizado.includes(`${CLIENTE.duracao}meses`) ||
                         hrefNormalizado.includes(`${CLIENTE.duracao}-meses`);
    
    if (matchNomeCurso && matchDuracao) {
      console.log(`   ✅ Curso encontrado com duração correta!`);
      console.log(`      📝 Texto: "${texto.substring(0, 60).replace(/\s+/g, ' ')}..."`);
      console.log(`      🔗 URL: ${href}`);
      await card.scrollIntoViewIfNeeded();
      await card.click();
      cursoClicado = true;
      break;
    }
  }
  
  // Se não encontrou com duração, tenta usar o filtro de duração
  if (!cursoClicado) {
    console.log(`   🔄 Card com duração não encontrado, tentando filtro...`);
    
    // Tenta aplicar filtro de duração
    const seletoresFiltro = [
      `label[for="duracao-${CLIENTE.duracao}-meses"]`,
      `input#duracao-${CLIENTE.duracao}-meses`,
      `.vtex-search-result-3-x-filter__container--duracao label:has-text("${CLIENTE.duracao} meses")`,
      `input[type="checkbox"][value="${CLIENTE.duracao} meses"]`,
    ];
    
    for (const seletor of seletoresFiltro) {
      try {
        const filtro = page.locator(seletor).first();
        if (await filtro.isVisible({ timeout: 2000 })) {
          console.log(`   📍 Filtro encontrado: ${seletor}`);
          await filtro.click();
          await page.waitForTimeout(3000);
          console.log(`   ✅ Filtro "${duracaoDesejada}" aplicado`);
          
          // Agora clica no primeiro card do curso
          const cardFiltrado = page.locator('a[href*="/pos-"][href$="/p"]').first();
          if (await cardFiltrado.isVisible({ timeout: 3000 })) {
            const textoCard = await cardFiltrado.textContent() || '';
            console.log(`   ✅ Selecionando: "${textoCard.substring(0, 50).replace(/\s+/g, ' ')}..."`);
            await cardFiltrado.click();
            cursoClicado = true;
          }
          break;
        }
      } catch (e) {}
    }
  }
  
  // Último fallback: clica no primeiro card que contenha o nome do curso
  if (!cursoClicado) {
    console.log('   ⚠️ Selecionando primeiro curso disponível (duração pode não ser a desejada)...');
    
    for (let i = 0; i < countCards; i++) {
      const card = todosCards.nth(i);
      const texto = await card.textContent() || '';
      const textoNormalizado = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const matchNomeCurso = palavrasChaveCurso.some(palavra => textoNormalizado.includes(palavra));
      
      if (matchNomeCurso) {
        console.log(`   📍 Clicando em: "${texto.substring(0, 50).replace(/\s+/g, ' ')}..."`);
        await card.click();
        cursoClicado = true;
        break;
      }
    }
  }
  
  // Fallback final
  if (!cursoClicado) {
    const primeiroCard = page.locator('a[href*="/pos-"][href$="/p"]').first();
    if (await primeiroCard.isVisible({ timeout: 3000 })) {
      await primeiroCard.click();
    }
  }
  
  await page.waitForTimeout(3000);
  
  console.log(`✅ ETAPA 4 CONCLUÍDA - Curso: ${page.url()}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  
  // Aguarda o formulário carregar
  await page.waitForTimeout(2000);
  
  // Rolar para cima para garantir visibilidade do formulário
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  
  // PREENCHER NOME - múltiplas estratégias
  console.log('   📝 Preenchendo nome...');
  let nomePreenchido = false;
  
  // Estratégia 1: Seletores específicos
  const seletoresNome = [
    'input[placeholder*="nome completo" i]',
    'input[name="userName"]',
    'input[name="nomecompleto"]',
    'input[name="name"]',
    '[class*="userName"] input',
    '[class*="nome"] input',
  ];
  
  for (const seletor of seletoresNome) {
    try {
      const campo = page.locator(seletor).first();
      if (await campo.isVisible({ timeout: 2000 })) {
        console.log(`   📍 Campo nome encontrado: ${seletor}`);
        
        // Clica no campo
        await campo.click();
        await page.waitForTimeout(300);
        
        // Limpa e preenche
        await campo.fill('');
        await page.waitForTimeout(200);
        await campo.fill(CLIENTE.nome);
        await page.waitForTimeout(500);
        
        // Verifica se preencheu
        const valor = await campo.inputValue();
        if (valor && valor.length > 0) {
          console.log(`   ✅ Nome preenchido: "${valor}"`);
          nomePreenchido = true;
          break;
        }
      }
    } catch (e) {
      // Continua para próximo seletor
    }
  }
  
  // Estratégia 2: getByRole
  if (!nomePreenchido) {
    try {
      const campoNome = page.getByRole('textbox', { name: /nome/i }).first();
      if (await campoNome.isVisible({ timeout: 2000 })) {
        await campoNome.click();
        await campoNome.fill(CLIENTE.nome);
        console.log(`   ✅ Nome preenchido via getByRole: "${CLIENTE.nome}"`);
        nomePreenchido = true;
      }
    } catch (e) {}
  }
  
  // Estratégia 3: Procura por label
  if (!nomePreenchido) {
    try {
      const labelNome = page.locator('label').filter({ hasText: /nome/i }).first();
      if (await labelNome.isVisible({ timeout: 2000 })) {
        const forId = await labelNome.getAttribute('for');
        if (forId) {
          const campo = page.locator(`#${forId}`);
          await campo.click();
          await campo.fill(CLIENTE.nome);
          console.log(`   ✅ Nome preenchido via label: "${CLIENTE.nome}"`);
          nomePreenchido = true;
        }
      }
    } catch (e) {}
  }
  
  if (!nomePreenchido) {
    console.log('   ⚠️ Não conseguiu preencher o nome!');
    await page.screenshot({ path: 'erro-nome-pos.png', fullPage: true });
  }
  
  await page.waitForTimeout(500);
  
  // PREENCHER TELEFONE - múltiplas estratégias
  console.log('   📝 Preenchendo telefone...');
  let telefonePreenchido = false;
  
  const seletoresTelefone = [
    'input[placeholder*="XXXXX" i]',
    'input[type="tel"]',
    'input[name="userPhone"]',
    'input[name="telefone"]',
    'input[inputmode="tel"]',
    '[class*="phone"] input',
    '[class*="telefone"] input',
  ];
  
  for (const seletor of seletoresTelefone) {
    try {
      const campo = page.locator(seletor).first();
      if (await campo.isVisible({ timeout: 2000 })) {
        console.log(`   📍 Campo telefone encontrado: ${seletor}`);
        await campo.click();
        await campo.fill(CLIENTE.telefone);
        await page.waitForTimeout(500);
        console.log(`   ✅ Telefone preenchido: "${CLIENTE.telefone}"`);
        telefonePreenchido = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!telefonePreenchido) {
    try {
      const campoTelefone = page.getByRole('textbox', { name: /XXXXX|telefone/i }).first();
      if (await campoTelefone.isVisible({ timeout: 2000 })) {
        await campoTelefone.click();
        await campoTelefone.fill(CLIENTE.telefone);
        console.log(`   ✅ Telefone preenchido via getByRole`);
        telefonePreenchido = true;
      }
    } catch (e) {}
  }
  
  if (!telefonePreenchido) {
    console.log('   ⚠️ Não conseguiu preencher o telefone!');
  }
  
  await page.waitForTimeout(500);
  
  // MARCAR CHECKBOX de termos
  console.log('   📝 Marcando checkbox...');
  try {
    // Tenta pelo seletor específico VTEX
    const checkboxVtex = page.locator('.cruzeirodosul-product-purchase-box-0-x-checkboxWrapperFakeInput');
    if (await checkboxVtex.isVisible({ timeout: 2000 })) {
      await checkboxVtex.click();
      console.log('   ✅ Checkbox marcado (VTEX)');
    } else {
      // Tenta checkbox genérico
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 2000 })) {
        await checkbox.click({ force: true });
        console.log('   ✅ Checkbox marcado (genérico)');
      } else {
        // Tenta pelo label
        const labelCheckbox = page.locator('label').filter({ hasText: /aceito|termos|li e aceito/i }).first();
        if (await labelCheckbox.isVisible({ timeout: 2000 })) {
          await labelCheckbox.click();
          console.log('   ✅ Checkbox marcado (via label)');
        }
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao marcar checkbox: ${e.message}`);
  }
  
  await page.waitForTimeout(500);
  
  // CLICAR EM INSCREVA-SE
  console.log('   📝 Clicando em Inscreva-se...');
  try {
    const btnInscreva = page.getByRole('button', { name: /inscreva-se/i });
    if (await btnInscreva.isVisible({ timeout: 5000 })) {
      await btnInscreva.scrollIntoViewIfNeeded();
      await btnInscreva.click();
      console.log('   ✅ Botão Inscreva-se clicado');
    } else {
      // Fallback
      const btnAlternativo = page.locator('button').filter({ hasText: /inscreva/i }).first();
      if (await btnAlternativo.isVisible({ timeout: 2000 })) {
        await btnAlternativo.click();
        console.log('   ✅ Botão clicado (alternativo)');
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao clicar Inscreva-se: ${e.message}`);
  }
  
  await page.waitForTimeout(3000);
  
  console.log('✅ ETAPA 5 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 6: DADOS DE LOCALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 6: Dados de Localização');
  
  // Scroll para baixo para evitar header sticky bloqueando
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(1000);
  await manterCursorNaTela(page);
  
  // País - Brasil
  try {
    const selectPais = page.locator('.react-select__input-container').first();
    await selectPais.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await selectPais.click({ force: true });
    await page.locator('#react-select-2-input').fill('brasil');
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: 'Brasil' }).click();
  } catch (e) {
    // Fallback: tenta com keyboard
    await page.keyboard.type('brasil', { delay: 50 });
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);
  console.log('   ✅ País: Brasil');
  
  // Estado
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(500);
  const selectEstado = page.locator('.react-select__input-container').nth(1);
  await selectEstado.scrollIntoViewIfNeeded();
  await selectEstado.click({ force: true });
  await page.keyboard.type(CLIENTE.estado, { delay: 30 });
  await page.waitForTimeout(1000);
  
  // Tenta clicar na opção - pode ter acento diferente
  try {
    // Primeiro tenta match exato
    const opcaoEstado = page.getByRole('option', { name: CLIENTE.estado });
    if (await opcaoEstado.isVisible({ timeout: 2000 })) {
      await opcaoEstado.click();
    } else {
      // Tenta pela primeira opção visível (deve ser o match mais próximo)
      const primeiraOpcao = page.locator('[class*="react-select__option"]').first();
      if (await primeiraOpcao.isVisible({ timeout: 2000 })) {
        await primeiraOpcao.click();
      } else {
        // Último recurso: Enter para selecionar
        await page.keyboard.press('Enter');
      }
    }
  } catch (e) {
    // Fallback: Enter para selecionar a opção destacada
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);
  console.log(`   ✅ Estado: ${CLIENTE.estado}`);
  
  // Cidade
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(500);
  const selectCidade = page.locator('.react-select__input-container').nth(2);
  await selectCidade.scrollIntoViewIfNeeded();
  await selectCidade.click({ force: true });
  await page.keyboard.type(CLIENTE.cidade, { delay: 30 });
  await page.waitForTimeout(1000);
  
  try {
    const opcaoCidade = page.getByRole('option', { name: CLIENTE.cidade });
    if (await opcaoCidade.isVisible({ timeout: 2000 })) {
      await opcaoCidade.click();
    } else {
      const primeiraOpcao = page.locator('[class*="react-select__option"]').first();
      if (await primeiraOpcao.isVisible({ timeout: 2000 })) {
        await primeiraOpcao.click();
      } else {
        await page.keyboard.press('Enter');
      }
    }
  } catch (e) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);
  console.log(`   ✅ Cidade: ${CLIENTE.cidade}`);
  
  // Polo
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(500);
  const selectPolo = page.locator('.react-select__input-container').nth(3);
  await selectPolo.scrollIntoViewIfNeeded();
  await selectPolo.click({ force: true });
  await page.keyboard.type(CLIENTE.polo, { delay: 30 });
  await page.waitForTimeout(1500);
  
  try {
    // Tenta encontrar opção que contenha o nome do polo
    const opcaoPolo = page.locator('[class*="react-select__option"]').filter({ hasText: new RegExp(CLIENTE.polo, 'i') }).first();
    if (await opcaoPolo.isVisible({ timeout: 2000 })) {
      await opcaoPolo.click();
    } else {
      const primeiraOpcao = page.locator('[class*="react-select__option"]').first();
      if (await primeiraOpcao.isVisible({ timeout: 2000 })) {
        await primeiraOpcao.click();
      } else {
        await page.keyboard.press('Enter');
      }
    }
  } catch (e) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);
  console.log(`   ✅ Polo: ${CLIENTE.polo}`);
  
  // CPF
  await page.locator('input[name="userDocument"]').click();
  await page.locator('input[name="userDocument"]').fill(CLIENTE.cpf);
  await page.waitForTimeout(500);
  console.log(`   ✅ CPF: ${CLIENTE.cpf}`);
  
  // Continuar Inscrição
  await page.getByRole('button', { name: 'Continuar Inscrição' }).click();
  await page.waitForTimeout(5000);
  
  console.log('✅ ETAPA 6 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 7: CAMPANHA COMERCIAL - TESTE DINÂMICO DE CAMPANHAS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Campanha Comercial');
  
  // Aguarda página de campanha
  await page.waitForTimeout(3000);
  
  const urlAtualEtapa7 = page.url();
  console.log(`   📍 URL atual: ${urlAtualEtapa7}`);
  
  let campanhaEscolhida = null;
  
  // Verifica se está na página de campanha
  const estaNaPaginaCampanha = urlAtualEtapa7.includes('campanha-comercial');
  console.log(`   📍 Está na página de campanha? ${estaNaPaginaCampanha}`);
  
  if (estaNaPaginaCampanha) {
    console.log('   📍 Página de campanha detectada');
    console.log(`   🎯 Buscando: Matrícula R$ ${CLIENTE.matricula},00 | Mensalidade R$ ${CLIENTE.mensalidade},00`);
    
    // Função para ler os valores da campanha atual (Preço Campanha no lado direito)
    const lerValoresCampanha = async () => {
      try {
        // Aguarda a área de preços atualizar
        await page.waitForTimeout(500);
        
        // Estratégia: Buscar o texto completo da página e extrair os valores APÓS "Preço Campanha"
        const textoCompleto = await page.locator('body').textContent();
        
        // Divide o texto em "Preço Produto" e "Preço Campanha"
        const partes = textoCompleto.split(/Preço Campanha/i);
        
        if (partes.length >= 2) {
          // Pega apenas a parte após "Preço Campanha" (que contém os valores da campanha)
          const textoPreçoCampanha = partes[1].substring(0, 200); // Pega os primeiros 200 chars após "Preço Campanha"
          
          // Busca padrão "Matrícula: R$ XX,XX" ou "Matrícula: XX,XX"
          const regexMatricula = /Matr[ií]cula[:\s]*R?\$?\s*([\d.,]+)/i;
          const regexMensalidade = /(\d+)x\s*R\$\s*([\d.,]+)/i;
          
          const matchMatricula = textoPreçoCampanha.match(regexMatricula);
          const matchMensalidade = textoPreçoCampanha.match(regexMensalidade);
          
          let matricula = null;
          let mensalidade = null;
          let parcelas = null;
          
          if (matchMatricula) {
            matricula = parseFloat(matchMatricula[1].replace('.', '').replace(',', '.'));
          }
          
          if (matchMensalidade) {
            parcelas = parseInt(matchMensalidade[1]);
            mensalidade = parseFloat(matchMensalidade[2].replace('.', '').replace(',', '.'));
          }
          
          return { matricula, mensalidade, parcelas };
        }
        
        // Fallback: tenta buscar na área "Informações da Campanha" que mostra os valores
        const infoCampanha = page.locator('text=Informações da Campanha').first();
        if (await infoCampanha.isVisible({ timeout: 2000 })) {
          const containerInfo = infoCampanha.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "info") or contains(@class, "campaign")]').first();
          
          if (await containerInfo.isVisible({ timeout: 1000 }).catch(() => false)) {
            const textoInfo = await containerInfo.textContent();
            
            // Na área de informações: "Matrícula – Valor: R$ 99,00" e "Mensalidade – Desconto: 15%"
            const matchValorMatricula = textoInfo.match(/Matr[ií]cula.*Valor[:\s]*R\$\s*([\d.,]+)/i);
            const matchDesconto = textoInfo.match(/Mensalidade.*Desconto[:\s]*(\d+)%/i);
            
            if (matchValorMatricula) {
              const matricula = parseFloat(matchValorMatricula[1].replace('.', '').replace(',', '.'));
              
              // Se tem desconto, calcula a mensalidade com desconto
              // Preço original é R$ 199,90, então mensalidade = 199.90 * (1 - desconto/100)
              let mensalidade = null;
              if (matchDesconto) {
                const desconto = parseInt(matchDesconto[1]);
                mensalidade = Math.round(199.90 * (1 - desconto / 100) * 100) / 100;
              }
              
              return { matricula, mensalidade, parcelas: 17 };
            }
          }
        }
        
      } catch (e) {
        console.log(`      ⚠️ Erro ao ler valores: ${e.message}`);
      }
      return { matricula: null, mensalidade: null, parcelas: null };
    };
    
    // Abre o dropdown de campanhas para obter todas as opções
    console.log('   📝 Buscando dropdown de campanhas...');
    
    let selectCampanha = page.locator('.react-select__control').first();
    
    // Verifica se o dropdown existe
    const dropdownVisivel = await selectCampanha.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   📍 Dropdown visível: ${dropdownVisivel}`);
    
    if (!dropdownVisivel) {
      // Tenta seletores alternativos
      console.log('   🔄 Tentando seletores alternativos...');
      
      const seletoresAlternativos = [
        'div[class*="select__control"]',
        'div[class*="select-container"]',
        '[class*="campanha"] select',
        'select[name*="campanha"]',
        '.css-1s2u09g-control', // classe comum do react-select
        '[class*="indicatorContainer"]'
      ];
      
      for (const sel of seletoresAlternativos) {
        const alt = page.locator(sel).first();
        if (await alt.isVisible({ timeout: 1000 }).catch(() => false)) {
          selectCampanha = alt;
          console.log(`   ✅ Dropdown encontrado via: ${sel}`);
          break;
        }
      }
    }
    
    // Tira screenshot para debug
    try {
      await page.screenshot({ path: 'debug-campanha-antes-click.png', fullPage: true });
      console.log('   📸 Screenshot salvo: debug-campanha-antes-click.png');
    } catch (e) {}
    
    await selectCampanha.click({ force: true });
    await page.waitForTimeout(2000);
    
    // Obtém todas as opções de campanha disponíveis
    let opcoes = page.locator('.react-select__option');
    let qtdOpcoes = await opcoes.count();
    
    // Se não encontrou opções, tenta outros seletores
    if (qtdOpcoes === 0) {
      console.log('   🔄 Nenhuma opção encontrada, tentando seletores alternativos...');
      const seletoresOpcoes = [
        'div[class*="option"]',
        '[class*="menu"] [class*="option"]',
        '.css-1n7v3ny-option',
        'li[role="option"]'
      ];
      
      for (const sel of seletoresOpcoes) {
        opcoes = page.locator(sel);
        qtdOpcoes = await opcoes.count();
        if (qtdOpcoes > 0) {
          console.log(`   ✅ Opções encontradas via: ${sel} (${qtdOpcoes})`);
          break;
        }
      }
    }
    
    console.log(`   📋 ${qtdOpcoes} opções de campanha encontradas`);
    
    // Coleta todos os textos das opções primeiro
    const listaCampanhas = [];
    for (let i = 0; i < qtdOpcoes; i++) {
      const texto = await opcoes.nth(i).textContent();
      listaCampanhas.push(texto);
    }
    
    // Fecha o dropdown (clica fora ou pressiona Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    console.log(`   📋 ${listaCampanhas.length} campanhas disponíveis`);
    
    // Array para armazenar resultados de cada campanha
    const resultadosCampanhas = [];
    
    // Testa cada campanha
    for (let i = 0; i < listaCampanhas.length; i++) {
      const textoOpcao = listaCampanhas[i];
      
      // Extrai o código da campanha (ex: "2542" de "2542 - Balcão 10%CT - Pós EAD")
      const codigoCampanha = textoOpcao.split(' - ')[0].trim();
      
      console.log(`   📝 Testando campanha ${i + 1}/${listaCampanhas.length}: ${textoOpcao.substring(0, 50)}...`);
      
      // Abre o dropdown e digita o código da campanha
      await selectCampanha.click();
      await page.waitForTimeout(500);
      
      // Limpa e digita o código
      await page.keyboard.type(codigoCampanha, { delay: 30 });
      await page.waitForTimeout(1000);
      
      // Seleciona a opção
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000); // Aguarda valores atualizarem
      
      // Lê os valores da campanha
      let valores = await lerValoresCampanha();
      
      // Se não conseguiu ler, tenta novamente
      if (!valores.mensalidade) {
        await page.waitForTimeout(2000);
        valores = await lerValoresCampanha();
      }
      
      console.log(`      💰 Matrícula: R$ ${valores.matricula || 'N/A'} | Mensalidade: R$ ${valores.mensalidade || 'N/A'} (${valores.parcelas || '?'}x)`);
      
      resultadosCampanhas.push({
        codigo: codigoCampanha,
        nome: textoOpcao,
        matricula: valores.matricula,
        mensalidade: valores.mensalidade,
        parcelas: valores.parcelas
      });
    }
    
    // Encontra a melhor campanha baseada nos critérios
    const matriculaAlvo = parseFloat(CLIENTE.matricula);
    const mensalidadeAlvo = parseFloat(CLIENTE.mensalidade);
    
    console.log('');
    console.log('   🔍 Analisando campanhas...');
    
    // Filtra campanhas com matrícula correta e encontra a mais próxima da mensalidade alvo
    let melhorCampanha = null;
    let menorDiferenca = Infinity;
    
    for (const camp of resultadosCampanhas) {
      if (camp.matricula === null || camp.mensalidade === null) continue;
      
      // Verifica se a matrícula está dentro do esperado (tolerância de R$ 5)
      const diferencaMatricula = Math.abs(camp.matricula - matriculaAlvo);
      const diferencaMensalidade = Math.abs(camp.mensalidade - mensalidadeAlvo);
      
      if (diferencaMatricula <= 5) { // Matrícula OK (tolerância R$ 5)
        if (diferencaMensalidade < menorDiferenca) {
          menorDiferenca = diferencaMensalidade;
          melhorCampanha = camp;
        }
      }
    }
    
    if (melhorCampanha) {
      campanhaEscolhida = melhorCampanha.codigo;
      console.log(`   ✅ MELHOR CAMPANHA: ${melhorCampanha.codigo} - ${melhorCampanha.nome.substring(0, 40)}...`);
      console.log(`      💰 Matrícula: R$ ${melhorCampanha.matricula} | Mensalidade: R$ ${melhorCampanha.mensalidade}`);
      console.log(`      📊 Diferença da mensalidade alvo: R$ ${menorDiferenca.toFixed(2)}`);
      
      // Seleciona a melhor campanha
      await selectCampanha.click();
      await page.waitForTimeout(500);
      await page.keyboard.type(melhorCampanha.codigo, { delay: 50 });
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    } else {
      console.log('   ⚠️ Nenhuma campanha encontrada com matrícula próxima ao alvo');
      console.log('   📝 Usando primeira campanha disponível');
      
      // Usa a primeira campanha
      await selectCampanha.click();
      await page.waitForTimeout(500);
      const primeiraOpcao = page.locator('.react-select__option').first();
      const textoPrimeira = await primeiraOpcao.textContent();
      campanhaEscolhida = textoPrimeira.split(' - ')[0].trim();
      await primeiraOpcao.click();
      await page.waitForTimeout(2000);
    }
    
    // Clica em Aplicar campanha
    await page.getByRole('button', { name: 'Aplicar campanha' }).click();
    await page.waitForTimeout(3000);
    console.log(`   ✅ Campanha ${campanhaEscolhida} aplicada`);
  }
  
  console.log('✅ ETAPA 7 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 8: CARRINHO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 8: Carrinho');
  
  await manterCursorNaTela(page);
  await page.waitForTimeout(2000);
  
  // Fecha modal "Atenção" se aparecer (tem um X no canto)
  try {
    const modalAtencao = page.locator('text=Atenção').first();
    if (await modalAtencao.isVisible({ timeout: 2000 })) {
      console.log('   📍 Modal Atenção detectado, fechando...');
      // O X é um elemento svg ou span próximo ao texto "Atenção"
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {}
  
  await manterCursorNaTela(page);
  
  // Clica em Continuar Inscrição (botão azul grande)
  console.log('   📝 Clicando em Continuar Inscrição para ir ao checkout...');
  console.log(`   📍 URL atual: ${page.url()}`);
  
  let btnClicado = false;
  
  // Espera o botão aparecer e estar clicável
  await page.waitForTimeout(2000);
  
  // Tenta pelo seletor de classe específico do VTEX
  try {
    const btnVtex = page.locator('button.vtex-button, .vtex-button__label, button[class*="vtex"]').filter({ hasText: /Continuar/i }).first();
    if (await btnVtex.isVisible({ timeout: 3000 })) {
      await btnVtex.scrollIntoViewIfNeeded();
      await btnVtex.click({ force: true });
      console.log('   ✅ Botão Continuar clicado (via classe VTEX)');
      btnClicado = true;
    }
  } catch (e) {
    console.log(`   ⚠️ Botão VTEX não encontrado: ${e.message}`);
  }
  
  // Tenta pelo texto exato
  if (!btnClicado) {
    try {
      const btnContinuar = page.getByRole('button', { name: /Continuar Inscrição/i });
      if (await btnContinuar.isVisible({ timeout: 3000 })) {
        await btnContinuar.scrollIntoViewIfNeeded();
        await btnContinuar.click({ force: true });
        console.log('   ✅ Botão "Continuar Inscrição" clicado');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback: qualquer botão que contenha "Continuar"
  if (!btnClicado) {
    try {
      const btn = page.locator('button:has-text("Continuar")').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        console.log('   ✅ Botão Continuar clicado (fallback)');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback: link
  if (!btnClicado) {
    try {
      const link = page.locator('a:has-text("Continuar")').first();
      if (await link.isVisible({ timeout: 2000 })) {
        await link.scrollIntoViewIfNeeded();
        await link.click({ force: true });
        console.log('   ✅ Link Continuar clicado');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback: tenta clicar via JavaScript se nada funcionou
  if (!btnClicado) {
    try {
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
          if (btn.textContent && btn.textContent.toLowerCase().includes('continuar')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) {
        console.log('   ✅ Botão Continuar clicado (via JavaScript)');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  if (!btnClicado) {
    console.log('   ⚠️ Botão Continuar não encontrado - tentando screenshot');
    try {
      await page.screenshot({ path: 'erro-carrinho-pos.png', fullPage: true });
    } catch (e) {}
  }
  
  // Aguarda navegação para o checkout
  await page.waitForTimeout(5000);
  await manterCursorNaTela(page);
  
  // Verifica se realmente saiu da página de campanha
  const urlAposClique = page.url();
  console.log(`   📍 URL após clique: ${urlAposClique}`);
  
  if (urlAposClique.includes('campanha-comercial')) {
    console.log('   ⚠️ Ainda na página de campanha, tentando novamente...');
    
    // Segunda tentativa com mais força
    try {
      await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const continuar = allButtons.find(b => 
          b.textContent?.toLowerCase().includes('continuar') && 
          !b.disabled
        );
        if (continuar) {
          continuar.scrollIntoView({ behavior: 'smooth', block: 'center' });
          continuar.focus();
          continuar.click();
        }
      });
      await page.waitForTimeout(5000);
      console.log(`   📍 URL após segunda tentativa: ${page.url()}`);
    } catch (e) {
      console.log(`   ⚠️ Segunda tentativa falhou: ${e.message}`);
    }
  }
  
  console.log('✅ ETAPA 8 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 9: CHECKOUT - DADOS PESSOAIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 9: Dados Pessoais');
  console.log(`   📍 URL: ${page.url()}`);
  
  // Aguarda a página de checkout carregar
  await page.waitForTimeout(3000);
  
  // Preenche data de nascimento (formato YYYY-MM-DD para input type=date)
  const partes = CLIENTE.nascimento.split('/');
  const dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
  
  // Tenta diferentes seletores para data de nascimento
  let dataPreenchida = false;
  
  const seletoresData = [
    page.getByRole('textbox', { name: 'Data de nascimento *' }),
    page.locator('input[name="birthDate"]'),
    page.locator('input[type="date"]'),
    page.locator('#client-birth-date'),
    page.locator('input[placeholder*="nascimento" i]')
  ];
  
  for (const seletor of seletoresData) {
    try {
      if (await seletor.isVisible({ timeout: 2000 })) {
        const disabled = await seletor.getAttribute('disabled');
        if (!disabled) {
          await seletor.fill(dataFormatada);
          console.log(`   ✅ Data nascimento: ${CLIENTE.nascimento}`);
          dataPreenchida = true;
          break;
        } else {
          console.log(`   ℹ️ Data nascimento já preenchida (campo desabilitado)`);
          dataPreenchida = true;
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!dataPreenchida) {
    console.log('   ⚠️ Campo data de nascimento não encontrado');
  }
  
  await page.waitForTimeout(1000);
  
  // Ir para Endereço - com múltiplos fallbacks
  console.log('   📝 Clicando em Ir para o Endereço...');
  let avancouEndereco = false;
  
  const seletoresBtnEndereco = [
    page.getByRole('button', { name: /Ir para o Endereço/i }),
    page.getByRole('button', { name: /Endereço/i }),
    page.locator('button:has-text("Ir para o Endereço")'),
    page.locator('#go-to-shipping'),
    page.locator('button.btn-go-to-shipping'),
    page.locator('#btn-go-to-shipping'),
    page.locator('button[data-i18n*="shipping"]'),
    page.locator('.btn-success:has-text("Endereço")')
  ];
  
  for (const seletor of seletoresBtnEndereco) {
    try {
      if (await seletor.isVisible({ timeout: 2000 })) {
        await seletor.scrollIntoViewIfNeeded();
        await seletor.click({ force: true });
        console.log('   ✅ Botão Ir para o Endereço clicado');
        avancouEndereco = true;
        break;
      }
    } catch (e) {}
  }
  
  // Fallback: JavaScript
  if (!avancouEndereco) {
    try {
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
          const txt = btn.textContent?.toLowerCase() || '';
          if (txt.includes('endereço') || txt.includes('shipping') || txt.includes('address')) {
            btn.click();
            return true;
          }
        }
        // Tenta pelo ID
        const goShipping = document.querySelector('#go-to-shipping, #btn-go-to-shipping, .btn-go-to-shipping');
        if (goShipping) {
          goShipping.click();
          return true;
        }
        return false;
      });
      if (clicked) {
        console.log('   ✅ Botão Endereço clicado (via JavaScript)');
        avancouEndereco = true;
      }
    } catch (e) {}
  }
  
  if (!avancouEndereco) {
    console.log('   ⚠️ Botão Ir para o Endereço não encontrado');
    await page.screenshot({ path: 'debug-checkout-profile.png', fullPage: true });
  }
  
  await page.waitForTimeout(3000);
  console.log(`   📍 URL após clicar: ${page.url()}`);
  
  console.log('✅ ETAPA 9 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: CHECKOUT - ENDEREÇO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Endereço');
  console.log(`   📍 URL: ${page.url()}`);
  
  await page.waitForTimeout(2000);
  
  // Preenche CEP - com múltiplos seletores
  let cepPreenchido = false;
  
  const seletoresCep = [
    page.getByRole('textbox', { name: 'CEP *' }),
    page.locator('input[name="postalCode"]'),
    page.locator('input#ship-postalCode'),
    page.locator('input[placeholder*="CEP" i]'),
    page.locator('input[id*="postal" i]')
  ];
  
  for (const seletor of seletoresCep) {
    try {
      if (await seletor.isVisible({ timeout: 2000 })) {
        await seletor.click();
        await seletor.fill(CLIENTE.cep);
        await page.waitForTimeout(2000);
        console.log(`   ✅ CEP: ${CLIENTE.cep}`);
        cepPreenchido = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!cepPreenchido) {
    console.log('   ⚠️ Campo CEP não encontrado');
  }
  
  // Preenche Número - com múltiplos seletores
  let numeroPreenchido = false;
  
  const seletoresNumero = [
    page.getByRole('textbox', { name: 'Número *' }),
    page.locator('input[name="number"]'),
    page.locator('input#ship-number'),
    page.locator('input[placeholder*="Número" i]')
  ];
  
  for (const seletor of seletoresNumero) {
    try {
      if (await seletor.isVisible({ timeout: 2000 })) {
        await seletor.click();
        await seletor.fill(CLIENTE.numero);
        console.log(`   ✅ Número: ${CLIENTE.numero}`);
        numeroPreenchido = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!numeroPreenchido) {
    console.log('   ⚠️ Campo Número não encontrado');
  }
  
  await page.waitForTimeout(1000);
  
  // Ir para pagamento - com múltiplos fallbacks
  console.log('   📝 Clicando em Ir para o Pagamento...');
  let avancouPagamento = false;
  
  const seletoresBtnPagamento = [
    page.getByRole('button', { name: /Ir para o pagamento/i }),
    page.getByRole('button', { name: /pagamento/i }),
    page.locator('button:has-text("Ir para o pagamento")'),
    page.locator('#go-to-payment'),
    page.locator('button.btn-go-to-payment'),
    page.locator('#btn-go-to-payment'),
    page.locator('button[data-i18n*="payment"]'),
    page.locator('.btn-success:has-text("pagamento")')
  ];
  
  for (const seletor of seletoresBtnPagamento) {
    try {
      if (await seletor.isVisible({ timeout: 2000 })) {
        await seletor.scrollIntoViewIfNeeded();
        await seletor.click({ force: true });
        console.log('   ✅ Botão Ir para o Pagamento clicado');
        avancouPagamento = true;
        break;
      }
    } catch (e) {}
  }
  
  // Fallback: JavaScript
  if (!avancouPagamento) {
    try {
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
          const txt = btn.textContent?.toLowerCase() || '';
          if (txt.includes('pagamento') || txt.includes('payment')) {
            btn.click();
            return true;
          }
        }
        const goPayment = document.querySelector('#go-to-payment, #btn-go-to-payment, .btn-go-to-payment');
        if (goPayment) {
          goPayment.click();
          return true;
        }
        return false;
      });
      if (clicked) {
        console.log('   ✅ Botão Pagamento clicado (via JavaScript)');
        avancouPagamento = true;
      }
    } catch (e) {}
  }
  
  if (!avancouPagamento) {
    console.log('   ⚠️ Botão Ir para o Pagamento não encontrado');
    await page.screenshot({ path: 'debug-checkout-shipping.png', fullPage: true });
  }
  
  await page.waitForTimeout(3000);
  console.log(`   📍 URL após clicar: ${page.url()}`);
  
  console.log('✅ ETAPA 10 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 11: PAGAMENTO E FINALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 11: Pagamento e Finalização');
  
  await manterCursorNaTela(page);
  await page.waitForTimeout(3000);
  
  console.log(`   📍 URL: ${page.url()}`);
  
  // Seleciona Boleto Bancário se disponível
  try {
    const btnBoleto = page.locator('#payment-group-promissoryPaymentGroup');
    if (await btnBoleto.isVisible({ timeout: 3000 })) {
      if (!(await btnBoleto.getAttribute('class')).includes('active')) {
        await btnBoleto.click();
        console.log('   ✅ Boleto bancário selecionado');
        await page.waitForTimeout(1000);
      } else {
        console.log('   ✅ Boleto bancário já selecionado');
      }
    }
  } catch (e) {
    console.log('   ⚠️ Opção de pagamento não encontrada, continuando...');
  }
  
  // Clica no botão "Finalizar compra"
  console.log('   📝 Clicando em Finalizar compra...');
  
  let finalizou = false;
  
  // Tenta pelo ID específico do botão
  try {
    const btnFinalizar = page.locator('#payment-data-submit').last();
    if (await btnFinalizar.isVisible({ timeout: 3000 })) {
      await btnFinalizar.scrollIntoViewIfNeeded();
      await btnFinalizar.click();
      console.log('   ✅ Botão "Finalizar compra" clicado (via ID)');
      finalizou = true;
    }
  } catch (e) {}
  
  // Fallback: pelo texto
  if (!finalizou) {
    try {
      const btn = page.getByRole('button', { name: /Finalizar compra/i });
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        console.log('   ✅ Botão "Finalizar compra" clicado (via texto)');
        finalizou = true;
      }
    } catch (e) {}
  }
  
  // Fallback: botão submit com classe específica
  if (!finalizou) {
    try {
      const btn = page.locator('button.btn-success.btn-large.btn-block').last();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        console.log('   ✅ Botão finalizar clicado (via classe)');
        finalizou = true;
      }
    } catch (e) {}
  }
  
  if (!finalizou) {
    console.log('   ⚠️ Botão Finalizar compra não encontrado');
    await page.screenshot({ path: 'erro-finalizar-compra.png', fullPage: true });
  }
  
  await page.waitForTimeout(10000);
  
  // Verifica se chegou na página de confirmação
  const urlFinal = page.url();
  console.log(`📍 URL final: ${urlFinal}`);
  
  if (urlFinal.includes('orderPlaced')) {
    // Extrai número da inscrição
    const ogMatch = urlFinal.match(/og=(\d+)/);
    if (ogMatch) {
      numeroInscricao = ogMatch[1];
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🎉 INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADA COM SUCESSO!');
    if (numeroInscricao) {
      console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
    }
    console.log(`📋 Campanha aplicada: ${CLIENTE.campanha}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('❌ INSCRIÇÃO PÓS-GRADUAÇÃO NÃO FINALIZADA');
    console.log(`📍 URL final: ${urlFinal}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    await page.screenshot({ path: 'erro-pos-final.png', fullPage: true });
    // Se não chegou na página de confirmação, não continua
    return;
  }
  
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 12: REALIZAR PAGAMENTO (ABRE NOVA ABA)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 12: Realizar Pagamento');
  
  await page.waitForTimeout(3000);
  
  // Aguarda o botão "Realizar pagamento" aparecer
  const btnRealizarPagamento = page.locator('a.cruzeirodosul-store-theme-3-x-confirmationStepsButton:has-text("Realizar pagamento")');
  
  let siaaPage = null;
  
  try {
    if (await btnRealizarPagamento.isVisible({ timeout: 10000 })) {
      console.log('   📝 Clicando em "Realizar pagamento"...');
      
      // Captura a nova página que será aberta
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        btnRealizarPagamento.click()
      ]);
      
      siaaPage = newPage;
      await siaaPage.waitForLoadState('domcontentloaded');
      
      console.log(`   ✅ Nova aba aberta: ${siaaPage.url()}`);
    } else {
      // Fallback: tenta pelo texto
      const btnAlt = page.getByRole('link', { name: /Realizar pagamento/i });
      if (await btnAlt.isVisible({ timeout: 3000 })) {
        const [newPage] = await Promise.all([
          context.waitForEvent('page'),
          btnAlt.click()
        ]);
        siaaPage = newPage;
        await siaaPage.waitForLoadState('domcontentloaded');
        console.log(`   ✅ Nova aba aberta (fallback): ${siaaPage.url()}`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao abrir página de pagamento: ${e.message}`);
  }
  
  if (!siaaPage) {
    console.log('   ❌ Não foi possível abrir a página de pagamento');
    await page.screenshot({ path: 'erro-realizar-pagamento.png', fullPage: true });
    return;
  }
  
  console.log('✅ ETAPA 12 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 13: SIAA - DIGITAR CPF
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 13: SIAA - Digitar CPF');
  
  await siaaPage.waitForTimeout(2000);
  
  // Preenche o CPF
  try {
    const campoCpf = siaaPage.locator('input[id*="cpf"], input[name*="cpf"], input[placeholder*="CPF"]').first();
    
    if (await campoCpf.isVisible({ timeout: 5000 })) {
      await campoCpf.click();
      await campoCpf.fill(CLIENTE.cpf);
      console.log(`   ✅ CPF preenchido: ${CLIENTE.cpf}`);
    } else {
      // Fallback: procura por label
      const label = siaaPage.locator('label:has-text("CPF")');
      if (await label.isVisible({ timeout: 2000 })) {
        const input = siaaPage.locator('input').first();
        await input.fill(CLIENTE.cpf);
        console.log(`   ✅ CPF preenchido (fallback): ${CLIENTE.cpf}`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao preencher CPF: ${e.message}`);
  }
  
  // Clica em Próximo
  await siaaPage.waitForTimeout(1000);
  
  try {
    const btnProximo = siaaPage.getByRole('button', { name: /Próximo/i });
    if (await btnProximo.isVisible({ timeout: 3000 })) {
      await btnProximo.click();
      console.log('   ✅ Botão "Próximo" clicado');
    } else {
      // Fallback
      const btnAlt = siaaPage.locator('button:has-text("Próximo"), input[type="submit"][value*="Próximo"]').first();
      if (await btnAlt.isVisible({ timeout: 2000 })) {
        await btnAlt.click();
        console.log('   ✅ Botão "Próximo" clicado (fallback)');
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao clicar em Próximo: ${e.message}`);
  }
  
  await siaaPage.waitForLoadState('domcontentloaded');
  await siaaPage.waitForTimeout(3000);
  
  console.log(`   📍 URL SIAA: ${siaaPage.url()}`);
  console.log('✅ ETAPA 13 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 14: SELECIONAR INSCRIÇÃO E CAPTURAR APROVAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 14: Selecionar Inscrição e Capturar Aprovação');
  
  // Aguarda a página carregar completamente
  await siaaPage.waitForTimeout(3000);
  
  // Verifica se há modal "Resultados das Inscrições" (quando aluno tem múltiplas inscrições)
  try {
    const modalResultados = siaaPage.locator('text=Resultados das Inscrições').first();
    
    if (await modalResultados.isVisible({ timeout: 5000 })) {
      console.log('   📍 Modal "Resultados das Inscrições" detectado');
      await siaaPage.waitForTimeout(1000);
      
      // ═══════════════════════════════════════════════════════════════════════════
      // SELEÇÃO DO CURSO NO DROPDOWN PRIMEFACES
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Primeiro tenta o trigger do PrimeFaces (componente customizado)
      const dropdownTrigger = siaaPage.locator('.ui-selectonemenu-trigger').first();
      
      if (await dropdownTrigger.isVisible({ timeout: 3000 })) {
        console.log('   📋 Lendo opções do dropdown PrimeFaces...');
        console.log(`   🔍 Procurando: "${CLIENTE.curso}"`);
        
        // Clica no trigger para abrir o dropdown
        await dropdownTrigger.click({ force: true });
        await siaaPage.waitForTimeout(1000);
        
        // Lista as opções visíveis no painel do dropdown PrimeFaces
        const opcoesPF = siaaPage.locator('.ui-selectonemenu-item');
        const countOpcoes = await opcoesPF.count();
        
        // Normaliza o nome do curso buscado
        const cursoNormalizado = CLIENTE.curso.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, '');
        
        // Palavras-chave principais do curso (ignora palavras pequenas)
        const palavrasChave = cursoNormalizado.split(/\s+/)
          .filter(p => p.length > 2);
        
        let melhorMatch = { indice: -1, score: 0, texto: '', elemento: null };
        
        for (let i = 0; i < countOpcoes; i++) {
          const opcao = opcoesPF.nth(i);
          const textoOpcao = await opcao.textContent();
          const textoNormalizado = textoOpcao.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '');
          
          console.log(`      ${i + 1}. ${textoOpcao.substring(0, 120).trim()}`);
          
          // Calcula score: quantas palavras-chave estão presentes
          let score = 0;
          for (const palavra of palavrasChave) {
            if (textoNormalizado.includes(palavra)) {
              score++;
            }
          }
          
          // Se todas as palavras-chave foram encontradas, é um match
          if (score > melhorMatch.score) {
            melhorMatch = { indice: i, score: score, texto: textoOpcao, elemento: opcao };
          }
        }
        
        // Seleciona o melhor match se encontrou pelo menos metade das palavras-chave
        const minPalavras = Math.ceil(palavrasChave.length / 2);
        
        if (melhorMatch.indice >= 0 && melhorMatch.score >= minPalavras && melhorMatch.elemento) {
          console.log(`      ✅ Melhor match (${melhorMatch.score}/${palavrasChave.length} palavras): "${melhorMatch.texto.substring(0, 100).trim()}"`);
          
          // Clica diretamente na opção encontrada (método mais confiável para PrimeFaces)
          await melhorMatch.elemento.click();
          await siaaPage.waitForTimeout(1500);
          console.log(`   ✅ Curso selecionado no dropdown PrimeFaces (índice ${melhorMatch.indice})`);
        } else {
          console.log(`   ⚠️ Curso "${CLIENTE.curso}" não encontrado com certeza suficiente`);
          console.log(`   📝 Melhor match teve apenas ${melhorMatch.score}/${palavrasChave.length} palavras`);
          // Seleciona a última opção (mais recente)
          if (countOpcoes > 1) {
            await opcoesPF.nth(1).click(); // Índice 1 pula "-- Selecione --"
            await siaaPage.waitForTimeout(1500);
            console.log(`   📝 Selecionada segunda opção (mais recente)`);
          }
        }
      } else {
        // Fallback: tenta select nativo
        const dropdownInscricoes = siaaPage.locator('select').first();
        
        if (await dropdownInscricoes.isVisible({ timeout: 2000 })) {
          console.log('   📋 Usando select nativo...');
          const opcoes = await dropdownInscricoes.locator('option').allTextContents();
          
          for (let i = 0; i < opcoes.length; i++) {
            console.log(`      ${i + 1}. ${opcoes[i].substring(0, 100).trim()}`);
          }
          
          // Seleciona a segunda opção (índice 1)
          await dropdownInscricoes.selectOption({ index: 1 });
          await siaaPage.waitForTimeout(1500);
        }
      }
      
      await siaaPage.waitForTimeout(500);
      
      // Clica no botão "Acessar"
      let btnAcessar = siaaPage.locator('span.ui-button-text:has-text("Acessar")').first();
      
      if (!(await btnAcessar.isVisible({ timeout: 2000 }).catch(() => false))) {
        btnAcessar = siaaPage.locator('button:has(span:has-text("Acessar"))').first();
      }
      
      if (!(await btnAcessar.isVisible({ timeout: 2000 }).catch(() => false))) {
        btnAcessar = siaaPage.getByRole('button', { name: /Acessar/i });
      }
      
      if (await btnAcessar.isVisible({ timeout: 3000 })) {
        console.log('   📝 Clicando em "Acessar"...');
        await btnAcessar.click({ force: true });
        await siaaPage.waitForLoadState('domcontentloaded');
        await siaaPage.waitForTimeout(4000);
        console.log('   ✅ Botão "Acessar" clicado');
        console.log(`   📍 URL após acessar: ${siaaPage.url()}`);
      } else {
        console.log('   ⚠️ Botão "Acessar" não encontrado, tentando Enter...');
        await siaaPage.keyboard.press('Enter');
        await siaaPage.waitForTimeout(3000);
      }
    } else {
      console.log('   📍 Modal "Resultados das Inscrições" não detectado (aluno tem apenas uma inscrição)');
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao processar modal: ${e.message}`);
    await siaaPage.screenshot({ path: `erro-modal-${Date.now()}.png`, fullPage: true });
  }
  
  // Verifica se está na página de aprovação
  const textoAprovado = siaaPage.locator('text=Parabéns').first();
  
  // Define os caminhos dos arquivos de saída
  const timestamp = Date.now();
  const screenshotPath = `aprovacao-${CLIENTE.cpf}-${timestamp}.png`;
  const boletoPath = `boleto-${CLIENTE.cpf}-${timestamp}.pdf`;
  
  // Captura screenshot ESPECÍFICO: apenas "Parabéns" + dados + tabela até 6ª mensalidade
  try {
    if (await textoAprovado.isVisible({ timeout: 10000 })) {
      console.log('   ✅ Página de aprovação detectada');
      
      // Aguarda a página carregar completamente
      await siaaPage.waitForLoadState('networkidle');
      await siaaPage.waitForTimeout(2000);
      
      // Scroll para o topo
      await siaaPage.evaluate(() => window.scrollTo(0, 0));
      await siaaPage.waitForTimeout(1000);
      
      // Configura viewport grande para capturar todo o conteúdo sem corte
      await siaaPage.setViewportSize({ width: 1600, height: 1400 });
      await siaaPage.waitForTimeout(500);
      
      // Captura screenshot da área de conteúdo (excluindo sidebar esquerda)
      // A sidebar "Orientações" tem aproximadamente 270px de largura
      // O conteúdo principal vai de x=270 até o final
      
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
          
          // Captura desde depois da sidebar até o fim do conteúdo
          // Usa a posição X do elemento Parabéns como referência
          // A sidebar tem ~270px, o conteúdo começa um pouco antes
          const xInicio = Math.max(0, boundingParabens.x - 10);
          const larguraConteudo = boundingParabens.width + 50; // Largura do card + margem
          
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
          console.log(`   📐 Área de captura (fallback): x=${clipArea.x.toFixed(0)}, y=${clipArea.y.toFixed(0)}, w=${clipArea.width.toFixed(0)}, h=${clipArea.height}`);
        } else {
          // Fallback total: área fixa começando em x=270
          clipArea = {
            x: 270,
            y: 200,
            width: 900,
            height: 750
          };
          console.log(`   📐 Área de captura (padrão): x=${clipArea.x}, y=${clipArea.y}, w=${clipArea.width}, h=${clipArea.height}`);
        }
      } catch (e) {
        console.log(`   ⚠️ Erro ao calcular área: ${e.message}`);
        clipArea = {
          x: 270,
          y: 200,
          width: 900,
          height: 750
        };
      }
      
      // Captura screenshot
      await siaaPage.screenshot({ 
        path: screenshotPath, 
        clip: clipArea
      });
      console.log(`   ✅ Screenshot aprovação salvo: ${screenshotPath}`);
      
      // Extrai informações da aprovação
      const infoAprovacao = await siaaPage.locator('text=NOME:').first().textContent().catch(() => '');
      if (infoAprovacao) {
        console.log(`   📋 ${infoAprovacao.substring(0, 100)}...`);
      }
      
      // Lê informações do plano de pagamento
      try {
        const tabela = siaaPage.locator('table').first();
        if (await tabela.isVisible({ timeout: 3000 })) {
          // Busca valor da matrícula
          const linhaMatricula = siaaPage.locator('tr:has-text("Matrícula")').first();
          if (await linhaMatricula.isVisible({ timeout: 2000 })) {
            const textoMatricula = await linhaMatricula.textContent();
            console.log(`   📊 ${textoMatricula.replace(/\s+/g, ' ').trim()}`);
          }
          
          // Busca valor da primeira mensalidade
          const linhaMensalidade = siaaPage.locator('tr:has-text("Mensalidade")').first();
          if (await linhaMensalidade.isVisible({ timeout: 2000 })) {
            const textoMensalidade = await linhaMensalidade.textContent();
            console.log(`   📊 ${textoMensalidade.replace(/\s+/g, ' ').trim()}`);
          }
        }
      } catch (e) {}
      
    } else {
      console.log('   ⚠️ Texto "Parabéns" não encontrado, capturando tela atual...');
      await siaaPage.screenshot({ path: screenshotPath, fullPage: false });
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao capturar aprovação: ${e.message}`);
    await siaaPage.screenshot({ path: screenshotPath, fullPage: false });
  }
  
  // Verifica se há um modal de seleção de inscrição aberto
  try {
    const modalOverlay = siaaPage.locator('.ui-widget-overlay.ui-dialog-mask');
    if (await modalOverlay.isVisible({ timeout: 2000 })) {
      console.log('   📍 Modal de seleção detectado');
      
      // Tenta fechar clicando fora ou no botão fechar
      const btnFechar = siaaPage.locator('.ui-dialog-titlebar-close, button:has-text("Fechar"), .ui-icon-closethick').first();
      if (await btnFechar.isVisible({ timeout: 1000 })) {
        await btnFechar.click();
        console.log('   ✅ Modal fechado');
        await siaaPage.waitForTimeout(1000);
      } else {
        // Tenta pressionar Escape
        await siaaPage.keyboard.press('Escape');
        await siaaPage.waitForTimeout(1000);
      }
    }
  } catch (e) {}
  
  // Verifica se há um dropdown para selecionar a inscrição e seleciona a mais recente
  try {
    const selectInscricao = siaaPage.locator('#formulario\\:inscricao_candidato, select[id*="inscricao"]').first();
    if (await selectInscricao.isVisible({ timeout: 2000 })) {
      console.log('   📍 Dropdown de inscrições detectado');
      // Seleciona a primeira opção (mais recente)
      await selectInscricao.click();
      await siaaPage.waitForTimeout(500);
      await siaaPage.keyboard.press('Enter');
      await siaaPage.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Scroll para encontrar o botão de Emitir Boleto
  await siaaPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await siaaPage.waitForTimeout(1000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD DIRETO DO BOLETO VIA INTERCEPTAÇÃO DE REDE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let pdfBuffer = null;
  let linhaDigitavel = null;
  let boletoPage = null;
  
  // Configura interceptação para capturar o PDF diretamente da rede
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
  
  try {
    // Localiza o botão de Emitir Boleto
    let btnEmitirBoleto = siaaPage.locator('#formulario\\:acm\\:emissao_boleto, button[id*="emissao_boleto"]').first();
    
    if (!(await btnEmitirBoleto.isVisible({ timeout: 2000 }))) {
      btnEmitirBoleto = siaaPage.getByRole('button', { name: /Emitir Boleto/i });
    }
    
    if (await btnEmitirBoleto.isVisible({ timeout: 5000 })) {
      console.log('   📝 Clicando em "Emitir Boleto"...');
      
      // Scroll até o botão
      await btnEmitirBoleto.scrollIntoViewIfNeeded();
      await siaaPage.waitForTimeout(500);
      
      // Verifica se ainda há overlay bloqueando
      const overlay = siaaPage.locator('.ui-widget-overlay').first();
      if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('   📍 Overlay detectado, aguardando...');
        await siaaPage.waitForTimeout(2000);
        await siaaPage.keyboard.press('Escape');
        await siaaPage.waitForTimeout(1000);
      }
      
      // Clica no botão e aguarda nova página
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
        btnEmitirBoleto.click({ force: true, timeout: 10000 })
      ]);
      
      if (newPage) {
        boletoPage = newPage;
        await boletoPage.waitForLoadState('load');
        await boletoPage.waitForTimeout(3000);
        console.log(`   📍 Nova página aberta: ${boletoPage.url().substring(0, 80)}...`);
      }
      
      // Verifica se capturou o PDF via interceptação
      if (pdfBuffer) {
        fs.writeFileSync(boletoPath, pdfBuffer);
        console.log(`   ✅ BOLETO PDF BAIXADO DIRETAMENTE!`);
        console.log(`   📁 Arquivo: ${boletoPath}`);
        console.log(`   📦 Tamanho: ${pdfBuffer.length} bytes`);
        
        // Tenta extrair linha digitável do conteúdo do PDF
        try {
          const pdfText = pdfBuffer.toString('latin1');
          const codigoMatch = pdfText.match(/\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14}/);
          if (codigoMatch) {
            linhaDigitavel = codigoMatch[0];
            console.log(`   📊 Linha digitável: ${linhaDigitavel}`);
          }
        } catch (e) {}
        
      } else {
        console.log('   ⚠️ PDF não capturado via interceptação, tentando método alternativo...');
        
        // Fallback: tenta capturar screenshot do boleto
        if (boletoPage) {
          const boletoPngPath = boletoPath.replace('.pdf', '.png');
          
          await boletoPage.setViewportSize({ width: 1600, height: 1200 });
          await boletoPage.waitForTimeout(2000);
          
          // Zoom 150% para melhor qualidade
          await boletoPage.keyboard.press('Control+0');
          await boletoPage.waitForTimeout(500);
          for (let i = 0; i < 4; i++) {
            await boletoPage.keyboard.press('Control+Equal');
            await boletoPage.waitForTimeout(200);
          }
          await boletoPage.waitForTimeout(1000);
          
          // Coordenadas do boleto
          const clipBoleto = { x: 200, y: 100, width: 700, height: 765 };
          
          await boletoPage.screenshot({ path: boletoPngPath, clip: clipBoleto });
          console.log(`   ✅ Screenshot do boleto salvo: ${boletoPngPath}`);
          
          // Converte para PDF usando pdfkit
          try {
            const doc = new PDFDocument({ size: [clipBoleto.width, clipBoleto.height], margin: 0 });
            const pdfStream = fs.createWriteStream(boletoPath);
            doc.pipe(pdfStream);
            doc.image(boletoPngPath, 0, 0, { width: clipBoleto.width, height: clipBoleto.height });
            doc.end();
            await new Promise((resolve) => pdfStream.on('finish', resolve));
            
            const stats = fs.statSync(boletoPath);
            console.log(`   ✅ Boleto PDF gerado: ${boletoPath} (${stats.size} bytes)`);
          } catch (pdfErr) {
            console.log(`   ⚠️ Erro ao converter PNG para PDF: ${pdfErr.message}`);
          }
          
          // Tenta extrair linha digitável
          try {
            const textContent = await boletoPage.textContent('body').catch(() => '');
            const codigoMatch = textContent.match(/\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14}/);
            if (codigoMatch) {
              linhaDigitavel = codigoMatch[0];
              console.log(`   📊 Linha digitável: ${linhaDigitavel}`);
            }
          } catch (e) {}
        }
      }
      
    } else {
      // Fallback: procura por link ou botão alternativo
      const btnAlt = siaaPage.locator('button:has-text("Emitir"), a:has-text("Emitir Boleto"), input[value*="Emitir"]').first();
      if (await btnAlt.isVisible({ timeout: 3000 })) {
        console.log('   📝 Clicando em "Emitir Boleto" (fallback)...');
        
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
          btnAlt.click({ force: true })
        ]);
        
        if (newPage && pdfBuffer) {
          fs.writeFileSync(boletoPath, pdfBuffer);
          console.log(`   ✅ Boleto baixado (fallback): ${boletoPath}`);
          boletoPage = newPage;
        }
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao emitir boleto: ${e.message}`);
    
    try {
      await siaaPage.screenshot({ path: `erro-boleto-${timestamp}.png`, fullPage: true });
    } catch (e2) {}
  }
  
  // Remove a interceptação para não afetar outras requisições
  await context.unroute('**/boleto/getBoletoDiversos**');
  
  // Verifica se o PDF foi salvo
  if (!fs.existsSync(boletoPath)) {
    console.log('   ⚠️ PDF não foi salvo, tentando capturar screenshot da página atual...');
    try {
      await siaaPage.screenshot({ path: boletoPath.replace('.pdf', '.png'), fullPage: true });
      console.log(`   ✅ Screenshot salvo: ${boletoPath.replace('.pdf', '.png')}`);
    } catch (e) {}
  }
  
  console.log('✅ ETAPA 14 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 PROCESSO COMPLETO DE INSCRIÇÃO PÓS-GRADUAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
  console.log(`📋 CPF: ${CLIENTE.cpf}`);
  console.log(`📋 Campanha: ${CLIENTE.campanha}`);
  console.log(`📸 Screenshot aprovação: ${screenshotPath}`);
  console.log(`📄 Boleto: ${boletoPath}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 15: ENVIAR ARQUIVOS PARA N8N/WEBHOOK
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('📤 ETAPA 15: Enviando arquivos para n8n...');
  
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/upload-boleto';
  const leadId = process.env.LEAD_ID || '';
  
  if (webhookUrl && webhookUrl !== 'http://localhost:5678/webhook/upload-boleto') {
    try {
      const FormData = require('form-data');
      const axios = require('axios');
      
      const formData = new FormData();
      
      // Adiciona dados JSON
      formData.append('lead_id', leadId);
      formData.append('cpf', CLIENTE.cpf);
      formData.append('numero_inscricao', numeroInscricao || '');
      formData.append('campanha', CLIENTE.campanha || '');
      formData.append('curso', CLIENTE.curso || '');
      formData.append('linha_digitavel', linhaDigitavel || '');
      
      // Adiciona screenshot de aprovação
      if (fs.existsSync(screenshotPath)) {
        formData.append('screenshot', fs.createReadStream(screenshotPath), {
          filename: screenshotPath,
          contentType: 'image/png'
        });
        console.log(`   📸 Anexando screenshot: ${screenshotPath}`);
      }
      
      // Adiciona boleto PDF
      if (fs.existsSync(boletoPath)) {
        formData.append('boleto', fs.createReadStream(boletoPath), {
          filename: boletoPath,
          contentType: 'application/pdf'
        });
        console.log(`   📄 Anexando boleto: ${boletoPath}`);
      } else {
        // Tenta anexar PNG se PDF não existir
        const boletoPngPath = boletoPath.replace('.pdf', '.png');
        if (fs.existsSync(boletoPngPath)) {
          formData.append('boleto', fs.createReadStream(boletoPngPath), {
            filename: boletoPngPath,
            contentType: 'image/png'
          });
          console.log(`   📄 Anexando boleto (PNG): ${boletoPngPath}`);
        }
      }
      
      // Envia para o webhook
      const response = await axios.post(webhookUrl, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      });
      
      console.log(`   ✅ Arquivos enviados para n8n!`);
      console.log(`   📊 Status: ${response.status}`);
      if (response.data) {
        console.log(`   📊 Resposta: ${JSON.stringify(response.data)}`);
      }
    } catch (webhookError) {
      console.log(`   ⚠️ Erro ao enviar para n8n: ${webhookError.message}`);
    }
  } else {
    console.log('   ⏭️ N8N_WEBHOOK_URL não configurado, pulando envio.');
  }
  
  console.log('✅ ETAPA 15 CONCLUÍDA');
  console.log('');
  
  // Fecha as páginas adicionais
  if (boletoPage) {
    await boletoPage.close().catch(() => {});
  }
  if (siaaPage) {
    await siaaPage.close().catch(() => {});
  }
});

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

// Função para corrigir encoding de caracteres acentuados
function corrigirEncoding(texto) {
  if (!texto) return texto;
  
  // Mapa de correções comuns de encoding UTF-8 mal interpretado
  const correcoes = {
    'Ã£': 'ã', 'Ã¡': 'á', 'Ã ': 'à', 'Ã¢': 'â', 'Ã¤': 'ä',
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã«': 'ë',
    'Ã­': 'í', 'Ã¬': 'ì', 'Ã®': 'î', 'Ã¯': 'ï',
    'Ã³': 'ó', 'Ã²': 'ò', 'Ã´': 'ô', 'Ãµ': 'õ', 'Ã¶': 'ö',
    'Ãº': 'ú', 'Ã¹': 'ù', 'Ã»': 'û', 'Ã¼': 'ü',
    'Ã§': 'ç', 'Ã±': 'ñ',
    'Ã': 'Á', 'Ã': 'À', 'Ã': 'Â', 'Ã': 'Ã', 'Ã': 'Ä',
    'Ã': 'É', 'Ã': 'È', 'Ã': 'Ê', 'Ã': 'Ë',
    'Ã': 'Í', 'Ã': 'Ì', 'Ã': 'Î', 'Ã': 'Ï',
    'Ã': 'Ó', 'Ã': 'Ò', 'Ã': 'Ô', 'Ã': 'Õ', 'Ã': 'Ö',
    'Ã': 'Ú', 'Ã': 'Ù', 'Ã': 'Û', 'Ã': 'Ü',
    'Ã': 'Ç', 'Ã': 'Ñ',
  };
  
  let resultado = texto;
  for (const [errado, correto] of Object.entries(correcoes)) {
    resultado = resultado.split(errado).join(correto);
  }
  
  return resultado;
}

// Função para remover acentos (para buscas)
function removerAcentos(texto) {
  if (!texto) return texto;
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA FECHAR COOKIE BANNER E OUTROS OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════
async function fecharCookieBanner(page) {
  try {
    // Tenta fechar cookie consent (vários seletores comuns)
    const cookieSelectors = [
      '#privacytools-banner-consent button',
      '.cc-dismiss',
      '.cc-btn',
      'button[aria-label*="cookie"]',
      'button[aria-label*="aceitar"]',
      'button:has-text("Aceitar")',
      'button:has-text("OK")',
      'button:has-text("Concordo")',
      'button:has-text("Entendi")',
      '.privacy-tools-layout button',
      '#cookieconsent button'
    ];
    
    for (const sel of cookieSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log(`   🍪 Cookie banner fechado (${sel})`);
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {}
    }
    
    // Remove overlay via JavaScript se persistir
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('#privacytools-banner-consent, .cc-window, [class*="cookie"], [id*="cookie"], .privacy-tools-layout');
      overlays.forEach(el => {
        el.style.display = 'none';
        el.remove();
      });
    });
    
  } catch (e) {
    // Ignora erros - cookie banner é opcional
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA FECHAR POPUP "BAIXAR GUIA DO CURSO" + COOKIES + OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════
async function fecharTodosOverlays(page) {
  try {
    // 1) REMOVE TUDO via JavaScript (mais confiável - não depende de clique)
    const removidos = await page.evaluate(() => {
      let count = 0;
      
      // Remove popup "baixar guia do curso" e seus backdrops
      const popupSelectors = [
        '[class*="sectionContactFormNewsDownloadForm"]',
        '[class*="DownloadFormBackdrop"]',
        '[class*="DownloadFormContainer"]',
        '[class*="DownloadFormClose"]',
      ];
      popupSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => { el.remove(); count++; });
      });
      
      // Remove qualquer overlay/backdrop fixo que cubra a tela
      document.querySelectorAll('[class*="Backdrop"], [class*="backdrop"], [class*="overlay"]').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          if (el.offsetWidth > window.innerWidth * 0.5 || el.offsetHeight > window.innerHeight * 0.5) {
            el.remove(); count++;
          }
        }
      });
      
      // Remove cookie banners
      document.querySelectorAll('.cc-banner, #privacytools-banner-consent, [id*="cookie"], [class*="cookie-consent"], [class*="lgpd"]').forEach(el => { el.remove(); count++; });
      
      // Remove modais genéricos que bloqueiam
      document.querySelectorAll('.modal-backdrop, .ui-widget-overlay').forEach(el => { el.remove(); count++; });
      
      return count;
    });
    
    if (removidos > 0) {
      console.log(`   🧹 ${removidos} overlay(s)/popup(s) removido(s) via JS`);
    }
    
    // 2) Aceita cookies se o botão ainda existir (renderizado após remoção)
    await page.waitForTimeout(300);
    const btnCookies = page.locator('button:has-text("Aceitar todos")').first();
    if (await btnCookies.isVisible({ timeout: 500 }).catch(() => false)) {
      await btnCookies.click();
      await page.waitForTimeout(300);
      console.log('   🍪 Cookies aceitos');
    }
    
    // 3) Escape para fechar qualquer coisa residual
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    
    // 4) Segunda passada de remoção (popups podem reaparecer após scroll)
    await page.evaluate(() => {
      document.querySelectorAll('[class*="sectionContactFormNewsDownloadForm"], [class*="DownloadForm"]').forEach(el => el.remove());
    });
    
  } catch (e) {
    // Silencioso
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA DETECTAR EM QUAL TELA/ESTADO ESTAMOS
// ═══════════════════════════════════════════════════════════════════════════
async function detectarTelaAtual(page) {
  const url = page.url();
  const estado = {
    url: url,
    tela: 'desconhecida',
    detalhes: {}
  };
  
  try {
    // Verifica elementos-chave para identificar a tela
    const elementos = {
      // Formulário inicial de curso
      formNome: await page.locator('input[placeholder*="nome completo" i]').isVisible({ timeout: 1000 }).catch(() => false),
      formTelefone: await page.locator('input[placeholder*="XXXXX" i]').isVisible({ timeout: 1000 }).catch(() => false),
      btnInscreva: await page.getByRole('button', { name: /inscreva-se/i }).isVisible({ timeout: 1000 }).catch(() => false),
      
      // Formulário de localização
      reactSelects: await page.locator('.react-select__input-container').count().catch(() => 0),
      selectPais: await page.locator('text=País').first().isVisible({ timeout: 1000 }).catch(() => false),
      selectEstado: await page.locator('text=Estado').first().isVisible({ timeout: 1000 }).catch(() => false),
      campoCPF: await page.locator('input[name="userDocument"]').isVisible({ timeout: 1000 }).catch(() => false),
      btnContinuarInscricao: await page.locator('button:has-text("Continuar Inscrição")').isVisible({ timeout: 1000 }).catch(() => false),
      
      // Página de campanha
      dropdownCampanha: await page.locator('#select2-campanhas-container, select[name="campanhas"]').isVisible({ timeout: 1000 }).catch(() => false),
      
      // Checkout
      checkoutProfile: url.includes('/checkout/#/profile'),
      checkoutShipping: url.includes('/checkout/#/shipping'),
      checkoutPayment: url.includes('/checkout/#/payment'),
      checkoutCart: url.includes('/checkout/#/cart'),
      
      // Order placed
      orderPlaced: url.includes('orderPlaced'),
      
      // SIAA
      siaaPage: url.includes('siaa.cruzeirodosul'),
      
      // Textos específicos
      textoCampanha: await page.locator('text=Campanha Comercial').isVisible({ timeout: 1000 }).catch(() => false),
      textoEstamosQuaseLa: await page.locator('text=Estamos quase lá').isVisible({ timeout: 1000 }).catch(() => false),
      textoParabens: await page.locator('text=Parabéns').isVisible({ timeout: 1000 }).catch(() => false),
    };
    
    estado.detalhes = elementos;
    
    // Determina a tela baseado nos elementos
    if (elementos.orderPlaced || elementos.textoEstamosQuaseLa) {
      estado.tela = 'ORDER_PLACED';
    } else if (elementos.siaaPage) {
      estado.tela = elementos.textoParabens ? 'SIAA_APROVADO' : 'SIAA_CPF';
    } else if (elementos.checkoutPayment) {
      estado.tela = 'CHECKOUT_PAYMENT';
    } else if (elementos.checkoutShipping) {
      estado.tela = 'CHECKOUT_SHIPPING';
    } else if (elementos.checkoutProfile) {
      estado.tela = 'CHECKOUT_PROFILE';
    } else if (elementos.checkoutCart) {
      estado.tela = 'CHECKOUT_CART';
    } else if (url.includes('campanha-comercial') || elementos.dropdownCampanha || elementos.textoCampanha) {
      estado.tela = 'CAMPANHA';
    } else if (elementos.reactSelects >= 3 || (elementos.selectPais && elementos.selectEstado) || elementos.campoCPF || elementos.btnContinuarInscricao) {
      estado.tela = 'FORMULARIO_LOCALIZACAO';
    } else if (elementos.formNome || elementos.formTelefone || elementos.btnInscreva) {
      estado.tela = 'FORMULARIO_INICIAL';
    } else if (url.includes('/p') && url.includes('cruzeirodosul')) {
      estado.tela = 'PAGINA_CURSO';
    }
    
    console.log(`   🔍 [DETECTOR] Tela: ${estado.tela} | URL: ${url.substring(0, 60)}...`);
    console.log(`   📊 [DETECTOR] ReactSelects: ${elementos.reactSelects} | CPF: ${elementos.campoCPF} | País: ${elementos.selectPais}`);
    
  } catch (e) {
    console.log(`   ⚠️ [DETECTOR] Erro: ${e.message}`);
  }
  
  return estado;
}

const CLIENTE = {
  nome: capitalizarNome(corrigirEncoding(process.env.CLIENTE_NOME || 'Carlos Eduardo Mendes')),
  cpf: process.env.CLIENTE_CPF || '26415424041',
  email: (process.env.CLIENTE_EMAIL || 'carlos.mendes2024@gmail.com').toLowerCase(),
  telefone: formatarTelefone(process.env.CLIENTE_TELEFONE || '11974562318'),
  nascimento: process.env.CLIENTE_NASCIMENTO || '12/09/1980',
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || '33',
  estado: corrigirEncoding(process.env.CLIENTE_ESTADO || 'São Paulo'),
  cidade: corrigirEncoding(process.env.CLIENTE_CIDADE || 'São Paulo'),
  curso: corrigirEncoding(process.env.CLIENTE_CURSO || 'Engenharia de Produção'),
  // Duração: usa env var se fornecida, senão extrai do nome do curso (ex: "MBA... 9 Meses" → 9)
  duracao: process.env.CLIENTE_DURACAO || (() => {
    const cursoNome = corrigirEncoding(process.env.CLIENTE_CURSO || '');
    const matchDur = cursoNome.match(/(\d+)\s*meses?/i);
    return matchDur ? matchDur[1] : '6';
  })(),
  polo: corrigirEncoding(process.env.CLIENTE_POLO || 'barra funda'),
  campanha: corrigirEncoding(process.env.CLIENTE_CAMPANHA || ''),
  // Limpa R$, espaços e vírgulas dos valores monetários para garantir que parseFloat funcione
  matricula: (process.env.CLIENTE_MATRICULA || '99').replace(/[R$\s]/g, '').replace(',', '.').trim(),
  mensalidade: (process.env.CLIENTE_MENSALIDADE || '184').replace(/[R$\s]/g, '').replace(',', '.').trim(),
};

// Função DESABILITADA - não mover o mouse para evitar popup "Antes de Você Sair"
async function manterCursorNaTela(page) {
  // NÃO FAZER NADA - movimento do mouse causa popup
}

// Função de espera simples
async function aguardar(page, ms) {
  await page.waitForTimeout(ms);
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
      return true;
    }
  } catch (e) {}
  return false;
}

// Função para fechar qualquer modal/popup bloqueante
async function fecharModais(page) {
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
  let pdfBoletoBuffer = null; // Para capturar o PDF via interceptação de rede

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCEPTAÇÃO DE REDE PARA CAPTURAR O PDF DO BOLETO DIRETAMENTE
  // ═══════════════════════════════════════════════════════════════════════════
  await context.route('**/boleto/getBoletoDiversos**', async (route) => {
    const pdfUrl = route.request().url();
    console.log(`   🎯 [INTERCEPTOR] URL do PDF interceptada`);
    
    try {
      const response = await route.fetch();
      const body = await response.body();
      
      // Se começa com %PDF, é o PDF real
      if (body.slice(0, 5).toString().includes('%PDF')) {
        pdfBoletoBuffer = body;
        console.log(`   ✅ [INTERCEPTOR] PDF capturado: ${body.length} bytes`);
      }
      
      // Continua a requisição normalmente para o browser
      await route.fulfill({ response });
    } catch (e) {
      console.log(`   ⚠️ [INTERCEPTOR] Erro: ${e.message}`);
      await route.continue();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN (randomiza entre dois logins)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  
  const ADMINS = [
    { email: 'fabio.boas50@polo.cruzeirodosul.edu.br', senha: 'Eduit777' },
    { email: 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', senha: 'MFPedu!t678@!' },
  ];
  const adminEscolhido = ADMINS[Math.floor(Math.random() * ADMINS.length)];
  console.log(`   🔑 Admin: ${adminEscolhido.email}`);
  
  await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
  await page.waitForTimeout(1000);
  
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(adminEscolhido.email);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(1000);
  
  await page.getByRole('textbox', { name: 'Senha' }).fill(adminEscolhido.senha);
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
    // PASSO 0: Aceitar cookies se o banner estiver visível
    try {
      const btnAceitarCookies = page.getByRole('button', { name: /aceitar todos/i });
      if (await btnAceitarCookies.isVisible({ timeout: 3000 })) {
        console.log('   🍪 Banner de cookies detectado, aceitando...');
        await btnAceitarCookies.click();
        await page.waitForTimeout(1000);
        console.log('   ✅ Cookies aceitos');
      }
    } catch (e) {
      // Tenta fechar de outra forma
      try {
        const cookieBanner = page.locator('#privacytools-banner-consent, .cc-banner, [class*="cookie"]').first();
        if (await cookieBanner.isVisible({ timeout: 1000 })) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      } catch (e2) {}
    }
    
    // PASSO 1: Clica em "Entrar como cliente" (seletor da gravação)
    console.log('   📝 Clicando em "Entrar como cliente"...');
    try {
      await page.getByText('Entrar como cliente').first().click();
      console.log('   ✅ Clicou em "Entrar como cliente"');
    } catch (e) {
      const btnEntrarCliente = page.locator('div.cruzeirodosul-telemarketing-2-x-loginAsText');
      if (await btnEntrarCliente.isVisible({ timeout: 3000 })) {
        await btnEntrarCliente.click();
        console.log('   ✅ Clicou em "Entrar como cliente" (fallback)');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Verifica se o formulário de login apareceu, senão tenta novamente
    const campoEmailVisivel = await page.getByPlaceholder('Ex: example@mail.com').isVisible({ timeout: 3000 }).catch(() => false);
    if (!campoEmailVisivel) {
      console.log('   ⚠️ Formulário de login não apareceu, tentando novamente...');
      // Tenta clicar novamente no "Entrar como cliente"
      try {
        await page.getByText('Entrar como cliente').first().click({ force: true });
        await page.waitForTimeout(2000);
      } catch (e) {}
    }
    
    // PASSO 2: Preenche o email
    console.log('   📝 Preenchendo email...');
    const campoEmail = page.getByPlaceholder('Ex: example@mail.com');
    await campoEmail.click();
    await campoEmail.fill(CLIENTE.email);
    console.log(`   ✅ Email preenchido: ${CLIENTE.email}`);
    
    await page.waitForTimeout(500);
    
    // PASSO 3: Clica em "Entrar" - pode precisar clicar 1 ou 2 vezes
    console.log('   📝 Clicando em Entrar (1ª vez)...');
    const btnEntrar = page.getByRole('button', { name: 'Entrar' });
    await btnEntrar.click();
    console.log('   ✅ 1º clique em Entrar');
    
    await page.waitForTimeout(2000);
    
    // Verifica se botão ainda está visível para 2º clique (timeout curto)
    try {
      const btnEntrar2 = page.getByRole('button', { name: 'Entrar' });
      const visivel = await btnEntrar2.isVisible();
      if (visivel) {
        console.log('   📝 Clicando em Entrar (2ª vez)...');
        await btnEntrar2.click({ timeout: 3000 });
        console.log('   ✅ 2º clique em Entrar');
      } else {
        console.log('   ℹ️ Botão não visível - login já efetuado');
      }
    } catch (e) {
      console.log('   ℹ️ 2º clique não necessário - login já efetuado');
    }
    
    console.log('   ✅ Login submetido');
    
    await page.waitForTimeout(3000);
    
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
  
  // Fecha modais se necessário
  await fecharModais(page);
  
  // PASSO 1: Pesquisar o curso
  console.log(`   🔍 Pesquisando curso: "${CLIENTE.curso}"`);
  
  
  const searchInput = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
  await searchInput.click({ force: true });
  await searchInput.fill(CLIENTE.curso);
  await searchInput.press('Enter');
  
  // PASSO 2: Aguardar os resultados carregarem
  console.log('   ⏳ Aguardando resultados carregarem...');
  await aguardar(page, 3000);
  
  // Aguarda aparecer os cards de resultado
  try {
    await page.waitForSelector('a[href*="/pos-"][href$="/p"]', { timeout: 20000 });
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
  // Remove palavras genéricas que matcham qualquer curso (meses, curso, pos, ead, etc.)
  const palavrasGenericasCurso = ['meses', 'curso', 'cursos', 'graduacao', 'pos-graduacao', 'livre', 'livres', 'virtual', 'digital', 'presencial', 'semestre', 'semestres'];
  const palavrasChaveCurso = cursoNormalizado.split(' ').filter(p => p.length > 3 && !palavrasGenericasCurso.includes(p) && !/^\d+$/.test(p));
  console.log(`   🔑 Palavras-chave do curso: [${palavrasChaveCurso.join(', ')}]`);
  
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
  
  // Último fallback com seletores padrão: exige pelo menos metade das keywords
  if (!cursoClicado) {
    console.log('   ⚠️ Tentando match parcial com seletores padrão...');
    const minMatchPadrao = Math.max(2, Math.floor(palavrasChaveCurso.length / 2));
    
    for (let i = 0; i < countCards; i++) {
      const card = todosCards.nth(i);
      const texto = await card.textContent() || '';
      const textoNormalizado = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const href = ((await card.getAttribute('href')) || '').toLowerCase();
      
      const matchCount = palavrasChaveCurso.filter(palavra => textoNormalizado.includes(palavra) || href.includes(palavra)).length;
      
      if (matchCount >= minMatchPadrao) {
        console.log(`   📍 Clicando em (${matchCount}/${palavrasChaveCurso.length} keywords): "${texto.substring(0, 50).replace(/\s+/g, ' ')}..."`);
        await card.click();
        cursoClicado = true;
        break;
      }
    }
  }
  
  // Fallback final (seletor original)
  if (!cursoClicado) {
    const primeiroCard = page.locator('a[href*="/pos-"][href$="/p"]').first();
    if (await primeiroCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await primeiroCard.click();
      cursoClicado = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACKS AVANÇADOS - quando nenhum card de curso foi encontrado
  // Cenários: VTEX redirecionou para página do produto, cards com seletor
  // diferente, busca não retornou resultados, etc.
  // Ordem: A (já na página?) → B (URL direta) → C (re-busca curta) → D (seletores amplos) → E (listagem)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!cursoClicado) {
    console.log('   🆘 Nenhum card encontrado com seletores padrão. Iniciando fallbacks avançados...');
    
    // Quantidade mínima de palavras-chave que devem bater para considerar relevante
    const minKeywordsMatch = Math.max(2, Math.floor(palavrasChaveCurso.length / 2));
    console.log(`   🔑 Exigindo pelo menos ${minKeywordsMatch}/${palavrasChaveCurso.length} keywords para match`);
    console.log(`   📏 Duração desejada: ${CLIENTE.duracao} meses`);
    
    // Função auxiliar para verificar se um card/texto corresponde ao curso E à duração
    const cardMatchCursoEDuracao = (texto, href) => {
      const txtNorm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const hrNorm = (href || '').toLowerCase();
      // Verifica keywords do nome do curso
      const matchCount = palavrasChaveCurso.filter(p => txtNorm.includes(p) || hrNorm.includes(p)).length;
      // Verifica duração (ex: "9 meses", "9meses", "9-meses")
      const temDuracao = txtNorm.includes(`${CLIENTE.duracao} meses`) || 
                         txtNorm.includes(`${CLIENTE.duracao}meses`) ||
                         hrNorm.includes(`${CLIENTE.duracao}-meses`) ||
                         hrNorm.includes(`-${CLIENTE.duracao}-`);
      return { matchCount, temDuracao };
    };

    // FALLBACK A: Verificar se VTEX já redirecionou para a página do produto
    // (quando busca com match exato, VTEX às vezes vai direto para o produto)
    const temBotaoInscreva = await page.locator(
      'button:has-text("Inscreva-se"), a:has-text("Inscreva-se"), input[value*="Inscreva" i], [class*="inscreva" i]'
    ).first().isVisible({ timeout: 3000 }).catch(() => false);

    if (temBotaoInscreva) {
      // Verifica se a URL ou conteúdo da página contém a duração correta
      const urlAtualA = page.url().toLowerCase();
      const tituloA = await page.title().catch(() => '');
      const { matchCount: mcA, temDuracao: tdA } = cardMatchCursoEDuracao(tituloA, urlAtualA);
      
      if (tdA || urlAtualA.includes(`${CLIENTE.duracao}-meses`) || urlAtualA.includes(CLIENTE.curso.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 20))) {
        console.log('   ✅ FALLBACK A: Já estamos na página do produto (botão "Inscreva-se" + duração OK)');
        cursoClicado = true;
      } else {
        console.log(`   ⚠️ FALLBACK A: Botão "Inscreva-se" encontrado mas URL não confirma o curso/duração corretos`);
        console.log(`      URL: ${urlAtualA.substring(0, 80)}`);
      }
    }

    // FALLBACK B: Navegação direta via URL slug construída do nome do curso
    // (mais seguro que seletores amplos - vai direto para o produto correto)
    if (!cursoClicado) {
      const slug = CLIENTE.curso
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const urlsTentativas = [
        `https://cruzeirodosul.myvtex.com/${slug}/p`,
        `https://cruzeirodosul.myvtex.com/pos-${slug}/p`,
        `https://cruzeirodosul.myvtex.com/${slug.replace(/^mba-em-/, 'mba-')}/p`,
      ];

      for (const urlDireta of urlsTentativas) {
        console.log(`   🔄 FALLBACK B: Tentando URL direta: ${urlDireta}`);
        try {
          const resp = await page.goto(urlDireta, { waitUntil: 'domcontentloaded', timeout: 15000 });
          if (resp && resp.status() < 400) {
            await page.waitForTimeout(3000);
            const temConteudo = await page.locator(
              'button:has-text("Inscreva-se"), input[placeholder*="nome" i], [class*="productName"], [class*="formContainer"]'
            ).first().isVisible({ timeout: 5000 }).catch(() => false);
            if (temConteudo) {
              console.log('   ✅ FALLBACK B: Página do curso encontrada via URL direta!');
              cursoClicado = true;
              break;
            }
          }
        } catch (e) {
          console.log(`   ⚠️ URL ${urlDireta} falhou`);
        }
      }
    }

    // FALLBACK C: Re-buscar com nome simplificado (sem duração/números)
    if (!cursoClicado) {
      const cursoSimples = CLIENTE.curso
        .replace(/\d+\s*meses?/gi, '')
        .replace(/\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`   🔄 FALLBACK C: Re-buscando com termo curto: "${cursoSimples}"`);

      try {
        // Volta para a página de pós-graduação primeiro (para ter o campo de busca)
        await page.goto('https://cruzeirodosul.myvtex.com/pos-graduacao', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        
        const searchRetry = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
        await searchRetry.click({ force: true });
        await searchRetry.fill('');
        await page.waitForTimeout(500);
        await searchRetry.fill(cursoSimples);
        await searchRetry.press('Enter');
        await page.waitForTimeout(6000);

        // Tenta com seletor específico de pós primeiro, depois amplo
        let cardsRetry = page.locator('a[href*="/pos-"][href$="/p"]');
        let countRetry = await cardsRetry.count();
        
        if (countRetry === 0) {
          cardsRetry = page.locator('a[href$="/p"]');
          countRetry = await cardsRetry.count();
        }
        
        console.log(`   📋 FALLBACK C: ${countRetry} resultados`);

        if (countRetry > 0) {
          // PASSO 1: Busca card com keywords + duração correta
          for (let i = 0; i < Math.min(countRetry, 30); i++) {
            const card = cardsRetry.nth(i);
            const texto = (await card.textContent()) || '';
            const href = (await card.getAttribute('href')) || '';
            const { matchCount, temDuracao } = cardMatchCursoEDuracao(texto, href);
            if (matchCount >= minKeywordsMatch && temDuracao) {
              console.log(`   ✅ FALLBACK C: Card com keywords+duração (${matchCount} kw, ${CLIENTE.duracao}m): "${texto.substring(0, 60).replace(/\s+/g, ' ')}..."`);
              await card.click();
              cursoClicado = true;
              break;
            }
          }
          // PASSO 2: Se não achou com duração, busca só por keywords (fallback mais fraco)
          if (!cursoClicado) {
            for (let i = 0; i < Math.min(countRetry, 30); i++) {
              const card = cardsRetry.nth(i);
              const texto = (await card.textContent()) || '';
              const href = (await card.getAttribute('href')) || '';
              const { matchCount } = cardMatchCursoEDuracao(texto, href);
              if (matchCount >= minKeywordsMatch) {
                console.log(`   ⚠️ FALLBACK C: Card sem duração confirmada (${matchCount} kw): "${texto.substring(0, 60).replace(/\s+/g, ' ')}..."`);
                console.log(`      ⚠️ Duração ${CLIENTE.duracao}m não encontrada no card, selecionando mesmo assim`);
                await card.click();
                cursoClicado = true;
                break;
              }
            }
          }
          if (!cursoClicado) {
            console.log('   ⚠️ FALLBACK C: Nenhum card com keywords suficientes');
          }
        }
      } catch (e) {
        console.log(`   ⚠️ FALLBACK C falhou: ${e.message}`);
      }
    }

    // FALLBACK D: Seletores de card mais amplos na página atual
    // (último recurso com seletores - exige match rigoroso de múltiplas keywords)
    if (!cursoClicado) {
      console.log('   🔄 FALLBACK D: Tentando seletores amplos com match rigoroso...');
      const seletoresAmplos = [
        'a[href$="/p"]',
        '[class*="productSummary"] a',
        '[class*="product-summary"] a',
        '.vtex-product-summary-2-x-clearLink',
      ];

      for (const sel of seletoresAmplos) {
        try {
          const cardsAmplos = page.locator(sel);
          const countAmplos = await cardsAmplos.count();
          if (countAmplos > 0) {
            console.log(`   📋 FALLBACK D: ${countAmplos} cards via "${sel}"`);
            // PASSO 1: keywords + duração
            for (let i = 0; i < Math.min(countAmplos, 30); i++) {
              const c = cardsAmplos.nth(i);
              const txt = (await c.textContent()) || '';
              const hr = (await c.getAttribute('href')) || '';
              const { matchCount, temDuracao } = cardMatchCursoEDuracao(txt, hr);
              if (matchCount >= minKeywordsMatch && temDuracao) {
                console.log(`   ✅ FALLBACK D: Card com keywords+duração (${matchCount} kw, ${CLIENTE.duracao}m): "${txt.substring(0, 60).replace(/\s+/g, ' ')}..."`);
                await c.scrollIntoViewIfNeeded().catch(() => {});
                await c.click();
                cursoClicado = true;
                break;
              }
            }
            if (cursoClicado) break;
            // PASSO 2: só keywords (sem duração), NÃO seleciona - muito arriscado com seletor amplo
          }
        } catch (e) {}
      }
      if (!cursoClicado) {
        console.log('   ⚠️ FALLBACK D: Nenhum card com keywords+duração suficientes');
      }
    }

    // FALLBACK E: Volta para listagem /pos-graduacao e busca por link com scroll
    if (!cursoClicado) {
      console.log('   🔄 FALLBACK E: Voltando para listagem de pós-graduação com scroll...');
      try {
        await page.goto('https://cruzeirodosul.myvtex.com/pos-graduacao', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(5000);

        // Faz scroll progressivo para carregar lazy-loaded cards
        for (let s = 0; s < 5; s++) {
          await page.evaluate((step) => window.scrollTo(0, (step + 1) * 800), s);
          await page.waitForTimeout(1500);
        }

        const allLinks = page.locator('a[href$="/p"]');
        const linkCount = await allLinks.count();
        console.log(`   📋 FALLBACK E: ${linkCount} links de produto na listagem`);

        // PASSO 1: Busca com keywords + duração
        for (let i = 0; i < linkCount; i++) {
          const link = allLinks.nth(i);
          const href = (await link.getAttribute('href')) || '';
          const texto = (await link.textContent()) || '';
          const { matchCount, temDuracao } = cardMatchCursoEDuracao(texto, href);
          if (matchCount >= minKeywordsMatch && temDuracao) {
            console.log(`   ✅ FALLBACK E: Curso+duração encontrados (${matchCount} kw, ${CLIENTE.duracao}m)!`);
            await link.scrollIntoViewIfNeeded().catch(() => {});
            await link.click();
            cursoClicado = true;
            break;
          }
        }
        // PASSO 2: Só keywords se não encontrou com duração
        if (!cursoClicado) {
          for (let i = 0; i < linkCount; i++) {
            const link = allLinks.nth(i);
            const href = (await link.getAttribute('href')) || '';
            const texto = (await link.textContent()) || '';
            const { matchCount } = cardMatchCursoEDuracao(texto, href);
            if (matchCount >= minKeywordsMatch) {
              console.log(`   ⚠️ FALLBACK E: Curso sem duração confirmada (${matchCount} kw)`);
              await link.scrollIntoViewIfNeeded().catch(() => {});
              await link.click();
              cursoClicado = true;
              break;
            }
          }
        }
      } catch (e) {
        console.log(`   ⚠️ FALLBACK E falhou: ${e.message}`);
      }
    }

    if (!cursoClicado) {
      console.log('   ❌ TODOS OS FALLBACKS FALHARAM - continuando na página atual...');
      // Screenshot para diagnóstico
      try {
        await page.screenshot({ path: 'debug-etapa4-fallback-falhou.png', fullPage: true });
        console.log('   📸 Screenshot debug: debug-etapa4-fallback-falhou.png');
      } catch (e) {}
    }
  }
  
  await page.waitForTimeout(3000);
  
  // IMPORTANTE: Fecha popup "Baixar guia do curso" que aparece ao entrar na página do curso
  // Esse popup tem campos Nome/Email/Telefone que confundem o script
  await fecharTodosOverlays(page);
  
  console.log(`✅ ETAPA 4 CONCLUÍDA - Curso: ${page.url()}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  
  // Aguarda o formulário carregar
  await page.waitForTimeout(2000);
  
  // IMPORTANTE: Limpa NOVAMENTE todos os overlays (podem reaparecer após scroll)
  await fecharTodosOverlays(page);
  
  // Scroll até o formulário real de inscrição (fica mais abaixo na página)
  try {
    const formReal = page.locator('input[placeholder*="nome completo" i], input[name="userName"], [class*="formContainer"] input').first();
    if (await formReal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await formReal.scrollIntoViewIfNeeded();
      console.log('   📍 Formulário de inscrição localizado');
    } else {
      // Scroll para baixo para encontrar o formulário
      await page.evaluate(() => window.scrollTo(0, 600));
    }
  } catch (e) {
    await page.evaluate(() => window.scrollTo(0, 600));
  }
  await page.waitForTimeout(500);
  
  // Limpa overlays mais uma vez após scroll (o popup pode reaparecer)
  await fecharTodosOverlays(page);
  
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
  
  // IMPORTANTE: Fecha todos os overlays/popups que podem bloquear
  await fecharTodosOverlays(page);
  
  // Primeiro, detecta onde estamos
  let telaAtual = await detectarTelaAtual(page);
  
  // Se já estamos em uma tela posterior, pula
  if (['CAMPANHA', 'CHECKOUT_CART', 'CHECKOUT_PROFILE', 'CHECKOUT_SHIPPING', 'CHECKOUT_PAYMENT', 'ORDER_PLACED'].includes(telaAtual.tela)) {
    console.log(`   ⏭️ Já estamos na tela ${telaAtual.tela}, pulando etapa 5`);
    console.log('✅ ETAPA 5 PULADA');
    console.log('');
  } else if (telaAtual.tela === 'FORMULARIO_LOCALIZACAO') {
    console.log(`   ⏭️ Formulário de localização já visível, pulando para ETAPA 6`);
    console.log('✅ ETAPA 5 CONCLUÍDA');
    console.log('');
  } else {
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
      
      // Aguarda o formulário de localização aparecer com retry
      console.log('   ⏳ Aguardando formulário de localização...');
      
      let formEncontrado = false;
      for (let tentativa = 1; tentativa <= 5; tentativa++) {
        await page.waitForTimeout(2000);
        
        // Scroll para baixo para revelar formulário se estiver oculto
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(1000);
        
        // Re-detecta a tela
        telaAtual = await detectarTelaAtual(page);
        
        if (telaAtual.tela === 'FORMULARIO_LOCALIZACAO' || telaAtual.detalhes.reactSelects >= 3) {
          console.log(`   ✅ Formulário de localização detectado na tentativa ${tentativa}`);
          formEncontrado = true;
          break;
        } else if (['CAMPANHA', 'CHECKOUT_CART'].includes(telaAtual.tela)) {
          console.log(`   ✅ Navegou para ${telaAtual.tela}, localização já preenchida`);
          formEncontrado = true;
          break;
        }
        
        console.log(`   ⏳ Tentativa ${tentativa}/5 - Tela: ${telaAtual.tela}`);
      }
      
      if (!formEncontrado) {
        console.log('   ⚠️ Formulário de localização não apareceu após 5 tentativas');
        await page.screenshot({ path: 'debug-pos-inscreva-se.png', fullPage: true });
        console.log('   📸 Screenshot: debug-pos-inscreva-se.png');
      }
      
    } catch (e) {
      console.log(`   ⚠️ Erro ao clicar Inscreva-se: ${e.message}`);
    }
    
    console.log('✅ ETAPA 5 CONCLUÍDA');
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 6: DADOS DE LOCALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 6: Dados de Localização');
  
  // IMPORTANTE: Fecha todos os overlays/popups que podem bloquear cliques
  await fecharTodosOverlays(page);
  
  // Primeiro, detecta onde estamos
  let telaAtualE6 = await detectarTelaAtual(page);
  
  // Se já passamos da localização, pula
  if (['CAMPANHA', 'CHECKOUT_CART', 'CHECKOUT_PROFILE', 'CHECKOUT_SHIPPING', 'CHECKOUT_PAYMENT', 'ORDER_PLACED'].includes(telaAtualE6.tela)) {
    console.log(`   ⏭️ Já estamos na tela ${telaAtualE6.tela}, pulando etapa 6`);
    console.log('✅ ETAPA 6 PULADA - Localização já preenchida');
    console.log('');
  } else {
    // Aguarda carregamento
    await page.waitForTimeout(2000);
    
    // Verifica ESPECIFICAMENTE se existem os react-select de localização
    let qtdReactSelects = await page.locator('.react-select__input-container').count();
    console.log(`   📍 Quantidade de react-select encontrados: ${qtdReactSelects}`);
    
    // Também verifica se há campo de CPF (indicador de formulário de dados)
    let campoCPFvisivel = await page.locator('input[name="userDocument"]').isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   📍 Campo CPF visível: ${campoCPFvisivel}`);
    console.log(`   📍 URL atual: ${page.url()}`);
    
    // Se não encontrou react-selects, tenta seletores alternativos
    if (qtdReactSelects < 3) {
      console.log('   🔍 Buscando seletores alternativos...');
      
      // Tenta diferentes seletores para os dropdowns
      const seletoresAlternativos = [
        '.react-select__control',
        '[class*="react-select"]',
        'div[class*="select__"]',
        '.css-1s2u09g-control',  // react-select v5
        '.css-13cymwt-control',  // react-select v5 alternativo
      ];
      
      for (const sel of seletoresAlternativos) {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count > 0) {
          console.log(`   📍 Encontrados ${count} elementos com seletor: ${sel}`);
        }
      }
      
      // Verifica se há textos indicando o formulário
      const textoPais = await page.locator('text=País').first().isVisible({ timeout: 1000 }).catch(() => false);
      const textoEstado = await page.locator('text=Estado').first().isVisible({ timeout: 1000 }).catch(() => false);
      const textoCidade = await page.locator('text=Cidade').first().isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(`   📍 Labels visíveis - País: ${textoPais}, Estado: ${textoEstado}, Cidade: ${textoCidade}`);
      
      if (textoPais || textoEstado) {
        console.log('   ✅ Formulário de localização detectado via labels');
        qtdReactSelects = 4; // Força continuar
      }
    }
    
    const temFormLocalizacao = qtdReactSelects >= 3 || campoCPFvisivel || telaAtualE6.tela === 'FORMULARIO_LOCALIZACAO';
    
    if (!temFormLocalizacao) {
      console.log('   ⚠️ Formulário de localização não encontrado');
      
      // Verifica se ainda estamos no formulário inicial
      const btnInscreva = page.getByRole('button', { name: /inscreva-se/i });
      if (await btnInscreva.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   🔄 Ainda no formulário inicial - clicando em Inscreva-se...');
        
        // Verifica se precisa preencher nome/telefone
        const campoNome = page.locator('input[placeholder*="nome completo" i]');
        if (await campoNome.isVisible({ timeout: 1000 }).catch(() => false)) {
          const valorNome = await campoNome.inputValue().catch(() => '');
          if (!valorNome) {
            console.log('   📝 Preenchendo nome...');
            await campoNome.fill(CLIENTE.nome);
          }
        }
        
        const campoTel = page.locator('input[placeholder*="XXXXX" i]');
        if (await campoTel.isVisible({ timeout: 1000 }).catch(() => false)) {
          const valorTel = await campoTel.inputValue().catch(() => '');
          if (!valorTel) {
            console.log('   📝 Preenchendo telefone...');
            await campoTel.fill(CLIENTE.telefone);
          }
        }
        
        await page.waitForTimeout(500);
        await btnInscreva.scrollIntoViewIfNeeded();
        await btnInscreva.click();
        console.log('   ✅ Clicou em Inscreva-se');
        
        // Aguarda navegação ou aparecimento do formulário
        await page.waitForTimeout(5000);
        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(2000);
        
        // Re-verifica
        qtdReactSelects = await page.locator('.react-select__input-container').count();
        campoCPFvisivel = await page.locator('input[name="userDocument"]').isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`   📍 Após retry - react-selects: ${qtdReactSelects}, CPF visível: ${campoCPFvisivel}`);
      }
      
      // Tira screenshot para debug
      await page.screenshot({ path: 'debug-etapa6-estado.png', fullPage: true });
      console.log('   📸 Screenshot: debug-etapa6-estado.png');
    }
    
    // Re-verifica tela
    telaAtualE6 = await detectarTelaAtual(page);
    const qtdReactSelectsFinal = await page.locator('.react-select__input-container').count();
    console.log(`   📍 ${qtdReactSelectsFinal} react-selects encontrados (final)`);
    
    // Decide se deve preencher localização ou pular
    const devePreencher = qtdReactSelectsFinal >= 3 || telaAtualE6.tela === 'FORMULARIO_LOCALIZACAO' || 
                          (await page.locator('text=País').first().isVisible({ timeout: 1000 }).catch(() => false));
    
    if (devePreencher) {
    console.log('   ✅ Formulário de localização encontrado!');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FECHA OVERLAYS/POPUPS QUE PODEM BLOQUEAR CLIQUES
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Primeiro tenta fechar via funções padrão
    await fecharTodosOverlays(page);
    
    // Remove overlays/backdrops forçadamente via JavaScript (mais eficaz)
    try {
      await page.evaluate(() => {
        // Remove backdrops
        const backdrops = document.querySelectorAll('.cruzeirodosul-store-theme-3-x-sectionContactFormNewsDownloadFormBackdrop, [class*="Backdrop"], [class*="backdrop"]');
        backdrops.forEach(el => el.remove());
        
        // Remove formulários popup de download de guia
        const popups = document.querySelectorAll('.cruzeirodosul-store-theme-3-x-sectionContactFormNewsDownloadFormContainer');
        popups.forEach(el => el.remove());
        
        // Remove cookie banners
        const cookies = document.querySelectorAll('.cc-banner, #privacytools-banner-consent, [class*="cookie-consent"]');
        cookies.forEach(el => el.remove());
        
        // Remove qualquer overlay que cubra a tela
        const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal-backdrop"]');
        overlays.forEach(el => {
          if (el.style.position === 'fixed' || el.style.position === 'absolute') {
            el.remove();
          }
        });
      });
      console.log('   📍 Overlays removidos via JavaScript');
    } catch (e) {}
    
    await page.waitForTimeout(500);
    
    // Scroll para baixo para evitar header sticky bloqueando
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BASEADO NA GRAVAÇÃO DO PLAYWRIGHT CODEGEN
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 1. PAÍS - Brasil
    console.log('   📝 Selecionando País: Brasil...');
    try {
      // Usa force: true para ignorar interceptação de cliques
      await page.locator('.react-select__input-container').first().click({ force: true });
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: 'Brasil' }).click();
      console.log('   ✅ País: Brasil');
    } catch (e) {
      console.log(`   ⚠️ Erro ao selecionar país: ${e.message}`);
    }
    await page.waitForTimeout(1000);
    
    // 2. ESTADO - Clica no select de estado e digita
    console.log(`   📝 Selecionando Estado: ${CLIENTE.estado}...`);
    try {
      // Clica no segundo "Selecione" (Estado)
      await page.locator('div').filter({ hasText: /^Selecione$/ }).nth(1).click();
      await page.waitForTimeout(500);
      
      // Encontra o input do react-select ativo e digita
      const inputEstado = page.locator('#react-select-3-input, #react-select-4-input').first();
      if (await inputEstado.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputEstado.fill('são pau');
      } else {
        await page.keyboard.type('são pau', { delay: 50 });
      }
      await page.waitForTimeout(1000);
      
      // Clica na opção São Paulo
      await page.getByRole('option', { name: 'São Paulo' }).click();
      console.log('   ✅ Estado: São Paulo');
    } catch (e) {
      console.log(`   ⚠️ Erro ao selecionar estado: ${e.message}`);
    }
    await page.waitForTimeout(1500);
    
    // 3. CIDADE - Clica no select de cidade e digita
    console.log(`   📝 Selecionando Cidade: ${CLIENTE.cidade}...`);
    try {
      // Clica no próximo "Selecione" (Cidade)
      await page.locator('div').filter({ hasText: /^Selecione$/ }).nth(1).click();
      await page.waitForTimeout(500);
      
      // Encontra o input do react-select ativo e digita
      const inputCidade = page.locator('#react-select-4-input, #react-select-5-input').first();
      if (await inputCidade.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputCidade.fill('são pa');
      } else {
        await page.keyboard.type('são pa', { delay: 50 });
      }
      await page.waitForTimeout(1000);
      
      // Clica na opção São Paulo
      await page.getByRole('option', { name: 'São Paulo' }).click();
      console.log('   ✅ Cidade: São Paulo');
    } catch (e) {
      console.log(`   ⚠️ Erro ao selecionar cidade: ${e.message}`);
    }
    await page.waitForTimeout(1500);
    
    // 4. POLO - Clica no select de polo e digita
    console.log(`   📝 Selecionando Polo: ${CLIENTE.polo}...`);
    try {
      // Tenta clicar no select de polo (geralmente o 5º react-select ou tem texto "Selecione")
      const selectPolo = page.locator('div:nth-child(5) > .react-select-container > .react-select__control > .react-select__value-container > .react-select__input-container');
      if (await selectPolo.isVisible({ timeout: 2000 }).catch(() => false)) {
        await selectPolo.click();
      } else {
        // Fallback: clica no próximo "Selecione"
        await page.locator('div').filter({ hasText: /^Selecione$/ }).first().click();
      }
      await page.waitForTimeout(500);
      
      // Digita o polo
      const inputPolo = page.locator('#react-select-5-input, #react-select-6-input').first();
      if (await inputPolo.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputPolo.fill(CLIENTE.polo);
      } else {
        await page.keyboard.type(CLIENTE.polo, { delay: 50 });
      }
      await page.waitForTimeout(1000);
      
      // Pressiona Enter para selecionar
      await page.keyboard.press('Enter');
      console.log(`   ✅ Polo: ${CLIENTE.polo}`);
    } catch (e) {
      console.log(`   ⚠️ Erro ao selecionar polo: ${e.message}`);
    }
    await page.waitForTimeout(1000);
    
    // 5. CPF
    console.log(`   📝 Preenchendo CPF: ${CLIENTE.cpf}...`);
    try {
      const campoCPF = page.locator('input[name="userDocument"]');
      await campoCPF.click();
      await campoCPF.fill(CLIENTE.cpf);
      console.log(`   ✅ CPF: ${CLIENTE.cpf}`);
      
      // Aguarda validação do CPF
      await page.waitForTimeout(2000);
      
      // Verifica se há erro de CPF
      const erroCPF = page.locator('text=/CPF inválido|CPF já cadastrado|Digite um CPF válido/i').first();
      if (await erroCPF.isVisible({ timeout: 1000 }).catch(() => false)) {
        const textoErro = await erroCPF.textContent();
        console.log(`   ❌ ERRO CPF: ${textoErro}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Erro ao preencher CPF: ${e.message}`);
    }
    await page.waitForTimeout(1000);
    
    // 6. BOTÃO CONTINUAR INSCRIÇÃO
    console.log('   📝 Clicando em Continuar Inscrição...');
    
    // Scroll para garantir que o botão está visível
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    
    // Fecha modais se existirem
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Tenta clicar até 3 vezes
    let navegouParaCampanha = false;
    for (let tentativa = 1; tentativa <= 3 && !navegouParaCampanha; tentativa++) {
      console.log(`   🔄 Tentativa ${tentativa}/3 de clicar em Continuar Inscrição...`);
      
      try {
        const btnContinuar = page.getByRole('button', { name: 'Continuar Inscrição' });
        if (await btnContinuar.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btnContinuar.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await btnContinuar.click();
          console.log('   ✅ Botão "Continuar Inscrição" clicado');
        }
      } catch (e) {
        // Fallback
        const btnAlt = page.locator('button:has-text("Continuar")').first();
        if (await btnAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btnAlt.click({ force: true });
          console.log('   ✅ Botão alternativo clicado');
        }
      }
      
      // Aguarda navegação para página de campanha
      console.log('   ⏳ Aguardando navegação...');
      try {
        await page.waitForURL('**/campanha-comercial**', { timeout: 15000 });
        console.log('   ✅ Navegou para página de campanha');
        navegouParaCampanha = true;
      } catch (e) {
        console.log(`   ⚠️ Tentativa ${tentativa}: não navegou ainda`);
        console.log(`   📍 URL atual: ${page.url()}`);
        
        // Verifica se há algum erro na página
        const erroForm = page.locator('text=/erro|inválido|obrigatório|preencha/i').first();
        if (await erroForm.isVisible({ timeout: 1000 }).catch(() => false)) {
          const textoErro = await erroForm.textContent();
          console.log(`   ❌ Erro detectado: ${textoErro}`);
        }
        
        await page.waitForTimeout(2000);
      }
    }
    
    await page.waitForTimeout(3000);
    } // Fecha o if (devePreencher)
    
    console.log('✅ ETAPA 6 CONCLUÍDA');
    console.log('');
  } // Fecha o else (não pulou etapa 6)

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 7: CAMPANHA COMERCIAL - TESTE DINÂMICO DE CAMPANHAS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Campanha Comercial');
  
  // Fecha popups/overlays que podem estar bloqueando
  await fecharTodosOverlays(page);
  
  // Primeiro, detecta onde estamos
  let telaAtualE7 = await detectarTelaAtual(page);
  
  // Se já estamos em tela posterior, pula
  if (['CHECKOUT_CART', 'CHECKOUT_PROFILE', 'CHECKOUT_SHIPPING', 'CHECKOUT_PAYMENT', 'ORDER_PLACED'].includes(telaAtualE7.tela)) {
    console.log(`   ⏭️ Já estamos na tela ${telaAtualE7.tela}, pulando etapa 7`);
    console.log('✅ ETAPA 7 PULADA - Campanha já selecionada');
    console.log('');
  } else {
  
  // Aguarda página de campanha carregar completamente
  await page.waitForTimeout(5000);
  
  let urlAtualEtapa7 = page.url();
  console.log(`   📍 URL atual: ${urlAtualEtapa7}`);
  
  let campanhaEscolhida = null;
  
  // Se não está na página de campanha, tenta aguardar mais ou navegar
  if (!urlAtualEtapa7.includes('campanha-comercial')) {
    console.log('   ⚠️ Não está na página de campanha, aguardando mais...');
    await page.waitForTimeout(5000);
    urlAtualEtapa7 = page.url();
    console.log(`   📍 URL após espera adicional: ${urlAtualEtapa7}`);
    
    // Se ainda não está na campanha, verifica se estamos no checkout (campanha pode ser opcional)
    telaAtualE7 = await detectarTelaAtual(page);
    if (['CHECKOUT_CART', 'CHECKOUT_PROFILE'].includes(telaAtualE7.tela)) {
      console.log(`   ⏭️ Campanha pode ser opcional - já no ${telaAtualE7.tela}`);
    }
  }
  
  // Verifica se está na página de campanha
  const estaNaPaginaCampanha = urlAtualEtapa7.includes('campanha-comercial');
  console.log(`   📍 Está na página de campanha? ${estaNaPaginaCampanha}`);
  
  // Screenshot para debug
  try {
    await page.screenshot({ path: 'debug-etapa7-campanha.png', fullPage: true });
    console.log('   📸 Screenshot: debug-etapa7-campanha.png');
  } catch (e) {}
  
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
      await page.waitForTimeout(5000); // Aguarda valores atualizarem
      
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
    await page.waitForTimeout(5000);
    console.log(`   ✅ Campanha ${campanhaEscolhida} aplicada`);
  }
  
  console.log('✅ ETAPA 7 CONCLUÍDA');
  console.log('');
  } // Fecha o else (não pulou etapa 7)

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 8: CARRINHO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 8: Carrinho');
  
  // Fecha popups/overlays que podem estar bloqueando
  await fecharTodosOverlays(page);
  
  // Primeiro, detecta onde estamos
  let telaAtualE8 = await detectarTelaAtual(page);
  
  // Se já estamos no checkout ou além, pula
  if (['CHECKOUT_PROFILE', 'CHECKOUT_SHIPPING', 'CHECKOUT_PAYMENT', 'ORDER_PLACED'].includes(telaAtualE8.tela)) {
    console.log(`   ⏭️ Já estamos na tela ${telaAtualE8.tela}, pulando etapa 8`);
    console.log('✅ ETAPA 8 PULADA');
    console.log('');
  } else {
  
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
  
  // Clica em "Seguir para o carrinho" ou "Continuar Inscrição"
  console.log('   📝 Clicando para ir ao checkout...');
  console.log(`   📍 URL atual: ${page.url()}`);
  
  let btnClicado = false;
  
  // Espera o botão aparecer
  await page.waitForTimeout(2000);
  
  // PRIMEIRA PRIORIDADE: "Continuar pagamento" (gravação)
  try {
    const linkPagamento = page.getByRole('link', { name: 'Continuar pagamento Continuar' });
    if (await linkPagamento.isVisible({ timeout: 3000 })) {
      await linkPagamento.click();
      console.log('   ✅ Link "Continuar pagamento" clicado');
      btnClicado = true;
    }
  } catch (e) {}
  
  // SEGUNDA PRIORIDADE: "Seguir para o carrinho" (página de campanha)
  if (!btnClicado) {
    try {
      const linkCarrinho = page.locator('a:has-text("Seguir para o carrinho"), text=Seguir para o carrinho').first();
      if (await linkCarrinho.isVisible({ timeout: 3000 })) {
        await linkCarrinho.scrollIntoViewIfNeeded();
        await linkCarrinho.click({ force: true });
        console.log('   ✅ Link "Seguir para o carrinho" clicado');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Tenta pelo seletor de classe específico do VTEX
  if (!btnClicado) {
    try {
      const btnVtex = page.locator('button.vtex-button, .vtex-button__label, button[class*="vtex"]').filter({ hasText: /Continuar/i }).first();
      if (await btnVtex.isVisible({ timeout: 3000 })) {
        await btnVtex.scrollIntoViewIfNeeded();
        await btnVtex.click({ force: true });
        console.log('   ✅ Botão Continuar clicado (via classe VTEX)');
        btnClicado = true;
      }
    } catch (e) {}
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
  
  // Fallback: link Continuar
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
  await page.waitForTimeout(8000);
  
  // Tenta esperar pelo checkout
  try {
    await page.waitForURL('**/checkout/**', { timeout: 15000 });
    console.log('   ✅ Navegou para checkout');
  } catch (e) {
    console.log('   ⚠️ Timeout esperando checkout, continuando...');
  }
  
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
      await page.waitForTimeout(8000);
      console.log(`   📍 URL após segunda tentativa: ${page.url()}`);
    } catch (e) {
      console.log(`   ⚠️ Segunda tentativa falhou: ${e.message}`);
    }
  }
  
  console.log('✅ ETAPA 8 CONCLUÍDA');
  console.log('');
  } // Fecha o else (não pulou etapa 8)

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 9: CHECKOUT - DADOS PESSOAIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 9: Dados Pessoais');
  console.log(`   📍 URL: ${page.url()}`);
  
  // Aguarda a página de checkout carregar completamente
  await page.waitForTimeout(5000);
  
  // Fecha popups/overlays que podem estar bloqueando
  await fecharTodosOverlays(page);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO DE PÁGINA EM BRANCO - RECARREGA SE NECESSÁRIO
  // ═══════════════════════════════════════════════════════════════════════════
  let paginaCarregada = false;
  for (let tentativaReload = 1; tentativaReload <= 3; tentativaReload++) {
    // Verifica se a página está em branco (sem conteúdo visível)
    const temConteudo = await page.evaluate(() => {
      const body = document.body;
      if (!body) return false;
      
      // Verifica se há elementos visíveis no body além de headers/footers
      const elementos = body.querySelectorAll('input, button, form, table, .cart, .checkout, [class*="vtex"], [class*="cart"], [class*="checkout"]');
      const textoBody = body.innerText?.trim() || '';
      
      // Considera página carregada se tiver elementos interativos OU texto significativo
      return elementos.length > 5 || textoBody.length > 200;
    });
    
    console.log(`   📍 [Tentativa ${tentativaReload}/3] Conteúdo detectado: ${temConteudo}`);
    
    if (temConteudo) {
      paginaCarregada = true;
      break;
    }
    
    // Página em branco - recarrega
    console.log('   ⚠️ Página em branco detectada, recarregando...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    // Se após reload ainda estiver no checkout, tenta networkidle
    if (page.url().includes('checkout')) {
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (e) {}
    }
  }
  
  if (!paginaCarregada) {
    console.log('   ⚠️ Página não carregou após 3 tentativas, continuando mesmo assim...');
    await page.screenshot({ path: 'erro-pagina-branco.png', fullPage: true });
  }
  
  // Aguarda o checkout VTEX carregar (espera o DOM estar pronto)
  try {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('   ✅ Página carregada (networkidle)');
  } catch (e) {
    console.log('   ⚠️ Timeout esperando networkidle, continuando...');
  }
  
  // Screenshot para debug
  try {
    await page.screenshot({ path: 'debug-etapa9-checkout.png', fullPage: true });
    console.log('   📸 Screenshot: debug-etapa9-checkout.png');
  } catch (e) {}
  
  // Verifica se está no checkout
  const urlCheckout = page.url();
  if (!urlCheckout.includes('checkout')) {
    console.log('   ⚠️ NÃO ESTÁ NO CHECKOUT! Tentando navegar...');
    try {
      await page.goto('https://cruzeirodosul.myvtex.com/checkout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);
      console.log(`   📍 Nova URL: ${page.url()}`);
    } catch (e) {
      console.log(`   ⚠️ Erro ao navegar: ${e.message}`);
    }
  }
  
  // Lista todos os botões visíveis para debug
  try {
    const botoes = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      return Array.from(btns).map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        id: b.id,
        class: b.className.substring(0, 50),
        visible: b.offsetParent !== null
      })).filter(b => b.visible);
    });
    console.log(`   📋 Botões visíveis no checkout: ${botoes.length}`);
    botoes.slice(0, 5).forEach(b => {
      console.log(`      - "${b.text}" (id: ${b.id || 'N/A'})`);
    });
  } catch (e) {}
  
  await page.waitForTimeout(2000);
  
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NAVEGAÇÃO NO CHECKOUT VTEX (SPA - Single Page Application)
  // O checkout VTEX tem todas as seções na mesma página, com steps/accordion
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('   📝 Navegando no checkout VTEX...');
  
  // Usa JavaScript para entender e navegar no checkout VTEX
  const statusCheckout = await page.evaluate(() => {
    // Verifica quais seções existem e estão visíveis
    const sections = {
      profile: document.querySelector('#client-profile-data'),
      shipping: document.querySelector('#shipping-data'),
      payment: document.querySelector('#payment-data')
    };
    
    // Verifica se cada seção está ativa/expandida
    const isActive = (section) => {
      if (!section) return false;
      return section.classList.contains('active') || 
             section.classList.contains('accordion-inner-show') ||
             section.querySelector('.accordion-inner-show') !== null;
    };
    
    // Procura o link real para ir para shipping (não o fake-button)
    const linkShipping = document.querySelector('#go-to-shipping') ||
                         document.querySelector('a[href="#/shipping"]') ||
                         document.querySelector('.link-box-edit[data-i18n*="shipping"]');
    
    // Procura campos de endereço
    const campoCep = document.querySelector('#ship-postalCode') ||
                     document.querySelector('input[name="postalCode"]') ||
                     document.querySelector('input[id*="postalCode"]');
    
    return {
      hasProfile: !!sections.profile,
      hasShipping: !!sections.shipping,
      hasPayment: !!sections.payment,
      profileActive: isActive(sections.profile),
      shippingActive: isActive(sections.shipping),
      paymentActive: isActive(sections.payment),
      hasLinkShipping: !!linkShipping,
      hasCampoCep: !!campoCep,
      campoCepVisible: campoCep ? campoCep.offsetParent !== null : false
    };
  });
  
  console.log(`   📊 Status checkout: Profile=${statusCheckout.profileActive}, Shipping=${statusCheckout.shippingActive}, Payment=${statusCheckout.paymentActive}`);
  console.log(`   📊 Campo CEP existe: ${statusCheckout.hasCampoCep}, visível: ${statusCheckout.campoCepVisible}`);
  
  // Verifica se o botão "Ir para o Pagamento" ou "fake-button-go-to-shipping" está visível
  const btnFakeShipping = page.locator('#fake-button-go-to-shipping').first();
  const btnPagamento = page.locator('button:has-text("Ir para o Pagamento")').first();
  
  const fakeVisivel = await btnFakeShipping.isVisible({ timeout: 2000 }).catch(() => false);
  const pagamentoVisivel = await btnPagamento.isVisible({ timeout: 2000 }).catch(() => false);
  
  console.log(`   📍 Botão fake-button visível: ${fakeVisivel}, Botão Pagamento visível: ${pagamentoVisivel}`);
  
  if (fakeVisivel || pagamentoVisivel) {
    console.log('   ✅ Dados já preenchidos! Tentando navegar para Pagamento...');
    
    // Tenta via JavaScript diretamente (mais confiável)
    await page.evaluate(() => {
      // Método 1: Clica na seção de pagamento para expandir
      const paymentSection = document.querySelector('#payment-data');
      if (paymentSection) {
        const editLink = paymentSection.querySelector('.link-box-edit');
        if (editLink) {
          console.log('Clicando em link-box-edit do payment');
          editLink.click();
          return;
        }
        const accordionToggle = paymentSection.querySelector('.accordion-toggle');
        if (accordionToggle) {
          console.log('Clicando em accordion-toggle do payment');
          accordionToggle.click();
          return;
        }
      }
      
      // Método 2: Navega para #/payment
      if (window.location.hash !== '#/payment') {
        console.log('Navegando para #/payment via hash');
        window.location.hash = '#/payment';
      }
    });
    
    await page.waitForTimeout(5000);
    console.log(`   📍 URL após tentar navegar para Pagamento: ${page.url()}`);
  } else if (statusCheckout.campoCepVisible) {
    console.log('   ✅ Campos de endereço já estão visíveis');
  } else {
    // Tenta expandir a seção de shipping
    console.log('   📝 Tentando expandir seção de endereço...');
    
    const expanded = await page.evaluate(() => {
      // Método 0: Clica no botão fake-button-go-to-shipping (específico do VTEX)
      const fakeButton = document.querySelector('#fake-button-go-to-shipping');
      if (fakeButton && fakeButton.offsetParent !== null) {
        fakeButton.click();
        return { method: 'fake-button-go-to-shipping', success: true };
      }
      
      // Método 1: Clica no link #go-to-shipping
      const linkShipping = document.querySelector('#go-to-shipping');
      if (linkShipping) {
        linkShipping.click();
        return { method: 'go-to-shipping', success: true };
      }
      
      // Método 2: Clica no header da seção shipping para expandir
      const shippingHeader = document.querySelector('#shipping-data .accordion-toggle') ||
                             document.querySelector('#shipping-data .link-box-edit') ||
                             document.querySelector('[data-bind*="goToShipping"]');
      if (shippingHeader) {
        shippingHeader.click();
        return { method: 'shipping-header', success: true };
      }
      
      // Método 3: Usa a API do VTEX checkout se disponível
      if (window.vtexjs && window.vtexjs.checkout) {
        try {
          // Simula navegação para step de shipping
          window.location.hash = '#/shipping';
          return { method: 'vtexjs-hash', success: true };
        } catch (e) {}
      }
      
      // Método 4: Clica em qualquer elemento que contenha "Ir para o Endereço"
      const elements = document.querySelectorAll('a, button, span, p');
      for (const el of elements) {
        if (el.textContent?.includes('Ir para o Endereço') && el.offsetParent !== null) {
          el.click();
          return { method: 'text-match', success: true };
        }
      }
      
      return { method: 'none', success: false };
    });
    
    console.log(`   📍 Método usado: ${expanded.method}, sucesso: ${expanded.success}`);
    
    // Se usou o fake-button, aguarda mais tempo para a navegação
    if (expanded.method === 'fake-button-go-to-shipping') {
      console.log('   ⏳ Aguardando navegação do fake-button...');
      await page.waitForTimeout(5000);
      
      // Verifica se a URL mudou
      const urlAtual = page.url();
      console.log(`   📍 URL após fake-button: ${urlAtual}`);
    } else {
      // Aguarda a seção expandir
      await page.waitForTimeout(3000);
    }
    
    // Verifica se agora o campo CEP está visível
    const cepVisivelAgora = await page.evaluate(() => {
      const campoCep = document.querySelector('#ship-postalCode') ||
                       document.querySelector('input[name="postalCode"]');
      return campoCep ? campoCep.offsetParent !== null : false;
    });
    
    if (cepVisivelAgora) {
      console.log('   ✅ Seção de endereço expandida com sucesso');
    } else {
      console.log('   ⚠️ Seção de endereço não expandiu, tentando navegar por hash...');
      // Tenta navegar diretamente para a seção de shipping
      try {
        await page.evaluate(() => { window.location.hash = '#/shipping'; });
        await page.waitForTimeout(3000);
      } catch (e) {}
    }
  }
  
  console.log(`   📍 URL após navegação: ${page.url()}`);
  
  console.log('✅ ETAPA 9 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: CHECKOUT - ENDEREÇO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Endereço');
  console.log(`   📍 URL: ${page.url()}`);
  
  await page.waitForTimeout(2000);
  
  // Screenshot para debug
  try {
    await page.screenshot({ path: 'debug-etapa10-endereco.png', fullPage: true });
    console.log('   📸 Screenshot: debug-etapa10-endereco.png');
  } catch (e) {}
  
  // Verifica se o endereço já está preenchido (seção de endereço mostra dados)
  const enderecoJaPreenchido = await page.evaluate(() => {
    // Verifica se há texto de endereço visível na seção de endereço
    const secaoEndereco = document.querySelector('#shipping-data, .shipping-data');
    if (secaoEndereco) {
      const texto = secaoEndereco.textContent || '';
      // Se tiver CEP ou nome de cidade, o endereço já está preenchido
      if (texto.match(/\d{5}-?\d{3}/) || texto.includes('São Paulo') || texto.includes('Brasil')) {
        return true;
      }
    }
    // Verifica se a seção de pagamento está visível (significa que endereço já foi preenchido)
    const secaoPagamento = document.querySelector('#payment-data');
    if (secaoPagamento && secaoPagamento.offsetParent !== null) {
      return true;
    }
    return false;
  });
  
  if (enderecoJaPreenchido) {
    console.log('   ✅ Endereço já preenchido anteriormente');
  } else {
    console.log('   📝 Tentando preencher campos de endereço...');
    // Usa JavaScript para preencher os campos de endereço diretamente
    const resultadoEndereco = await page.evaluate((dados) => {
      const result = { cep: false, numero: false, logs: [] };
      
      // Procura campo CEP
      const campoCep = document.querySelector('#ship-postalCode') ||
                       document.querySelector('input[name="postalCode"]') ||
                       document.querySelector('input[id*="postalCode"]') ||
                       document.querySelector('input[placeholder*="CEP" i]');
      
      if (campoCep && campoCep.offsetParent !== null) {
        campoCep.focus();
        campoCep.value = dados.cep;
        campoCep.dispatchEvent(new Event('input', { bubbles: true }));
        campoCep.dispatchEvent(new Event('change', { bubbles: true }));
        campoCep.dispatchEvent(new Event('blur', { bubbles: true }));
        result.cep = true;
        result.logs.push(`CEP preenchido: ${dados.cep}`);
      } else {
        result.logs.push('Campo CEP não encontrado ou não visível');
      }
      
      // Procura campo Número
      const campoNumero = document.querySelector('#ship-number') ||
                          document.querySelector('input[name="number"]') ||
                          document.querySelector('input[id*="number"]') ||
                          document.querySelector('input[placeholder*="Número" i]');
      
      if (campoNumero && campoNumero.offsetParent !== null) {
        campoNumero.focus();
        campoNumero.value = dados.numero;
        campoNumero.dispatchEvent(new Event('input', { bubbles: true }));
        campoNumero.dispatchEvent(new Event('change', { bubbles: true }));
        campoNumero.dispatchEvent(new Event('blur', { bubbles: true }));
        result.numero = true;
        result.logs.push(`Número preenchido: ${dados.numero}`);
      } else {
        result.logs.push('Campo Número não encontrado ou não visível');
      }
      
      return result;
    }, { cep: CLIENTE.cep, numero: CLIENTE.numero });
    
    resultadoEndereco.logs.forEach(log => console.log(`   📝 ${log}`));
    
    if (resultadoEndereco.cep) {
      console.log(`   ✅ CEP: ${CLIENTE.cep}`);
    }
    if (resultadoEndereco.numero) {
      console.log(`   ✅ Número: ${CLIENTE.numero}`);
    }
    
    // Aguarda o CEP ser processado (autocomplete de endereço)
    await page.waitForTimeout(3000);
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
  
  await page.waitForTimeout(3000);
  
  console.log(`   📍 URL: ${page.url()}`);
  
  // Verifica qual botão está visível e clica
  if (page.url().includes('#/profile') || page.url().includes('#/shipping')) {
    await page.waitForTimeout(2000);
    
    // Verifica se precisa ir para endereço ou pagamento
    const spanEndereco = page.locator('span[data-i18n="global.goToShipping"]');
    const spanPagamento = page.locator('span[data-i18n="global.goToPayment"]');
    
    const enderecoVisivel = await spanEndereco.isVisible({ timeout: 3000 }).catch(() => false);
    const pagamentoVisivel = await spanPagamento.isVisible({ timeout: 3000 }).catch(() => false);
    
    console.log(`   📍 Botão "Ir para o Endereço" visível: ${enderecoVisivel}`);
    console.log(`   📍 Botão "Ir para o Pagamento" visível: ${pagamentoVisivel}`);
    
    if (enderecoVisivel) {
      // Precisa preencher endereço primeiro
      console.log('   📝 Clicando em "Ir para o Endereço"...');
      await spanEndereco.click();
      await page.waitForTimeout(3000);
      
      // Preenche CEP
      console.log('   📝 Preenchendo CEP...');
      const campoCep = page.locator('#ship-postalCode');
      if (await campoCep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await campoCep.fill(CLIENTE.cep);
        await campoCep.press('Tab');
        console.log(`   ✅ CEP preenchido: ${CLIENTE.cep}`);
        await page.waitForTimeout(4000); // Aguarda autocomplete
      }
      
      // Preenche Número
      console.log('   📝 Preenchendo Número...');
      const campoNumero = page.locator('#ship-number');
      if (await campoNumero.isVisible({ timeout: 5000 }).catch(() => false)) {
        await campoNumero.fill(CLIENTE.numero);
        console.log(`   ✅ Número preenchido: ${CLIENTE.numero}`);
        await page.waitForTimeout(2000);
      }
      
      // Agora clica em "Ir para o Pagamento" (seletor da gravação)
      await page.waitForTimeout(2000);
      console.log('   📝 Clicando em "Ir para o Pagamento"...');
      await page.getByRole('button', { name: 'Ir para o pagamento' }).click();
      console.log('   ✅ Clicou em "Ir para o Pagamento"!');
      await page.waitForTimeout(5000);
      
    } else if (pagamentoVisivel) {
      // Endereço já preenchido, vai direto para pagamento
      console.log('   📝 Clicando em "Ir para o Pagamento"...');
      await spanPagamento.click();
      console.log('   ✅ Clicou em "Ir para o Pagamento"!');
      await page.waitForTimeout(5000);
    }
    
    console.log(`   📍 URL após navegação: ${page.url()}`);
  }
  
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
  
  // DEBUG: Lista todos os botões visíveis na página
  console.log('   📋 Listando botões disponíveis na página...');
  try {
    const botoesDisponiveis = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a.btn, input[type="submit"]');
      return Array.from(btns).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim().substring(0, 60) || '',
        id: b.id || '',
        className: b.className?.substring(0, 60) || '',
        visible: b.offsetParent !== null,
        disabled: b.disabled || false
      })).filter(b => b.visible && b.text.length > 0);
    });
    
    console.log(`   📋 ${botoesDisponiveis.length} botões/links encontrados:`);
    botoesDisponiveis.forEach((b, i) => {
      console.log(`      ${i + 1}. [${b.tag}] "${b.text}" (id: ${b.id || 'N/A'}, disabled: ${b.disabled})`);
    });
  } catch (e) {
    console.log(`   ⚠️ Erro ao listar botões: ${e.message}`);
  }
  
  // Screenshot para debug
  try {
    await page.screenshot({ path: 'debug-etapa11-pagamento.png', fullPage: true });
    console.log('   📸 Screenshot: debug-etapa11-pagamento.png');
  } catch (e) {}
  
  // Clica no botão de finalização (pode ser "Continuar Inscrição", "Finalizar compra", etc)
  console.log('   📝 Procurando botão de finalização...');
  
  let finalizou = false;
  
  // Lista de textos possíveis para o botão (em ordem de prioridade)
  // IMPORTANTE: Não incluir "Finalizar compra sem" que é para remover itens!
  const textosFinalizacao = [
    'Continuar Inscrição',
    'Continuar Inscricao'
  ];
  
  // Textos a EVITAR (botões que fazem outras coisas)
  const textosEvitar = [
    'sem este item',
    'sem estes itens',
    'remover',
    'excluir',
    'cancelar'
  ];
  
  // Tenta pelo ID específico do botão VTEX
  try {
    const btnFinalizar = page.locator('#payment-data-submit').last();
    if (await btnFinalizar.isVisible({ timeout: 3000 })) {
      const textoBtn = await btnFinalizar.textContent();
      console.log(`   📍 Botão #payment-data-submit encontrado: "${textoBtn?.trim()}"`);
      await btnFinalizar.scrollIntoViewIfNeeded();
      await btnFinalizar.click({ force: true });
      console.log(`   ✅ Botão clicado (via ID)`);
      finalizou = true;
    }
  } catch (e) {}
  
  // Tenta por cada texto possível
  if (!finalizou) {
    for (const texto of textosFinalizacao) {
      try {
        const btn = page.getByRole('button', { name: new RegExp(texto, 'i') });
        if (await btn.isVisible({ timeout: 1000 })) {
          const textoReal = await btn.textContent();
          console.log(`   📍 Botão encontrado: "${textoReal?.trim()}"`);
          await btn.scrollIntoViewIfNeeded();
          await btn.click({ force: true });
          console.log(`   ✅ Botão "${texto}" clicado`);
          finalizou = true;
          break;
        }
      } catch (e) {}
    }
  }
  
  // Fallback: botão submit com classe específica do VTEX
  if (!finalizou) {
    try {
      const btn = page.locator('button.btn-success.btn-large.btn-block, button.btn-success.btn-block, button.submit-button').last();
      if (await btn.isVisible({ timeout: 2000 })) {
        const textoBtn = await btn.textContent();
        console.log(`   📍 Botão encontrado via classe: "${textoBtn?.trim()}"`);
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        console.log('   ✅ Botão finalizar clicado (via classe)');
        finalizou = true;
      }
    } catch (e) {}
  }
  
  // Fallback: qualquer botão que contenha os textos de finalização via JavaScript
  // MAS evita botões com textos proibidos
  if (!finalizou) {
    try {
      const clicked = await page.evaluate(({ textos, evitar }) => {
        const btns = document.querySelectorAll('button, input[type="submit"]');
        for (const btn of btns) {
          const txt = btn.textContent?.toLowerCase() || btn.value?.toLowerCase() || '';
          
          // Verifica se contém texto a evitar
          let deveEvitar = false;
          for (const e of evitar) {
            if (txt.includes(e.toLowerCase())) {
              deveEvitar = true;
              break;
            }
          }
          if (deveEvitar) continue;
          
          // Verifica se contém texto de finalização
          for (const t of textos) {
            if (txt.includes(t.toLowerCase())) {
              btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              btn.click();
              return { success: true, text: btn.textContent?.trim() || btn.value };
            }
          }
        }
        return { success: false };
      }, { textos: textosFinalizacao, evitar: textosEvitar });
      
      if (clicked.success) {
        console.log(`   ✅ Botão "${clicked.text}" clicado (via JavaScript)`);
        finalizou = true;
      }
    } catch (e) {}
  }
  
  if (!finalizou) {
    console.log('   ⚠️ Nenhum botão de finalização encontrado');
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
  
  // Aguarda a página de confirmação carregar completamente
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'debug-orderPlaced.png', fullPage: true });
  console.log('   📸 Screenshot: debug-orderPlaced.png');
  
  let siaaPage = null;
  
  try {
    // MÉTODO 1: Seletor da gravação (preferido)
    console.log('   📝 Buscando botão "Realizar pagamento"...');
    const btnPrimario = page.getByRole('link', { name: 'Realizar pagamento' });
    
    if (await btnPrimario.isVisible({ timeout: 10000 })) {
      console.log('   📝 Clicando em "Realizar pagamento" (getByRole)...');
      
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }),
        btnPrimario.click()
      ]);
      
      siaaPage = newPage;
      await siaaPage.waitForLoadState('domcontentloaded');
      console.log(`   ✅ Nova aba aberta: ${siaaPage.url()}`);
    } else {
      // MÉTODO 2: Seletor por classe VTEX
      const btnVtex = page.locator('a.cruzeirodosul-store-theme-3-x-confirmationStepsButton:has-text("Realizar pagamento")');
      if (await btnVtex.isVisible({ timeout: 5000 })) {
        console.log('   📝 Clicando em "Realizar pagamento" (VTEX class)...');
        
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }),
          btnVtex.click()
        ]);
        
        siaaPage = newPage;
        await siaaPage.waitForLoadState('domcontentloaded');
        console.log(`   ✅ Nova aba aberta: ${siaaPage.url()}`);
      } else {
        // MÉTODO 3: Qualquer link com "Realizar pagamento"
        const btnQualquer = page.locator('a:has-text("Realizar pagamento")').first();
        if (await btnQualquer.isVisible({ timeout: 3000 })) {
          console.log('   📝 Clicando em "Realizar pagamento" (any link)...');
          
          const [newPage] = await Promise.all([
            context.waitForEvent('page', { timeout: 15000 }),
            btnQualquer.click()
          ]);
          
          siaaPage = newPage;
          await siaaPage.waitForLoadState('domcontentloaded');
          console.log(`   ✅ Nova aba aberta: ${siaaPage.url()}`);
        } else {
          // Lista todos os links disponíveis para debug
          const todosLinks = await page.locator('a').all();
          console.log(`   📋 Total de links na página: ${todosLinks.length}`);
          for (let i = 0; i < Math.min(todosLinks.length, 10); i++) {
            const texto = await todosLinks[i].textContent().catch(() => '');
            const href = await todosLinks[i].getAttribute('href').catch(() => '');
            if (texto.trim()) {
              console.log(`      ${i+1}. "${texto.trim().substring(0, 50)}" -> ${href?.substring(0, 50) || 'sem href'}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao abrir página de pagamento: ${e.message}`);
  }
  
  if (!siaaPage) {
    console.log('   ❌ Não foi possível abrir a página de pagamento');
    await page.screenshot({ path: 'erro-realizar-pagamento.png', fullPage: true });
    console.log('   📸 Screenshot erro: erro-realizar-pagamento.png');
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
  
  try {
    await siaaPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
  } catch (e) {
    console.log(`   ⚠️ Timeout waitForLoadState, continuando...`);
  }
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RETRY: Se "Não existem resultados disponíveis no momento" - aguarda e tenta novamente
  // ═══════════════════════════════════════════════════════════════════════════
  let resultadosDisponiveis = false;
  const maxRetries = 3;
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    const msgSemResultados = siaaPage.locator('text=Não existem resultados disponíveis no momento').first();
    
    if (await msgSemResultados.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`   ⏳ [Tentativa ${tentativa}/${maxRetries}] "Não existem resultados disponíveis no momento" detectado`);
      
      if (tentativa < maxRetries) {
        console.log(`   🔄 Aguardando 30 segundos e recarregando página...`);
        await siaaPage.waitForTimeout(30000); // 30 segundos
        
        // Recarrega a página do SIAA
        await siaaPage.reload({ waitUntil: 'domcontentloaded' });
        await siaaPage.waitForTimeout(3000);
        
        // Preenche CPF novamente se necessário
        const campoCPF = siaaPage.getByRole('textbox', { name: 'CPF' });
        if (await campoCPF.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log(`   📝 Re-preenchendo CPF: ${CLIENTE.cpf}`);
          await campoCPF.fill(CLIENTE.cpf);
          await siaaPage.waitForTimeout(500);
          
          const btnProximo = siaaPage.getByRole('button', { name: 'Próximo' });
          if (await btnProximo.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btnProximo.click();
            await siaaPage.waitForTimeout(3000);
          }
        }
        
        console.log(`   📍 URL após reload: ${siaaPage.url()}`);
      } else {
        console.log(`   ⚠️ Máximo de tentativas atingido (${maxRetries}x). Resultados ainda não disponíveis.`);
        console.log(`   📸 Capturando screenshot do estado atual...`);
        
        // Captura screenshot do erro para retornar
        const timestampErro = Date.now();
        const screenshotErroPath = `erro-sem-resultados-${CLIENTE.cpf}-${timestampErro}.png`;
        await siaaPage.screenshot({ path: screenshotErroPath, fullPage: true });
        console.log(`   ✅ Screenshot de erro salvo: ${screenshotErroPath}`);
        
        // Marca que não há resultados disponíveis (para retornar 200 com o erro)
        resultadosDisponiveis = false;
      }
    } else {
      console.log(`   ✅ Resultados disponíveis na página SIAA`);
      resultadosDisponiveis = true;
      break;
    }
  }
  
  // Se não há resultados disponíveis após retries, continua para capturar o estado atual
  if (!resultadosDisponiveis) {
    console.log('   📋 Continuando para capturar estado atual (sem resultados)...');
  }
  
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
        
        // Extrai número de inscrição do SIAA (ex: "Nº DE INSCRIÇÃO: 265222199")
        const matchSiaa = infoAprovacao.match(/(?:N[ºo°]\s*(?:DE\s*)?INSCRI[CÇ][AÃ]O)\s*:\s*(\d+)/i);
        if (matchSiaa) {
          console.log(`   📋 Número Inscrição SIAA: ${matchSiaa[1]}`);
          console.log(`NUMERO_INSCRICAO_SIAA: ${matchSiaa[1]}`);
        }
      }
      
      // Tenta extrair também via seletores diretos na página
      try {
        const textoCompleto = await siaaPage.locator('body').textContent().catch(() => '');
        if (textoCompleto) {
          const matchSiaa2 = textoCompleto.match(/(?:N[ºo°]\s*(?:DE\s*)?INSCRI[CÇ][AÃ]O)\s*:\s*(\d+)/i);
          if (matchSiaa2 && !infoAprovacao.includes(matchSiaa2[1])) {
            console.log(`   📋 Número Inscrição SIAA (body): ${matchSiaa2[1]}`);
            console.log(`NUMERO_INSCRICAO_SIAA: ${matchSiaa2[1]}`);
          }
        }
      } catch (e) {}
      
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
      
      // Se não há resultados após retries, pula a geração do boleto
      if (!resultadosDisponiveis) {
        console.log('   📋 SIAA ainda processando - não é possível gerar boleto neste momento');
        console.log('   💡 O aluno pode acessar o boleto posteriormente pelo link "Realizar pagamento"');
        console.log('✅ ETAPA 14 CONCLUÍDA (com pendência de sincronização SIAA)');
        console.log('');
        
        // ═══════════════════════════════════════════════════════════════════════════
        // RESUMO FINAL (sem boleto - SIAA ainda processando)
        // ═══════════════════════════════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('🎉 PROCESSO DE INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADO');
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
        console.log(`📋 CPF: ${CLIENTE.cpf}`);
        console.log(`📋 Status SIAA: Aguardando sincronização`);
        console.log(`📸 Screenshot: ${screenshotPath}`);
        console.log('📋 Boleto: Disponível posteriormente via "Realizar pagamento"');
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('');
        
        // Pula para ETAPA 15 (envio para n8n)
        // ═══════════════════════════════════════════════════════════════════════════
        // ETAPA 15: ENVIO PARA N8N (se configurado)
        // ═══════════════════════════════════════════════════════════════════════════
        console.log('📤 ETAPA 15: Enviando arquivos para n8n...');
        
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        
        if (n8nWebhookUrl) {
          try {
            const FormData = require('form-data');
            const formData = new FormData();
            
            formData.append('numero_inscricao', numeroInscricao || '');
            formData.append('cpf', CLIENTE.cpf);
            formData.append('nome', CLIENTE.nome);
            formData.append('email', CLIENTE.email);
            formData.append('curso', CLIENTE.curso);
            formData.append('campanha', CLIENTE.campanha || '');
            formData.append('status_siaa', 'aguardando_sincronizacao');
            
            if (fs.existsSync(screenshotPath)) {
              formData.append('screenshot', fs.createReadStream(screenshotPath));
            }
            
            const response = await fetch(n8nWebhookUrl, {
              method: 'POST',
              body: formData,
              headers: formData.getHeaders()
            });
            
            console.log(`   ✅ Enviado para n8n: ${response.status}`);
          } catch (e) {
            console.log(`   ⚠️ Erro ao enviar para n8n: ${e.message}`);
          }
        } else {
          console.log('   ⏭️ N8N_WEBHOOK_URL não configurado, pulando envio.');
        }
        
        console.log('✅ ETAPA 15 CONCLUÍDA');
        return; // Encerra o teste aqui quando SIAA não tem resultados
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao capturar aprovação: ${e.message}`);
    await siaaPage.screenshot({ path: screenshotPath, fullPage: false });
  }
  
  console.log('   📝 Preparando para gerar boleto...');
  
  // Verifica se há um modal de seleção de inscrição aberto
  try {
    console.log('   📍 Verificando modais...');
    const modalOverlay = siaaPage.locator('.ui-widget-overlay.ui-dialog-mask');
    const modalVisible = await modalOverlay.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   📍 Modal overlay visível: ${modalVisible}`);
    
    if (modalVisible) {
      console.log('   📍 Modal de seleção detectado');
      
      // Tenta fechar clicando fora ou no botão fechar
      const btnFechar = siaaPage.locator('.ui-dialog-titlebar-close, button:has-text("Fechar"), .ui-icon-closethick').first();
      if (await btnFechar.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btnFechar.click();
        console.log('   ✅ Modal fechado');
        await siaaPage.waitForTimeout(1000);
      } else {
        // Tenta pressionar Escape
        await siaaPage.keyboard.press('Escape');
        await siaaPage.waitForTimeout(1000);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro verificando modal: ${e.message}`);
  }
  
  // Verifica se há um dropdown para selecionar a inscrição e seleciona a mais recente
  try {
    console.log('   📍 Verificando dropdown de inscrições...');
    const selectInscricao = siaaPage.locator('#formulario\\:inscricao_candidato, select[id*="inscricao"]').first();
    const dropdownVisible = await selectInscricao.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   📍 Dropdown visível: ${dropdownVisible}`);
    
    if (dropdownVisible) {
      console.log('   📍 Dropdown de inscrições detectado');
      // Seleciona a primeira opção (mais recente)
      await selectInscricao.click();
      await siaaPage.waitForTimeout(500);
      await siaaPage.keyboard.press('Enter');
      await siaaPage.waitForTimeout(1000);
    }
  } catch (e) {
    console.log(`   ⚠️ Erro verificando dropdown: ${e.message}`);
  }
  
  // Scroll para encontrar os botões de pagamento
  console.log('   📍 Fazendo scroll para botões de pagamento...');
  await siaaPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await siaaPage.waitForTimeout(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPTURAR LINK DO CARTÃO DE CRÉDITO (clica no botão → nova aba → copia URL)
  // ═══════════════════════════════════════════════════════════════════════════
  let linkCartaoCredito = null;
  try {
    console.log('   💳 Buscando botão "Cartão de Crédito" na página SIAA...');
    
    // Seletor exato fornecido + fallbacks
    const seletoresCartao = [
      '#formulario\\:acm\\:cartao_credito > span',
      '#formulario\\:acm\\:cartao_credito',
      'button:has-text("Cartão de Crédito")',
      'a:has-text("Cartão de Crédito")',
      '[id*="cartao_credito"]',
      'span:has-text("Cartão de Crédito")'
    ];

    let btnCartao = null;
    for (const sel of seletoresCartao) {
      const btn = siaaPage.locator(sel).first();
      const visivel = await btn.isVisible({ timeout: 1500 }).catch(() => false);
      if (visivel) {
        console.log(`   💳 Botão encontrado via seletor: ${sel}`);
        btnCartao = btn;
        break;
      }
    }

    // Fallback: busca qualquer elemento que contenha "Cartão" no texto
    if (!btnCartao) {
      console.log('   💳 Tentando fallback por texto parcial...');
      const allButtons = await siaaPage.evaluate(() => {
        const elementos = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], .ui-button, span.ui-button-text');
        return Array.from(elementos).map((el, i) => ({
          idx: i,
          tag: el.tagName,
          text: (el.textContent || el.value || '').trim().substring(0, 60),
          id: el.id || '',
          visible: el.offsetParent !== null
        })).filter(e => e.visible && (e.text.toLowerCase().includes('cart') || e.id.toLowerCase().includes('cart')));
      });
      console.log(`   💳 Elementos com "cart" encontrados: ${allButtons.length}`);
      allButtons.forEach((b, i) => console.log(`      ${i+1}. [${b.tag}] "${b.text}" (id: ${b.id})`));
    }

    if (btnCartao) {
      console.log('   💳 Clicando no botão "Cartão de Crédito" e aguardando nova aba...');
      
      // Scroll até o botão para garantir visibilidade
      await btnCartao.scrollIntoViewIfNeeded();
      await siaaPage.waitForTimeout(500);
      
      // Clica e espera a nova aba/janela abrir
      const newPagePromise = context.waitForEvent('page', { timeout: 15000 });
      await btnCartao.click();
      
      try {
        const cartaoPage = await newPagePromise;
        
        // Aguarda a página carregar completamente para ter a URL final (com redirects)
        await cartaoPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await cartaoPage.waitForTimeout(3000);
        
        linkCartaoCredito = cartaoPage.url();
        console.log(`   💳 ✅ Link Cartão de Crédito capturado!`);
        console.log(`   💳 URL: ${linkCartaoCredito}`);
        console.log(`LINK_CARTAO_CREDITO: ${linkCartaoCredito}`);
        
        // Fecha a aba do cartão - não precisamos dela
        await cartaoPage.close();
        console.log('   💳 Aba do cartão fechada');
        
      } catch (waitErr) {
        console.log(`   ⚠️ Nova aba não abriu (timeout): ${waitErr.message}`);
        
        // Pode ter aberto na mesma aba - verifica se a URL mudou
        await siaaPage.waitForTimeout(3000);
        const urlAtual = siaaPage.url();
        if (urlAtual.includes('getnet') || urlAtual.includes('finaliza-pagamento') || urlAtual.includes('pagamento')) {
          linkCartaoCredito = urlAtual;
          console.log(`   💳 ✅ Link capturado (mesma aba): ${linkCartaoCredito}`);
          console.log(`LINK_CARTAO_CREDITO: ${linkCartaoCredito}`);
          // Volta para a página SIAA
          await siaaPage.goBack();
          await siaaPage.waitForLoadState('domcontentloaded').catch(() => {});
          await siaaPage.waitForTimeout(2000);
        }
      }
    } else {
      console.log('   ⚠️ Botão "Cartão de Crédito" não encontrado na página SIAA');
      // Debug: screenshot para análise
      await siaaPage.screenshot({ path: 'debug-cartao-nao-encontrado.png', fullPage: true });
      console.log('   📸 Screenshot debug: debug-cartao-nao-encontrado.png');
    }
    
    if (!linkCartaoCredito) {
      console.log('   ⚠️ Link do Cartão de Crédito não capturado');
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao capturar link do cartão: ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD DO BOLETO (via click e captura de nova página)
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('   [BOLETO] Iniciando processo de download do boleto...');

  let linhaDigitavel = null;
  let boletoPage = null;

  try {
    // Localiza o botao de Emitir Boleto
    console.log('   [BOLETO] Buscando botao Emitir Boleto...');
    let btnEmitirBoleto = siaaPage.locator('#formulario\\:acm\\:emissao_boleto, button[id*="emissao_boleto"]').first();
    
    let btnVisivel = await btnEmitirBoleto.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   📍 Botão por ID visível: ${btnVisivel}`);
    
    if (!btnVisivel) {
      console.log('   📍 Tentando localizar por texto...');
      btnEmitirBoleto = siaaPage.getByRole('button', { name: /Emitir Boleto/i });
      btnVisivel = await btnEmitirBoleto.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`   📍 Botão por texto visível: ${btnVisivel}`);
    }
    
    // Lista todos os botões na página para debug
    if (!btnVisivel) {
      console.log('   📋 Listando botões disponíveis na página SIAA...');
      const buttons = await siaaPage.evaluate(() => {
        const btns = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.ui-button');
        return Array.from(btns).slice(0, 15).map(b => ({
          tag: b.tagName,
          id: b.id || 'N/A',
          text: (b.textContent || b.value || '').trim().substring(0, 50),
          visible: b.offsetParent !== null
        }));
      });
      buttons.forEach((b, i) => console.log(`      ${i+1}. [${b.tag}] "${b.text}" (id: ${b.id}, visible: ${b.visible})`));
    }
    
    // Fallback: tenta encontrar por outros seletores
    if (!btnVisivel) {
      console.log('   📍 Tentando seletores alternativos...');
      const altSelectors = [
        'button:has-text("Emitir Boleto")',
        'input[value*="Emitir Boleto"]',
        '[onclick*="emissao_boleto"]',
        'a:has-text("Emitir Boleto")',
        '.ui-button:has-text("Emitir")'
      ];
      
      for (const sel of altSelectors) {
        const btn = siaaPage.locator(sel).first();
        btnVisivel = await btn.isVisible({ timeout: 1000 }).catch(() => false);
        if (btnVisivel) {
          console.log(`   ✅ Botão encontrado via: ${sel}`);
          btnEmitirBoleto = btn;
          break;
        }
      }
    }
    
    // Screenshot de debug antes de clicar
    await siaaPage.screenshot({ path: 'debug-antes-emitir-boleto.png', fullPage: true });
    console.log('   📸 Screenshot: debug-antes-emitir-boleto.png');
    
    if (btnVisivel) {
      console.log('   📝 Clicando em "Emitir Boleto"...');
      
      // Scroll até o botão
      await btnEmitirBoleto.scrollIntoViewIfNeeded();
      await siaaPage.waitForTimeout(500);
      
      // Verifica se ainda há overlay bloqueando
      const overlay = siaaPage.locator('.ui-widget-overlay').first();
      const overlayVisible = await overlay.isVisible({ timeout: 500 }).catch(() => false);
      console.log(`   📍 Overlay bloqueando: ${overlayVisible}`);
      
      if (overlayVisible) {
        console.log('   📍 Overlay detectado, aguardando...');
        await siaaPage.waitForTimeout(2000);
        await siaaPage.keyboard.press('Escape');
        await siaaPage.waitForTimeout(1000);
      }
      
      // Clica no botão e aguarda nova página
      console.log('   📍 Executando clique e aguardando nova página...');
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
        btnEmitirBoleto.click({ force: true, timeout: 10000 })
      ]);
      
      console.log(`   📍 Nova página retornada: ${newPage ? 'sim' : 'não'}`);
      
      if (newPage) {
        boletoPage = newPage;
        await boletoPage.waitForLoadState('load');
        await boletoPage.waitForTimeout(3000);
        console.log(`   📍 Nova página aberta: ${boletoPage.url().substring(0, 80)}...`);
        
        // Verifica se a URL contém "boleto" - indica página de boleto
        const boletoUrl = boletoPage.url();
        if (boletoUrl.includes('boleto') || boletoUrl.includes('getBoletoDiversos')) {
          console.log('   ✅ Página de boleto detectada');
        }
      } else {
        console.log('   ⚠️ Nova página não abriu, verificando URL atual...');
        console.log(`   📍 URL atual SIAA: ${siaaPage.url()}`);
      }
      
      // Captura screenshot do boleto na nova página
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
    } else {
      console.log('   ⚠️ Botão Emitir Boleto não encontrado!');
      console.log('   📍 Tentando fallback...');
      
      // Fallback: procura por link ou botão alternativo
      const btnAlt = siaaPage.locator('button:has-text("Emitir"), a:has-text("Emitir Boleto"), input[value*="Emitir"]').first();
      const altVisivel = await btnAlt.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`   📍 Botão alternativo visível: ${altVisivel}`);
      
      if (altVisivel) {
        console.log('   📝 Clicando em "Emitir Boleto" (fallback)...');
        
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
          btnAlt.click({ force: true })
        ]);
        
        console.log(`   📍 Nova página (fallback): ${newPage ? 'sim' : 'não'}`);
        
        if (newPage) {
          boletoPage = newPage;
          await boletoPage.waitForLoadState('load');
          await boletoPage.waitForTimeout(2000);
          
          // Captura screenshot do boleto
          const boletoPngPath = boletoPath.replace('.pdf', '.png');
          await boletoPage.screenshot({ path: boletoPngPath, fullPage: true });
          console.log(`   ✅ Screenshot boleto (fallback): ${boletoPngPath}`);
        }
      } else {
        console.log('   ❌ Nenhum botão de boleto encontrado na página');
        // Salva screenshot para debug
        await siaaPage.screenshot({ path: 'debug-sem-botao-boleto.png', fullPage: true });
        console.log('   📸 Screenshot: debug-sem-botao-boleto.png');
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao emitir boleto: ${e.message}`);
    console.log(`   📍 Stack: ${e.stack?.split('\n')[1] || 'N/A'}`);
    
    try {
      await siaaPage.screenshot({ path: `erro-boleto-${timestamp}.png`, fullPage: true });
    } catch (e2) {}
  }
  
  // Verifica se o PDF foi capturado via interceptação
  if (pdfBoletoBuffer && pdfBoletoBuffer.length > 0) {
    try {
      fs.writeFileSync(boletoPath, pdfBoletoBuffer);
      const stats = fs.statSync(boletoPath);
      console.log(`   ✅ BOLETO PDF SALVO VIA INTERCEPTAÇÃO: ${boletoPath} (${stats.size} bytes)`);
    } catch (e) {
      console.log(`   ⚠️ Erro ao salvar PDF interceptado: ${e.message}`);
    }
  }
  
  // Verifica se o PDF foi salvo (por qualquer método)
  if (!fs.existsSync(boletoPath)) {
    console.log('   ⚠️ PDF não foi salvo, tentando capturar screenshot da página atual...');
    try {
      await siaaPage.screenshot({ path: boletoPath.replace('.pdf', '.png'), fullPage: true });
      console.log(`   ✅ Screenshot salvo: ${boletoPath.replace('.pdf', '.png')}`);
    } catch (e) {}
  } else {
    console.log(`   ✅ Boleto PDF confirmado: ${boletoPath}`);
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
  if (linkCartaoCredito) {
    console.log(`💳 Link Cartão de Crédito: ${linkCartaoCredito}`);
    console.log(`LINK_CARTAO_CREDITO: ${linkCartaoCredito}`);
  }
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

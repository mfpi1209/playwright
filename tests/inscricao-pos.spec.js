import 'dotenv/config';
const { test, expect } = require('./stealth-fixture');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const https = require('https');
const http = require('http');
const { validarPolo: validarPoloWhitelist } = require('./polos-atendidos');

// Pasta padrão para arquivos gerados (acessível por todas as instâncias)
const ARQUIVOS_DIR = process.env.ARQUIVOS_DIR || path.join(__dirname, '..', 'arquivos');
if (!fs.existsSync(ARQUIVOS_DIR)) {
  fs.mkdirSync(ARQUIVOS_DIR, { recursive: true });
}

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

// Normaliza polo "sapopemba" → "sapopemba (vila ema)" (nunca pode ir só "sapopemba")
function normalizarPolo(polo) {
  if (!polo) return polo;
  return polo.trim().toLowerCase() === 'sapopemba' ? 'sapopemba (vila ema)' : polo;
}

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
// FUNÇÕES PARA AJUSTE DE CIDADE BASEADA NO POLO
// ═══════════════════════════════════════════════════════════════════════════

// Detecta se o polo é de Taboão da Serra (taboão centro, mituzi)
function isPoloTaboao(polo) {
  if (!polo) return false;
  const poloNormalizado = polo.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return poloNormalizado.includes('taboao') ||
         poloNormalizado.includes('mituzi') ||
         poloNormalizado.includes('mitsuzi');
}

// Detecta se o polo é de Capivari
function isPoloCapivari(polo) {
  if (!polo) return false;
  const poloNormalizado = polo.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return poloNormalizado.includes('capivari');
}

// Detecta se o polo é de Itapira
function isPoloItapira(polo) {
  if (!polo) return false;
  const poloNormalizado = polo.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return poloNormalizado.includes('itapira');
}

// Retorna a cidade correta baseada no polo
function obterCidadeDoPolo(polo, cidadePadrao) {
  if (isPoloTaboao(polo)) {
    return 'Taboão da Serra';
  }
  if (isPoloCapivari(polo)) {
    return 'Capivari';
  }
  if (isPoloItapira(polo)) {
    return 'Itapira';
  }
  return cidadePadrao;
}

// Retorna informação sobre ajuste de cidade para log
function getInfoAjusteCidade(polo) {
  if (isPoloTaboao(polo)) return ' (cidade ajustada para polo de Taboão)';
  if (isPoloCapivari(polo)) return ' (cidade ajustada para polo de Capivari)';
  if (isPoloItapira(polo)) return ' (cidade ajustada para polo de Itapira)';
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA FECHAR COOKIE BANNER E OUTROS OVERLAYS - VERSÃO ROBUSTA
// ═══════════════════════════════════════════════════════════════════════════
async function fecharCookieBanner(page) {
  try {
    // MÉTODO 1: Seletores específicos do privacytools (VTEX)
    const seletoresPrivacyTools = [
      '#privacytools-banner-consent button[class*="accept"]',
      '#privacytools-banner-consent button:has-text("Aceitar")',
      '#privacytools-banner-consent .privacy-tools-accept',
      '.privacy-tools-layout button[class*="accept"]',
      '.privacy-tools-layout button:first-child',
      '#privacytools-banner button',
    ];
    
    for (const seletor of seletoresPrivacyTools) {
      try {
        const btn = page.locator(seletor).first();
        if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 })) {
          await btn.click({ force: true, timeout: 3000 });
          console.log(`   🍪 Cookie banner fechado (privacytools: ${seletor})`);
          await page.waitForTimeout(500);
          return true;
        }
      } catch (e) {}
    }

    // MÉTODO 2: Seletores genéricos
    const cookieSelectors = [
      'button:has-text("Aceitar todos")',
      'button:has-text("Aceitar Todos")',
      'button:has-text("Aceitar")',
      '.cc-dismiss',
      '.cc-btn',
      '#onetrust-accept-btn-handler',
      'button[aria-label*="cookie"]',
      'button[aria-label*="aceitar"]',
      'button:has-text("OK")',
      'button:has-text("Concordo")',
      'button:has-text("Entendi")',
      '#cookieconsent button',
      '[class*="lgpd"] button',
      '[class*="consent"] button'
    ];

    for (const sel of cookieSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log(`   🍪 Cookie banner fechado (${sel})`);
          await page.waitForTimeout(500);
          return true;
        }
      } catch (e) {}
    }

    // MÉTODO 3: JavaScript fallback
    const clicouJS = await page.evaluate(() => {
      const seletores = [
        '#privacytools-banner-consent button',
        '[class*="cookie"] button',
        '[class*="lgpd"] button',
        '[class*="consent"] button',
      ];
      
      for (const sel of seletores) {
        const btns = document.querySelectorAll(sel);
        for (const btn of btns) {
          const texto = btn.textContent?.toLowerCase() || '';
          if (texto.includes('aceitar') || texto.includes('accept') || texto.includes('concordo')) {
            btn.click();
            return true;
          }
        }
        if (btns.length > 0) {
          btns[0].click();
          return true;
        }
      }
      return false;
    });
    
    if (clicouJS) {
      console.log('   🍪 Cookie banner fechado via JavaScript');
      await page.waitForTimeout(500);
      return true;
    }

    // MÉTODO 4: Remove overlay via JavaScript se persistir
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('#privacytools-banner-consent, .cc-window, [class*="cookie-banner"], [class*="lgpd-banner"], .privacy-tools-layout');
      overlays.forEach(el => {
        el.style.display = 'none';
        el.remove();
      });
    });

    return false;
  } catch (e) {
    // Ignora erros - cookie banner é opcional
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA FECHAR POPUP "BAIXAR GUIA DO CURSO" + COOKIES + OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════
async function fecharTodosOverlays(page) {
  try {
    // 1) ACEITA COOKIES PRIMEIRO (antes de remover elementos)
    // Tenta aceitar via clique direto nos seletores mais comuns
    const seletoresCookies = [
      '#privacytools-banner-consent button[class*="accept"]',
      '#privacytools-banner-consent button:has-text("Aceitar")',
      '.privacy-tools-layout button:first-child',
      'button:has-text("Aceitar todos")',
      'button:has-text("Aceitar Todos")',
      'button:has-text("Aceitar")',
    ];
    
    for (const sel of seletoresCookies) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log('   🍪 Cookies aceitos');
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {}
    }
    
    // 2) REMOVE TUDO via JavaScript (mais confiável - não depende de clique)
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

      // Remove cookie banners que ainda persistem
      document.querySelectorAll('.cc-banner, #privacytools-banner-consent, [class*="cookie-banner"], [class*="cookie-consent"], [class*="lgpd-banner"]').forEach(el => { el.remove(); count++; });

      // Remove modais genéricos que bloqueiam
      document.querySelectorAll('.modal-backdrop, .ui-widget-overlay').forEach(el => { el.remove(); count++; });

      return count;
    });

    if (removidos > 0) {
      console.log(`   🧹 ${removidos} overlay(s)/popup(s) removido(s) via JS`);
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
    
    // Log compacto - só mostra a tela detectada (sem detalhes internos)
    // Para debug, descomente a linha abaixo:
    // console.log(`   📊 ReactSelects: ${elementos.reactSelects} | CPF: ${elementos.campoCPF} | País: ${elementos.selectPais}`);
    
  } catch (e) {
    console.log(`   ⚠️ [DETECTOR] Erro: ${e.message}`);
  }
  
  return estado;
}

// Polo solicitado (precisa ser obtido antes de CLIENTE para ajustar cidade)
const poloSolicitado = normalizarPolo(corrigirEncoding(process.env.CLIENTE_POLO || ''));
const cidadePadrao = corrigirEncoding(process.env.CLIENTE_CIDADE || '');

const CLIENTE = {
  nome: capitalizarNome(corrigirEncoding(process.env.CLIENTE_NOME || '')),
  cpf: process.env.CLIENTE_CPF || '',
  email: (process.env.CLIENTE_EMAIL || '').toLowerCase(),
  telefone: formatarTelefone(process.env.CLIENTE_TELEFONE || ''),
  nascimento: process.env.CLIENTE_NASCIMENTO || '',
  cep: process.env.CLIENTE_CEP || '',
  numero: process.env.CLIENTE_NUMERO || String(Math.floor(Math.random() * 999) + 1),
  estado: corrigirEncoding(process.env.CLIENTE_ESTADO || ''),
  // Cidade ajustada automaticamente para polos específicos (Capivari, Itapira, Taboão)
  cidade: obterCidadeDoPolo(poloSolicitado, cidadePadrao),
  curso: corrigirEncoding(process.env.CLIENTE_CURSO || ''),
  // Duração: só o número (sem "meses"). Ex: "9 meses" → "9", "9" → "9"
  duracao: (() => {
    const raw = (process.env.CLIENTE_DURACAO || '').trim();
    if (raw) {
      const m = raw.match(/(\d+)/);
      return m ? m[1] : raw;
    }
    const cursoNome = corrigirEncoding(process.env.CLIENTE_CURSO || '');
    const matchDur = cursoNome.match(/(\d+)\s*meses?/i);
    return matchDur ? matchDur[1] : '';
  })(),
  polo: poloSolicitado,
  campanha: corrigirEncoding(process.env.CLIENTE_CAMPANHA || ''),
  // Limpa R$, espaços e vírgulas dos valores monetários para garantir que parseFloat funcione
  matricula: (process.env.CLIENTE_MATRICULA || '').replace(/[R$\s]/g, '').replace(',', '.').trim(),
  mensalidade: (process.env.CLIENTE_MENSALIDADE || '').replace(/[R$\s]/g, '').replace(',', '.').trim(),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAÇÃO DE POLO - rejeita se vazio ou fora da whitelist dos 12 atendidos
  // ═══════════════════════════════════════════════════════════════════════════
  const _validacaoPolo = validarPoloWhitelist(CLIENTE.polo);
  if (!_validacaoPolo.valido) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`❌ ${_validacaoPolo.motivo}`);
    console.log(`   Polo informado: "${CLIENTE.polo}"`);
    console.log(`   ${_validacaoPolo.mensagem}`);
    console.log(`   Polos atendidos: ${_validacaoPolo.listaAtendidos.join(', ')}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    throw new Error(`${_validacaoPolo.motivo}: ${_validacaoPolo.mensagem}`);
  }
  CLIENTE.polo = _validacaoPolo.canonico;

  let numeroInscricao = null;
  let pdfBoletoBuffer = null; // Para capturar o PDF via listener passivo
  let pdfBoletoUrl = null;    // URL do boleto para download direto

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTENER PASSIVO DE REDE PARA CAPTURAR O PDF DO BOLETO
  // Usa context.on('response') — NÃO interfere nas requisições (sem route.fetch)
  // ═══════════════════════════════════════════════════════════════════════════
  context.on('response', async (response) => {
    try {
      const url = response.url();
      const status = response.status();
      const contentType = (response.headers()['content-type'] || '').toLowerCase();
      
      // Ignora fontes, imagens e outros recursos estáticos
      if (/\.(woff2?|ttf|eot|svg|png|jpg|gif|ico|css|js)(\?|$)/i.test(url)) return;
      if (contentType.includes('font') || contentType.includes('image') || contentType.includes('javascript') || contentType.includes('css')) return;
      
      // Só processa URLs com "boleto", ".pdf", ou content-type de PDF
      const urlMatch = /boleto|\.pdf(\?|$)|gerar.*boleto|emissao.*boleto/i.test(url);
      const isPdfContentType = contentType.includes('pdf') || (contentType.includes('octet-stream') && urlMatch);
      
      if (!urlMatch && !isPdfContentType) return;
      if (status < 200 || status >= 400) return;
      
      // Salva URL para download direto
      if (!pdfBoletoUrl || url.includes('getBoletoDiversos') || url.includes('.pdf')) {
        pdfBoletoUrl = url;
      }
      
      const body = await response.body().catch(() => null);
      
      if (body && body.length > 500) {
        const isPdf = body.slice(0, 5).toString().includes('%PDF');
        const isBigBinary = !isPdf && isPdfContentType && body.length > 5000;
        
        if ((isPdf || isBigBinary) && (!pdfBoletoBuffer || body.length > pdfBoletoBuffer.length)) {
          pdfBoletoBuffer = body;
          pdfBoletoUrl = url;
          console.log(`   ✅ [LISTENER] PDF boleto capturado: ${body.length} bytes`);
        } else if (!pdfBoletoBuffer && body.length > 1000 && isPdf) {
          pdfBoletoBuffer = body;
        }
      }
    } catch (e) {
      // Listener passivo - erro silencioso
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN (randomiza entre dois logins)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  
  const ADMINS = (() => {
    const list = [];
    const envAdmins = process.env.VTEX_ADMINS || '';
    if (envAdmins.includes('|') || envAdmins.includes(':')) {
      envAdmins.split('|').filter(Boolean).forEach(par => {
        const [email, ...senhaParts] = par.split(':');
        if (email && senhaParts.length) list.push({ email: email.trim(), senha: senhaParts.join(':').trim() });
      });
    }
    if (process.env.VTEX_ADMIN_EMAIL && process.env.VTEX_ADMIN_PASSWORD) {
      const jaExiste = list.some(a => a.email === process.env.VTEX_ADMIN_EMAIL);
      if (!jaExiste) list.push({ email: process.env.VTEX_ADMIN_EMAIL, senha: process.env.VTEX_ADMIN_PASSWORD });
    }
    if (list.length === 0) {
      list.push(
        { email: 'fabio.boas50@polo.cruzeirodosul.edu.br', senha: 'Eduit123@!' },
        { email: 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', senha: 'Eduit123@!' },
      );
    }
    return list;
  })();
  
  async function tentarLoginAdmin(admin) {
    console.log(`   🔑 Tentando admin: ${admin.email}`);
    try {
      await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F', { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      console.log(`   ⚠️ Erro ao navegar para login: ${e.message}`);
    }
    await page.waitForTimeout(1500);
    const urlAtual = page.url();
    if (!urlAtual.includes('admin-login') && !urlAtual.includes('login')) {
      console.log(`   ✅ Já logado (URL: ${urlAtual})`);
      return true;
    }
    const emailField = page.getByRole('textbox', { name: 'Email' });
    try {
      await emailField.waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      console.log(`   ⚠️ Campo Email não encontrado na página de login (URL: ${page.url()})`);
      return !page.url().includes('admin-login');
    }
    await emailField.click();
    await emailField.fill(admin.email);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForTimeout(1500);
    try {
      const senhaInput = page.getByRole('textbox', { name: 'Senha' });
      await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
      await senhaInput.fill(admin.senha);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log(`   ⚠️ Erro no campo de senha: ${e.message}`);
      return false;
    }
    const urlAposLogin = page.url();
    const loginOk = !urlAposLogin.includes('admin-login');
    console.log(`   📍 URL após login: ${urlAposLogin} → ${loginOk ? 'OK' : 'FALHOU'}`);
    return loginOk;
  }
  
  let adminLogado = false;
  for (const admin of ADMINS) {
    adminLogado = await tentarLoginAdmin(admin);
    if (adminLogado) break;
    console.log('   ⚠️ Login falhou com este admin, tentando próximo...');
  }
  if (!adminLogado) {
    console.log('   ⚠️ Nenhum admin logou na 1ª rodada, aguardando 3s e tentando novamente...');
    await page.waitForTimeout(3000);
    for (const admin of ADMINS) {
      adminLogado = await tentarLoginAdmin(admin);
      if (adminLogado) break;
    }
  }
  if (!adminLogado) {
    throw new Error('Login admin falhou com todos os admins disponíveis.');
  }
  
  console.log(`✅ ETAPA 1 CONCLUÍDA - Admin logado`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO E COOKIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Pós-Graduação');
  
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
      if (tentativa < 3) await page.waitForTimeout(2000);
    }
  }
  
  if (!navegacaoOk) {
    try {
      await page.getByText('Cursos').first().click();
      await page.waitForTimeout(1000);
      await page.getByText('Pós-Graduação', { exact: false }).first().click();
    } catch (e) {}
  }
  
  await page.waitForTimeout(2000);
  
  try {
    const aceitarCookies = page.getByText('Aceitar todos');
    if (await aceitarCookies.isVisible({ timeout: 3000 })) {
      await aceitarCookies.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Verifica se estamos na página de pós (não redirecionados para login)
  let urlAposEtapa2 = page.url();
  if (urlAposEtapa2.includes('admin-login') || (urlAposEtapa2.includes('login') && !urlAposEtapa2.includes('/pos'))) {
    console.log(`⚠️ URL ainda é login: ${urlAposEtapa2}. Refazendo login admin...`);
    for (const admin of ADMINS) {
      const ok = await tentarLoginAdmin(admin);
      if (ok) break;
    }
    await page.goto('https://cruzeirodosul.myvtex.com/pos-graduacao', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    urlAposEtapa2 = page.url();
    if (urlAposEtapa2.includes('admin-login')) {
      throw new Error('Não foi possível acessar pós-graduação após retry de login. URL: ' + urlAposEtapa2);
    }
  }
  
  console.log(`✅ ETAPA 2 CONCLUÍDA - URL: ${page.url()}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: LOGIN CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 3: Login como Cliente');

  // Função para remover TODOS os overlays/banners que bloqueiam cliques na página
  async function limparTelaCompleta() {
    try {
      const removidos = await page.evaluate(() => {
        let count = 0;
        // Cookie banners (privacytools/LGPD)
        document.querySelectorAll(
          '#privacytools-banner-consent, .cc-banner, [class*="cookie-banner"], [class*="cookie-consent"], ' +
          '[class*="lgpd"], [id*="lgpd"], [class*="privacytools"], [id*="privacytools"]'
        ).forEach(el => { el.remove(); count++; });
        // Backdrops e overlays fixos
        document.querySelectorAll(
          '[class*="Backdrop"], [class*="backdrop"], .overlay, .modal-backdrop, ' +
          '[class*="sectionContactFormNews"], [class*="DownloadForm"], [class*="ContactForm"]'
        ).forEach(el => { el.remove(); count++; });
        // Popups "Antes de Você Sair" e similares
        document.querySelectorAll('[class*="portalContainer"], [class*="popup"], [class*="modal"]').forEach(el => {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('antes de você sair') || text.includes('deixe seus dados') ||
              text.includes('fale com um dos nossos') || text.includes('baixar guia')) {
            el.remove(); count++;
          }
        });
        // Remove qualquer elemento fixed/absolute que cobre mais de 40% da tela
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if ((style.position === 'fixed' || style.position === 'absolute') && style.zIndex > 100) {
            if (el.offsetWidth > window.innerWidth * 0.4 && el.offsetHeight > window.innerHeight * 0.3) {
              const tag = el.tagName.toLowerCase();
              if (tag !== 'html' && tag !== 'body' && !el.querySelector('input[type="email"]')) {
                el.remove(); count++;
              }
            }
          }
        });
        return count;
      });
      if (removidos > 0) console.log(`   🧹 ${removidos} overlay(s) removido(s)`);
    } catch (e) {}
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Função para clicar via JavaScript diretamente no DOM (ignora overlays visuais)
  async function clicarViaJS(locator, descricao) {
    try {
      await locator.evaluate(el => el.click());
      console.log(`   ✅ ${descricao} (via JS)`);
      return true;
    } catch (e) {
      console.log(`   ⚠️ Clique JS falhou para "${descricao}": ${e.message.substring(0, 60)}`);
      return false;
    }
  }

  await fecharModais(page);
  await limparTelaCompleta();
  await page.waitForTimeout(1000);

  let jaLogado = false;
  try {
    const headerOla = page.locator('text=/Olá,/i').first();
    if (await headerOla.isVisible({ timeout: 2000 })) {
      jaLogado = true;
      console.log('   ✅ Já logado como cliente');
    }
  } catch (e) {}

  if (!jaLogado) {
    const emailCliente = page.getByPlaceholder('Ex: example@mail.com')
      .or(page.getByPlaceholder(/e-mail|email/i))
      .or(page.getByRole('textbox', { name: /e-mail|email/i }))
      .or(page.locator('input[type="email"]').first());

    let loginClienteOk = false;
    for (let tentLogin = 1; tentLogin <= 3; tentLogin++) {
      console.log(`   🔄 Tentativa ${tentLogin}/3 login cliente...`);

      // Limpa overlays antes de cada tentativa
      await limparTelaCompleta();
      await page.waitForTimeout(500);

      // Passo 1: Encontrar e clicar "Entrar como cliente"
      const entrarComoCliente = page.getByText('Entrar como cliente').first()
        .or(page.getByRole('button', { name: /entrar como cliente/i }).first())
        .or(page.getByRole('link', { name: /entrar como cliente/i }).first())
        .or(page.locator('a, button, span').filter({ hasText: /entrar como cliente/i }).first());

      let clicouEntrar = false;
      try {
        await entrarComoCliente.first().waitFor({ state: 'visible', timeout: 10000 });

        // Tenta clique normal primeiro
        try {
          await entrarComoCliente.first().click({ timeout: 3000 });
          clicouEntrar = true;
          console.log('   ✅ Clicou em "Entrar como cliente" (clique normal)');
        } catch (clickErr) {
          // Clique normal falhou (overlay?), remove overlays e tenta via JS
          console.log('   ⚠️ Clique normal bloqueado, removendo overlays e tentando JS...');
          await limparTelaCompleta();
          await page.waitForTimeout(500);
          clicouEntrar = await clicarViaJS(entrarComoCliente.first(), 'Clicou em "Entrar como cliente"');
        }
      } catch (e) {
        console.log('   ⚠️ "Entrar como cliente" não encontrado na página');
        // Tenta scroll para cima onde o botão geralmente fica
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1000);
        await limparTelaCompleta();
        continue;
      }

      if (!clicouEntrar) continue;
      await page.waitForTimeout(2000);

      // Passo 2: Esperar campo de email aparecer
      let campoEmailVisivel = false;
      try {
        await emailCliente.first().waitFor({ state: 'visible', timeout: 10000 });
        campoEmailVisivel = true;
        console.log('   ✅ Painel de login aberto');
      } catch (e) {
        console.log('   ⚠️ Campo email não apareceu após clique');
        // Pode ter overlay cobrindo — limpa e tenta clicar de novo
        await limparTelaCompleta();
        await page.waitForTimeout(1000);
        try {
          await emailCliente.first().waitFor({ state: 'visible', timeout: 3000 });
          campoEmailVisivel = true;
          console.log('   ✅ Painel de login apareceu após limpeza');
        } catch (e2) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
          continue;
        }
      }

      if (!campoEmailVisivel) continue;

      // Passo 3: Limpar overlays residuais (preservando o painel de login)
      try {
        await page.evaluate(() => {
          document.querySelectorAll(
            '[class*="Backdrop"]:not([class*="login"]), [class*="backdrop"]:not([class*="login"]), ' +
            '[class*="sectionContactFormNews"], [class*="DownloadForm"]'
          ).forEach(el => {
            if (!el.querySelector('input[type="email"]') && !el.querySelector('input[placeholder*="mail"]')) {
              el.remove();
            }
          });
        });
      } catch (e) {}
      await page.waitForTimeout(500);

      // Passo 4: Preencher email
      const campoEmail = emailCliente.first();
      try {
        await campoEmail.click({ force: true });
        await page.waitForTimeout(300);
        await campoEmail.fill('');
        await page.waitForTimeout(200);
        await campoEmail.type(CLIENTE.email, { delay: 60 });
        console.log(`   ✅ Email: ${CLIENTE.email}`);
      } catch (e) {
        console.log(`   ⚠️ Erro ao preencher email: ${e.message.substring(0, 60)}`);
        continue;
      }

      await page.waitForTimeout(2500);

      // Passo 5: Clicar "Entrar" (VTEX às vezes precisa de 2 cliques)
      try {
        const btnEntrar = page.getByRole('button', { name: 'Entrar' });
        await btnEntrar.waitFor({ state: 'visible', timeout: 5000 });
        try {
          await btnEntrar.click({ timeout: 3000 });
        } catch (e) {
          await clicarViaJS(btnEntrar, 'Clicou "Entrar"');
        }
        console.log('   ✅ Clicou em "Entrar" (1º clique)');

        await page.waitForTimeout(3000);

        // Segundo clique: VTEX pode mostrar "Entrar" de novo para confirmar
        try {
          const btnEntrar2 = page.getByRole('button', { name: 'Entrar' });
          if (await btnEntrar2.isVisible({ timeout: 3000 })) {
            await btnEntrar2.click({ timeout: 3000 }).catch(() => {});
            console.log('   ✅ Clicou em "Entrar" (2º clique - confirmação)');
          }
        } catch (e) {}

        loginClienteOk = true;
      } catch (e) {
        console.log(`   ⚠️ Erro ao clicar Entrar: ${e.message.substring(0, 60)}`);
        continue;
      }

      await page.waitForTimeout(5000);
      break;
    }

    if (!loginClienteOk) {
      throw new Error('Login do cliente falhou após 3 tentativas.');
    }

    await fecharModalSair(page);

    try {
      const cookieBanner2 = page.getByText('Aceitar todos');
      if (await cookieBanner2.isVisible({ timeout: 2000 })) {
        await cookieBanner2.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    let loginOk = false;
    try {
      const headerOla = page.locator('text=/Olá,/i').first();
      loginOk = await headerOla.isVisible({ timeout: 5000 });
    } catch (e) {}

    if (!loginOk) {
      console.log('   ⚠️ Login pode não ter funcionado (sem "Olá" no header)');
    } else {
      console.log('   ✅ Login confirmado (header "Olá" visível)');
    }
  }

  await fecharModais(page);

  console.log(`✅ ETAPA 3 CONCLUÍDA - ${jaLogado ? 'Já logado' : CLIENTE.email}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: BUSCA DO CURSO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 4: Busca e Seleção do Curso');
  
  // Fecha modais se necessário
  await fecharModais(page);
  
  // PASSO 1: Pesquisar o curso (SEM a duração no termo de busca)
  // Remove TODAS as ocorrências de "N meses" e traços soltos (ex: "MBA em X - 6 meses 6 meses" → "MBA em X")
  const cursoSemDuracao = CLIENTE.curso
    .replace(/\s*-?\s*\d+\s*meses?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*$/, '')
    .trim();
  console.log(`   🔍 Pesquisando: "${cursoSemDuracao}" (${CLIENTE.duracao}m)`);
  
  const searchInput = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
  await searchInput.click({ force: true });
  await searchInput.fill(cursoSemDuracao);
  await searchInput.press('Enter');
  
  await aguardar(page, 3000);
  
  try {
    await page.waitForSelector('a[href*="/pos-"][href$="/p"]', { timeout: 20000 });
  } catch (e) {
    console.log('   ⚠️ Timeout aguardando resultados');
  }
  await aguardar(page, 2000);
  
  const duracaoDesejada = `${CLIENTE.duracao} meses`;
  
  const cursoNormalizado = CLIENTE.curso.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palavrasGenericasCurso = ['meses', 'curso', 'cursos', 'graduacao', 'pos-graduacao', 'livre', 'livres', 'virtual', 'digital', 'presencial', 'semestre', 'semestres', 'com', 'para', 'dos', 'das', 'nos', 'nas', 'por'];
  const siglasCurso = ['mba', 'bi', 'ti', 'rh', 'ead'];
  const palavrasChaveCurso = cursoNormalizado.split(/[\s\-]+/).filter(p => {
    if (/^\d+$/.test(p)) return false;
    if (palavrasGenericasCurso.includes(p)) return false;
    if (siglasCurso.includes(p)) return true;
    return p.length > 3;
  });
  console.log(`   🔑 Keywords do curso: [${palavrasChaveCurso.join(', ')}]`);
  
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
    
    // Verifica se o card contém a duração desejada (ex: "9 meses") — só verifica se duração foi informada
    const matchDuracao = !CLIENTE.duracao || 
                         textoNormalizado.includes(`${CLIENTE.duracao} meses`) || 
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
  
  // Se não encontrou com duração, tenta usar o filtro de duração (só se duração for conhecida)
  if (!cursoClicado && CLIENTE.duracao) {
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
          
          // Agora busca card que tenha as keywords do curso (NÃO clica cegamente no primeiro)
          const cardsFiltrados = page.locator('a[href*="/pos-"][href$="/p"]');
          const countFiltrados = await cardsFiltrados.count();
          console.log(`   📋 ${countFiltrados} cards após filtro de duração`);
          for (let fi = 0; fi < countFiltrados; fi++) {
            const cardF = cardsFiltrados.nth(fi);
            const textoF = (await cardF.textContent() || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const hrefF = ((await cardF.getAttribute('href')) || '').toLowerCase();
            const matchCountF = palavrasChaveCurso.filter(p => textoF.includes(p) || hrefF.includes(p)).length;
            if (fi < 3) console.log(`      Card[${fi}] href: ${hrefF.substring(0,60)} | match: ${matchCountF}/${palavrasChaveCurso.length}`);
            if (matchCountF >= Math.max(2, Math.floor(palavrasChaveCurso.length * 0.6))) {
              const textoOriginal = await cardF.textContent() || '';
              console.log(`   ✅ Card filtrado com match de nome (${matchCountF}/${palavrasChaveCurso.length} kw): "${textoOriginal.substring(0, 60).replace(/\s+/g, ' ')}..."`);
              await cardF.click();
              cursoClicado = true;
              break;
            }
          }
          if (!cursoClicado) {
            console.log(`   ⚠️ Nenhum card filtrado corresponde ao curso "${CLIENTE.curso}"`);
          }
          break;
        }
      } catch (e) {}
    }
  }
  
  // Fallback com seletores padrão: exige pelo menos 60% das keywords
  if (!cursoClicado) {
    console.log('   ⚠️ Tentando match parcial com seletores padrão...');
    const minMatchPadrao = Math.max(3, Math.ceil(palavrasChaveCurso.length * 0.6));
    
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
  
  // REMOVIDO: Fallback cego que clicava no primeiro card sem verificar nome/curso.
  // Esse fallback era a causa de inscrições em cursos ERRADOS (ex: Psicologia em vez de MBA).
  // Agora, se não houver match, o script continua para os fallbacks avançados que validam keywords.

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
      const matchCount = palavrasChaveCurso.filter(p => txtNorm.includes(p) || hrNorm.includes(p)).length;
      // Se duração não foi informada, considera como "tem duração" (não filtra por ela)
      const temDuracao = !CLIENTE.duracao ||
                         txtNorm.includes(`${CLIENTE.duracao} meses`) || 
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
    if (!cursoClicado) {
      // Usa cursoSemDuracao (sem "N meses") para gerar o slug limpo
      const slugBase = cursoSemDuracao
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim();
      const durSlug = CLIENTE.duracao ? `-${CLIENTE.duracao}-meses` : '';
      const sufixos = ['', '-cruzeiro-do-sul-virtual', '-ead'];

      const urlsTentativas = [];
      for (const suf of sufixos) {
        urlsTentativas.push(`https://cruzeirodosul.myvtex.com/pos-${slugBase}${durSlug}${suf}/p`);
        urlsTentativas.push(`https://cruzeirodosul.myvtex.com/${slugBase}${durSlug}${suf}/p`);
      }
      // Sem duração no slug
      urlsTentativas.push(`https://cruzeirodosul.myvtex.com/pos-${slugBase}-cruzeiro-do-sul-virtual/p`);
      urlsTentativas.push(`https://cruzeirodosul.myvtex.com/${slugBase}/p`);

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

    // FALLBACK C: Re-buscar com nome simplificado (reutiliza cursoSemDuracao que já está limpo)
    if (!cursoClicado) {
      const cursoSimples = cursoSemDuracao;

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
          // PASSO 2: Se não achou com duração, busca com mais keywords (exige 70%+ match)
          if (!cursoClicado) {
            const minRigoroso = Math.max(3, Math.ceil(palavrasChaveCurso.length * 0.7));
            for (let i = 0; i < Math.min(countRetry, 30); i++) {
              const card = cardsRetry.nth(i);
              const texto = (await card.textContent()) || '';
              const href = (await card.getAttribute('href')) || '';
              const { matchCount } = cardMatchCursoEDuracao(texto, href);
              if (matchCount >= minRigoroso) {
                console.log(`   ⚠️ FALLBACK C: Card sem duração mas com match rigoroso (${matchCount}/${palavrasChaveCurso.length} kw, mín ${minRigoroso}): "${texto.substring(0, 60).replace(/\s+/g, ' ')}..."`);
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
        // PASSO 2: Só keywords se não encontrou com duração (exige 70%+ match rigoroso)
        if (!cursoClicado) {
          const minRigorosoE = Math.max(3, Math.ceil(palavrasChaveCurso.length * 0.7));
          for (let i = 0; i < linkCount; i++) {
            const link = allLinks.nth(i);
            const href = (await link.getAttribute('href')) || '';
            const texto = (await link.textContent()) || '';
            const { matchCount } = cardMatchCursoEDuracao(texto, href);
            if (matchCount >= minRigorosoE) {
              console.log(`   ⚠️ FALLBACK E: Curso sem duração mas match rigoroso (${matchCount}/${palavrasChaveCurso.length} kw, mín ${minRigorosoE})`);
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
      console.log('   ❌ TODOS OS FALLBACKS FALHARAM - ABORTANDO para não inscrever em curso errado');
      try {
        await page.screenshot({ path: path.join(ARQUIVOS_DIR, `debug-etapa4-curso-nao-encontrado-${CLIENTE.cpf}.png`), fullPage: true });
      } catch (e) {}
      throw new Error(`CURSO NÃO ENCONTRADO: "${CLIENTE.curso}" (${CLIENTE.duracao} meses). Inscrição abortada para evitar inscrição em curso errado.`);
    }
  }
  
  await page.waitForTimeout(3000);

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAÇÃO PÓS-SELEÇÃO: Confirma que o curso na página é o correto
  // Defesa crítica contra inscrição em curso errado
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const urlCurso = page.url().toLowerCase();
    const tituloPagina = (await page.title().catch(() => '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    let conteudoPagina = '';
    try {
      conteudoPagina = (await page.locator('[class*="productName"], [class*="product-name"], h1, h2').first().textContent({ timeout: 5000 })) || '';
      conteudoPagina = conteudoPagina.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {}

    const textoValidacao = `${urlCurso} ${tituloPagina} ${conteudoPagina}`;
    const keywordsRelevantes = palavrasChaveCurso.filter(p => p.length > 3 || siglasCurso.includes(p));
    const matchValidacao = keywordsRelevantes.filter(p => textoValidacao.includes(p)).length;
    const minValidacao = Math.max(2, Math.floor(keywordsRelevantes.length * 0.5));

    console.log(`   🔍 VALIDAÇÃO PÓS-SELEÇÃO: ${matchValidacao}/${keywordsRelevantes.length} keywords na página (mínimo: ${minValidacao})`);
    console.log(`      URL: ${urlCurso.substring(0, 80)}`);
    console.log(`      Título: ${tituloPagina.substring(0, 80)}`);
    if (conteudoPagina) console.log(`      Produto: ${conteudoPagina.substring(0, 80)}`);

    if (matchValidacao < minValidacao) {
      console.log(`   ❌ VALIDAÇÃO FALHOU! Curso na página NÃO corresponde a "${CLIENTE.curso}"`);
      console.log(`      Keywords esperadas: [${keywordsRelevantes.join(', ')}]`);
      console.log(`      Keywords encontradas: [${keywordsRelevantes.filter(p => textoValidacao.includes(p)).join(', ')}]`);
      try {
        await page.screenshot({ path: path.join(ARQUIVOS_DIR, `debug-curso-errado-${CLIENTE.cpf}.png`), fullPage: true });
      } catch (e) {}
      throw new Error(`CURSO ERRADO DETECTADO! Esperado: "${CLIENTE.curso}". A página não corresponde ao curso solicitado. Inscrição abortada.`);
    }
    console.log('   ✅ VALIDAÇÃO PÓS-SELEÇÃO: Curso correto confirmado!');
  }

  // IMPORTANTE: Fecha popup "Baixar guia do curso" que aparece ao entrar na página do curso
  // Esse popup tem campos Nome/Email/Telefone que confundem o script
  await fecharTodosOverlays(page);
  
  console.log(`✅ ETAPA 4 CONCLUÍDA - Curso: ${page.url()}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  
  // Aguarda o formulário carregar (pode demorar mais em conexões lentas)
  await page.waitForTimeout(3000);
  
  // IMPORTANTE: Limpa NOVAMENTE todos os overlays (podem reaparecer após scroll)
  await fecharTodosOverlays(page);
  await fecharModalSair(page);
  
  // Scroll até o formulário real de inscrição (fica mais abaixo na página)
  // Tenta múltiplos seletores e faz scroll agressivo para encontrá-lo
  let formEncontrado = false;
  const seletoresFormulario = [
    'input[placeholder*="nome completo" i]',
    'input[name="userName"]',
    '[class*="formContainer"] input',
    '[class*="purchase-box"] input',
    'button:has-text("Inscreva-se")',
    '[class*="productPurchaseBox"] input',
  ];
  for (const sel of seletoresFormulario) {
    try {
      const elem = page.locator(sel).first();
      if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await elem.scrollIntoViewIfNeeded();
        formEncontrado = true;
        console.log(`   📍 Formulário de inscrição localizado (${sel})`);
        break;
      }
    } catch (e) {}
  }
  if (!formEncontrado) {
    console.log('   📍 Formulário não visível, scrollando para baixo...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
    await page.waitForTimeout(2000);
    await fecharTodosOverlays(page);
    // Tenta de novo após scroll
    for (const sel of seletoresFormulario) {
      try {
        const elem = page.locator(sel).first();
        if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await elem.scrollIntoViewIfNeeded();
          formEncontrado = true;
          console.log(`   📍 Formulário encontrado após scroll (${sel})`);
          break;
        }
      } catch (e) {}
    }
  }
  await page.waitForTimeout(500);
  
  // Limpa overlays mais uma vez após scroll (o popup pode reaparecer)
  await fecharTodosOverlays(page);
  
  // PREENCHER NOME DO CANDIDATO - múltiplas estratégias
  // IMPORTANTE: Evitar campos de "nome da mãe", "nome do pai", "nome do responsável"
  console.log('   📝 Preenchendo nome do candidato...');
  let nomePreenchido = false;
  
  // Função para verificar se é campo de nome de parente (mãe, pai, responsável)
  const ehCampoParente = async (campo) => {
    try {
      const placeholder = (await campo.getAttribute('placeholder') || '').toLowerCase();
      const name = (await campo.getAttribute('name') || '').toLowerCase();
      const id = (await campo.getAttribute('id') || '').toLowerCase();
      const ariaLabel = (await campo.getAttribute('aria-label') || '').toLowerCase();
      
      const termosExcluir = ['mãe', 'mae', 'pai', 'mother', 'father', 'responsavel', 'responsável', 'parent'];
      for (const termo of termosExcluir) {
        if (placeholder.includes(termo) || name.includes(termo) || id.includes(termo) || ariaLabel.includes(termo)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };
  
  // Estratégia 1: Seletores específicos (EXCLUINDO campos de parentes)
  const seletoresNome = [
    'input[placeholder*="nome completo" i]:not([placeholder*="mãe" i]):not([placeholder*="mae" i]):not([placeholder*="pai" i])',
    'input[name="userName"]',
    'input[name="nomecompleto"]:not([name*="mae"]):not([name*="mãe"])',
    'input[name="name"]:not([name*="mother"]):not([name*="father"])',
    '[class*="userName"] input',
    '[class*="nome"] input:not([class*="mae"]):not([class*="mãe"])',
    'input[placeholder*="nome" i]:not([placeholder*="mãe" i]):not([placeholder*="mae" i]):not([placeholder*="pai" i])',
  ];
  
  for (const seletor of seletoresNome) {
    try {
      const campo = page.locator(seletor).first();
      if (await campo.isVisible({ timeout: 2000 })) {
        // Verificação adicional: garantir que não é campo de parente
        if (await ehCampoParente(campo)) {
          console.log(`   ⚠️ Seletor ${seletor} retornou campo de parente, pulando...`);
          continue;
        }
        
        console.log(`   📍 Campo nome do candidato encontrado: ${seletor}`);
        
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
          console.log(`   ✅ Nome do candidato preenchido: "${valor}"`);
          nomePreenchido = true;
          break;
        }
      }
    } catch (e) {
      // Continua para próximo seletor
    }
  }
  
  // Estratégia 2: getByRole com vários nomes possíveis
  if (!nomePreenchido) {
    const nomesRole = [/nome completo/i, /^nome$/i, /nome do candidato/i, /seu nome/i];
    for (const nomeRole of nomesRole) {
      try {
        const campoNomeCompleto = page.getByRole('textbox', { name: nomeRole }).first();
        if (await campoNomeCompleto.isVisible({ timeout: 2000 })) {
          if (!(await ehCampoParente(campoNomeCompleto))) {
            await campoNomeCompleto.click();
            await campoNomeCompleto.fill(CLIENTE.nome);
            console.log(`   ✅ Nome preenchido via getByRole(${nomeRole}): "${CLIENTE.nome}"`);
            nomePreenchido = true;
            break;
          }
        }
      } catch (e) {}
    }
  }
  
  // Estratégia 3: Procura por label específico (APENAS "Nome completo" ou "Nome do aluno")
  if (!nomePreenchido) {
    try {
      // Labels específicos que indicam nome do candidato (não de parente)
      const labelsPermitidos = ['nome completo', 'nome do aluno', 'nome do candidato', 'seu nome'];
      for (const labelTexto of labelsPermitidos) {
        const labelNome = page.locator('label').filter({ hasText: new RegExp(`^${labelTexto}`, 'i') }).first();
        if (await labelNome.isVisible({ timeout: 1000 }).catch(() => false)) {
          const forId = await labelNome.getAttribute('for');
          if (forId) {
            const campo = page.locator(`#${forId}`);
            if (!(await ehCampoParente(campo))) {
              await campo.click();
              await campo.fill(CLIENTE.nome);
              console.log(`   ✅ Nome do candidato preenchido via label "${labelTexto}": "${CLIENTE.nome}"`);
              nomePreenchido = true;
              break;
            }
          }
        }
      }
    } catch (e) {}
  }
  
  if (!nomePreenchido) {
    console.log('   ⚠️ Não conseguiu preencher o nome do candidato!');
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
    // RETRY LOOP: preenche formulário + clica Inscreva-se, com refresh se travar
    let formLocalizacaoOk = false;
    
    for (let tentativaGlobal = 1; tentativaGlobal <= 3; tentativaGlobal++) {
      if (tentativaGlobal > 1) {
        console.log(`   🔄 Tentativa ${tentativaGlobal}/3: Recarregando página e re-preenchendo formulário...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        await fecharTodosOverlays(page);
        
        // Re-preenche nome
        for (const seletor of seletoresNome) {
          try {
            const campo = page.locator(seletor).first();
            if (await campo.isVisible({ timeout: 3000 })) {
              await campo.click();
              await campo.fill('');
              await campo.fill(CLIENTE.nome);
              console.log(`   ✅ Nome re-preenchido: "${CLIENTE.nome}"`);
              break;
            }
          } catch (e) {}
        }
        await page.waitForTimeout(300);
        
        // Re-preenche telefone
        for (const seletor of seletoresTelefone) {
          try {
            const campo = page.locator(seletor).first();
            if (await campo.isVisible({ timeout: 2000 })) {
              await campo.click();
              await campo.fill(CLIENTE.telefone);
              console.log(`   ✅ Telefone re-preenchido: "${CLIENTE.telefone}"`);
              break;
            }
          } catch (e) {}
        }
        await page.waitForTimeout(300);
        
        // Re-marca checkbox
        try {
          const checkboxVtex = page.locator('.cruzeirodosul-product-purchase-box-0-x-checkboxWrapperFakeInput');
          if (await checkboxVtex.isVisible({ timeout: 2000 })) {
            await checkboxVtex.click();
          } else {
            const cb = page.locator('input[type="checkbox"]').first();
            if (await cb.isVisible({ timeout: 2000 })) await cb.click({ force: true });
          }
          console.log('   ✅ Checkbox re-marcado');
        } catch (e) {}
        await page.waitForTimeout(500);
        await fecharTodosOverlays(page);
      }
      
      // Clica em Inscreva-se
      try {
        const btnInscreva = page.getByRole('button', { name: /inscreva-se/i });
        if (await btnInscreva.isVisible({ timeout: 5000 })) {
          await btnInscreva.scrollIntoViewIfNeeded();
          await btnInscreva.click();
          console.log('   ✅ Botão Inscreva-se clicado');
        } else {
          const btnAlt = page.locator('button').filter({ hasText: /inscreva/i }).first();
          if (await btnAlt.isVisible({ timeout: 2000 })) {
            await btnAlt.click();
            console.log('   ✅ Botão clicado (alternativo)');
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Erro ao clicar Inscreva-se: ${e.message}`);
        continue;
      }
      
      // Aguarda formulário de localização (máx 20s)
      console.log('   ⏳ Aguardando formulário de localização...');
      let formOk = false;
      
      for (let espera = 1; espera <= 10; espera++) {
        await page.waitForTimeout(2000);
        
        // Verifica se "Carregando..." sumiu e formulário apareceu
        const carregando = await page.locator('text=Carregando').isVisible({ timeout: 500 }).catch(() => false);
        
        telaAtual = await detectarTelaAtual(page);
        
        if (telaAtual.tela === 'FORMULARIO_LOCALIZACAO' || telaAtual.detalhes.reactSelects >= 3) {
          console.log(`   ✅ Formulário de localização detectado!`);
          formOk = true;
          break;
        } else if (['CAMPANHA', 'CHECKOUT_CART'].includes(telaAtual.tela)) {
          console.log(`   ✅ Navegou para ${telaAtual.tela}`);
          formOk = true;
          break;
        }
        
        // Se ainda mostra "Carregando..." após 10s, é hora de retry
        if (espera >= 5 && carregando) {
          console.log(`   ⚠️  Página travada em "Carregando..." (${espera * 2}s)`);
          break;
        }
        
        if (espera % 3 === 0) {
          await page.evaluate(() => window.scrollBy(0, 300));
        }
      }
      
      if (formOk) {
        formLocalizacaoOk = true;
        break;
      }
      
      console.log(`   ⚠️ Formulário não carregou na tentativa ${tentativaGlobal}/3`);
    }
    
    if (!formLocalizacaoOk) {
      console.log('   ⚠️ Formulário de localização não apareceu após 3 tentativas com refresh');
      await page.screenshot({ path: 'debug-pos-inscreva-se.png', fullPage: true });
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
    let campoCPFvisivel = await page.locator('input[name="userDocument"]').isVisible({ timeout: 2000 }).catch(() => false);
    
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
      // debug screenshot salvo silenciosamente
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
    
    // ── Helper para selecionar opção em react-select ──
    async function selecionarReactSelect(page, indice, textoDigitar, nomeOpcao, label) {
      // Localiza todos os react-select controls
      const controls = page.locator('.react-select__control');
      const control = controls.nth(indice);
      
      // Tenta abrir o dropdown clicando no control
      let abriu = false;
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          // Verifica se já foi selecionado (tem single-value)
          const jaTemValor = await control.locator('.react-select__single-value').isVisible({ timeout: 500 }).catch(() => false);
          if (jaTemValor) {
            const valorAtual = await control.locator('.react-select__single-value').textContent().catch(() => '');
            if (valorAtual && valorAtual.toLowerCase().includes(nomeOpcao.toLowerCase().slice(0, 5))) {
              console.log(`   ✅ ${label}: ${valorAtual} (já selecionado)`);
              return true;
            }
          }
          
          await control.click({ timeout: 5000 });
          await page.waitForTimeout(400);
          
          // Verifica se o menu abriu
          const menuAberto = await page.locator('.react-select__menu').isVisible({ timeout: 2000 }).catch(() => false);
          if (menuAberto) {
            abriu = true;
            break;
          }
          
          // Tenta clicar no input-container diretamente
          const inputContainer = control.locator('.react-select__input-container');
          if (await inputContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
            await inputContainer.click();
            await page.waitForTimeout(400);
            const menuAberto2 = await page.locator('.react-select__menu').isVisible({ timeout: 2000 }).catch(() => false);
            if (menuAberto2) {
              abriu = true;
              break;
            }
          }
          
          console.log(`   ⚠️ Tentativa ${tentativa}/3: menu não abriu para ${label}`);
        } catch (e) {
          console.log(`   ⚠️ Tentativa ${tentativa}/3 erro: ${e.message.split('\n')[0]}`);
        }
      }
      
      if (!abriu) {
        console.log(`   ❌ Não conseguiu abrir dropdown ${label}`);
        return false;
      }
      
      // Digita para filtrar
      await page.keyboard.type(textoDigitar, { delay: 30 });
      await page.waitForTimeout(1000);
      
      // Tenta clicar na opção pelo texto
      const opcao = page.locator('.react-select__option').filter({ hasText: new RegExp(nomeOpcao, 'i') }).first();
      const opcaoVisivel = await opcao.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (opcaoVisivel) {
        await opcao.click();
        console.log(`   ✅ ${label}: ${nomeOpcao}`);
        return true;
      }
      
      // Fallback: pressiona Enter para selecionar primeiro item filtrado
      console.log(`   📍 Opção "${nomeOpcao}" não clicável, tentando Enter...`);
      await page.keyboard.press('Enter');
      
      // Verifica se selecionou
      await page.waitForTimeout(500);
      const valorSelecionado = await control.locator('.react-select__single-value').textContent().catch(() => '');
      if (valorSelecionado) {
        console.log(`   ✅ ${label}: ${valorSelecionado} (via Enter)`);
        return true;
      }
      
      console.log(`   ⚠️ ${label}: Não confirmado se selecionou`);
      return false;
    }
    
    // 1. PAÍS - Brasil
    console.log('   📝 Selecionando País: Brasil...');
    await selecionarReactSelect(page, 0, 'brasil', 'Brasil', 'País');
    await page.waitForTimeout(1000);
    
    // 2. ESTADO
    console.log(`   📝 Selecionando Estado: ${CLIENTE.estado}...`);
    await selecionarReactSelect(page, 1, 'são pau', 'São Paulo', 'Estado');
    await page.waitForTimeout(1500);
    
    // 3. CIDADE - Usa termo de busca baseado na cidade (Capivari, Itapira, Taboão ou São Paulo)
    console.log(`   📝 Selecionando Cidade: ${CLIENTE.cidade}...`);
    // Determina o termo de busca correto baseado na cidade
    let termoBuscaCidade = 'são pa'; // padrão para São Paulo
    if (CLIENTE.cidade && CLIENTE.cidade.toLowerCase().includes('capivari')) {
      termoBuscaCidade = 'capiv';
    } else if (CLIENTE.cidade && CLIENTE.cidade.toLowerCase().includes('itapira')) {
      termoBuscaCidade = 'itapi';
    } else if (CLIENTE.cidade && CLIENTE.cidade.toLowerCase().includes('tabo')) {
      termoBuscaCidade = 'taboa';
    }
    console.log(`   📍 Termo de busca cidade: "${termoBuscaCidade}" para encontrar "${CLIENTE.cidade}"`);
    await selecionarReactSelect(page, 2, termoBuscaCidade, CLIENTE.cidade, 'Cidade');
    await page.waitForTimeout(1500);
    
    // 4. POLO
    console.log(`   📝 Selecionando Polo: ${CLIENTE.polo}...`);
    await selecionarReactSelect(page, 3, CLIENTE.polo, CLIENTE.polo, 'Polo');
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
    // debug screenshot salvo silenciosamente
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
    let dropdownVisivel = await selectCampanha.isVisible({ timeout: 5000 }).catch(() => false);
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
          dropdownVisivel = true;
          console.log(`   ✅ Dropdown encontrado via: ${sel}`);
          break;
        }
      }
    }
    
    // Se ainda não encontrou dropdown, pode ser que campanha seja opcional ou já aplicada
    if (!dropdownVisivel) {
      console.log('   ⚠️ Dropdown de campanha não encontrado na página');
      console.log('   📍 Verificando se há botão para continuar ou se podemos ir para checkout...');
      
      // Tenta encontrar botão "Aplicar campanha" ou "Continuar" mesmo sem dropdown
      const botoesAvancar = [
        page.getByRole('button', { name: /Aplicar/i }),
        page.getByRole('button', { name: /Continuar/i }),
        page.getByRole('button', { name: /Prosseguir/i }),
        page.locator('button:has-text("Aplicar")').first(),
        page.locator('button:has-text("Continuar")').first(),
        page.locator('a:has-text("Continuar")').first(),
      ];
      
      let clicouBotaoAvancar = false;
      for (const btn of botoesAvancar) {
        try {
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ force: true });
            console.log('   ✅ Botão para avançar encontrado e clicado');
            clicouBotaoAvancar = true;
            await page.waitForTimeout(3000);
            break;
          }
        } catch (e) {}
      }
      
      // Se não encontrou botão, tenta navegar diretamente para checkout
      if (!clicouBotaoAvancar) {
        console.log('   📍 Nenhum botão encontrado, tentando ir direto para checkout...');
        try {
          await page.goto('https://cruzeirodosul.myvtex.com/checkout/#/cart', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(3000);
          console.log('   ✅ Navegou para checkout diretamente');
        } catch (e) {
          console.log(`   ⚠️ Erro ao navegar para checkout: ${e.message}`);
        }
      }
      
      // Pula o resto da lógica de campanha
      console.log('✅ ETAPA 7 CONCLUÍDA (campanha pulada ou já aplicada)');
      console.log('');
    } else {
    
    // Tira screenshot para debug
    try {
      await page.screenshot({ path: 'debug-campanha-antes-click.png', fullPage: true });
      // debug screenshot salvo silenciosamente
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
    
    // Alvos para comparação
    const matriculaAlvo = parseFloat(CLIENTE.matricula);
    const mensalidadeAlvo = parseFloat(CLIENTE.mensalidade);
    const TOLERANCIA = 1.00; // R$ 1 de tolerância para match imediato
    
    console.log(`   🎯 Alvo: Matrícula R$ ${matriculaAlvo} | Mensalidade R$ ${mensalidadeAlvo} (tolerância R$ ${TOLERANCIA})`);
    
    // Testa cada campanha e PARA ao encontrar match dentro da tolerância
    let melhorCampanha = null;
    let menorDiferenca = Infinity;
    let campanhaExata = false;
    
    for (let i = 0; i < listaCampanhas.length; i++) {
      const textoOpcao = listaCampanhas[i];
      
      // Extrai o código da campanha (ex: "2542" de "2542 - Balcão 10%CT - Pós EAD")
      const codigoCampanha = textoOpcao.split(' - ')[0].trim();
      
      console.log(`   📝 Testando campanha ${i + 1}/${listaCampanhas.length}: ${textoOpcao.substring(0, 60)}...`);
      
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
      
      if (valores.matricula !== null && valores.mensalidade !== null) {
        const diffMatricula = Math.abs(valores.matricula - matriculaAlvo);
        const diffMensalidade = Math.abs(valores.mensalidade - mensalidadeAlvo);
        
        // Verifica se matrícula está OK (tolerância R$ 5)
        if (diffMatricula <= 5) {
          // Atualiza melhor campanha se essa tem mensalidade mais próxima
          if (diffMensalidade < menorDiferenca) {
            menorDiferenca = diffMensalidade;
            melhorCampanha = {
              codigo: codigoCampanha,
              nome: textoOpcao,
              matricula: valores.matricula,
              mensalidade: valores.mensalidade,
              parcelas: valores.parcelas
            };
          }
          
          // MATCH EXATO (dentro da tolerância): para imediatamente!
          if (diffMatricula <= TOLERANCIA && diffMensalidade <= TOLERANCIA) {
            console.log(`      ✅ MATCH EXATO! Matrícula diff: R$ ${diffMatricula.toFixed(2)} | Mensalidade diff: R$ ${diffMensalidade.toFixed(2)}`);
            campanhaExata = true;
            break; // Para de buscar - encontrou a campanha ideal
          }
        }
      }
    }
    
    console.log('');
    
    if (melhorCampanha) {
      campanhaEscolhida = melhorCampanha.codigo;
      
      if (campanhaExata) {
        console.log(`   ✅ CAMPANHA ENCONTRADA (match exato): ${melhorCampanha.codigo} - ${melhorCampanha.nome.substring(0, 50)}...`);
      } else {
        console.log(`   ✅ MELHOR CAMPANHA: ${melhorCampanha.codigo} - ${melhorCampanha.nome.substring(0, 50)}...`);
      }
      console.log(`      💰 Matrícula: R$ ${melhorCampanha.matricula} | Mensalidade: R$ ${melhorCampanha.mensalidade}`);
      console.log(`      📊 Diferença da mensalidade alvo: R$ ${menorDiferenca.toFixed(2)}`);
      
      // Se não foi a última campanha testada, precisa re-selecionar
      if (!campanhaExata) {
        await selectCampanha.click();
        await page.waitForTimeout(500);
        await page.keyboard.type(melhorCampanha.codigo, { delay: 50 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
      // Se foi match exato, já está selecionada (foi a última ação no loop)
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
  } // Fecha o else do dropdown visível
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
  
  // ══════════════════════════════════════════════════════════════════════
  // Detecta popup "Aviso Importante" / inconsistência no cadastro
  // Se detectado, PARA o fluxo e retorna erro (não continua a inscrição)
  // ══════════════════════════════════════════════════════════════════════
  try {
    // Verifica especificamente "Aviso Importante" e "inconsistência"
    const avisoImportante = page.locator('text=Aviso Importante').first();
    const inconsistencia = page.locator('text=/inconsist/i').first();
    const atencao = page.locator('text=Atenção').first();
    
    let popupBloqueante = false;
    let mensagemPopup = '';
    
    // Checa os textos-chave do popup
    const temAviso = await avisoImportante.isVisible({ timeout: 3000 }).catch(() => false);
    const temInconsistencia = await inconsistencia.isVisible({ timeout: 1000 }).catch(() => false);
    const temAtencao = await atencao.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (temAviso || temInconsistencia || temAtencao) {
      console.log('   📍 Popup detectado!');
      
      // Captura TODO o texto visível da página (o popup está por cima)
      mensagemPopup = await page.evaluate(() => {
        // Estratégia 1: Buscar todos os elementos visíveis que contenham texto relevante
        const todosElementos = document.querySelectorAll('*');
        const textos = [];
        
        for (const el of todosElementos) {
          if (el.offsetParent === null) continue;
          if (['SCRIPT', 'STYLE', 'META', 'LINK'].includes(el.tagName)) continue;
          
          // Pega texto direto (sem filhos) para evitar duplicação
          const textoDirecto = Array.from(el.childNodes)
            .filter(n => n.nodeType === 3) // TEXT_NODE
            .map(n => n.textContent.trim())
            .filter(t => t.length > 0)
            .join(' ');
          
          if (textoDirecto && (
            textoDirecto.toLowerCase().includes('aviso') ||
            textoDirecto.toLowerCase().includes('inconsist') ||
            textoDirecto.toLowerCase().includes('cadastro') ||
            textoDirecto.toLowerCase().includes('contato') ||
            textoDirecto.toLowerCase().includes('verificamos')
          )) {
            textos.push(textoDirecto);
          }
        }
        
        if (textos.length > 0) return textos.join(' ').substring(0, 500);
        
        // Estratégia 2: Pega texto do overlay/modal mais próximo
        const overlays = document.querySelectorAll(
          '[class*="modal"], [class*="overlay"], [class*="popup"], [class*="dialog"], ' +
          '[class*="alert"], [class*="aviso"], [role="dialog"], [role="alertdialog"]'
        );
        for (const ov of overlays) {
          if (ov.offsetParent !== null) {
            const t = ov.textContent?.trim().replace(/\s+/g, ' ').substring(0, 500);
            if (t && t.length > 10) return t;
          }
        }
        
        return '';
      }).catch(() => '');
      
      // Se não capturou texto via JS, tenta via Playwright
      if (!mensagemPopup) {
        if (temAviso) {
          const parent = avisoImportante.locator('xpath=ancestor::*[3]');
          mensagemPopup = await parent.textContent().catch(() => '');
          mensagemPopup = mensagemPopup?.trim().replace(/\s+/g, ' ').substring(0, 500) || '';
        }
      }
      
      // Fallback hardcoded se nada funcionou mas sabemos que o popup existe
      if (!mensagemPopup && (temAviso || temInconsistencia)) {
        mensagemPopup = 'Aviso Importante: Verificamos que há alguma inconsistência em seu cadastro.';
      }
      
      console.log(`   📋 Mensagem: ${mensagemPopup}`);
      
      // Screenshot do popup
      await page.screenshot({ path: `debug-aviso-importante-${Date.now()}.png`, fullPage: true }).catch(() => {});
      
      // Verifica se é um popup bloqueante (inconsistência)
      const msgLower = mensagemPopup.toLowerCase();
      if (msgLower.includes('inconsist') || msgLower.includes('aviso importante') || msgLower.includes('cadastro')) {
        popupBloqueante = true;
        console.log(`ALERTA_INSCRICAO: ${mensagemPopup}`);
        console.log('   ❌ Popup de inconsistência detectado - inscrição não pode prosseguir');
        
        // Clica em OK para fechar
        const btnOk = page.locator('button:has-text("Ok"), button:has-text("OK")').first();
        if (await btnOk.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btnOk.click({ force: true });
          console.log('   ✅ Clicou em OK');
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
        
        // ENCERRA O TESTE - não continua a inscrição
        return;
      }
      
      // Se não é bloqueante, apenas fecha
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao verificar popup: ${e.message.split('\n')[0]}`);
  }
  
  // Clica em "Seguir para o carrinho" ou "Continuar Inscrição"
  console.log('   📝 Clicando para ir ao checkout...');
  console.log(`   📍 URL atual: ${page.url()}`);
  
  let btnClicado = false;
  
  // Espera o botão aparecer e fecha aviso de "Atenção" se existir
  await page.waitForTimeout(2000);
  
  // Fecha aviso "Atenção" se existir (não é bloqueante, é só informativo)
  try {
    const fecharAviso = page.locator('.vtex-modal__close, button[aria-label="close"], .close-button').first();
    if (await fecharAviso.isVisible({ timeout: 1000 })) {
      await fecharAviso.click();
      console.log('   📍 Fechou aviso informativo');
      await page.waitForTimeout(500);
    }
  } catch (e) {}
  
  // PRIORIDADE MÁXIMA: Botão "Continuar Inscrição" na página do carrinho (com ícone de carrinho)
  if (!btnClicado) {
    try {
      // Seletores específicos para a página "Meu Carrinho" / "Resumindo a inscrição"
      const seletoresContinuarInscricao = [
        page.locator('button:has-text("Continuar Inscrição")').first(),
        page.locator('a:has-text("Continuar Inscrição")').first(),
        page.getByRole('button', { name: /Continuar Inscrição/i }),
        page.getByRole('link', { name: /Continuar Inscrição/i }),
        page.locator('[class*="summary"] button, [class*="summary"] a').filter({ hasText: /Continuar/i }).first(),
        page.locator('[class*="checkout-button"], [class*="checkoutButton"]').first(),
      ];
      
      for (const btn of seletoresContinuarInscricao) {
        try {
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);
            await btn.click({ force: true });
            console.log('   ✅ Botão "Continuar Inscrição" clicado (carrinho)');
            btnClicado = true;
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  // SEGUNDA PRIORIDADE: "Continuar pagamento" (gravação)
  if (!btnClicado) {
    try {
      const linkPagamento = page.getByRole('link', { name: 'Continuar pagamento Continuar' });
      if (await linkPagamento.isVisible({ timeout: 2000 })) {
        await linkPagamento.click();
        console.log('   ✅ Link "Continuar pagamento" clicado');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // TERCEIRA PRIORIDADE: "Seguir para o carrinho" (página de campanha)
  if (!btnClicado) {
    try {
      const linkCarrinho = page.locator('a:has-text("Seguir para o carrinho"), text=Seguir para o carrinho').first();
      if (await linkCarrinho.isVisible({ timeout: 2000 })) {
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
      if (await btnVtex.isVisible({ timeout: 2000 })) {
        await btnVtex.scrollIntoViewIfNeeded();
        await btnVtex.click({ force: true });
        console.log('   ✅ Botão Continuar clicado (via classe VTEX)');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback: qualquer botão que contenha "Continuar"
  if (!btnClicado) {
    try {
      const btn = page.locator('button:has-text("Continuar"), a:has-text("Continuar")').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        console.log('   ✅ Botão Continuar clicado (fallback)');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback: tenta via JavaScript
  if (!btnClicado) {
    try {
      const clicouJS = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
          const texto = (btn.textContent || '').toLowerCase();
          if (texto.includes('continuar inscrição') || texto.includes('continuar inscricao')) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btn.click();
            return true;
          }
        }
        // Segunda passada: qualquer "continuar"
        for (const btn of btns) {
          const texto = (btn.textContent || '').toLowerCase();
          if (texto.includes('continuar') && !texto.includes('sem')) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (clicouJS) {
        console.log('   ✅ Botão clicado via JavaScript');
        btnClicado = true;
      }
    } catch (e) {}
  }
  
  // Fallback final: link Continuar
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
  
  // Se nenhum botão "Continuar" foi encontrado, tenta "Comprar" / "Adicionar ao carrinho" (página de produto)
  if (!btnClicado) {
    console.log('   ⚠️ Botão Continuar não encontrado, verificando se está na página de produto...');
    const urlAtualE8 = page.url();
    
    if (urlAtualE8.includes('/p') || urlAtualE8.match(/\/[^/]+-cruzeiro-do-sul/)) {
      console.log('   📍 Detectada página de produto VTEX, tentando "Comprar"...');
      
      // Tenta botão "Comprar" (padrão VTEX para página de produto)
      const botoesComprar = [
        page.getByRole('button', { name: /Comprar/i }),
        page.getByRole('link', { name: /Comprar/i }),
        page.locator('button:has-text("Comprar")').first(),
        page.locator('a:has-text("Comprar")').first(),
        page.locator('.vtex-button:has-text("Comprar")').first(),
        page.locator('[class*="buyButton"], [class*="buy-button"]').first(),
        page.getByRole('button', { name: /Adicionar ao carrinho/i }),
        page.locator('button:has-text("Adicionar")').first(),
        page.locator('[class*="add-to-cart"]').first(),
      ];
      
      for (const btn of botoesComprar) {
        try {
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ force: true });
            console.log('   ✅ Botão "Comprar" clicado na página de produto');
            btnClicado = true;
            break;
          }
        } catch (e) {}
      }
      
      // Fallback: tenta via JavaScript buscar qualquer botão com "Comprar" ou "Adicionar"
      if (!btnClicado) {
        try {
          const clicked = await page.evaluate(() => {
            const btns = document.querySelectorAll('button, a, [role="button"]');
            for (const btn of btns) {
              const texto = (btn.textContent || '').toLowerCase().trim();
              if ((texto.includes('comprar') || texto.includes('adicionar ao carrinho') || texto.includes('add to cart')) && btn.offsetParent !== null) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                btn.click();
                return texto;
              }
            }
            return null;
          });
          if (clicked) {
            console.log(`   ✅ Botão "${clicked}" clicado via JavaScript`);
            btnClicado = true;
          }
        } catch (e) {}
      }
    }
  }
  
  if (!btnClicado) {
    console.log('   ⚠️ Nenhum botão encontrado (Continuar nem Comprar) - tentando screenshot');
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
  
  // Verifica se realmente saiu da página anterior
  const urlAposClique = page.url();
  console.log(`   📍 URL após clique: ${urlAposClique}`);
  
  // Se ainda está na página de campanha ou produto, tenta novamente
  if (urlAposClique.includes('campanha-comercial') || (urlAposClique.includes('/p') && !urlAposClique.includes('checkout'))) {
    console.log('   ⚠️ Ainda na página anterior, tentando novamente...');
    
    // Segunda tentativa com mais força - busca qualquer botão de ação
    try {
      const btnTexto = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const alvos = ['continuar', 'comprar', 'seguir', 'carrinho', 'checkout', 'adicionar'];
        const btn = allButtons.find(b => {
          const texto = (b.textContent || '').toLowerCase();
          return alvos.some(alvo => texto.includes(alvo)) && !b.disabled && b.offsetParent !== null;
        });
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          btn.focus();
          btn.click();
          return btn.textContent?.trim().substring(0, 50);
        }
        return null;
      });
      if (btnTexto) {
        console.log(`   ✅ Botão "${btnTexto}" clicado na segunda tentativa`);
      }
      await page.waitForTimeout(8000);
      console.log(`   📍 URL após segunda tentativa: ${page.url()}`);
    } catch (e) {
      console.log(`   ⚠️ Segunda tentativa falhou: ${e.message}`);
    }
    
    // Última tentativa: navega direto para o checkout
    if (!page.url().includes('checkout')) {
      console.log('   🔄 Tentando navegar diretamente para o checkout...');
      try {
        await page.goto('https://cruzeirodosul.myvtex.com/checkout/', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
        console.log(`   📍 URL após navegação direta: ${page.url()}`);
      } catch (e) {
        console.log(`   ⚠️ Navegação direta falhou: ${e.message}`);
      }
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
    // debug screenshot salvo silenciosamente
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
  
  // (debug silencioso - botões do checkout)
  
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
  
  // Status checkout para decisão interna (log só se necessário debug)
  
  // Verifica se o botão "Ir para o Pagamento" ou "fake-button-go-to-shipping" está visível
  const btnFakeShipping = page.locator('#fake-button-go-to-shipping').first();
  const btnPagamento = page.locator('button:has-text("Ir para o Pagamento")').first();
  
  const fakeVisivel = await btnFakeShipping.isVisible({ timeout: 2000 }).catch(() => false);
  const pagamentoVisivel = await btnPagamento.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (fakeVisivel || pagamentoVisivel) {
    console.log('   ✅ Dados já preenchidos, navegando para Pagamento...');
    
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

  // ── Se estamos em #/profile, precisamos avançar para #/shipping ──
  const urlE10 = page.url();
  if (urlE10.includes('#/profile') || urlE10.includes('#/cart')) {
    console.log('   📍 Checkout está na etapa Profile/Cart, tentando avançar para Shipping...');
    
    for (let tentProfile = 1; tentProfile <= 5; tentProfile++) {
      console.log(`   🔄 Tentativa ${tentProfile}/5 de avançar para Shipping...`);
      
      // Diagnóstico: verificar campos e erros de validação
      const diagnostico = await page.evaluate(() => {
        const campos = {};
        const erros = [];
        
        // Verifica cada campo do perfil
        const email = document.querySelector('#client-email');
        const firstName = document.querySelector('#client-first-name');
        const lastName = document.querySelector('#client-last-name');
        const document_ = document.querySelector('#client-document');
        const phone = document.querySelector('#client-phone');
        
        campos.email = email ? { valor: email.value, visivel: email.offsetParent !== null, disabled: email.disabled } : null;
        campos.firstName = firstName ? { valor: firstName.value, visivel: firstName.offsetParent !== null, disabled: firstName.disabled } : null;
        campos.lastName = lastName ? { valor: lastName.value, visivel: lastName.offsetParent !== null, disabled: lastName.disabled } : null;
        campos.document = document_ ? { valor: document_.value, visivel: document_.offsetParent !== null, disabled: document_.disabled } : null;
        campos.phone = phone ? { valor: phone.value, visivel: phone.offsetParent !== null, disabled: phone.disabled } : null;
        
        // Verifica erros de validação
        const errorElements = document.querySelectorAll('.error, .field-error, [class*="error"]:not(script):not(style), .help.error');
        for (const el of errorElements) {
          if (el.offsetParent !== null && el.textContent?.trim()) {
            erros.push(el.textContent.trim().substring(0, 80));
          }
        }
        
        // Verifica se há campos obrigatórios com classe de erro
        const camposComErro = document.querySelectorAll('input.error, input.invalid, .form-group.has-error input');
        const camposErroIds = Array.from(camposComErro).map(el => el.id || el.name).filter(Boolean);
        
        return { campos, erros: [...new Set(erros)].slice(0, 5), camposErroIds };
      }).catch(() => ({ campos: {}, erros: [], camposErroIds: [] }));
      
      // Loga apenas erros de validação (campos detalhados só em debug)
      if (diagnostico.erros.length > 0) {
        console.log(`   ❌ Erros validação: ${diagnostico.erros.join(' | ')}`);
      }
      if (diagnostico.camposErroIds.length > 0) {
        console.log(`   ❌ Campos com erro: ${diagnostico.camposErroIds.join(', ')}`);
      }
      
      // FORÇAR preenchimento de TODOS os campos (não apenas os vazios)
      try {
        // Email - SEMPRE preencher se visível e habilitado
        const campoEmail = page.locator('#client-email').first();
        if (await campoEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
          const disabled = await campoEmail.getAttribute('disabled').catch(() => null);
          if (!disabled) {
            await campoEmail.click().catch(() => {});
            await campoEmail.fill('');
            await campoEmail.fill(CLIENTE.email);
            await campoEmail.press('Tab');
            console.log(`   ✅ Email: ${CLIENTE.email}`);
            await page.waitForTimeout(1500); // Aguardar validação de email do VTEX
          } else {
            console.log(`   ℹ️ Email desabilitado (já preenchido)`);
          }
        }
        
        // Primeiro Nome
        const campoNome = page.locator('#client-first-name').first();
        if (await campoNome.isVisible({ timeout: 1000 }).catch(() => false)) {
          const disabled = await campoNome.getAttribute('disabled').catch(() => null);
          if (!disabled) {
            await campoNome.click().catch(() => {});
            await campoNome.fill('');
            await campoNome.fill(CLIENTE.nome.split(' ')[0]);
            await campoNome.press('Tab');
            console.log(`   ✅ Nome: ${CLIENTE.nome.split(' ')[0]}`);
          }
        }
        
        // Sobrenome
        const campoSobrenome = page.locator('#client-last-name').first();
        if (await campoSobrenome.isVisible({ timeout: 1000 }).catch(() => false)) {
          const disabled = await campoSobrenome.getAttribute('disabled').catch(() => null);
          if (!disabled) {
            const partes = CLIENTE.nome.split(' ');
            const sobrenome = partes.length > 1 ? partes.slice(1).join(' ') : CLIENTE.nome;
            await campoSobrenome.click().catch(() => {});
            await campoSobrenome.fill('');
            await campoSobrenome.fill(sobrenome);
            await campoSobrenome.press('Tab');
            console.log(`   ✅ Sobrenome: ${sobrenome}`);
          }
        }
        
        // Documento (CPF)
        const campoDoc = page.locator('#client-document').first();
        if (await campoDoc.isVisible({ timeout: 1000 }).catch(() => false)) {
          const disabled = await campoDoc.getAttribute('disabled').catch(() => null);
          if (!disabled) {
            await campoDoc.click().catch(() => {});
            await campoDoc.fill('');
            await campoDoc.fill(CLIENTE.cpf);
            await campoDoc.press('Tab');
            console.log(`   ✅ CPF: ${CLIENTE.cpf}`);
          }
        }
        
        // Telefone
        const campoTel = page.locator('#client-phone').first();
        if (await campoTel.isVisible({ timeout: 1000 }).catch(() => false)) {
          const disabled = await campoTel.getAttribute('disabled').catch(() => null);
          if (!disabled) {
            await campoTel.click().catch(() => {});
            await campoTel.fill('');
            await campoTel.fill(CLIENTE.telefone);
            await campoTel.press('Tab');
            console.log(`   ✅ Telefone: ${CLIENTE.telefone}`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Erro preenchendo perfil: ${e.message.split('\n')[0]}`);
      }
      
      await page.waitForTimeout(2000);
      
      // Tenta clicar no botão para avançar (com fallbacks)
      const botoesAvancar = [
        '#go-to-shipping',
        '#btn-go-to-shipping',
        '#fake-button-go-to-shipping',
        'button.submit[data-i18n*="goToShipping"]',
        'a[href="#/shipping"]',
      ];
      
      let clicouAvancar = false;
      
      // Primeiro: tenta via JavaScript direto (mais confiável no VTEX)
      clicouAvancar = await page.evaluate((seletores) => {
        for (const sel of seletores) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) {
            el.click();
            return true;
          }
        }
        // Tenta por texto
        const buttons = document.querySelectorAll('button, a');
        for (const btn of buttons) {
          const txt = btn.textContent?.toLowerCase() || '';
          if ((txt.includes('ir para') && (txt.includes('entrega') || txt.includes('endereço'))) ||
              txt.includes('go to shipping')) {
            if (btn.offsetParent !== null) {
              btn.click();
              return true;
            }
          }
        }
        return false;
      }, botoesAvancar).catch(() => false);
      
      if (clicouAvancar) {
        console.log('   ✅ Clicou para avançar (via JS)');
      } else {
        // Fallback: tenta via Playwright
        for (const sel of botoesAvancar) {
          try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await btn.scrollIntoViewIfNeeded().catch(() => {});
              await btn.click({ force: true, timeout: 5000 });
              console.log(`   ✅ Clicou para avançar (Playwright: ${sel})`);
              clicouAvancar = true;
              break;
            }
          } catch (e) { /* próximo */ }
        }
      }
      
      await page.waitForTimeout(4000);
      
      // Verifica se avançou
      const urlApos = page.url();
      if (urlApos.includes('#/shipping') || urlApos.includes('#/payment')) {
        console.log(`   ✅ Avançou para: ${urlApos.split('#')[1]}`);
        break;
      }
      
      // Verifica se o campo CEP já está visível (mesmo sem mudar a URL)
      const cepVisivel = await page.locator('#ship-postalCode, input[name="postalCode"]').first()
        .isVisible({ timeout: 2000 }).catch(() => false);
      if (cepVisivel) {
        console.log('   ✅ Campo CEP já visível, prosseguindo...');
        break;
      }
      
      console.log(`   ⚠️ URL continua em: ${urlApos.split('#')[1] || urlApos}`);
      
      // Na tentativa 3+, tenta abordagens mais agressivas
      if (tentProfile >= 3) {
        console.log('   🔧 Tentando abordagem agressiva...');
        
        // Tenta usar a API VTEX para enviar os dados do profile diretamente
        const resultado = await page.evaluate((dados) => {
          try {
            // Tenta acessar a orderForm do VTEX
            if (window.vtexjs && window.vtexjs.checkout) {
              const orderForm = window.vtexjs.checkout.orderForm;
              if (orderForm && orderForm.orderFormId) {
                // Envia dados do profile via API
                return fetch(`/api/checkout/pub/orderForm/${orderForm.orderFormId}/attachments/clientProfileData`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: dados.email,
                    firstName: dados.nome,
                    lastName: dados.sobrenome,
                    document: dados.cpf,
                    documentType: 'cpf',
                    phone: dados.telefone,
                  })
                }).then(r => r.ok ? 'api-ok' : `api-erro-${r.status}`);
              }
            }
            return 'sem-vtexjs';
          } catch (e) {
            return `erro: ${e.message}`;
          }
        }, {
          email: CLIENTE.email,
          nome: CLIENTE.nome.split(' ')[0],
          sobrenome: CLIENTE.nome.split(' ').slice(1).join(' ') || CLIENTE.nome,
          cpf: CLIENTE.cpf.replace(/\D/g, ''),
          telefone: CLIENTE.telefone,
        }).catch(() => 'evaluate-erro');
        
        console.log(`   📋 Resultado API VTEX: ${resultado}`);
        await page.waitForTimeout(2000);
        
        // Força navegação via hash
        await page.evaluate(() => { window.location.hash = '#/shipping'; });
        console.log('   📍 Forçou navegação para #/shipping via hash');
        await page.waitForTimeout(3000);
        
        // Verifica se funcionou
        if (page.url().includes('#/shipping') || page.url().includes('#/payment')) {
          console.log(`   ✅ Avançou para: ${page.url().split('#')[1]}`);
          break;
        }
        
        // Se estamos na tentativa 4, tenta reload completo
        if (tentProfile === 4) {
          console.log('   🔄 Reload completo do checkout...');
          await page.screenshot({ path: `debug-profile-stuck-t${tentProfile}.png`, fullPage: true }).catch(() => {});
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(5000);
        }
      }
    }
  }
  
  await page.waitForTimeout(1000);
  console.log(`   📍 URL atual: ${page.url()}`);
  
  // Se AINDA está em #/profile após todas tentativas, faz último esforço
  if (page.url().includes('#/profile')) {
    console.log('   ⚠️ Ainda em #/profile! Tentando último esforço via API VTEX + hash...');
    
    // Tenta enviar profile via API do VTEX e navegar diretamente
    await page.evaluate(async (dados) => {
      try {
        if (window.vtexjs && window.vtexjs.checkout && window.vtexjs.checkout.orderForm) {
          const ofId = window.vtexjs.checkout.orderForm.orderFormId;
          await fetch(`/api/checkout/pub/orderForm/${ofId}/attachments/clientProfileData`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: dados.email,
              firstName: dados.nome,
              lastName: dados.sobrenome,
              document: dados.cpf,
              documentType: 'cpf',
              phone: dados.telefone,
            })
          });
        }
      } catch (e) {}
      window.location.hash = '#/shipping';
    }, {
      email: CLIENTE.email,
      nome: CLIENTE.nome.split(' ')[0],
      sobrenome: CLIENTE.nome.split(' ').slice(1).join(' ') || CLIENTE.nome,
      cpf: CLIENTE.cpf.replace(/\D/g, ''),
      telefone: CLIENTE.telefone,
    }).catch(() => {});
    
    await page.waitForTimeout(5000);
    console.log(`   📍 URL após último esforço: ${page.url()}`);
  }
  
  // Screenshot para debug
  try {
    await page.screenshot({ path: 'debug-etapa10-endereco.png', fullPage: true });
  } catch (e) {}
  
  // Verifica se o endereço já está preenchido
  const enderecoJaPreenchido = await page.evaluate(() => {
    const secaoEndereco = document.querySelector('#shipping-data, .shipping-data');
    if (secaoEndereco) {
      const texto = secaoEndereco.textContent || '';
      if (texto.match(/\d{5}-?\d{3}/) || texto.includes('São Paulo') || texto.includes('Brasil')) {
        return true;
      }
    }
    const secaoPagamento = document.querySelector('#payment-data');
    if (secaoPagamento && secaoPagamento.offsetParent !== null) {
      return true;
    }
    return false;
  });
  
  // Verifica botão "Calcular"
  const btnCalcular = page.locator('#shipping-calculate-link, button:has-text("Calcular")').first();
  const calculaVisivel = await btnCalcular.isVisible({ timeout: 2000 }).catch(() => false);

  if (enderecoJaPreenchido && !calculaVisivel) {
    console.log('   ✅ Endereço já preenchido e validado');
  } else {
    console.log('   📝 Preenchendo CEP e Número...');

    // Preenche CEP
    const seletoresCep = [
      '#ship-postalCode',
      'input[name="postalCode"]',
      'input[id*="postalCode"]',
      'input[placeholder*="CEP" i]',
      'input[label*="CEP" i]'
    ];

    let cepPreenchido = false;
    for (const sel of seletoresCep) {
      try {
        const campo = page.locator(sel).first();
        if (await campo.isVisible({ timeout: 2000 }).catch(() => false)) {
          await campo.scrollIntoViewIfNeeded().catch(() => {});
          await campo.click();
          await campo.fill('');
          await campo.type(CLIENTE.cep, { delay: 50 });
          await campo.press('Tab');
          console.log(`   ✅ CEP preenchido: ${CLIENTE.cep} (via ${sel})`);
          cepPreenchido = true;
          break;
        }
      } catch (e) {}
    }
    if (!cepPreenchido) {
      console.log('   ⚠️ Campo CEP não encontrado');
    }

    // Aguarda endereço carregar (a busca é acionada pelo Tab/blur do campo CEP)
    await page.waitForTimeout(3000);

    // Clica em "Calcular" se visível (em alguns layouts o botão aparece)
    const btnCalc = page.locator('#shipping-calculate-link, button:has-text("Calcular")').first();
    const calcVisivel = await btnCalc.isVisible({ timeout: 3000 }).catch(() => false);
    if (calcVisivel) {
      console.log('   📝 Clicando em "Calcular" (validar endereço)...');
      try {
        await btnCalc.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
      } catch (e) {}
      try {
        await btnCalc.click({ timeout: 5000 });
      } catch (e) {
        try {
          await btnCalc.click({ force: true, timeout: 5000 });
        } catch (e2) {
          await page.evaluate(() => {
            const btn = document.querySelector('#shipping-calculate-link');
            if (btn) btn.click();
          });
        }
      }
      await page.waitForTimeout(5000);
      console.log('   ✅ Endereço validado');
    } else {
      // Sem botão Calcular visível, tenta acionar busca via API VTEX
      console.log('   📝 Botão Calcular não visível, tentando busca de endereço via API VTEX...');
      const apiResult = await page.evaluate(async (cep) => {
        try {
          if (window.vtexjs && window.vtexjs.checkout && window.vtexjs.checkout.orderForm) {
            const ofId = window.vtexjs.checkout.orderForm.orderFormId;
            const r = await fetch(`/api/checkout/pub/orderForm/${ofId}/attachments/shippingData`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: {
                  postalCode: cep,
                  country: 'BRA'
                }
              })
            });
            return r.ok ? 'api-ok' : `api-erro-${r.status}`;
          }
          return 'sem-vtexjs';
        } catch (e) { return `erro: ${e.message}`; }
      }, CLIENTE.cep).catch(() => 'evaluate-erro');
      console.log(`   📋 Resultado busca endereço: ${apiResult}`);
      await page.waitForTimeout(5000);
    }

    // Preenche Número (aparece após CEP ser validado)
    const seletoresNum = [
      '#ship-number',
      'input[name="number"]',
      'input[id*="number"][id*="ship"]',
      'input[placeholder*="Número" i]',
      '.ship-number input',
      '#shipping-data input[name="number"]'
    ];

    let numPreenchido = false;
    
    // Aguarda o campo número aparecer (pode demorar após busca do CEP)
    for (let tentNum = 1; tentNum <= 3; tentNum++) {
      for (const sel of seletoresNum) {
        try {
          const campo = page.locator(sel).first();
          if (await campo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await campo.scrollIntoViewIfNeeded().catch(() => {});
            await campo.click();
            await campo.fill('');
            await campo.type(CLIENTE.numero, { delay: 50 });
            console.log(`   ✅ Número preenchido: ${CLIENTE.numero} (via ${sel})`);
            numPreenchido = true;
            break;
          }
        } catch (e) {}
      }
      if (numPreenchido) break;
      
      if (tentNum < 3) {
        console.log(`   🔄 Campo Número não visível, aguardando (tentativa ${tentNum}/3)...`);
        await page.waitForTimeout(3000);
      }
    }
    
    // Fallback: preenche Número via API VTEX
    if (!numPreenchido) {
      console.log('   ⚠️ Campo Número não encontrado nos seletores, tentando via API VTEX...');
      const numResult = await page.evaluate(async (dados) => {
        try {
          if (window.vtexjs && window.vtexjs.checkout && window.vtexjs.checkout.orderForm) {
            const ofId = window.vtexjs.checkout.orderForm.orderFormId;
            const address = window.vtexjs.checkout.orderForm.shippingData?.address || {};
            const r = await fetch(`/api/checkout/pub/orderForm/${ofId}/attachments/shippingData`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: {
                  ...address,
                  postalCode: dados.cep,
                  number: dados.numero,
                  country: 'BRA'
                }
              })
            });
            return r.ok ? 'api-ok' : `api-erro-${r.status}`;
          }
          return 'sem-vtexjs';
        } catch (e) { return `erro: ${e.message}`; }
      }, { cep: CLIENTE.cep, numero: CLIENTE.numero }).catch(() => 'evaluate-erro');
      console.log(`   📋 Número via API VTEX: ${numResult}`);
      if (numResult === 'api-ok') {
        numPreenchido = true;
        console.log(`   ✅ Número ${CLIENTE.numero} enviado via API VTEX`);
      }
    }
    
    if (!numPreenchido) {
      console.log('   ⚠️ Campo Número não encontrado por nenhum método');
    }

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
  
  // Screenshot para debug (silencioso)
  await page.screenshot({ path: 'debug-etapa11-pagamento.png', fullPage: true }).catch(() => {});
  
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
    // Captura orderFormId do VTEX (NÃO é o nº de inscrição acadêmica do SIAA)
    const ogMatch = urlFinal.match(/og=(\d+)/);
    const vtexOrderFormId = ogMatch ? ogMatch[1] : null;

    // Extrai número de inscrição REAL do SIAA.
    // Estratégia: abre a aba do SIAA via "Realizar pagamento", preenche CPF + Próximo,
    // captura nrInscricao da URL final (matricula-unificada.jsp?...&nrInscricao=NNNNN)
    // e fecha a aba ANTES de qualquer botão que gere boleto/cartão.
    try {
      await page.waitForTimeout(2500);

      // Tentativa 1 (rápida): href já tem nrInscricao? (raro, mas barato testar)
      const seletoresLinkSiaa = [
        page.getByRole('link', { name: 'Realizar pagamento' }),
        page.locator('a:has-text("Realizar pagamento")').first(),
        page.locator('a[href*="nrInscricao"]').first(),
      ];
      for (const linkLocator of seletoresLinkSiaa) {
        try {
          if (await linkLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
            const href = await linkLocator.getAttribute('href').catch(() => null);
            if (href) {
              const matchNr = href.match(/[?&]nrInscricao=(\d+)/i);
              if (matchNr) {
                numeroInscricao = matchNr[1];
                console.log(`📋 Número de Inscrição SIAA (via href): ${numeroInscricao}`);
                break;
              }
            }
          }
        } catch (e) {}
      }

      // Tentativa 2: abre a aba do SIAA e preenche CPF para chegar na página de aprovação
      if (!numeroInscricao) {
        const linkPag = page.getByRole('link', { name: 'Realizar pagamento' }).first();
        if (await linkPag.isVisible({ timeout: 1500 }).catch(() => false)) {
          console.log('   📝 Abrindo aba SIAA para extrair nrInscricao...');
          const [siaaTabSkip] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 12000 }).catch(() => null),
            linkPag.click().catch(() => {}),
          ]);

          if (siaaTabSkip) {
            try {
              await siaaTabSkip.waitForLoadState('domcontentloaded', { timeout: 10000 });
              await siaaTabSkip.waitForTimeout(1500);

              try {
                const campoCpf = siaaTabSkip.locator('input[id*="cpf"], input[name*="cpf"], input[placeholder*="CPF" i]').first();
                if (await campoCpf.isVisible({ timeout: 4000 }).catch(() => false)) {
                  await campoCpf.click();
                  await campoCpf.fill(CLIENTE.cpf);
                  console.log(`   ✅ CPF preenchido no SIAA: ${CLIENTE.cpf}`);
                }
              } catch (e) {}

              try {
                const btnProximo = siaaTabSkip.getByRole('button', { name: /Pr[óo]ximo/i }).first();
                if (await btnProximo.isVisible({ timeout: 4000 }).catch(() => false)) {
                  await btnProximo.click();
                  console.log('   ✅ Clicou "Próximo" no SIAA');
                  await siaaTabSkip.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                  await siaaTabSkip.waitForTimeout(3500);
                }
              } catch (e) {}

              const urlSiaaFinal = siaaTabSkip.url();
              console.log(`   🔗 URL SIAA pós-Próximo: ${urlSiaaFinal}`);
              const matchUrl = urlSiaaFinal.match(/[?&]nrInscricao=(\d+)/i);
              if (matchUrl) {
                numeroInscricao = matchUrl[1];
                console.log(`📋 Número de Inscrição SIAA (via URL): ${numeroInscricao}`);
              } else {
                const textoBody = await siaaTabSkip.locator('body').textContent().catch(() => '');
                const matchTexto = textoBody && textoBody.match(/N[ºo°]\s*(?:DE\s*)?INSCRI[CÇ][AÃ]O\s*:?\s*(\d{6,})/i);
                if (matchTexto) {
                  numeroInscricao = matchTexto[1];
                  console.log(`📋 Número de Inscrição SIAA (via texto): ${numeroInscricao}`);
                } else {
                  console.log('   ⚠️ nrInscricao não encontrado na URL nem no texto do SIAA');
                }
              }
            } catch (e) {
              console.log(`   ⚠️ Erro ao processar SIAA: ${e.message}`);
            } finally {
              await siaaTabSkip.close().catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.log(`   ⚠️ Falha ao tentar extrair nrInscricao do SIAA: ${e.message}`);
    }

    // Se ainda não encontrou nº SIAA, mantém o orderFormId como fallback (compatibilidade)
    if (!numeroInscricao) {
      numeroInscricao = vtexOrderFormId;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🎉 INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADA COM SUCESSO!');
    if (numeroInscricao) {
      console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
    }
    if (vtexOrderFormId && vtexOrderFormId !== numeroInscricao) {
      console.log(`📋 OrderFormId VTEX: ${vtexOrderFormId}`);
    }
    console.log(`📋 Campanha aplicada: ${CLIENTE.campanha}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');

    // Após orderPlaced: concluir só a inscrição no VTEX (sem SIAA, boleto ou telas extras como cadastro de cota).
    // Ative com POS_SKIP_PAGAMENTO_SIAA=1 (padrão na rota /inscricao-pos/sync do server.js).
    const skipSiaa =
      process.env.POS_SKIP_PAGAMENTO_SIAA === '1' ||
      process.env.POS_SKIP_PAGAMENTO_SIAA === 'true' ||
      process.env.POS_SKIP_PAGAMENTO_SIAA === 'yes';
    if (skipSiaa) {
      console.log('PROCESSO COMPLETO DE INSCRIÇÃO PÓS-GRADUAÇÃO');
      if (numeroInscricao) {
        console.log(`NUMERO_INSCRICAO_EXTRAIDO: ${numeroInscricao}`);
      }
      if (vtexOrderFormId) {
        console.log(`VTEX_ORDERFORM_ID: ${vtexOrderFormId}`);
      }
      console.log('STATUS_INSCRICAO: INSCRICAO_POS_SUCESSO_APENAS_VTEX');
      console.log('ℹ️ Inscrição encerrada no VTEX (SIAA/pagamento não executados).');
      return;
    }
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
  // debug screenshot salvo silenciosamente
  
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
        const nomeErro = CLIENTE.nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cpf3Erro = CLIENTE.cpf.replace(/\D/g, '').substring(0, 3);
        const screenshotErroPath = `erro-${nomeErro}-${cpf3Erro}-${timestampErro}.png`;
        try {
          await siaaPage.screenshot({ path: screenshotErroPath, fullPage: true, timeout: 15000 });
          console.log(`   ✅ Screenshot de erro salvo: ${screenshotErroPath}`);
        } catch (screenshotErr) {
          console.log(`   ⚠️ Screenshot falhou (fontes): ${screenshotErr.message}`);
        }
        
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
    try {
      await siaaPage.screenshot({ path: `erro-modal-${Date.now()}.png`, fullPage: true, timeout: 15000 });
    } catch (screenshotErr) {
      console.log(`   ⚠️ Screenshot modal falhou: ${screenshotErr.message}`);
    }
  }
  
  // Verifica se está na página de aprovação
  const textoAprovado = siaaPage.locator('text=Parabéns').first();
  
  // Define os caminhos dos arquivos de saída (nome amigável: primeiroNome-3cpf-data)
  const primeiroNome = CLIENTE.nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cpf3 = CLIENTE.cpf.replace(/\D/g, '').substring(0, 3);
  const dataHoje = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefixoArquivo = `${primeiroNome}-${cpf3}-${dataHoje}`;
  // Nomes dos arquivos (usados nos console.log para o server.js extrair)
  const screenshotFilename = `aprovacao-${prefixoArquivo}.png`;
  const boletoFilename = `boleto-${prefixoArquivo}.pdf`;
  // Caminhos completos (pasta padrão arquivos/)
  const screenshotPath = path.join(ARQUIVOS_DIR, screenshotFilename);
  const boletoPath = path.join(ARQUIVOS_DIR, boletoFilename);
  
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
      try {
        await siaaPage.screenshot({ 
          path: screenshotPath, 
          clip: clipArea,
          timeout: 15000
        });
        console.log(`   ✅ Screenshot aprovação salvo: ${screenshotPath}`);
      } catch (screenshotErr) {
        console.log(`   ⚠️ Screenshot com clip falhou, tentando fullPage...`);
        try {
          await siaaPage.screenshot({ path: screenshotPath, fullPage: false, timeout: 15000 });
          console.log(`   ✅ Screenshot aprovação (fallback) salvo: ${screenshotPath}`);
        } catch (screenshotErr2) {
          console.log(`   ⚠️ Screenshot falhou completamente: ${screenshotErr2.message}`);
        }
      }
      
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
      try {
        await siaaPage.screenshot({ path: screenshotPath, fullPage: false, timeout: 15000 });
      } catch (screenshotErr) {
        console.log(`   ⚠️ Screenshot falhou (fontes não carregaram): ${screenshotErr.message}`);
      }
      
      // Se não há resultados após retries, pula a geração do boleto
      if (!resultadosDisponiveis) {
        console.log('   📋 SIAA ainda processando - não é possível gerar boleto neste momento');
        console.log('   💡 O aluno pode acessar o boleto posteriormente pelo link "Realizar pagamento"');
        console.log('✅ ETAPA 14 CONCLUÍDA (com pendência de sincronização SIAA)');
        console.log('');
        
        // ═══════════════════════════════════════════════════════════════════════════
        // RESUMO FINAL - SIAA NÃO VINCULADO (é SUCESSO se tem número de inscrição!)
        // ═══════════════════════════════════════════════════════════════════════════
        const temNumeroInscricaoSiaa = numeroInscricao && numeroInscricao.trim() !== '';
        const statusInscricaoSiaa = temNumeroInscricaoSiaa 
          ? 'INSCRICAO_POS_SUCESSO_SIAA_PENDENTE' 
          : 'INSCRICAO_POS_ERRO';
        const statusDescricaoSiaa = temNumeroInscricaoSiaa
          ? 'Inscrição concluída (SIAA aguardando sincronização - boleto/cartão disponível posteriormente)'
          : 'Inscrição NÃO foi concluída - sem número de inscrição';
        
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log(`🎯 STATUS: ${statusInscricaoSiaa}`);
        console.log(`📋 ${statusDescricaoSiaa}`);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log(`📋 Número de Inscrição: ${numeroInscricao || 'NÃO GERADO'}`);
        console.log(`📋 CPF: ${CLIENTE.cpf}`);
        console.log(`📋 Nome: ${CLIENTE.nome}`);
        console.log(`📋 Email: ${CLIENTE.email}`);
        console.log(`📋 Curso: ${CLIENTE.curso}`);
        console.log(`📋 Campanha: ${CLIENTE.campanha}`);
        console.log(`📋 Status SIAA: Aguardando sincronização`);
        console.log(`📸 Screenshot aprovação: ${screenshotFilename}`);
        console.log(`📄 Boleto: NÃO GERADO (SIAA pendente)`);
        console.log(`💳 Link Cartão de Crédito: NÃO GERADO (SIAA pendente)`);
        console.log('───────────────────────────────────────────────────────────────────────────');
        // Outputs estruturados para o N8N parsear
        console.log(`STATUS_INSCRICAO: ${statusInscricaoSiaa}`);
        console.log(`NUMERO_INSCRICAO: ${numeroInscricao || ''}`);
        console.log(`BOLETO_GERADO: NAO`);
        console.log(`LINK_CARTAO_GERADO: NAO`);
        console.log(`SIAA_STATUS: AGUARDANDO_SINCRONIZACAO`);
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
            formData.append('status_inscricao', statusInscricaoSiaa);
            formData.append('status_siaa', 'aguardando_sincronizacao');
            formData.append('boleto_gerado', 'NAO');
            formData.append('link_cartao_gerado', 'NAO');
            
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
        
        // Se a inscrição não foi concluída, lança erro
        if (!temNumeroInscricaoSiaa) {
          throw new Error(`INSCRICAO_POS_ERRO: Inscrição não foi concluída - sem número de inscrição`);
        }
        
        return; // Encerra o teste aqui quando SIAA não tem resultados (mas inscrição OK)
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao capturar aprovação: ${e.message}`);
    try {
      await siaaPage.screenshot({ path: screenshotPath, fullPage: false, timeout: 15000 });
    } catch (screenshotErr) {
      console.log(`   ⚠️ Screenshot de fallback também falhou: ${screenshotErr.message}`);
    }
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
      try {
        await siaaPage.screenshot({ path: 'debug-cartao-nao-encontrado.png', fullPage: true, timeout: 15000 });
      } catch (e) {}
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
    try {
      await siaaPage.screenshot({ path: 'debug-antes-emitir-boleto.png', fullPage: true, timeout: 15000 });
    } catch (e) {}
    
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
        try {
          await siaaPage.screenshot({ path: 'debug-sem-botao-boleto.png', fullPage: true, timeout: 15000 });
        } catch (e) {}
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Erro ao emitir boleto: ${e.message}`);
    console.log(`   📍 Stack: ${e.stack?.split('\n')[1] || 'N/A'}`);
    
    try {
      await siaaPage.screenshot({ path: `erro-boleto-${timestamp}.png`, fullPage: true, timeout: 15000 });
    } catch (e2) {}
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SALVAR BOLETO PDF - com múltiplas tentativas e fallbacks
  // ═══════════════════════════════════════════════════════════════════════════
  let boletoPdfSalvo = false;
  
  // MÉTODO 1: PDF capturado via interceptação de rede
  if (pdfBoletoBuffer && pdfBoletoBuffer.length > 500) {
    try {
      fs.writeFileSync(boletoPath, pdfBoletoBuffer);
      const stats = fs.statSync(boletoPath);
      const isPdf = pdfBoletoBuffer.slice(0, 5).toString().includes('%PDF');
      if (isPdf && stats.size > 1000) {
        console.log(`   ✅ Boleto PDF salvo via interceptação: ${stats.size} bytes`);
        boletoPdfSalvo = true;
      } else {
        console.log(`   ⚠️ Interceptação capturou ${stats.size} bytes mas não é PDF válido, tentando download direto...`);
        fs.unlinkSync(boletoPath);
      }
    } catch (e) {
      console.log(`   ⚠️ Erro ao salvar interceptação: ${e.message}`);
    }
  }
  
  // MÉTODO 2: Download direto via URL do boleto (com retry 3x)
  // Se o listener não capturou URL, usa a URL da página do boleto
  if (!pdfBoletoUrl && boletoPage) {
    const boletoPageUrl = boletoPage.url();
    console.log(`   📌 Listener não capturou URL, usando URL da página: ${boletoPageUrl.substring(0, 100)}`);
    pdfBoletoUrl = boletoPageUrl;
  }
  
  if (!boletoPdfSalvo && pdfBoletoUrl) {
    console.log('   🔄 MÉTODO 2: Download direto do PDF (3 tentativas)...');
    
    // Coleta URLs únicas para tentar
    const urlsParaTentar = [pdfBoletoUrl];
    if (boletoPage && boletoPage.url() !== pdfBoletoUrl) {
      urlsParaTentar.push(boletoPage.url());
    }
    
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      if (boletoPdfSalvo) break;
      const urlAtual = urlsParaTentar[Math.min(tentativa - 1, urlsParaTentar.length - 1)];
      
      // --- Abordagem A: context().request.get (usa cookies da sessão do browser) ---
      try {
        console.log(`   📥 Tentativa ${tentativa}/3 (API request): ${urlAtual.substring(0, 100)}...`);
        
        const response = await siaaPage.context().request.get(urlAtual);
        const statusCode = response.status();
        const contentType = response.headers()['content-type'] || '';
        const body = await response.body();
        
        console.log(`      Resposta: status=${statusCode}, type=${contentType}, size=${body ? body.length : 0}`);
        
        if (body && body.length > 1000) {
          const isPdf = body.slice(0, 5).toString().includes('%PDF');
          if (isPdf || contentType.includes('pdf') || contentType.includes('octet-stream')) {
            fs.writeFileSync(boletoPath, body);
            console.log(`   ✅ Download (API): ${body.length} bytes, PDF: ${isPdf}`);
            boletoPdfSalvo = true;
            break;
          } else {
            console.log(`      Conteúdo não é PDF (primeiros bytes: ${body.slice(0, 20).toString()})`);
          }
        }
      } catch (e) {
        console.log(`      API request falhou: ${e.message}`);
      }
      
      // --- Abordagem B: page.evaluate(fetch) (usa cookies do browser diretamente) ---
      if (!boletoPdfSalvo) {
        try {
          const targetPage = boletoPage || siaaPage;
          console.log(`   📥 Tentativa ${tentativa}/3 (fetch no browser): ${urlAtual.substring(0, 100)}...`);
          
          const base64Pdf = await targetPage.evaluate(async (url) => {
            try {
              const resp = await fetch(url, { credentials: 'include' });
              if (!resp.ok) return { error: `HTTP ${resp.status}` };
              const blob = await resp.blob();
              return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ data: reader.result.split(',')[1], size: blob.size, type: blob.type });
                reader.onerror = () => reject('FileReader error');
                reader.readAsDataURL(blob);
              });
            } catch (err) {
              return { error: err.message || String(err) };
            }
          }, urlAtual);
          
          if (base64Pdf.error) {
            console.log(`      Fetch no browser falhou: ${base64Pdf.error}`);
          } else if (base64Pdf.data && base64Pdf.size > 1000) {
            const buffer = Buffer.from(base64Pdf.data, 'base64');
            const isPdf = buffer.slice(0, 5).toString().includes('%PDF');
            console.log(`      Fetch recebeu: ${buffer.length} bytes, type=${base64Pdf.type}, PDF: ${isPdf}`);
            
            if (isPdf || base64Pdf.type.includes('pdf') || base64Pdf.type.includes('octet-stream')) {
              fs.writeFileSync(boletoPath, buffer);
              console.log(`   ✅ Download (fetch browser): ${buffer.length} bytes`);
              boletoPdfSalvo = true;
              break;
            }
          } else {
            console.log(`      Resposta pequena: ${base64Pdf.size || 0} bytes`);
          }
        } catch (e) {
          console.log(`      Fetch no browser erro: ${e.message}`);
        }
      }
      
      // Aguarda e recarrega antes da próxima tentativa
      if (tentativa < 3 && !boletoPdfSalvo) {
        await siaaPage.waitForTimeout(3000);
        if (boletoPage) {
          try {
            await boletoPage.reload();
            await boletoPage.waitForTimeout(3000);
            const novaUrl = boletoPage.url();
            if (!urlsParaTentar.includes(novaUrl)) {
              urlsParaTentar.push(novaUrl);
            }
            // Listener pode ter capturado novo buffer após reload
            console.log(`   🔄 Página recarregada, URL: ${novaUrl.substring(0, 80)}...`);
          } catch (e) {}
        }
      }
    }
  } else if (!boletoPdfSalvo) {
    console.log('   ⚠️ Nenhuma URL de boleto disponível para download direto');
  }
  
  // MÉTODO 3: Screenshot da página do boleto como fallback final
  if (!boletoPdfSalvo) {
    console.log('   ⚠️ PDF não obtido, salvando screenshot do boleto...');
    try {
      if (boletoPage) {
        const boletoPngPath = boletoPath.replace('.pdf', '.png');
        await boletoPage.screenshot({ path: boletoPngPath, fullPage: true });
        console.log(`   📸 Screenshot boleto: ${boletoPngPath}`);
        
        // Converte screenshot para PDF
        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        const pdfStream = fs.createWriteStream(boletoPath);
        doc.pipe(pdfStream);
        doc.image(boletoPngPath, 20, 20, { fit: [555, 750] });
        doc.end();
        await new Promise((resolve) => pdfStream.on('finish', resolve));
        console.log(`   ✅ Boleto PDF (screenshot): ${fs.statSync(boletoPath).size} bytes`);
        boletoPdfSalvo = true;
      } else {
        await siaaPage.screenshot({ path: boletoPath.replace('.pdf', '.png'), fullPage: true, timeout: 15000 });
        console.log(`   📸 Screenshot SIAA salvo como fallback`);
      }
    } catch (e) {
      console.log(`   ⚠️ Falha no screenshot: ${e.message}`);
    }
  }
  
  if (boletoPdfSalvo) {
    console.log(`   ✅ Boleto confirmado: ${boletoPath}`);
  } else {
    console.log('   ❌ Não foi possível obter o boleto PDF');
  }
  
  console.log('✅ ETAPA 14 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMO FINAL - Com lógica para N8N processar corretamente
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Verifica o que foi gerado
  const temBoleto = boletoPdfSalvo && fs.existsSync(boletoPath);
  const temLinkCartao = linkCartaoCredito && linkCartaoCredito.trim() !== '';
  const temNumeroInscricao = numeroInscricao && numeroInscricao.trim() !== '';
  
  // Determina o status baseado no que foi gerado
  let statusInscricao = '';
  let statusDescricao = '';
  
  if (temNumeroInscricao) {
    // Inscrição foi concluída - NÃO é erro!
    if (temBoleto && temLinkCartao) {
      statusInscricao = 'INSCRICAO_POS_SUCESSO_COMPLETO';
      statusDescricao = 'Inscrição concluída com boleto E link do cartão';
    } else if (temBoleto && !temLinkCartao) {
      statusInscricao = 'INSCRICAO_POS_SUCESSO_BOLETO';
      statusDescricao = 'Inscrição concluída com boleto (sem link do cartão)';
    } else if (!temBoleto && temLinkCartao) {
      statusInscricao = 'INSCRICAO_POS_SUCESSO_CARTAO';
      statusDescricao = 'Inscrição concluída com link do cartão (sem boleto)';
    } else {
      // Nenhum dos dois foi gerado, mas inscrição OK
      statusInscricao = 'INSCRICAO_POS_SUCESSO_SEM_PAGAMENTO';
      statusDescricao = 'Inscrição concluída (boleto e cartão não gerados - usar link manual)';
    }
  } else {
    // Inscrição NÃO foi concluída - ERRO!
    statusInscricao = 'INSCRICAO_POS_ERRO';
    statusDescricao = 'Inscrição NÃO foi concluída (sem número de inscrição)';
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`🎯 STATUS: ${statusInscricao}`);
  console.log(`📋 ${statusDescricao}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`📋 Número de Inscrição: ${numeroInscricao || 'NÃO GERADO'}`);
  console.log(`📋 CPF: ${CLIENTE.cpf}`);
  console.log(`📋 Nome: ${CLIENTE.nome}`);
  console.log(`📋 Email: ${CLIENTE.email}`);
  console.log(`📋 Curso: ${CLIENTE.curso}`);
  console.log(`📋 Campanha: ${CLIENTE.campanha}`);
  console.log(`📸 Screenshot aprovação: ${screenshotFilename}`);
  console.log(`📄 Boleto: ${temBoleto ? boletoFilename : 'NÃO GERADO'}`);
  console.log(`💳 Link Cartão de Crédito: ${temLinkCartao ? linkCartaoCredito : 'NÃO GERADO'}`);
  console.log('───────────────────────────────────────────────────────────────────────────');
  // Outputs estruturados para o N8N parsear
  console.log(`STATUS_INSCRICAO: ${statusInscricao}`);
  console.log(`NUMERO_INSCRICAO: ${numeroInscricao || ''}`);
  console.log(`BOLETO_GERADO: ${temBoleto ? 'SIM' : 'NAO'}`);
  console.log(`LINK_CARTAO_GERADO: ${temLinkCartao ? 'SIM' : 'NAO'}`);
  if (temLinkCartao) {
    console.log(`LINK_CARTAO_CREDITO: ${linkCartaoCredito}`);
  }
  if (linhaDigitavel) {
    console.log(`LINHA_DIGITAVEL: ${linhaDigitavel}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  // Se a inscrição não foi concluída, lança erro para o Playwright reportar falha
  if (!temNumeroInscricao) {
    throw new Error(`INSCRICAO_POS_ERRO: Inscrição não foi concluída - sem número de inscrição`);
  }

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
          filename: screenshotFilename,
          contentType: 'image/png'
        });
        console.log(`   📸 Anexando screenshot: ${screenshotFilename}`);
      }
      
      // Adiciona boleto PDF
      if (fs.existsSync(boletoPath)) {
        formData.append('boleto', fs.createReadStream(boletoPath), {
          filename: boletoFilename,
          contentType: 'application/pdf'
        });
        console.log(`   📄 Anexando boleto: ${boletoFilename}`);
      } else {
        // Tenta anexar PNG se PDF não existir
        const boletoPngPath = boletoPath.replace('.pdf', '.png');
        const boletoPngFilename = boletoFilename.replace('.pdf', '.png');
        if (fs.existsSync(boletoPngPath)) {
          formData.append('boleto', fs.createReadStream(boletoPngPath), {
            filename: boletoPngFilename,
            contentType: 'image/png'
          });
          console.log(`   📄 Anexando boleto (PNG): ${boletoPngFilename}`);
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

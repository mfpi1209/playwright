const { test, expect } = require('./stealth-fixture');
const { validarPolo: validarPoloWhitelist } = require('./polos-atendidos');
const {
  safeEval,
  passarEtapaEmail,
  preencherDataNascimentoVtex,
  calcularDatasNascimento,
} = require('./checkout-helpers');

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DO CLIENTE - Via variáveis de ambiente ou valores padrão
// ═══════════════════════════════════════════════════════════════════════════

// Função para remover acentos e normalizar texto (resolve problemas de encoding)
function removerAcentos(texto) {
  if (!texto) return texto;
  
  // Mapeamento manual de caracteres acentuados para ASCII
  const mapa = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a', 'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o', 'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'ç': 'c', 'Ç': 'C', 'ñ': 'n', 'Ñ': 'N'
  };
  
  let resultado = '';
  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const code = char.charCodeAt(0);
    
    // Se está no mapa, usa o mapeamento
    if (mapa[char]) {
      resultado += mapa[char];
    }
    // Se é ASCII imprimível (32-126), mantém
    else if (code >= 32 && code <= 126) {
      resultado += char;
    }
    // Caso contrário, ignora (remove caracteres corrompidos)
  }
  
  return resultado;
}

// Função para corrigir caracteres acentuados corrompidos (encoding Windows/PowerShell)
function corrigirAcentos(texto) {
  if (!texto) return texto;
  return texto
    // Padrões de corrupção UTF-8 duplo (Ã seguido de caractere)
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
    .replace(/Ã¢/g, 'â').replace(/Ãª/g, 'ê').replace(/Ã®/g, 'î').replace(/Ã´/g, 'ô').replace(/Ã»/g, 'û')
    .replace(/Ã£/g, 'ã').replace(/Ãµ/g, 'õ')
    .replace(/Ã§/g, 'ç')
    // Padrões de corrupção com Á (Windows-1252 -> UTF-8)
    .replace(/Á£/g, 'ã').replace(/Á´/g, 'ô').replace(/Á©/g, 'é').replace(/Á¡/g, 'á')
    .replace(/Áº/g, 'ú').replace(/Á§/g, 'ç').replace(/Áª/g, 'ê').replace(/Á­/g, 'í')
    .replace(/Á³/g, 'ó').replace(/Áµ/g, 'õ').replace(/Á¢/g, 'â').replace(/Á®/g, 'î')
    // Se ainda sobrar caracteres estranhos, tenta normalizar
    .replace(/SÁ£o/g, 'São')
    .replace(/MecatrÁ´nica/g, 'Mecatrônica')
    .replace(/PedagÁ³gica/g, 'Pedagógica')
    .replace(/ContÁ¡beis/g, 'Contábeis')
    .replace(/AdministraÁ§Á£o/g, 'Administração');
}

// Normaliza polo "sapopemba" → "sapopemba (vila ema)" (nunca pode ir só "sapopemba")
function normalizarPolo(polo) {
  if (!polo) return polo;
  return polo.trim().toLowerCase() === 'sapopemba' ? 'sapopemba (vila ema)' : polo;
}

// Detecta se o polo é de Taboão da Serra (mituzi ou centro)
function isPoloTaboao(polo) {
  if (!polo) return false;
  const poloNormalizado = polo.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  return poloNormalizado.includes('taboao') ||
         poloNormalizado.includes('mituzi');
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

// Função para capitalizar nome (primeira letra maiúscula de cada palavra)
function capitalizarNome(nome) {
  return corrigirAcentos(nome).toLowerCase().split(' ').map(palavra => 
    palavra.charAt(0).toUpperCase() + palavra.slice(1)
  ).join(' ');
}

// Função para formatar telefone (remove código do país 55 se presente)
function formatarTelefone(telefone) {
  if (!telefone) return telefone;
  // Remove caracteres não numéricos
  let numeros = telefone.replace(/\D/g, '');
  // Se começa com 55 e tem mais de 11 dígitos, remove o 55
  if (numeros.startsWith('55') && numeros.length > 11) {
    numeros = numeros.substring(2);
  }
  return numeros;
}

const CLIENTE = {
  // Dados pessoais
  nome: capitalizarNome(process.env.CLIENTE_NOME || 'Carlos Eduardo Ribeiro'),
  cpf: process.env.CLIENTE_CPF || '96724754038',
  email: (process.env.CLIENTE_EMAIL || 'ceduardoribeiro@hotmail.com').toLowerCase(),
  telefone: formatarTelefone(process.env.CLIENTE_TELEFONE || '11974562318'),
  nascimento: process.env.CLIENTE_NASCIMENTO || '14/02/1985',
  // Endereço
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || String(Math.floor(Math.random() * 9000) + 100), // Número aleatório entre 100 e 9099
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
  // Localização
  estado: corrigirAcentos(process.env.CLIENTE_ESTADO) || 'São Paulo',
  cidade: corrigirAcentos(process.env.CLIENTE_CIDADE) || 'São Paulo',
  // Curso
  curso: corrigirAcentos(process.env.CLIENTE_CURSO) || 'pedagogia',
  polo: normalizarPolo(corrigirAcentos(process.env.CLIENTE_POLO) || ''),
  // Forma de ingresso ENEM
  tipoVestibular: 'ENEM',
};

test('test-enem-sem-nota', async ({ page }) => {
  
  // Exibe dados do cliente no início
  console.log('');
  console.log('📋 DADOS DO CLIENTE (ENEM SEM NOTA):');
  console.log(`   Nome: ${CLIENTE.nome}`);
  console.log(`   CPF: ${CLIENTE.cpf}`);
  console.log(`   Email: ${CLIENTE.email}`);
  console.log(`   Telefone: ${CLIENTE.telefone}`);
  console.log(`   Nascimento: ${CLIENTE.nascimento}`);
  console.log(`   CEP: ${CLIENTE.cep}`);
  console.log(`   Número: ${CLIENTE.numero}`);
  console.log(`   Estado: ${CLIENTE.estado}`);
  console.log(`   Cidade: ${CLIENTE.cidade}`);
  console.log(`   Curso: ${CLIENTE.curso}`);
  console.log(`   Polo: ${CLIENTE.polo}`);
  console.log(`   Forma de Ingresso: ${CLIENTE.tipoVestibular}`);
  console.log('   ⚠️ NOTAS DO ENEM: Ainda não disponíveis');
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda carregamento com verificação
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarCarregamento(descricao, timeout = 30000) {
    console.log(`⏳ Aguardando: ${descricao}...`);
    const inicio = Date.now();
    
    // Usa domcontentloaded ao invés de networkidle (mais confiável)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch (e) {
      // Continua mesmo se der timeout
    }
    
    await page.waitForTimeout(2000);
    
    // Aguarda "Carregando..." desaparecer (se existir)
    await aguardarCarregandoDesaparecer();
    
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`✅ ${descricao} - carregado em ${duracao}s`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda indicador "Carregando..." desaparecer
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarCarregandoDesaparecer(maxTentativas = 15) {
    // Verifica apenas o texto específico "Carregando..." que aparece na página
    const carregandoTexto = page.locator('text=Carregando...').first();
    
    try {
      // Verifica se existe o texto "Carregando..." visível
      const visivel = await carregandoTexto.isVisible({ timeout: 1000 });
      
      if (visivel) {
        console.log('   ⏳ Aguardando "Carregando..." desaparecer...');
        
        // Aguarda até desaparecer (máximo de tentativas)
        for (let i = 0; i < maxTentativas; i++) {
          await page.waitForTimeout(1000);
          const aindaVisivel = await carregandoTexto.isVisible({ timeout: 500 }).catch(() => false);
          if (!aindaVisivel) {
            console.log('   ✅ Carregamento concluído!');
            await page.waitForTimeout(1000); // Espera extra para estabilizar
            return;
          }
        }
        console.log('   ⚠️ Timeout aguardando carregamento, continuando...');
      }
    } catch (e) {
      // Não há indicador de carregamento, continua normalmente
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Verifica e preenche campo com retry
  // ═══════════════════════════════════════════════════════════════════════════
  async function preencherCampo(locator, valor, descricao, digitarLetraPorLetra = true) {
    console.log(`📝 Preenchendo: ${descricao}...`);
    await locator.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(500); // Espera estabilizar
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await locator.click();
    await page.waitForTimeout(200);
    await locator.clear();
    await page.waitForTimeout(200);
    
    if (digitarLetraPorLetra) {
      await locator.type(valor, { delay: 40 });
    } else {
      await locator.fill(valor);
    }
    
    await page.waitForTimeout(400);
    
    // Verifica se foi preenchido
    const valorAtual = await locator.inputValue().catch(() => '');
    if (valorAtual.replace(/\D/g, '').includes(valor.replace(/\D/g, '').substring(0, 5))) {
      console.log(`✅ ${descricao}: "${valorAtual}"`);
      return true;
    } else {
      console.log(`⚠️ ${descricao}: valor pode não ter sido preenchido corretamente`);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO: Remover overlays/backdrops que interceptam cliques
  // ═══════════════════════════════════════════════════════════════════════════
  async function removerOverlays() {
    console.log('🧹 Removendo overlays que bloqueiam cliques...');
    try {
      await page.evaluate(() => {
        const backdropSelectors = [
          '.cruzeirodosul-store-theme-3-x-sectionContactFormNewsBackdrop',
          '.cruzeirodosul-store-theme-3-x-sectionContactFormNewsDownloadFormBackdrop',
          '[class*="Backdrop"]',
          '[class*="backdrop"]',
          '.overlay',
          '.modal-backdrop',
          '[class*="portalContainer"]'
        ];
        
        backdropSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            console.log(`Removendo: ${el.className}`);
            el.remove();
          });
        });
        
        // Esconde formulários de contato que podem bloquear
        document.querySelectorAll('[class*="ContactForm"], [class*="DownloadForm"]').forEach(el => {
          if (el.style) el.style.display = 'none';
        });
      });
      
      // Pressiona Escape para fechar qualquer modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      console.log('   ✅ Overlays removidos');
    } catch (e) {
      console.log(`   ⚠️ Aviso ao remover overlays: ${e.message}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Seleciona opção em react-select
  // ═══════════════════════════════════════════════════════════════════════════
  async function selecionarOpcao(selectLocator, textoDigitar, opcaoNome, descricao) {
    console.log(`🔽 Selecionando: ${descricao}...`);
    
    // Aguarda carregamento antes de interagir
    await aguardarCarregandoDesaparecer();
    
    await selectLocator.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    await selectLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await selectLocator.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(textoDigitar, { delay: 50 });
    await page.waitForTimeout(1000);
    
    if (opcaoNome) {
      const opcao = page.getByRole('option', { name: opcaoNome });
      await opcao.waitFor({ state: 'visible', timeout: 10000 });
      await opcao.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    await page.waitForTimeout(800);
    
    // Aguarda possível carregamento após seleção
    await aguardarCarregandoDesaparecer();
    
    console.log(`✅ ${descricao} selecionado!`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🚀 INICIANDO SCRIPT DE INSCRIÇÃO ENEM (SEM NOTA) - CRUZEIRO DO SUL');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
  await aguardarCarregamento('Página de login');
  
  // Randomiza login admin
  const ADMINS = [
    { email: 'fabio.boas50@polo.cruzeirodosul.edu.br', senha: 'Eduit777' },
    { email: 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', senha: 'MFPedu!t678@!' },
  ];
  const adminEscolhido = ADMINS[Math.floor(Math.random() * ADMINS.length)];
  console.log(`   🔑 Admin: ${adminEscolhido.email}`);
  
  // Email
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await preencherCampo(emailInput, adminEscolhido.email, 'Email admin', false);
  
  // Clica continuar
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(2000);
  
  // Senha
  const senhaInput = page.getByRole('textbox', { name: 'Senha' });
  await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
  await senhaInput.fill(adminEscolhido.senha);
  console.log('✅ Senha preenchida');
  
  // Clica continuar para login
  await page.getByRole('button', { name: 'Continuar' }).click();
  await aguardarCarregamento('Login', 30000);
  await page.waitForTimeout(3000);
  
  console.log(`✅ ETAPA 1 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO PARA GRADUAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Graduação');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Verifica se já está na página de graduação
  const urlAtualEtapa2 = page.url();
  if (!urlAtualEtapa2.includes('/graduacao')) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        console.log(`   Tentativa ${tentativa}/3 de navegar para graduação...`);
    await page.goto('https://cruzeirodosul.myvtex.com/graduacao', { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (e) {
        console.log(`   ⚠️ Erro na tentativa ${tentativa}: ${e.message}`);
        if (tentativa < 3) {
          await page.waitForTimeout(2000);
        } else {
          throw e;
        }
      }
    }
  }
  await aguardarCarregamento('Página de graduação', 30000);
  
  // ACEITAR COOKIES - CRÍTICO: não pode prosseguir sem aceitar
  console.log('📍 Aguardando banner de cookies...');
  await page.waitForTimeout(2000);
  
  // Função para aceitar cookies - versão robusta
  async function aceitarCookiesObrigatorio() {
    const MAX_TENTATIVAS = 8;
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} de aceitar cookies...`);
      
      // Verifica se banner ainda existe
      const bannerVisivel = await page.evaluate(() => {
        const banner = document.querySelector('#privacytools-banner-consent, [class*="cookie-banner"], [class*="lgpd"], [class*="consent"], .cc-banner');
        return banner && banner.offsetParent !== null;
      });
      
      if (!bannerVisivel && tentativa > 2) {
        console.log('   ✅ Banner de cookies não está mais visível - já foi aceito ou não existe');
        return true;
      }
      
      // MÉTODO 1: Seletores específicos do privacytools (mais comum no site VTEX)
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
            console.log(`   📍 Encontrou botão privacytools: ${seletor}`);
            await btn.click({ force: true, timeout: 3000 });
            await page.waitForTimeout(1000);
            console.log('   ✅ Cookies aceitos (privacytools)!');
            return true;
          }
        } catch (e) { /* continua */ }
      }
      
      // MÉTODO 2: Seletores genéricos
      const seletoresGenericos = [
        { tipo: 'role', loc: page.getByRole('button', { name: /aceitar todos/i }) },
        { tipo: 'role', loc: page.getByRole('button', { name: /aceitar/i }) },
        { tipo: 'text', loc: page.getByText('Aceitar todos').first() },
        { tipo: 'text', loc: page.getByText('Aceitar Todos').first() },
        { tipo: 'locator', loc: page.locator('button').filter({ hasText: /aceitar todos/i }).first() },
        { tipo: 'locator', loc: page.locator('button').filter({ hasText: /aceitar/i }).first() },
        { tipo: 'locator', loc: page.locator('[class*="cookie"] button').first() },
        { tipo: 'locator', loc: page.locator('#onetrust-accept-btn-handler') },
        { tipo: 'css', loc: page.locator('button:has-text("Aceitar")').first() },
        { tipo: 'css', loc: page.locator('[class*="lgpd"] button').first() },
        { tipo: 'css', loc: page.locator('[class*="consent"] button').first() },
        { tipo: 'css', loc: page.locator('.cc-btn.cc-dismiss').first() },
      ];
      
      for (const { tipo, loc } of seletoresGenericos) {
        try {
          if (await loc.count() > 0 && await loc.isVisible({ timeout: 1000 })) {
            console.log(`   📍 Encontrou botão de cookies (${tipo})`);
            await loc.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(300);
            await loc.click({ force: true, timeout: 3000 });
            console.log('   ✅ Cookies aceitos!');
            await page.waitForTimeout(1000);
            return true;
          }
        } catch (e) { /* continua */ }
      }
      
      // MÉTODO 3: Fallback via JavaScript
      try {
        const clicouJS = await page.evaluate(() => {
          const seletores = [
            '#privacytools-banner-consent button',
            '[class*="cookie"] button',
            '[class*="lgpd"] button',
            '[class*="consent"] button[class*="accept"]',
            '[class*="consent"] button:first-child',
            'button[class*="accept"]',
          ];
          
          for (const sel of seletores) {
            const btns = document.querySelectorAll(sel);
            for (const btn of btns) {
              const texto = btn.textContent?.toLowerCase() || '';
              if (texto.includes('aceitar') || texto.includes('accept') || texto.includes('concordo') || texto.includes('ok')) {
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
          console.log('   ✅ Cookies aceitos via JavaScript!');
          await page.waitForTimeout(1000);
          return true;
        }
      } catch (e) { /* continua */ }
      
      if (tentativa < MAX_TENTATIVAS) {
        console.log(`   ⏳ Aguardando mais 1.5s...`);
        await page.waitForTimeout(1500);
        await page.mouse.wheel(0, 50).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    
    return false;
  }
  
  const cookieAceito = await aceitarCookiesObrigatorio();
  if (!cookieAceito) {
    console.log('⚠️ AVISO: Banner de cookies não encontrado ou já aceito - continuando');
    await page.evaluate(() => {
      const banners = document.querySelectorAll('#privacytools-banner-consent, [class*="cookie-banner"], [class*="lgpd-banner"]');
      banners.forEach(b => b.remove());
    }).catch(() => {});
  }
  
  // Fecha modais se existirem
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  console.log(`✅ ETAPA 2 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: LOGIN COMO CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 3: Login como Cliente');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Fecha modal se existir
  try {
    const backdrop = page.locator('[class*="backdrop"], [class*="Backdrop"]').first();
    if (await backdrop.isVisible({ timeout: 2000 })) {
      await backdrop.click({ force: true });
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Clica em "Entrar como cliente" (com retry)
  let loginClienteOk = false;
  for (let tentLogin = 1; tentLogin <= 3; tentLogin++) {
    console.log(`   🔄 Tentativa ${tentLogin}/3 de login do cliente...`);
    
    // Remove overlays que podem estar bloqueando
    await page.evaluate(() => {
      const seletores = ['[class*="helpCenter"]', '[class*="HelpCenter"]', '[class*="zendesk"]',
        '[class*="chat-widget"]', '.cruzeirodosul-store-theme-3-x-helpCenterBgOpen',
        '[class*="backdrop"]', '[class*="Backdrop"]'];
      for (const sel of seletores) {
        document.querySelectorAll(sel).forEach(el => el.remove());
      }
    }).catch(() => {});
    
    const entrarComoCliente = page.getByText('Entrar como cliente').first()
      .or(page.getByRole('button', { name: /entrar como cliente/i }))
      .or(page.getByRole('link', { name: /entrar como cliente/i }));
    
    try {
      await entrarComoCliente.first().waitFor({ state: 'visible', timeout: 15000 });
      await entrarComoCliente.first().click({ force: true });
      console.log('   ✅ Clicou em "Entrar como cliente"');
      await page.waitForTimeout(2000);
      
      // Verifica se o campo de email apareceu
      const emailCliente = page.getByPlaceholder('Ex: example@mail.com')
        .or(page.getByPlaceholder(/e-mail|email/i));
      
      if (await emailCliente.first().isVisible({ timeout: 10000 }).catch(() => false)) {
        // Fecha modal se necessário
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Preenche email do cliente
        await preencherCampo(emailCliente.first(), CLIENTE.email, 'Email cliente', false);
        
        // Clica em Entrar
        await page.getByRole('button', { name: 'Entrar' }).click({ force: true });
        await page.waitForTimeout(3000);
        loginClienteOk = true;
        break;
      } else {
        console.log('   ⚠️ Campo de email não apareceu, tentando novamente...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log(`   ⚠️ Tentativa ${tentLogin} falhou: ${e.message.split('\n')[0]}`);
      if (tentLogin < 3) {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
  }
  
  if (!loginClienteOk) {
    throw new Error('Não foi possível fazer login como cliente após 3 tentativas');
  }
  
  // Tenta clicar novamente se visível
  try {
    const entrarBtn = page.getByRole('button', { name: 'Entrar' });
    if (await entrarBtn.isVisible({ timeout: 2000 })) {
      await entrarBtn.click({ force: true });
    }
  } catch (e) {}
  
  await page.waitForTimeout(3000);
  console.log(`✅ ETAPA 3 CONCLUÍDA - Cliente logado`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: BUSCA E SELEÇÃO DO CURSO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 4: Busca e Seleção do Curso');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Remove overlays que podem bloquear a busca
  await removerOverlays();
  
  // Aguarda página estabilizar
  await page.waitForTimeout(2000);
  console.log('   🔍 Procurando campo de busca...');
  
  // Tenta múltiplos seletores para o campo de busca
  let searchInput = null;
  const seletoresBusca = [
    page.getByRole('textbox', { name: 'O que você procura? Buscar' }),
    page.getByRole('textbox', { name: /buscar/i }),
    page.locator('input[type="text"][placeholder*="busca"]').first(),
    page.locator('input[type="text"][placeholder*="procura"]').first(),
    page.locator('input[class*="search"]').first(),
    page.locator('[class*="search"] input').first(),
  ];
  
  for (const seletor of seletoresBusca) {
    try {
      const isVisible = await seletor.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) {
        searchInput = seletor;
        console.log('   ✅ Campo de busca encontrado!');
        break;
      }
    } catch (e) {
      // continua tentando
    }
  }
  
  if (!searchInput) {
    console.log('   ⚠️ Campo de busca não encontrado, usando URL direta');
  }
  
  // Usa texto sem acentos para a busca (evita problemas de encoding)
  const cursoParaBusca = removerAcentos(CLIENTE.curso);
  console.log(`🔍 Digitando na busca: "${cursoParaBusca}" (original: ${CLIENTE.curso})`);
  
  // Remove overlays novamente
  await removerOverlays();
  
  if (searchInput) {
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Usa page.evaluate para preencher o campo (mais confiável em headless)
    console.log('   📍 Preenchendo campo de busca via JavaScript...');
    await page.evaluate((curso) => {
      const input = document.querySelector('input[placeholder*="procura"]') || 
                    document.querySelector('input[class*="search"]') ||
                    document.querySelector('[class*="search"] input');
      if (input) {
        input.focus();
        input.value = curso;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, cursoParaBusca);
    await page.waitForTimeout(1000);
    
    console.log('   📍 Pressionando Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }
  
  // Se não navegou, tenta URL direta
  const urlAposBusca1 = page.url();
  if (!urlAposBusca1.includes('?') && !urlAposBusca1.includes('/p')) {
    console.log('   ⚠️ Busca não navegou, tentando URL direta...');
    await page.goto(`https://cruzeirodosul.myvtex.com/${cursoParaBusca}?_q=${cursoParaBusca}&map=ft`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  
  // Aguarda resultados carregarem completamente
  console.log('⏳ Aguardando resultados da busca...');
  await page.waitForTimeout(5000);
  await aguardarCarregandoDesaparecer();
  await page.waitForTimeout(3000);
  
  // Remove overlays novamente após carregamento
  await removerOverlays();
  
  // Verifica se está em página de busca ou de produto
  const urlAposBusca = page.url();
  console.log(`📍 URL após busca: ${urlAposBusca}`);
  
  // Se está em página de busca (contém ?map= ou não tem /p no final)
  if (urlAposBusca.includes('?map=') || !urlAposBusca.endsWith('/p')) {
    console.log(`🔍 Página de resultados detectada, procurando curso...`);
    
    // Aguarda cards carregarem completamente
    await page.waitForTimeout(3000);
    
    // Rola a página para encontrar os cards
    console.log('   📜 Rolando a página para encontrar os cards...');
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1000);
    
    // Procura pelo PRIMEIRO botão/link azul dentro de um card de curso
    console.log('   🔍 Procurando botão azul do primeiro card...');
    
    const seletoresBotaoAzul = [
      page.locator('a').filter({ hasText: /^Semipresencial$/i }).first(),
      page.locator('a').filter({ hasText: /^EAD Digital$/i }).first(),
      page.locator('a').filter({ hasText: /^EAD$/i }).first(),
      page.locator('article a[href$="/p"]').first(),
      page.locator('[class*="product"] a[href$="/p"]').first(),
      page.locator('[class*="card"] a[href$="/p"]').first(),
      page.locator('a[href*="grad-"][href$="/p"]').first(),
    ];
    
    let clicouNoBotao = false;
    
    for (const seletor of seletoresBotaoAzul) {
      try {
        const count = await seletor.count();
        if (count > 0) {
          const isVisible = await seletor.isVisible({ timeout: 2000 });
          if (isVisible) {
            const texto = await seletor.innerText().catch(() => '');
            const href = await seletor.getAttribute('href').catch(() => '');
            console.log(`   📍 Encontrou botão: "${texto.substring(0, 50).trim()}" -> ${href}`);
            
            await seletor.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await seletor.click({ force: true });
            console.log('   ✅ Clicou no botão!');
            clicouNoBotao = true;
            break;
          }
        }
      } catch (e) {}
    }
    
    // Fallback: primeiro link de produto
    if (!clicouNoBotao) {
      console.log('   ⚠️ Tentando fallback: primeiro link de produto...');
      try {
        const todosLinks = page.locator('a[href*="/p"]');
        const count = await todosLinks.count();
        
        for (let i = 0; i < Math.min(count, 10); i++) {
          const link = todosLinks.nth(i);
          const isVis = await link.isVisible().catch(() => false);
          if (isVis) {
            const href = await link.getAttribute('href');
            if (href && href.includes('grad-')) {
              console.log(`   📍 Clicando em: ${href}`);
              await link.scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);
              await link.click({ force: true });
              break;
            }
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Erro no fallback: ${e.message}`);
      }
    }
    
    // Aguarda navegação
    await page.waitForTimeout(3000);
    console.log(`   📍 URL após clique: ${page.url()}`);
  } else {
    console.log('✅ Já está na página do produto');
  }
  
  await aguardarCarregamento('Página do produto', 30000);
  console.log(`📍 URL atual: ${page.url()}`);
  await page.waitForTimeout(3000);
  
  console.log(`✅ ETAPA 4 CONCLUÍDA - Curso selecionado`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL (Nome, Telefone, Termos)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Aguarda formulário do produto carregar - espera o botão Inscreva-se aparecer
  console.log('⏳ Aguardando formulário do produto...');
  const btnInscreva = page.getByRole('button', { name: 'Inscreva-se' });
  try {
    await btnInscreva.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Formulário do produto carregado!');
  } catch (e) {
    console.log('⚠️ Botão Inscreva-se não encontrado, continuando...');
  }
  await page.waitForTimeout(3000);
  
  // Nome completo
  const nomeInput = page.getByRole('textbox', { name: 'Nome completo' });
  await preencherCampo(nomeInput, CLIENTE.nome, 'Nome completo');
  
  // Telefone
  const telefoneInput = page.getByRole('textbox', { name: '(XX) XXXXX-XXXX' });
  await preencherCampo(telefoneInput, CLIENTE.telefone, 'Telefone');
  
  // Checkbox de termos
  console.log('📝 Marcando checkbox de termos...');
  
  // Aguarda carregamento antes de marcar checkbox
  await aguardarCarregandoDesaparecer();
  
  const checkboxByText = page.locator('[class*="checkbox"]').filter({ hasText: /política|privacidade/i }).first();
  await checkboxByText.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await checkboxByText.click({ force: true });
  console.log('✅ Checkbox de termos marcado');
  
  await page.waitForTimeout(2000);
  
  // Aguarda carregamento antes de clicar em Inscreva-se
  await aguardarCarregandoDesaparecer();
  
  // Clica em Inscreva-se
  const inscreverBtn = page.getByRole('button', { name: 'Inscreva-se' });
  await inscreverBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  
  // Verifica se botão está habilitado
  const btnDesabilitado = await inscreverBtn.isDisabled().catch(() => false);
  if (btnDesabilitado) {
    console.log('   ⏳ Botão desabilitado, aguardando...');
    await page.waitForTimeout(3000);
    await aguardarCarregandoDesaparecer();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SISTEMA DE RETRY - Tenta clicar e verificar se navegou corretamente
  // ═══════════════════════════════════════════════════════════════════════════
  const MAX_TENTATIVAS = 2;
  let tentativaAtual = 0;
  let formularioCarregado = false;
  
  while (tentativaAtual < MAX_TENTATIVAS && !formularioCarregado) {
    tentativaAtual++;
    console.log(`🔄 Tentativa ${tentativaAtual}/${MAX_TENTATIVAS} - Clicando em Inscreva-se...`);
    
    await inscreverBtn.click();
  await aguardarCarregamento('Formulário de inscrição', 60000);
  await page.waitForTimeout(5000);
    
    // Verifica se os selects de localização existem
    const urlAtual = page.url();
    const selectsEncontrados = await page.locator('.react-select__input-container').count();
    const selectsControlEncontrados = await page.locator('.react-select__control').count();
    
    console.log(`   📍 URL: ${urlAtual}`);
    console.log(`   📋 Selects: ${selectsEncontrados} (input), ${selectsControlEncontrados} (control)`);
    
    // Se encontrou pelo menos 4 selects, o formulário carregou (País, Estado, Cidade, Polo)
    if (selectsEncontrados >= 4 || selectsControlEncontrados >= 4) {
      formularioCarregado = true;
      console.log(`   ✅ Formulário de localização encontrado!`);
    } else if (tentativaAtual < MAX_TENTATIVAS) {
      console.log(`   ⚠️ Formulário não carregou, recarregando página...`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await aguardarCarregandoDesaparecer();
      
      // Re-preenche o formulário inicial
      console.log('   🔄 Re-preenchendo formulário inicial...');
      
      // Nome
      const nomeInputRetry = page.getByRole('textbox', { name: 'Nome completo' });
      if (await nomeInputRetry.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nomeInputRetry.fill(CLIENTE.nome);
      }
      
      // Telefone
      const telefoneInputRetry = page.getByRole('textbox', { name: '(XX) XXXXX-XXXX' });
      if (await telefoneInputRetry.isVisible({ timeout: 3000 }).catch(() => false)) {
        await telefoneInputRetry.click();
        await telefoneInputRetry.fill(CLIENTE.telefone);
      }
      
      // Checkbox
      const checkboxRetry = page.locator('[class*="checkbox"]').filter({ hasText: /política|privacidade/i }).first();
      if (await checkboxRetry.isVisible({ timeout: 3000 }).catch(() => false)) {
        await checkboxRetry.click({ force: true });
      }
      
      await page.waitForTimeout(2000);
    } else {
      console.log(`   ❌ Falha após ${MAX_TENTATIVAS} tentativas`);
    }
  }
  
  if (!formularioCarregado) {
    throw new Error(`Formulário de localização não carregou após ${MAX_TENTATIVAS} tentativas`);
  }
  
  console.log(`✅ ETAPA 5 CONCLUÍDA`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 6: DADOS DE LOCALIZAÇÃO (País, Estado, Cidade, Polo, CPF)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 6: Dados de Localização');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Debug: mostra URL e estado da página
  console.log(`📍 URL atual: ${page.url()}`);
  
  // Aguarda formulário estar completamente carregado
  console.log('⏳ Verificando se formulário está pronto...');
  await aguardarCarregandoDesaparecer();
  await page.waitForTimeout(2000);
  
  // Pega os selects
  const selects = await page.locator('.react-select__input-container').count();
  const selectsControl = await page.locator('.react-select__control').count();
  console.log(`   📋 Selects encontrados: ${selects} (input-container), ${selectsControl} (control)`);
  
  // Tenta seletores alternativos se não encontrar o padrão
  let primeiroSelect = page.locator('.react-select__input-container').first();
  
  // Se não encontrar, tenta com .react-select__control
  if (selects === 0 && selectsControl > 0) {
    console.log('   ℹ️ Usando seletor alternativo: .react-select__control');
    primeiroSelect = page.locator('.react-select__control').first();
  }
  
  // Se ainda não encontrar, lista o que tem na página
  if (selects === 0 && selectsControl === 0) {
    console.log('   ⚠️ Nenhum select encontrado! Listando elementos...');
    const h1s = await page.locator('h1, h2, h3').allTextContents();
    console.log(`   Títulos: ${h1s.slice(0, 5).join(' | ')}`);
    const buttons = await page.locator('button:visible').allTextContents();
    console.log(`   Botões: ${buttons.slice(0, 5).join(' | ')}`);
    const inputs = await page.locator('input:visible').count();
    console.log(`   Inputs visíveis: ${inputs}`);
  }
  
  await primeiroSelect.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // País
  await selecionarOpcao(
    primeiroSelect,
    'brasil',
    'Brasil',
    'País'
  );
  
  // Estado
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(1),
    CLIENTE.estado,
    null,
    'Estado'
  );
  
  // Cidade (ajusta automaticamente para polo de Taboão, Capivari ou Itapira)
  const cidadeCorreta = obterCidadeDoPolo(CLIENTE.polo, CLIENTE.cidade);
  console.log(`   📍 Cidade a selecionar: ${cidadeCorreta}${getInfoAjusteCidade(CLIENTE.polo)}`);
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(2),
    cidadeCorreta,
    null,
    'Cidade'
  );
  
  // Polo
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(3),
    CLIENTE.polo,
    null,
    'Polo'
  );
  
  // CPF
  const cpfInput = page.locator('input[name="userDocument"]');
  await preencherCampo(cpfInput, CLIENTE.cpf, 'CPF');
  
  // Remove overlays antes de clicar
  await removerOverlays();
  
  // Continuar Inscrição
  const continuarBtn1 = page.getByRole('button', { name: 'Continuar Inscrição' });
  await continuarBtn1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await continuarBtn1.click();
  
  await aguardarCarregamento('Próxima etapa', 30000);
  await page.waitForTimeout(3000);
  
  console.log(`✅ ETAPA 6 CONCLUÍDA`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 7: FORMA DE INGRESSO ENEM E CONDIÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Forma de Ingresso ENEM e Condições');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Forma de Ingresso - ENEM
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    'enem',
    'ENEM',
    'Forma de Ingresso (ENEM)'
  );
  
  await page.waitForTimeout(2000);
  
  // Condições especiais
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    'não neces',
    'Não necessito de condições',
    'Condições Especiais'
  );
  
  // Remove overlays antes de clicar (Etapa 7)
  await removerOverlays();
  
  // Continuar Inscrição
  console.log('📍 Clicando em Continuar Inscrição...');
  await page.getByRole('button', { name: 'Continuar Inscrição' }).click();
  
  // Aguarda próxima página (sem networkidle que trava)
  console.log('⏳ Aguardando próxima etapa...');
  await page.waitForTimeout(5000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO: CPF já possui inscrição?
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔍 Verificando se CPF já possui inscrição...');
  const erroInscricao = page.locator('text=Este CPF já possui uma inscrição');
  const erroVisivel = await erroInscricao.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (erroVisivel) {
    console.log('');
    console.log('⚠️ ════════════════════════════════════════════════════════════════════════════');
    console.log('⚠️  CPF JÁ POSSUI INSCRIÇÃO!');
    console.log('⚠️  Este CPF já possui uma inscrição com esta forma de ingresso e/ou para este ciclo.');
    console.log('⚠️  Verifique em "minhas inscrições" ou altere a forma de ingresso.');
    console.log('⚠️ ════════════════════════════════════════════════════════════════════════════');
    console.log('');
    await page.screenshot({ path: 'cpf-ja-inscrito-enem.png', fullPage: true });
    console.log('📸 Screenshot salvo em: cpf-ja-inscrito-enem.png');
    console.log('🛑 Processo interrompido.');
    return;
  }
  
  console.log('✅ CPF liberado para inscrição');
  console.log(`✅ ETAPA 7 CONCLUÍDA - ENEM selecionado`);
  console.log('');
  
  // Mostra URL atual para debug
  console.log(`📍 URL atual: ${page.url()}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPAS FINAIS: Página de Checkout VTEX
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPAS FINAIS: Página de Checkout');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  const urlAtual = page.url();
  console.log(`📍 URL atual: ${urlAtual}`);
  
  // Aguarda página de checkout carregar completamente
  console.log('⏳ Aguardando checkout carregar...');
  await page.waitForTimeout(5000);
  
  // Aguarda até que existam inputs visíveis na página
  console.log('⏳ Aguardando campos do formulário...');
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const inputs = await page.locator('input:visible').count();
    console.log(`   Tentativa ${tentativa + 1}: ${inputs} inputs encontrados`);
    if (inputs >= 3) {
      console.log('✅ Formulário carregado!');
      break;
    }
    await page.waitForTimeout(1000);
  }
  
  await page.waitForTimeout(2000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 1: Dados Pessoais → Ir para o Endereço
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 CHECKOUT: Verificando Dados Pessoais...');

  // Se caiu em #/email (cliente nao autenticado de fato no VTEX), trata primeiro
  if (page.url().includes('#/email')) {
    await passarEtapaEmail(page, CLIENTE.email);
    await page.waitForTimeout(1500);
  }

  // Preenche data de nascimento usando helper compartilhado.
  // Estrategia A=valueAsDate eh a UNICA que funciona com o input HTML5
  // date do checkout VTEX da Cruzeiro (descoberto empiricamente). Fallbacks
  // B=keyboard.type e C=fill cobrem casos em que o input nao eh date.
  console.log('📝 Preenchendo data de nascimento (helper VTEX)...');
  const { dataBR: _dataBRVtex, dataIso: _dataIsoVtex } = calcularDatasNascimento(CLIENTE.nascimento);
  const resBD = await preencherDataNascimentoVtex(page, _dataBRVtex, _dataIsoVtex);
  let campoDataEncontrado = false;
  if (resBD.ok && resBD.motivo && resBD.motivo.startsWith('re-preenchido')) {
    console.log(`✅ Data de nascimento preenchida (${resBD.motivo}): ${resBD.valor}`);
    campoDataEncontrado = true;
  } else if (resBD.ok && resBD.motivo === 'ja-preenchido') {
    console.log(`ℹ️ Data já preenchida: ${resBD.valor}`);
    campoDataEncontrado = true;
  } else if (resBD.ok && resBD.motivo === 'campo-desabilitado') {
    console.log('ℹ️ Campo data de nascimento desabilitado (já validado)');
    campoDataEncontrado = true;
  } else {
    console.log(`⚠️ Campo de data de nascimento não preenchido: ${resBD.motivo}`);
  }

  if (!campoDataEncontrado) {
    const inputs = await page.locator('input:visible').all();
    console.log(`   Total de inputs visíveis: ${inputs.length}`);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const nome = await inputs[i].getAttribute('name').catch(() => '');
      const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
      const valor = await inputs[i].inputValue().catch(() => '');
      console.log(`   Input ${i}: name="${nome}", placeholder="${placeholder}", valor="${valor}"`);
    }
  }

  await page.waitForTimeout(2000);
  
  // Clica no botão para próxima etapa (pode ser "Ir para o Endereço" ou "Ir para o pagamento")
  console.log('📍 Procurando botão para próxima etapa...');
  
  // Lista todos os botões visíveis para debug
  const botoesVisiveis = await page.locator('button:visible').all();
  console.log(`   📋 Botões visíveis: ${botoesVisiveis.length}`);
  for (let i = 0; i < Math.min(botoesVisiveis.length, 8); i++) {
    const texto = await botoesVisiveis[i].innerText().catch(() => '');
    if (texto.trim()) console.log(`      - "${texto.trim().substring(0, 50)}"`);
  }
  
  const seletoresBtnProximo = [
    page.locator('button:has-text("Ir para o Endereço")'),
    page.locator('button:has-text("Ir para o endereço")'),
    page.getByRole('button', { name: /endereço/i }),
    page.getByRole('button', { name: /Ir para o pagamento/i }),
    page.locator('button:has-text("Ir para o pagamento")'),
    page.locator('button:has-text("Prosseguir")'),
    page.locator('button:has-text("Continuar")').first(),
    page.locator('button').filter({ hasText: 'Endereço' }).first(),
    page.locator('button').filter({ hasText: 'pagamento' }).first()
  ];
  
  let clicouProximo = false;
  
  for (const btn of seletoresBtnProximo) {
    try {
      if (await btn.isVisible({ timeout: 2000 })) {
        const textoBtn = await btn.innerText().catch(() => 'botão');
        console.log(`📍 Encontrou botão "${textoBtn.trim().substring(0, 30)}", clicando...`);
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btn.click();
        clicouProximo = true;
        console.log(`✅ Clicou no botão!`);
        await page.waitForTimeout(5000);
        break;
      }
    } catch (e) {
      // Tenta próximo
    }
  }
  
  if (!clicouProximo) {
    console.log('⚠️ Não encontrou botão para próxima etapa, tentando continuar...');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 2: Endereço → Ir para o Pagamento
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 CHECKOUT: Verificando Endereço...');
  
  // Aguarda seção de endereço
  await page.waitForTimeout(1500);
  
  // Verifica se o endereço já está preenchido (mostrando rua/bairro)
  const enderecoJaPreenchido = await page.locator('text=Rua ').first().isVisible({ timeout: 2000 }).catch(() => false) ||
                                await page.locator('text=Avenida ').first().isVisible({ timeout: 1000 }).catch(() => false);
  
  if (enderecoJaPreenchido) {
    console.log('✅ Endereço já está preenchido, pulando para próxima etapa...');
  } else {
  // Clica em "Sim" se aparecer (usando seletor do codegen original)
  console.log('📍 Verificando botão "Sim"...');
  try {
      const simBtn = page.locator('button:has-text("Sim")').first();
    const simNao = page.getByText('SimNão');
      
      if (await simBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📍 Clicando em "Sim"...');
        await simBtn.click();
        await page.waitForTimeout(1000);
        console.log('✅ Clicou em "Sim"!');
      } else if (await simNao.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('📍 Clicando em "Sim" (via SimNão)...');
      await simNao.click();
        await page.waitForTimeout(1000);
      console.log('✅ Clicou em "Sim"!');
    }
  } catch (e) {
      console.log('ℹ️ Botão Sim não encontrado');
    }
    
    await page.waitForTimeout(1000);
  }
  
  // Verifica se precisa preencher CEP
  const campoCep = page.getByRole('textbox', { name: 'CEP *' });
  const cepVisivel = await campoCep.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (cepVisivel) {
    const cepAtual = await campoCep.inputValue().catch(() => '');
    console.log(`📝 Campo CEP visível, valor atual: "${cepAtual}"`);
    
    if (!cepAtual || cepAtual.length < 8) {
  console.log('📝 Preenchendo CEP...');
  try {
    await campoCep.click();
        await page.waitForTimeout(300);
    await campoCep.fill(CLIENTE.cep);
    console.log(`✅ CEP: ${CLIENTE.cep}`);
        await page.waitForTimeout(500);
    await campoCep.press('Tab');
        await page.waitForTimeout(3000); // Aguarda busca do CEP
        
        // Verifica se o CEP foi encontrado
        const cepNaoEncontrado = await page.locator('text=/CEP não foi encontrado|CEP inválido|CEP não localizado/i').isVisible({ timeout: 2000 }).catch(() => false);
        
        if (cepNaoEncontrado) {
          console.log('');
          console.log('❌ ════════════════════════════════════════════════════════════════════════════');
          console.log('❌  ERRO: CEP NÃO FOI ENCONTRADO!');
          console.log(`❌  CEP informado: ${CLIENTE.cep}`);
          console.log('❌  Verifique se o CEP está correto e tente novamente.');
          console.log('❌ ════════════════════════════════════════════════════════════════════════════');
          console.log('');
          console.log('❌ INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA - CEP não encontrado');
          await page.screenshot({ path: 'erro-cep-nao-encontrado.png', fullPage: true });
          return; // Encerra o teste
        }
        
  } catch (e) {
    console.log('⚠️ Erro no CEP:', e.message);
      }
    } else {
      console.log(`✅ CEP já preenchido: ${cepAtual}`);
    }
  } else {
    console.log('ℹ️ Campo CEP não visível (endereço pode já estar preenchido)');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SEMPRE TENTA PREENCHER O NÚMERO (campo obrigatório)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📝 Verificando campo Número...');
  let numeroPreenchido = false;
  
  for (let tentativa = 1; tentativa <= 5 && !numeroPreenchido; tentativa++) {
    try {
      // Tenta múltiplos seletores para o campo Número
      const seletoresNumero = [
        page.getByRole('textbox', { name: 'Número *' }),
        page.locator('input[name*="number"]'),
        page.locator('input[placeholder*="Número"]'),
        page.locator('input').filter({ hasText: /número/i }).first()
      ];
      
      for (const campoNumero of seletoresNumero) {
        const numeroVisivel = await campoNumero.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (numeroVisivel) {
          const valorAtual = await campoNumero.inputValue().catch(() => '');
          
          if (!valorAtual || valorAtual.trim() === '') {
            await campoNumero.click();
            await page.waitForTimeout(300);
            await campoNumero.fill(CLIENTE.numero);
            console.log(`✅ Número preenchido: ${CLIENTE.numero}`);
            numeroPreenchido = true;
            break;
          } else {
            console.log(`✅ Número já preenchido: "${valorAtual}"`);
            numeroPreenchido = true;
            break;
          }
        }
      }
      
      if (!numeroPreenchido) {
        console.log(`   🔄 Tentativa ${tentativa}/5: Campo número não encontrado, aguardando...`);
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log(`   ⚠️ Tentativa ${tentativa} erro: ${e.message}`);
      await page.waitForTimeout(1000);
    }
  }
  
  if (!numeroPreenchido) {
    console.log('⚠️ ATENÇÃO: Não conseguiu preencher o número do endereço');
    // Tenta screenshot para debug
    await page.screenshot({ path: 'debug-numero-nao-preenchido.png', fullPage: true }).catch(() => {});
  }
  
  // Verifica e preenche campo Endereço se necessário
  const campoEnderecoVisivel = await page.getByRole('textbox', { name: 'Endereço *' }).isVisible({ timeout: 2000 }).catch(() => false);
  
  if (campoEnderecoVisivel) {
    console.log('📝 Verificando campo Endereço...');
    try {
      const campoEndereco = page.getByRole('textbox', { name: 'Endereço *' });
      const enderecoAtual = await campoEndereco.inputValue().catch(() => '');
      
      if (!enderecoAtual || enderecoAtual.trim() === '' || enderecoAtual.toLowerCase() === 'null') {
        console.log('   ℹ️ Endereço não preenchido pelo CEP, inserindo "Null"...');
        await campoEndereco.click();
        await page.waitForTimeout(300);
        await campoEndereco.fill('Null');
        console.log('✅ Endereço: Null');
      } else {
        console.log(`✅ Endereço já preenchido: "${enderecoAtual}"`);
      }
    } catch (e) {
      console.log('⚠️ Erro ao verificar Endereço:', e.message);
    }
  }
  
  // Verifica e preenche campo Bairro se necessário
  const campoBairroVisivel = await page.getByRole('textbox', { name: 'Bairro *' }).isVisible({ timeout: 2000 }).catch(() => false);
  
  if (campoBairroVisivel) {
    console.log('📝 Verificando campo Bairro...');
    try {
      const campoBairro = page.getByRole('textbox', { name: 'Bairro *' });
      const bairroAtual = await campoBairro.inputValue().catch(() => '');
      
      if (!bairroAtual || bairroAtual.trim() === '') {
        console.log('   ℹ️ Bairro não preenchido pelo CEP, inserindo "Centro"...');
        await campoBairro.click();
        await page.waitForTimeout(300);
        await campoBairro.fill('Centro');
        console.log('✅ Bairro: Centro');
      } else {
        console.log(`✅ Bairro já preenchido: "${bairroAtual}"`);
      }
    } catch (e) {
      console.log('⚠️ Erro ao verificar Bairro:', e.message);
    }
  }
  
  await page.waitForTimeout(500);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CLICA EM "IR PARA O PAGAMENTO"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📍 Procurando botão "Ir para o pagamento"...');
  
  // Lista botões visíveis para debug
  const botoesPagamento = await page.locator('button:visible').all();
  console.log(`   📋 Botões visíveis: ${botoesPagamento.length}`);
  for (let i = 0; i < Math.min(botoesPagamento.length, 8); i++) {
    const texto = await botoesPagamento[i].innerText().catch(() => '');
    if (texto.trim()) console.log(`      - "${texto.trim().substring(0, 50)}"`);
  }
  
  const seletoresBtnPagamento = [
    page.getByRole('button', { name: 'Ir para o pagamento Prosseguir' }),
    page.getByRole('button', { name: /Ir para o pagamento/i }),
    page.locator('button:has-text("Ir para o pagamento")'),
    page.locator('button:has-text("pagamento")').first(),
    page.locator('button:has-text("Prosseguir")').first(),
    page.getByRole('button', { name: /Continuar/i }).first()
  ];
  
  let clicouPagamento = false;
  
  for (const btn of seletoresBtnPagamento) {
    try {
      if (await btn.isVisible({ timeout: 3000 })) {
        const textoBtn = await btn.innerText().catch(() => 'botão');
        console.log(`📍 Encontrou botão "${textoBtn.trim().substring(0, 30)}", clicando...`);
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btn.click();
        clicouPagamento = true;
        console.log('✅ Clicou no botão de pagamento!');
        await page.waitForTimeout(5000);
        break;
      }
    } catch (e) {
      // Tenta próximo
    }
  }
  
  if (!clicouPagamento) {
    console.log('⚠️ Botão "Ir para o pagamento" não encontrado');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 3: Página de Pagamento → Clicar em "Continuar Inscrição"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 CHECKOUT: Página de Pagamento...');
  
  await page.waitForTimeout(5000);
  
  // Remove overlays antes de procurar o botão
  await removerOverlays();
  
  // Procura botão "Continuar Inscrição" (usando seletor exato)
  console.log('📍 Procurando botão "Continuar Inscrição"...');
  const btnContinuarInscricao = page.getByRole('button', { name: 'Continuar Inscrição' });
  
  try {
    await btnContinuarInscricao.waitFor({ state: 'visible', timeout: 15000 });
    console.log('📍 Encontrou botão "Continuar Inscrição", clicando...');
    await btnContinuarInscricao.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await btnContinuarInscricao.click();
    console.log('✅ Clicou em "Continuar Inscrição"!');
    
    // Aguarda página de confirmação (orderPlaced)
    console.log('⏳ Aguardando confirmação do pedido...');
    await page.waitForTimeout(15000);
  } catch (e) {
    console.log('⚠️ Erro ao clicar em "Continuar Inscrição":', e.message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO CRÍTICA: Chegou ao orderPlaced?
  // ═══════════════════════════════════════════════════════════════════════════
  let urlAposCheckout = page.url();
  
  if (!urlAposCheckout.includes('orderPlaced')) {
    console.log(`⚠️ URL ainda não é orderPlaced: ${urlAposCheckout}`);
    
    // Tenta clicar novamente em botões de avanço
    const MAX_TENTATIVAS = 3;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} de avançar no checkout...`);
      
      // Lista botões disponíveis
      const botoesDisponiveis = await page.locator('button:visible').allTextContents().catch(() => []);
      console.log(`   📋 Botões: ${botoesDisponiveis.slice(0, 5).join(' | ')}`);
      
      // Tenta clicar em botões de avanço
      const seletoresAvancar = [
        page.getByRole('button', { name: /Ir para o pagamento/i }),
        page.locator('button:has-text("Ir para o pagamento")'),
        page.getByRole('button', { name: 'Continuar Inscrição' }),
        page.locator('button:has-text("Continuar Inscrição")'),
        page.locator('button:has-text("Prosseguir")').first(),
        page.locator('button:has-text("Finalizar")').first()
      ];
      
      for (const btn of seletoresAvancar) {
        try {
          if (await btn.isVisible({ timeout: 2000 })) {
            const textoBtn = await btn.innerText().catch(() => 'botão');
            console.log(`   📍 Clicando em "${textoBtn.trim().substring(0, 30)}"...`);
            await btn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await btn.click({ force: true });
            await page.waitForTimeout(5000);
            
            urlAposCheckout = page.url();
            if (urlAposCheckout.includes('orderPlaced')) {
              console.log('   ✅ Chegou ao orderPlaced!');
              break;
            }
          }
        } catch (e) {}
      }
      
      if (urlAposCheckout.includes('orderPlaced')) break;
      await page.waitForTimeout(2000);
    }
    
    // Verifica se finalmente chegou
    urlAposCheckout = page.url();
    if (!urlAposCheckout.includes('orderPlaced')) {
      console.log('');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('❌  ERRO: NÃO CONSEGUIU FINALIZAR O CHECKOUT!');
      console.log(`❌  URL atual: ${urlAposCheckout}`);
      console.log('❌  O checkout pode ter falhado ou há campos obrigatórios faltando.');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('❌ INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA - Checkout não foi concluído');
      await page.screenshot({ path: 'erro-checkout-nao-concluido.png', fullPage: true });
      return;
    }
  }
  
  console.log(`✅ CHECKOUT CONCLUÍDO`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: FINALIZAÇÃO - Clicar em "Continuar Processo"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Finalização');
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log(`📍 URL atual: ${page.url()}`);
  
  await page.waitForTimeout(5000);
  
  // Procura pelo link/botão "Continuar Processo"
  const linkContinuarProcesso = page.getByRole('link', { name: 'Continuar Processo' });
  const btnContinuarProcesso = page.locator('a:has-text("Continuar Processo"), button:has-text("Continuar Processo")').first();
  
  let novaAba = null;
  
  // Tenta clicar em "Continuar Processo"
  if (await linkContinuarProcesso.isVisible({ timeout: 10000 }).catch(() => false)) {
    console.log('📍 Encontrou "Continuar Processo", clicando...');
    const page1Promise = page.waitForEvent('popup', { timeout: 60000 });
    await linkContinuarProcesso.click();
    novaAba = await page1Promise;
    console.log('✅ Nova aba aberta!');
  } else if (await btnContinuarProcesso.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('📍 Encontrou botão "Continuar Processo", clicando...');
    const page1Promise = page.waitForEvent('popup', { timeout: 60000 });
    await btnContinuarProcesso.click();
    novaAba = await page1Promise;
    console.log('✅ Nova aba aberta!');
  } else {
    console.log('ℹ️ Link "Continuar Processo" não encontrado');
    console.log('📍 Verificando outros botões na página...');
    
    // Lista todos os botões visíveis para debug
    const botoes = await page.locator('button').all();
    console.log(`   Botões encontrados: ${botoes.length}`);
    for (let i = 0; i < Math.min(botoes.length, 5); i++) {
      const texto = await botoes[i].innerText().catch(() => '');
      if (texto) console.log(`   - "${texto.trim()}"`);
    }
    
    // PAUSA PARA DEBUG
    console.log('');
    console.log('⏸️  PAUSADO PARA DEBUG - "Continuar Processo" não encontrado');
    await page.pause();
  }
  
  let numeroInscricao = null;
  let numeroInscricaoCapturado = null;
  
  if (novaAba) {
    console.log('⏳ Página aberta!');
    await novaAba.waitForTimeout(2000);
    console.log(`📍 URL da nova aba: ${novaAba.url()}`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INTERCEPTADOR DE REQUISIÇÃO - Captura numeroInscricao de getProvaUrl
    // ═══════════════════════════════════════════════════════════════════════════
    novaAba.on('request', request => {
      const url = request.url();
      if (url.includes('getProvaUrl')) {
        console.log('');
        console.log('🔍 INTERCEPTADO: Requisição getProvaUrl detectada!');
        console.log(`   URL: ${url}`);
        
        try {
          const urlObj = new URL(url);
          const numeroInscricao = urlObj.searchParams.get('numeroInscricao');
          if (numeroInscricao) {
            numeroInscricaoCapturado = numeroInscricao;
            console.log(`   ✅ NÚMERO DE INSCRIÇÃO CAPTURADO: ${numeroInscricao}`);
          }
          
          // Log de todos os parâmetros para debug
          console.log('   📋 Parâmetros da requisição:');
          for (const [key, value] of urlObj.searchParams.entries()) {
            console.log(`      - ${key}: ${value}`);
          }
        } catch (e) {
          console.log(`   ⚠️ Erro ao parsear URL: ${e.message}`);
        }
      }
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Capturar número de inscrição
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('🔍 Capturando número de inscrição...');
    
    try {
      // Método 1: Procura por texto que contenha número de inscrição
      const textosPagina = await novaAba.locator('text=/Inscrição.*\\d+|Nº.*\\d+|#\\d+/i').first().textContent({ timeout: 3000 }).catch(() => null);
      if (textosPagina) {
        const match = textosPagina.match(/(\d{5,})/);
        if (match) {
          numeroInscricao = match[1];
          console.log(`   ✅ Número de inscrição encontrado (texto): ${numeroInscricao}`);
        }
      }
      
      // Método 2: Procura na URL do orderPlaced
      if (!numeroInscricao) {
        const urlOrderPlaced = page.url();
        const matchOg = urlOrderPlaced.match(/og=(\d+)/);
        if (matchOg) {
          numeroInscricao = matchOg[1];
          console.log(`   ✅ Número de inscrição encontrado (URL og): ${numeroInscricao}`);
        }
      }
      
      // Método 3: Procura em spans ou divs com número grande
      if (!numeroInscricao) {
        const elementosComNumero = await novaAba.locator('span, div, p').filter({ hasText: /^\d{5,}$/ }).first().textContent({ timeout: 2000 }).catch(() => null);
        if (elementosComNumero) {
          const match = elementosComNumero.match(/(\d{5,})/);
          if (match) {
            numeroInscricao = match[1];
            console.log(`   ✅ Número de inscrição encontrado (elemento): ${numeroInscricao}`);
          }
        }
      }
      
      if (numeroInscricao) {
        // Imprime no formato esperado pelo server.js
        console.log(`Número de Inscrição extraído do token: ${numeroInscricao}`);
      } else {
        console.log('   ⚠️ Número de inscrição não encontrado na página');
      }
    } catch (e) {
      console.log(`   ⚠️ Erro ao capturar número: ${e.message}`);
    }
    
    // Screenshot final
    await novaAba.screenshot({ path: 'inscricao-enem-sem-nota-finalizada.png', fullPage: true });
    console.log('📸 Screenshot salvo em: inscricao-enem-sem-nota-finalizada.png');
    
    // Verifica se chegou à página correta (minhas-inscricoes)
    const urlNovaAba = novaAba.url();
    const chegouNaPaginaCorreta = urlNovaAba.includes('minhas-inscricoes') || urlNovaAba.includes('account');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NÚMERO DE INSCRIÇÃO FINAL - Prioriza o capturado da requisição getProvaUrl
    // ═══════════════════════════════════════════════════════════════════════════
    const numeroInscricaoFinal = numeroInscricaoCapturado || numeroInscricao;
    
    if (numeroInscricaoFinal) {
      // Imprime no formato esperado pelo server.js para extração
      console.log(`NUMERO_INSCRICAO_EXTRAIDO: ${numeroInscricaoFinal}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RESULTADO FINAL
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (chegouNaPaginaCorreta) {
      console.log('🎉 INSCRIÇÃO ENEM (SEM NOTA) FINALIZADA COM SUCESSO!');
      if (numeroInscricaoFinal) {
        console.log(`📋 Número de Inscrição: ${numeroInscricaoFinal}`);
        if (numeroInscricaoCapturado) {
          console.log(`   (Fonte: Requisição getProvaUrl)`);
        } else {
          console.log(`   (Fonte: Página - fallback)`);
        }
      }
      console.log('📋 Notas do ENEM deverão ser preenchidas posteriormente pelo aluno.');
    } else {
      console.log('❌ INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA - Não chegou à página de inscrições');
      if (numeroInscricaoFinal) {
        console.log(`📋 Número de Inscrição: ${numeroInscricaoFinal}`);
      }
    }
    console.log(`📍 URL final: ${page.url()}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
  } else {
    // Nova aba não foi aberta - inscrição não chegou ao final
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('❌ INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA - Não chegou à página de inscrições');
  console.log(`📍 URL final: ${page.url()}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  }
});

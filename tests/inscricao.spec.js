import { test, expect } from '@playwright/test';

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

// Gera número de residência aleatório entre 1 e 999
const numeroAleatorio = Math.floor(Math.random() * 999) + 1;

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

// Função para capitalizar nome (primeira letra maiúscula de cada palavra)
function capitalizarNome(nome) {
  return corrigirAcentos(nome).toLowerCase().split(' ').map(palavra => 
    palavra.charAt(0).toUpperCase() + palavra.slice(1)
  ).join(' ');
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
  numero: process.env.CLIENTE_NUMERO || String(numeroAleatorio),
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
  // Localização
  estado: corrigirAcentos(process.env.CLIENTE_ESTADO) || 'São Paulo',
  cidade: corrigirAcentos(process.env.CLIENTE_CIDADE) || 'São Paulo',
  // Curso
  curso: corrigirAcentos(process.env.CLIENTE_CURSO) || 'pedagogia',
  polo: corrigirAcentos(process.env.CLIENTE_POLO) || 'vila mariana',
  tipoVestibular: corrigirAcentos(process.env.CLIENTE_TIPO_VESTIBULAR) || 'Vestibular Múltipla Escolha',
};

test('test', async ({ page }) => {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VARIÁVEIS DE CONTROLE PARA FALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════
  let poloUsado = CLIENTE.polo;
  let vestibularUsado = CLIENTE.tipoVestibular;
  let tentouVestibularAlternativo = false;
  
  // Exibe dados do cliente no início
  console.log('');
  console.log('📋 DADOS DO CLIENTE:');
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
  console.log(`   Vestibular: ${CLIENTE.tipoVestibular}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda carregamento com verificação
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarCarregamento(descricao, timeout = 20000) {
    console.log(`⏳ Aguardando: ${descricao}...`);
    const inicio = Date.now();
    
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      // Continua mesmo se der timeout
    }
    
    await page.waitForTimeout(800);
    await aguardarCarregandoDesaparecer();
    
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`✅ ${descricao} - carregado em ${duracao}s`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda indicador "Carregando..." desaparecer
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarCarregandoDesaparecer(maxTentativas = 10) {
    const carregandoTexto = page.locator('text=Carregando...').first();
    
    try {
      const visivel = await carregandoTexto.isVisible({ timeout: 500 });
      
      if (visivel) {
        console.log('   ⏳ Aguardando "Carregando..." desaparecer...');
        
        for (let i = 0; i < maxTentativas; i++) {
          await page.waitForTimeout(500);
          const aindaVisivel = await carregandoTexto.isVisible({ timeout: 300 }).catch(() => false);
          if (!aindaVisivel) {
            console.log('   ✅ Carregamento concluído!');
            await page.waitForTimeout(300);
            return;
          }
        }
        console.log('   ⚠️ Timeout aguardando carregamento, continuando...');
      }
    } catch (e) {
      // Não há indicador de carregamento
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Verifica e preenche campo com retry
  // ═══════════════════════════════════════════════════════════════════════════
  async function preencherCampo(locator, valor, descricao, digitarLetraPorLetra = true) {
    console.log(`📝 Preenchendo: ${descricao}...`);
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(200);
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
    await page.waitForTimeout(100);
    await locator.clear();
    
    if (digitarLetraPorLetra) {
      await locator.type(valor, { delay: 25 });
    } else {
      await locator.fill(valor);
    }
    
    await page.waitForTimeout(200);
    
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
  // FUNÇÃO AUXILIAR: Clica com verificação e retry
  // ═══════════════════════════════════════════════════════════════════════════
  async function clicarComVerificacao(locator, descricao, verificacao = null, maxTentativas = 2) {
    console.log(`🖱️ Clicando em: ${descricao}...`);
    
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        await locator.waitFor({ state: 'visible', timeout: 8000 });
        await locator.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        
        const desabilitado = await locator.isDisabled().catch(() => false);
        if (desabilitado) {
          console.log(`   ⏳ Botão desabilitado, aguardando...`);
          await page.waitForTimeout(1000);
          continue;
        }
        
        await locator.click({ force: tentativa > 1 });
        await page.waitForTimeout(500);
        
        if (verificacao) {
          const verificado = await verificacao();
          if (verificado) {
            console.log(`✅ ${descricao} - clicado e verificado!`);
            return true;
          } else {
            console.log(`   ⚠️ Tentativa ${tentativa}: clique não teve efeito`);
            await page.waitForTimeout(500);
          }
        } else {
          console.log(`✅ ${descricao} - clicado!`);
          return true;
        }
      } catch (e) {
        console.log(`   ⚠️ Tentativa ${tentativa} falhou: ${e.message}`);
        if (tentativa < maxTentativas) await page.waitForTimeout(500);
      }
    }
    
    console.log(`❌ Falha ao clicar em: ${descricao}`);
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda mudança de URL ou elemento
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarMudanca(opcoes = {}) {
    const { urlContem, urlNaoContem, elementoVisivel, elementoInvisivel, timeout = 10000 } = opcoes;
    const inicio = Date.now();
    
    while (Date.now() - inicio < timeout) {
      const urlAtual = page.url();
      
      if (urlContem && urlAtual.includes(urlContem)) return true;
      if (urlNaoContem && !urlAtual.includes(urlNaoContem)) return true;
      
      if (elementoVisivel) {
        const visivel = await elementoVisivel.isVisible().catch(() => false);
        if (visivel) return true;
      }
      
      if (elementoInvisivel) {
        const visivel = await elementoInvisivel.isVisible().catch(() => true);
        if (!visivel) return true;
      }
      
      await page.waitForTimeout(300);
    }
    
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Seleciona opção em react-select com verificação
  // ═══════════════════════════════════════════════════════════════════════════
  async function selecionarOpcao(selectLocator, textoDigitar, opcaoNome, descricao) {
    console.log(`🔽 Selecionando: ${descricao}...`);
    
    await aguardarCarregandoDesaparecer();
    
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        await selectLocator.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(200);
        await selectLocator.scrollIntoViewIfNeeded();
    await selectLocator.click();
        await page.waitForTimeout(300);
        
        const menuAberto = await page.locator('.react-select__menu').isVisible().catch(() => false);
        if (!menuAberto) {
          console.log(`   ⚠️ Menu não abriu, tentativa ${tentativa}...`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          continue;
        }
        
        await page.keyboard.type(textoDigitar, { delay: 30 });
        await page.waitForTimeout(800);
    
    if (opcaoNome) {
      const opcao = page.getByRole('option', { name: opcaoNome });
          await opcao.waitFor({ state: 'visible', timeout: 5000 });
      await opcao.click();
    } else {
          const opcoesDisponiveis = await page.locator('.react-select__option').count();
          console.log(`   📋 Opções: ${opcoesDisponiveis}`);
          if (opcoesDisponiveis > 0) {
      await page.keyboard.press('Enter');
          } else {
            console.log(`   ⚠️ Nenhuma opção para "${textoDigitar}"`);
            await page.keyboard.press('Escape');
            continue;
          }
    }
    
        await page.waitForTimeout(500);
    await aguardarCarregandoDesaparecer();
    
    console.log(`✅ ${descricao} selecionado!`);
        return true;
        
      } catch (e) {
        console.log(`   ⚠️ Erro tentativa ${tentativa}: ${e.message}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
    
    console.log(`❌ Falha ao selecionar: ${descricao}`);
    return false;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🚀 INICIANDO SCRIPT DE INSCRIÇÃO - CRUZEIRO DO SUL');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
  await aguardarCarregamento('Página de login');
  
  // Email
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await preencherCampo(emailInput, 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', 'Email admin', false);
  
  // Clica continuar
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(1000);
  
  // Senha
  const senhaInput = page.getByRole('textbox', { name: 'Senha' });
  await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
  await senhaInput.fill('MFPedu!t678@!');
  console.log('✅ Senha preenchida');
  
  // Clica continuar para login
  await page.getByRole('button', { name: 'Continuar' }).click();
  await aguardarCarregamento('Login', 30000);
  await page.waitForTimeout(1500);
  
  console.log(`✅ ETAPA 1 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO PARA GRADUAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Graduação');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Verifica se já está na página de graduação - com retry
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
  await page.waitForTimeout(3000); // Espera mais tempo para o banner aparecer
  
  // Função para aceitar cookies - tenta várias vezes
  async function aceitarCookiesObrigatorio() {
    const MAX_TENTATIVAS = 5;
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} de aceitar cookies...`);
      
      // Lista de seletores para tentar
      const seletores = [
        { tipo: 'role', loc: page.getByRole('button', { name: 'Aceitar todos' }) },
        { tipo: 'role', loc: page.getByRole('button', { name: 'Aceitar Todos' }) },
        { tipo: 'text', loc: page.getByText('Aceitar todos') },
        { tipo: 'text', loc: page.getByText('Aceitar Todos') },
        { tipo: 'locator', loc: page.locator('button').filter({ hasText: /aceitar todos/i }).first() },
        { tipo: 'locator', loc: page.locator('button').filter({ hasText: /aceitar/i }).first() },
        { tipo: 'locator', loc: page.locator('[class*="cookie"] button').first() },
        { tipo: 'locator', loc: page.locator('#onetrust-accept-btn-handler') },
        { tipo: 'css', loc: page.locator('button:has-text("Aceitar")').first() },
        { tipo: 'css', loc: page.locator('[class*="lgpd"] button').first() },
        { tipo: 'css', loc: page.locator('[class*="consent"] button').first() },
      ];
      
      for (const { tipo, loc } of seletores) {
        try {
          const count = await loc.count();
          if (count > 0) {
            const isVis = await loc.isVisible({ timeout: 2000 });
            if (isVis) {
              console.log(`   📍 Encontrou botão de cookies (${tipo})`);
              await loc.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
              await loc.click({ force: true, timeout: 5000 });
              console.log('   ✅ Cookies aceitos!');
              await page.waitForTimeout(1500);
              return true;
            }
          }
  } catch (e) {
          // Continua para próximo seletor
        }
      }
      
      // Se não encontrou, espera e tenta novamente
      if (tentativa < MAX_TENTATIVAS) {
        console.log(`   ⏳ Aguardando mais 2s...`);
        await page.waitForTimeout(2000);
        
        // Tenta scroll para ver se o banner aparece
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(500);
        await page.mouse.wheel(0, -100);
      }
    }
    
    return false;
  }
  
  const cookieAceito = await aceitarCookiesObrigatorio();
  
  if (!cookieAceito) {
    console.log('⚠️ AVISO: Banner de cookies não encontrado - continuando mesmo assim');
  }
  
  // Fecha modais se existirem
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000)
  
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
  // FUNÇÃO: Login do cliente com validação
  // ═══════════════════════════════════════════════════════════════════════════
  async function fazerLoginCliente() {
    const MAX_TENTATIVAS = 3;
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} de login do cliente...`);
      
      // 1. Clica em "Entrar como cliente"
      console.log('   📍 Procurando "Entrar como cliente"...');
  const entrarComoCliente = page.getByText('Entrar como cliente').first();
      
      try {
        await entrarComoCliente.waitFor({ state: 'visible', timeout: 10000 });
        await entrarComoCliente.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
  await entrarComoCliente.click({ force: true });
        console.log('   ✅ Clicou em "Entrar como cliente"');
      } catch (e) {
        console.log('   ⚠️ "Entrar como cliente" não encontrado');
        continue;
      }
      
  await page.waitForTimeout(2000);
  
      // 2. Preenche o email
      console.log('   📝 Procurando campo de email...');
      const emailCliente = page.getByPlaceholder('Ex: example@mail.com');
      
      try {
        await emailCliente.waitFor({ state: 'visible', timeout: 10000 });
        await emailCliente.click();
        await emailCliente.fill('');
        await emailCliente.type(CLIENTE.email, { delay: 50 });
        console.log(`   ✅ Email preenchido: "${CLIENTE.email}"`);
      } catch (e) {
        console.log('   ⚠️ Erro ao preencher email');
  await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        continue;
      }
      
      await page.waitForTimeout(1000);
      
      // 3. Clica no botão "Entrar"
      console.log('   📍 Clicando em "Entrar"...');
      const btnEntrar = page.getByRole('button', { name: 'Entrar' });
      
      try {
        await btnEntrar.waitFor({ state: 'visible', timeout: 5000 });
        await btnEntrar.click();
        console.log('   ✅ Clicou em "Entrar"');
      } catch (e) {
        console.log('   ⚠️ Botão "Entrar" não encontrado');
        continue;
      }
      
      // 4. Aguarda e verifica se o login foi efetivado
      console.log('   ⏳ Aguardando login ser processado...');
  await page.waitForTimeout(3000);
      
      // 5. VALIDAÇÃO: Verifica se o nome do cliente aparece no header
      console.log('   🔍 Validando login...');
      
      // Procura pelo nome do cliente ou email no header
      const emailPrefix = CLIENTE.email.split('@')[0].toLowerCase();
      const headerText = await page.locator('header').innerText().catch(() => '');
      const headerLower = headerText.toLowerCase();
      
      // Verifica se o header contém o email/nome do cliente
      const clienteLogado = headerLower.includes(emailPrefix) || 
                            headerLower.includes('olá') ||
                            headerLower.includes(CLIENTE.email.toLowerCase());
      
      // Também verifica se não aparece mais "Entrar como cliente"
      const entrarAindaVisivel = await entrarComoCliente.isVisible({ timeout: 2000 }).catch(() => false);
      
      console.log(`   📋 Header contém cliente: ${clienteLogado}`);
      console.log(`   📋 "Entrar como cliente" ainda visível: ${entrarAindaVisivel}`);
      
      if (clienteLogado || !entrarAindaVisivel) {
        console.log('   ✅ LOGIN VALIDADO COM SUCESSO!');
        return true;
      }
      
      console.log('   ⚠️ Login não confirmado, tentando novamente...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
    
    return false;
  }
  
  const loginSucesso = await fazerLoginCliente();
  
  if (!loginSucesso) {
    console.log('❌ ERRO: Não foi possível fazer login do cliente após várias tentativas');
    // Continua mesmo assim para tentar o fluxo
  }
  
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
    page.locator('input[name*="search"]').first(),
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
    console.log('   ⚠️ Campo de busca não encontrado pelos seletores padrão');
    // Tenta screenshot para debug
    await page.screenshot({ path: 'debug-busca-nao-encontrada.png', fullPage: true });
    throw new Error('Campo de busca não encontrado');
  }
  
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  
  // Usa texto sem acentos para a busca (evita problemas de encoding)
  const cursoParaBusca = removerAcentos(CLIENTE.curso);
  console.log(`🔍 Digitando na busca: "${cursoParaBusca}" (original: ${CLIENTE.curso})`);
  
  // Clica e limpa o campo usando keyboard (mais confiável em headless)
  await searchInput.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(100);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  
  // Digita usando keyboard (mais confiável em headless)
  console.log('   📍 Digitando curso...');
  await page.keyboard.type(cursoParaBusca, { delay: 100 });
  await page.waitForTimeout(1500);
  
  console.log('   📍 Pressionando Enter...');
  await page.keyboard.press('Enter');
  
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
    
    // ESTRATÉGIA: Rolar a tela até encontrar um botão azul e clicar nele
    console.log('   📜 Rolando a página para encontrar os cards...');
    
    // Rola a página para baixo para carregar os cards
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1000);
    
    // Procura pelo PRIMEIRO botão/link azul dentro de um card de curso
    // O botão azul geralmente é um <a> com classe que contém 'button' ou dentro de um card
    console.log('   🔍 Procurando botão azul do primeiro card...');
    
    // Lista de seletores para o botão azul do card
    const seletoresBotaoAzul = [
      // Botões com texto específico de modalidade
      page.locator('a').filter({ hasText: /^Semipresencial$/i }).first(),
      page.locator('a').filter({ hasText: /^EAD Digital$/i }).first(),
      page.locator('a').filter({ hasText: /^EAD$/i }).first(),
      // Links dentro de articles/cards que levam a /p
      page.locator('article a[href$="/p"]').first(),
      page.locator('[class*="product"] a[href$="/p"]').first(),
      page.locator('[class*="card"] a[href$="/p"]').first(),
      // Links com grad- no href
      page.locator('a[href*="grad-"][href$="/p"]').first(),
      // Qualquer link que parece ser um botão de ação
      page.locator('a[class*="button"]').first(),
      page.locator('a[class*="btn"]').first(),
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
            console.log(`   📍 Encontrou botão: "${texto.trim()}" -> ${href}`);
            
            await seletor.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await seletor.click({ force: true });
            console.log('   ✅ Clicou no botão!');
            clicouNoBotao = true;
            break;
          }
        }
      } catch (e) {
        // Continua para próximo seletor
      }
    }
    
    // Se ainda não clicou, tenta clicar em qualquer link visível que leve a um produto
    if (!clicouNoBotao) {
      console.log('   ⚠️ Tentando fallback: primeiro link de produto...');
      try {
        // Pega todos os links visíveis
        const todosLinks = page.locator('a[href*="/p"]');
        const count = await todosLinks.count();
        console.log(`   📋 Total de links /p: ${count}`);
        
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
              clicouNoBotao = true;
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
    
    // Se ainda está em página de busca, tenta de novo com scroll maior
    if (page.url().includes('?map=') || page.url().includes('?_q=')) {
      console.log('   ⚠️ Ainda em página de busca, tentando scroll e clique...');
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1500);
      
      // Tenta clicar no primeiro link grad- visível
      const linkGrad = page.locator('a[href*="grad-"]').first();
      try {
        await linkGrad.scrollIntoViewIfNeeded();
        await linkGrad.click({ force: true, timeout: 5000 });
      } catch (e) {
        console.log('   ⚠️ Não conseguiu clicar no link');
      }
    }
  } else {
    console.log('✅ Já está na página do produto');
  }
  
  await aguardarCarregamento('Página do produto', 30000);
  console.log(`📍 URL atual: ${page.url()}`);
  await page.waitForTimeout(1000);
  
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
  await page.waitForTimeout(1500);
  
  // Fecha modal/backdrop se existir (pode bloquear cliques)
  console.log('📍 Verificando se há modal bloqueando...');
  try {
    // Tenta fechar com Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Tenta clicar no backdrop para fechar
    const backdrop = page.locator('[class*="backdrop"], [class*="Backdrop"], [class*="overlay"]').first();
    if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('   📍 Backdrop encontrado, fechando...');
      await backdrop.click({ force: true });
      await page.waitForTimeout(500);
    }
    
    // Tenta fechar botão X se existir
    const btnFechar = page.locator('button[class*="close"], [class*="close"] button, button:has-text("×")').first();
    if (await btnFechar.isVisible({ timeout: 500 }).catch(() => false)) {
      await btnFechar.click({ force: true });
      await page.waitForTimeout(500);
    }
    
    // Pressiona Escape novamente
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    // Ignora erros ao fechar modal
  }
  
  // Nome completo - usa force para evitar problemas com overlays
  const nomeInput = page.getByRole('textbox', { name: 'Nome completo' });
  console.log('📝 Preenchendo: Nome completo...');
  try {
    await nomeInput.waitFor({ state: 'visible', timeout: 15000 });
    await nomeInput.scrollIntoViewIfNeeded();
    await nomeInput.click({ force: true });
    await page.waitForTimeout(100);
    await nomeInput.fill(CLIENTE.nome);
    console.log(`✅ Nome completo: "${CLIENTE.nome}"`);
  } catch (e) {
    console.log(`⚠️ Erro ao preencher nome: ${e.message}`);
    // Tenta novamente com force
    await nomeInput.fill(CLIENTE.nome, { force: true });
  }
  
  // Telefone - usa force para evitar problemas com overlays
  const telefoneInput = page.getByRole('textbox', { name: '(XX) XXXXX-XXXX' });
  console.log('📝 Preenchendo: Telefone...');
  try {
    await telefoneInput.waitFor({ state: 'visible', timeout: 10000 });
    await telefoneInput.scrollIntoViewIfNeeded();
    await telefoneInput.click({ force: true });
    await page.waitForTimeout(100);
    await telefoneInput.type(CLIENTE.telefone, { delay: 25 });
    console.log(`✅ Telefone preenchido`);
  } catch (e) {
    console.log(`⚠️ Erro ao preencher telefone: ${e.message}`);
  }
  
  // Checkbox de termos
  console.log('📝 Marcando checkbox de termos...');
  
  // Aguarda carregamento antes de marcar checkbox
  await aguardarCarregandoDesaparecer();
  
  const checkboxByText = page.locator('[class*="checkbox"]').filter({ hasText: /política|privacidade/i }).first();
  await checkboxByText.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await checkboxByText.click({ force: true });
  console.log('✅ Checkbox de termos marcado');
  
  await page.waitForTimeout(1000);
  
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
    await page.waitForTimeout(1500);
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
    await page.waitForTimeout(1000);
    
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
      await page.waitForTimeout(1500);
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
      
      await page.waitForTimeout(1000);
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
  await page.waitForTimeout(1000);
  
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
  
  await primeiroSelect.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  
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
  
  // Cidade
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(2),
    CLIENTE.cidade,
    null,
    'Cidade'
  );
  
  // Polo - tenta o polo solicitado primeiro, depois fallbacks em ordem de prioridade
  const polosFallback = [
    'sapopemba',
    'vila prudente 2',
    'vila mariana',
    'santana 2',
    'morumbi'
  ];
  
  let poloSelecionado = false;
  
  // Primeiro tenta o polo solicitado
  console.log(`🔽 Tentando polo solicitado: "${CLIENTE.polo}"`);
  poloSelecionado = await selecionarOpcao(
    page.locator('.react-select__input-container').nth(3),
    CLIENTE.polo,
    null,
    'Polo'
  );
  
  // Se não encontrou, tenta os polos de fallback em ordem
  if (!poloSelecionado) {
    console.log('');
    console.log('⚠️ Polo solicitado não encontrado, tentando polos alternativos...');
    
    for (const poloAlternativo of polosFallback) {
      // Pula se for o mesmo que já tentou
      if (poloAlternativo.toLowerCase() === CLIENTE.polo.toLowerCase()) {
        continue;
      }
      
      console.log(`   🔄 Tentando polo: "${poloAlternativo}"...`);
      
      // Aguarda um pouco e tenta o próximo polo
      await page.waitForTimeout(500);
      
      poloSelecionado = await selecionarOpcao(
        page.locator('.react-select__input-container').nth(3),
        poloAlternativo,
        null,
        `Polo (${poloAlternativo})`
      );
      
      if (poloSelecionado) {
        poloUsado = poloAlternativo;
        console.log(`   ✅ POLO ALTERNATIVO SELECIONADO: "${poloAlternativo}"`);
        break;
      }
    }
  }

  // Verifica se algum polo foi encontrado
  if (!poloSelecionado) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`❌ ERRO: NENHUM POLO DISPONÍVEL`);
    console.log(`   Polo solicitado: "${CLIENTE.polo}"`);
    console.log(`   Polos tentados: ${polosFallback.join(', ')}`);
    console.log(`   O curso "${CLIENTE.curso}" não está disponível em nenhum dos polos listados.`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    
    // Tira screenshot do erro
    await page.screenshot({ path: 'erro-polo-nao-encontrado.png', fullPage: true });
    console.log('📸 Screenshot salvo: erro-polo-nao-encontrado.png');
    
    return; // Encerra o teste
  }
  
  // Se usou polo diferente do solicitado, loga isso
  if (poloUsado.toLowerCase() !== CLIENTE.polo.toLowerCase()) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`📍 POLO ALTERNATIVO UTILIZADO: "${poloUsado}"`);
    console.log(`   (Polo original solicitado: "${CLIENTE.polo}")`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
  }

  // CPF
  const cpfInput = page.locator('input[name="userDocument"]');
  await preencherCampo(cpfInput, CLIENTE.cpf, 'CPF');
  
  // Remove overlays antes de clicar
  await removerOverlays();
  
  // Continuar Inscrição - com verificação de mudança de estado
  console.log('📍 Clicando em "Continuar Inscrição" (Etapa 6)...');
  const continuarBtn1 = page.getByRole('button', { name: 'Continuar Inscrição' });
  
  // Guarda número de selects antes do clique
  const selectsAntes = await page.locator('.react-select__control').count();
  console.log(`   📋 Selects antes do clique: ${selectsAntes}`);
  
  const clicouContinuar1 = await clicarComVerificacao(
    continuarBtn1,
    'Continuar Inscrição (Etapa 6)',
    async () => {
      await page.waitForTimeout(1000);
      // Verifica se apareceram novos selects (próxima etapa) ou se a URL mudou
      const selectsDepois = await page.locator('.react-select__control').count();
      const urlMudou = !page.url().includes('/p');
      console.log(`   📋 Selects depois: ${selectsDepois}, URL mudou: ${urlMudou}`);
      return selectsDepois !== selectsAntes || urlMudou;
    }
  );
  
  if (!clicouContinuar1) {
    console.log('⚠️ Tentando clicar novamente com força...');
    await continuarBtn1.click({ force: true });
  }
  
  await aguardarCarregamento('Próxima etapa', 30000);
  await page.waitForTimeout(1500);
  
  // Verifica se realmente mudou para próxima etapa
  const selectsEtapa7 = await page.locator('.react-select__control').count();
  console.log(`📍 Verificação: ${selectsEtapa7} selects na página atual`);
  
  console.log(`✅ ETAPA 6 CONCLUÍDA`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 7: VESTIBULAR E CONDIÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Vestibular e Condições');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Vestibular - determina o texto de busca baseado no tipo
  let textoBuscaVestibular = 'vest';
  const tipoLower = CLIENTE.tipoVestibular.toLowerCase();
  
  if (tipoLower.includes('redac') || tipoLower.includes('redação')) {
    textoBuscaVestibular = 'redac';
  } else if (tipoLower.includes('mult') || tipoLower.includes('múltipla')) {
    textoBuscaVestibular = 'mult';
  } else if (tipoLower.includes('enem')) {
    textoBuscaVestibular = 'enem';
  }
  
  console.log(`   🔍 Buscando vestibular com: "${textoBuscaVestibular}" para encontrar: "${CLIENTE.tipoVestibular}"`);
  
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    textoBuscaVestibular,
    null, // Deixa selecionar a primeira opção que aparecer
    'Tipo de Vestibular'
  );
  
  await page.waitForTimeout(1000);
  
  // Condições especiais
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    'nao neces',
    null,
    'Condições Especiais'
  );
  
  // Remove overlays antes de clicar (Etapa 7)
  await removerOverlays();
  
  // Continuar Inscrição - com verificação de mudança de página
  console.log('📍 Clicando em Continuar Inscrição (Etapa 7)...');
  const btnContinuarEtapa7 = page.getByRole('button', { name: 'Continuar Inscrição' });
  const urlAntesEtapa7 = page.url();
  
  const clicouContinuar7 = await clicarComVerificacao(
    btnContinuarEtapa7,
    'Continuar Inscrição (Etapa 7)',
    async () => {
      await page.waitForTimeout(1500);
      const urlDepois = page.url();
      const mudouUrl = urlDepois !== urlAntesEtapa7;
      const temCheckout = urlDepois.includes('checkout');
      const temErro = await page.locator('text=Este CPF já possui uma inscrição').isVisible().catch(() => false);
      console.log(`   📋 URL mudou: ${mudouUrl}, Checkout: ${temCheckout}, Erro CPF: ${temErro}`);
      return mudouUrl || temCheckout || temErro;
    }
  );
  
  if (!clicouContinuar7) {
    // Verifica se já navegou para o checkout
    const urlAtual = page.url();
    if (urlAtual.includes('checkout')) {
      console.log('✅ Já navegou para o checkout!');
    } else {
      console.log('⚠️ Botão pode não ter respondido, tentando novamente...');
      try {
        await btnContinuarEtapa7.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('ℹ️ Botão não disponível, verificando se navegou...');
      }
    }
  }
  
  // Aguarda próxima página
  console.log('⏳ Aguardando próxima etapa...');
  await page.waitForTimeout(1500);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO: CPF já possui inscrição?
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔍 Verificando se CPF já possui inscrição...');
  const erroInscricao = page.locator('text=Este CPF já possui uma inscrição');
  const erroVisivel = await erroInscricao.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (erroVisivel) {
    // Se ainda não tentou vestibular alternativo, tenta agora
    if (!tentouVestibularAlternativo) {
      console.log('');
      console.log('⚠️ ════════════════════════════════════════════════════════════════════════════');
      console.log('⚠️  CPF JÁ POSSUI INSCRIÇÃO COM ESTE TIPO DE VESTIBULAR!');
      console.log(`⚠️  Tipo atual: "${vestibularUsado}"`);
      console.log('⚠️  Alterando para vestibular alternativo...');
      console.log('⚠️ ════════════════════════════════════════════════════════════════════════════');
      console.log('');
      
      tentouVestibularAlternativo = true;
      
      // Determina o vestibular alternativo
      const vestibularAtualLower = vestibularUsado.toLowerCase();
      let vestibularAlternativo = '';
      let textoBuscaAlternativo = '';
      
      if (vestibularAtualLower.includes('mult') || vestibularAtualLower.includes('múltipla')) {
        vestibularAlternativo = 'Vestibular Redação';
        textoBuscaAlternativo = 'redac';
      } else if (vestibularAtualLower.includes('redac') || vestibularAtualLower.includes('redação')) {
        vestibularAlternativo = 'Vestibular Múltipla Escolha';
        textoBuscaAlternativo = 'mult';
      } else {
        vestibularAlternativo = 'Vestibular Redação';
        textoBuscaAlternativo = 'redac';
      }
      
      console.log(`🔄 Alterando para: "${vestibularAlternativo}"...`);
      
      // Rola para cima para ver o dropdown de forma de ingresso
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      
      // Procura o dropdown que contém "Múltipla" ou "Redação" (já selecionado)
      const selectVestibular = page.locator('.react-select__control').filter({ hasText: /Múltipla|Redação|Vestibular/i }).first();
      await selectVestibular.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await selectVestibular.click();
      await page.waitForTimeout(500);
      
      // Digita para buscar o vestibular alternativo
      await page.keyboard.type(textoBuscaAlternativo, { delay: 30 });
      await page.waitForTimeout(800);
      
      // Seleciona a primeira opção
      const opcoesDisponiveis = await page.locator('.react-select__option').count();
      console.log(`   📋 Opções encontradas: ${opcoesDisponiveis}`);
      
      if (opcoesDisponiveis > 0) {
        await page.keyboard.press('Enter');
        vestibularUsado = vestibularAlternativo;
        console.log(`✅ Vestibular alterado para: "${vestibularAlternativo}"`);
      } else {
        console.log('❌ Não foi possível encontrar vestibular alternativo');
        await page.keyboard.press('Escape');
      }
      
      await page.waitForTimeout(1000);
      
      // Rola para baixo e clica em Continuar Inscrição
      console.log('📍 Clicando em Continuar Inscrição novamente...');
      const btnContinuarRetry = page.getByRole('button', { name: 'Continuar Inscrição' });
      await btnContinuarRetry.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await btnContinuarRetry.click();
      await page.waitForTimeout(2000);
      
      // Verifica novamente se há erro de CPF
      const erroVisivel2 = await erroInscricao.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (erroVisivel2) {
        console.log('');
        console.log('❌ ════════════════════════════════════════════════════════════════════════════');
        console.log('❌  CPF JÁ POSSUI INSCRIÇÃO EM AMBOS OS TIPOS DE VESTIBULAR!');
        console.log(`❌  Tipo original: "${CLIENTE.tipoVestibular}"`);
        console.log(`❌  Tipo alternativo: "${vestibularAlternativo}"`);
        console.log('❌  Não é possível realizar a inscrição com este CPF.');
        console.log('❌ ════════════════════════════════════════════════════════════════════════════');
        console.log('');
        await page.screenshot({ path: 'cpf-ja-inscrito-ambos.png', fullPage: true });
        console.log('📸 Screenshot salvo em: cpf-ja-inscrito-ambos.png');
        console.log('🛑 Processo interrompido.');
        return;
      }
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log(`✅ VESTIBULAR ALTERNATIVO UTILIZADO: "${vestibularAlternativo}"`);
      console.log(`   (Vestibular original solicitado: "${CLIENTE.tipoVestibular}")`);
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('');
      
    } else {
      // Já tentou alternativo e ainda assim deu erro
      console.log('');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('❌  CPF JÁ POSSUI INSCRIÇÃO EM AMBOS OS TIPOS!');
      console.log('❌  Este CPF já possui inscrição em ambos os tipos de vestibular.');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('');
      await page.screenshot({ path: 'cpf-ja-inscrito.png', fullPage: true });
      console.log('📸 Screenshot salvo em: cpf-ja-inscrito.png');
      console.log('🛑 Processo interrompido.');
      return;
    }
  }
  
  console.log('✅ CPF liberado para inscrição');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO CRÍTICA: Chegou ao checkout?
  // ═══════════════════════════════════════════════════════════════════════════
  let urlAtual = page.url();
  const MAX_TENTATIVAS_CHECKOUT = 5;
  
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_CHECKOUT; tentativa++) {
    if (urlAtual.includes('/checkout')) {
      console.log('✅ Chegou ao checkout!');
      break;
    }
    
    if (tentativa === 1) {
      console.log(`⚠️ URL ainda na página do produto: ${urlAtual}`);
      console.log(`🔄 Tentando novamente clicar em "Continuar Inscrição"...`);
    }
    
    // Remove overlays antes de tentar clicar
    await removerOverlays();
    
    // Tenta clicar novamente no botão
    try {
      const btnContinuar = page.getByRole('button', { name: 'Continuar Inscrição' });
      const btnVisivel = await btnContinuar.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (btnVisivel) {
        console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS_CHECKOUT}...`);
        await btnContinuar.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btnContinuar.click({ force: true });
        await page.waitForTimeout(3000);
        urlAtual = page.url();
        
        if (urlAtual.includes('/checkout')) {
          console.log('   ✅ Agora chegou ao checkout!');
          break;
        }
      } else {
        console.log(`   ⚠️ Botão não visível, aguardando...`);
        await page.waitForTimeout(2000);
        urlAtual = page.url();
      }
    } catch (e) {
      console.log(`   ⚠️ Erro na tentativa ${tentativa}: ${e.message}`);
    }
    
    if (tentativa === MAX_TENTATIVAS_CHECKOUT && !urlAtual.includes('/checkout')) {
      console.log('');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('❌  ERRO: NÃO CONSEGUIU IR PARA O CHECKOUT!');
      console.log(`❌  URL atual: ${urlAtual}`);
      console.log('❌  O botão "Continuar Inscrição" pode não estar funcionando.');
      console.log('❌ ════════════════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('❌ INSCRIÇÃO NÃO FINALIZADA - Não conseguiu avançar para o checkout');
      await page.screenshot({ path: 'erro-nao-chegou-checkout.png', fullPage: true });
      return;
    }
  }
  
  console.log(`✅ ETAPA 7 CONCLUÍDA`);
  console.log('');
  
  // Mostra URL atual para debug
  console.log(`📍 URL atual: ${page.url()}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPAS FINAIS: Página de Checkout VTEX
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPAS FINAIS: Página de Checkout');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  urlAtual = page.url();
  console.log(`📍 URL atual: ${urlAtual}`);
  
  // Aguarda página de checkout carregar completamente
  console.log('⏳ Aguardando checkout carregar...');
  await page.waitForTimeout(1000);
  
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
  
  await page.waitForTimeout(1000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 1: Dados Pessoais → Ir para o Endereço
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 CHECKOUT: Verificando Dados Pessoais...');
  
  // Tenta encontrar o campo de data de nascimento com vários seletores
  console.log('📝 Procurando campo de data de nascimento...');
  
  const seletoresData = [
    page.locator('input[name*="birthDate"]').first(),
    page.locator('input[name*="birth"]').first(),
    page.locator('input[placeholder*="nascimento"]').first(),
    page.locator('input[type="date"]').first(),
    page.getByRole('textbox', { name: /nascimento/i }),
    page.locator('input').filter({ hasText: '' }).nth(5) // Campo após telefone
  ];
  
  let campoDataEncontrado = false;
  
  for (const campo of seletoresData) {
    try {
      if (await campo.isVisible({ timeout: 2000 })) {
        const valorAtual = await campo.inputValue().catch(() => '');
        console.log(`   Encontrou campo de data, valor atual: "${valorAtual}"`);
        
        if (!valorAtual || valorAtual.length < 8) {
          await campo.click();
          await page.waitForTimeout(300);
          await campo.clear();
          await campo.type(CLIENTE.nascimento, { delay: 50 });
          console.log(`✅ Data de nascimento preenchida: ${CLIENTE.nascimento}`);
          campoDataEncontrado = true;
          break;
        } else {
          console.log(`ℹ️ Data já preenchida: ${valorAtual}`);
          campoDataEncontrado = true;
          break;
        }
      }
    } catch (e) {
      // Continua tentando próximo seletor
    }
  }
  
  if (!campoDataEncontrado) {
    console.log('⚠️ Campo de data de nascimento não encontrado, listando inputs...');
    const inputs = await page.locator('input:visible').all();
    console.log(`   Total de inputs visíveis: ${inputs.length}`);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const nome = await inputs[i].getAttribute('name').catch(() => '');
      const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
      const valor = await inputs[i].inputValue().catch(() => '');
      console.log(`   Input ${i}: name="${nome}", placeholder="${placeholder}", valor="${valor}"`);
    }
  }
  
  await page.waitForTimeout(1000);
  
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
        await page.waitForTimeout(1000);
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
    console.log('✅ Endereço já está preenchido, verificando se precisa editar...');
    
    // Verifica se tem botão de alterar/editar
    const btnAlterar = page.locator('text=Alterar').first();
    const precisaEditar = await btnAlterar.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!precisaEditar) {
      console.log('✅ Endereço OK, pulando para pagamento...');
    } else {
      console.log('📝 Botão Alterar disponível, mantendo endereço atual');
    }
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
          console.log('❌ INSCRIÇÃO NÃO FINALIZADA - CEP não encontrado');
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
  
  // Verifica e preenche campos de endereço apenas se visíveis
  const campoEnderecoVisivel = await page.getByRole('textbox', { name: 'Endereço *' }).isVisible({ timeout: 2000 }).catch(() => false);
  
  if (campoEnderecoVisivel) {
    // Verifica se o campo Endereço foi preenchido automaticamente
    console.log('📝 Verificando campo Endereço...');
    try {
      const campoEndereco = page.getByRole('textbox', { name: 'Endereço *' });
      const enderecoAtual = await campoEndereco.inputValue().catch(() => '');
      
      if (!enderecoAtual || enderecoAtual.trim() === '' || enderecoAtual.toLowerCase() === 'null') {
        console.log('   ℹ️ Endereço não preenchido pelo CEP, inserindo "Null"...');
        await campoEndereco.click();
        await page.waitForTimeout(200);
        await campoEndereco.fill('Null');
        console.log('✅ Endereço: Null');
      } else {
        console.log(`✅ Endereço já preenchido: "${enderecoAtual}"`);
      }
    } catch (e) {
      console.log('⚠️ Erro ao verificar Endereço:', e.message);
    }
    
    // Verifica e preenche Número
    console.log('📝 Verificando Número...');
  try {
    const campoNumero = page.getByRole('textbox', { name: 'Número *' });
      const numeroAtual = await campoNumero.inputValue().catch(() => '');
      
      if (!numeroAtual || numeroAtual.trim() === '') {
    await campoNumero.click();
        await page.waitForTimeout(200);
    await campoNumero.fill(CLIENTE.numero);
    console.log(`✅ Número: ${CLIENTE.numero}`);
      } else {
        console.log(`✅ Número já preenchido: "${numeroAtual}"`);
      }
  } catch (e) {
    console.log('⚠️ Erro no Número:', e.message);
  }
  
    // Verifica se o campo Bairro foi preenchido automaticamente
    console.log('📝 Verificando campo Bairro...');
    try {
      const campoBairro = page.getByRole('textbox', { name: 'Bairro *' });
      const bairroAtual = await campoBairro.inputValue().catch(() => '');
      
      if (!bairroAtual || bairroAtual.trim() === '') {
        console.log('   ℹ️ Bairro não preenchido pelo CEP, inserindo "Centro"...');
        await campoBairro.click();
        await page.waitForTimeout(200);
        await campoBairro.fill('Centro');
        console.log('✅ Bairro: Centro');
      } else {
        console.log(`✅ Bairro já preenchido: "${bairroAtual}"`);
      }
    } catch (e) {
      console.log('⚠️ Erro ao verificar Bairro:', e.message);
    }
  } else {
    console.log('ℹ️ Campos de endereço não visíveis (já preenchido anteriormente)');
  }
  
  await page.waitForTimeout(500);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PASSO 1: CLICA EM "IR PARA PAGAMENTO" OU "IR PARA ENDEREÇO"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📍 PASSO 1: Procurando "Ir para Pagamento" ou "Ir para Endereço"...');
  
  // Lista botões visíveis para debug
  const botoesDisponiveis = await page.locator('button:visible').all();
  console.log(`   📋 Botões visíveis: ${botoesDisponiveis.length}`);
  for (let i = 0; i < Math.min(botoesDisponiveis.length, 10); i++) {
    const texto = await botoesDisponiveis[i].innerText().catch(() => '');
    if (texto.trim()) console.log(`      - "${texto.trim().substring(0, 50)}"`);
  }
  
  // Primeiro: tenta "Ir para Pagamento" ou "Ir para Endereço"
  const seletoresPasso1 = [
    page.locator('button:has-text("Ir para o pagamento")'),
    page.getByRole('button', { name: /Ir para o pagamento/i }),
    page.locator('button:has-text("Ir para o Endereço")'),
    page.locator('button:has-text("Ir para o endereço")'),
    page.getByRole('button', { name: /endereço/i }),
    page.locator('button:has-text("Prosseguir")'),
  ];
  
  let clicouPasso1 = false;
  
  for (const btn of seletoresPasso1) {
    try {
      if (await btn.isVisible({ timeout: 1500 })) {
        const textoBtn = await btn.innerText().catch(() => 'botão');
        console.log(`📍 Encontrou "${textoBtn.trim().substring(0, 40)}", clicando...`);
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await btn.click();
        clicouPasso1 = true;
        console.log(`✅ Clicou!`);
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {
      // Tenta próximo
    }
  }
  
  if (!clicouPasso1) {
    console.log('⚠️ Botão "Ir para Pagamento/Endereço" não encontrado');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PASSO 2: VERIFICA SE ENDEREÇO JÁ ESTÁ PREENCHIDO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📍 PASSO 2: Verificando se endereço já está preenchido...');
  await page.waitForTimeout(1000);
  
  // Verifica se aparece endereço já preenchido (texto com "Rua" ou número de CEP)
  const enderecoExibido = await page.locator('text=/Rua |Avenida |Vila |CEP/i').first().isVisible({ timeout: 2000 }).catch(() => false);
  const campoCepVisivel = await page.getByRole('textbox', { name: 'CEP *' }).isVisible({ timeout: 1000 }).catch(() => false);
  
  if (enderecoExibido && !campoCepVisivel) {
    console.log('✅ Endereço já está preenchido!');
    
    // PASSO 3A: Clica em "Continuar Inscrição"
    console.log('📍 PASSO 3: Clicando em "Continuar Inscrição"...');
    const btnContinuar = page.locator('button:has-text("Continuar Inscrição")').first();
    if (await btnContinuar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnContinuar.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await btnContinuar.click();
      console.log('✅ Clicou em "Continuar Inscrição"!');
      await page.waitForTimeout(2000);
    }
  } else if (campoCepVisivel) {
    console.log('📝 Endereço NÃO está preenchido, preenchendo...');
    
    // PASSO 3B: Preenche o endereço
    // CEP
    try {
      const campoCep = page.getByRole('textbox', { name: 'CEP *' });
      const cepAtual = await campoCep.inputValue().catch(() => '');
      if (!cepAtual || cepAtual.length < 8) {
        await campoCep.click();
        await campoCep.fill(CLIENTE.cep);
        console.log(`✅ CEP: ${CLIENTE.cep}`);
        await campoCep.press('Tab');
        await page.waitForTimeout(2000); // Aguarda busca do CEP
      }
    } catch (e) {
      console.log('⚠️ Erro no CEP:', e.message);
    }
    
    // Endereço
    try {
      const campoEnd = page.getByRole('textbox', { name: 'Endereço *' });
      if (await campoEnd.isVisible({ timeout: 1000 }).catch(() => false)) {
        const endAtual = await campoEnd.inputValue().catch(() => '');
        if (!endAtual || endAtual.trim() === '') {
          await campoEnd.fill('Null');
          console.log('✅ Endereço: Null');
        }
      }
    } catch (e) {}
    
    // Número
    try {
      const campoNum = page.getByRole('textbox', { name: 'Número *' });
      if (await campoNum.isVisible({ timeout: 1000 }).catch(() => false)) {
        const numAtual = await campoNum.inputValue().catch(() => '');
        if (!numAtual || numAtual.trim() === '') {
          await campoNum.fill(CLIENTE.numero);
          console.log(`✅ Número: ${CLIENTE.numero}`);
        }
      }
    } catch (e) {}
    
    // Bairro
    try {
      const campoBairro = page.getByRole('textbox', { name: 'Bairro *' });
      if (await campoBairro.isVisible({ timeout: 1000 }).catch(() => false)) {
        const bairroAtual = await campoBairro.inputValue().catch(() => '');
        if (!bairroAtual || bairroAtual.trim() === '') {
          await campoBairro.fill('Centro');
          console.log('✅ Bairro: Centro');
        }
      }
    } catch (e) {}
    
    await page.waitForTimeout(500);
    
    // Agora clica em "Ir para o Pagamento" ou "Continuar Inscrição"
    console.log('📍 PASSO 4: Clicando para avançar após preencher endereço...');
    const seletoresPasso4 = [
      page.locator('button:has-text("Ir para o pagamento")'),
      page.getByRole('button', { name: /Ir para o pagamento/i }),
      page.locator('button:has-text("Continuar Inscrição")'),
      page.locator('button:has-text("Prosseguir")'),
    ];
    
    for (const btn of seletoresPasso4) {
      try {
        if (await btn.isVisible({ timeout: 1500 })) {
          const textoBtn = await btn.innerText().catch(() => 'botão');
          console.log(`📍 Clicando em "${textoBtn.trim().substring(0, 30)}"...`);
          await btn.scrollIntoViewIfNeeded();
          await btn.click();
          console.log('✅ Clicou!');
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {}
    }
  } else {
    console.log('ℹ️ Estado do endereço indeterminado, tentando continuar...');
    // Tenta clicar em qualquer botão de avanço
    const btnAvancar = page.locator('button:has-text("Continuar"), button:has-text("Prosseguir"), button:has-text("pagamento")').first();
    if (await btnAvancar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btnAvancar.click();
      await page.waitForTimeout(2000);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 3: Página de Pagamento → Clicar em "Continuar Inscrição"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 CHECKOUT: Página de Pagamento...');
  
  await page.waitForTimeout(1000);
  
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
  
  console.log(`✅ CHECKOUT CONCLUÍDO`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: FINALIZAÇÃO - Clicar em "Continuar Processo"
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Finalização');
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log(`📍 URL atual: ${page.url()}`);
  
  await page.waitForTimeout(1000);
  
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
  
  let linkProva = null;
  
  if (novaAba) {
   console.log('⏳ Página aberta, aguardando carregar...');
   console.log(`📍 URL da nova aba: ${novaAba.url()}`);
   
   // Aguarda a página carregar completamente
   console.log('⏳ Aguardando página de inscrições carregar (10s)...');
   await novaAba.waitForTimeout(10000);
   
   // ═══════════════════════════════════════════════════════════════════════════
  // PASSO 1: Encontrar e clicar em "Acompanhar Inscrição" (PRIMEIRO da lista)
   // ═══════════════════════════════════════════════════════════════════════════
   console.log('');
  console.log('🔍 PASSO 1: Procurando "Acompanhar Inscrição" (primeiro da lista)...');
   
   let clicouAcompanhar = false;
  const MAX_TENTATIVAS_ACOMPANHAR = 15;
  
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ACOMPANHAR && !clicouAcompanhar; tentativa++) {
    console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS_ACOMPANHAR}...`);
    
    // Tenta diferentes seletores para o botão
    const seletoresAcompanhar = [
      novaAba.getByRole('button', { name: 'Acompanhar Inscrição' }).first(),
      novaAba.locator('button:has-text("Acompanhar Inscrição")').first(),
      novaAba.locator('button').filter({ hasText: /Acompanhar Inscri/i }).first(),
    ];
    
    for (const btn of seletoresAcompanhar) {
      try {
        const count = await btn.count().catch(() => 0);
        if (count > 0) {
          const isVis = await btn.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVis) {
     console.log('   ✅ ENCONTROU "Acompanhar Inscrição"!');
            await btn.scrollIntoViewIfNeeded();
            await novaAba.waitForTimeout(300);
            await btn.click({ force: true });
            console.log('   ✅ Clicou no PRIMEIRO "Acompanhar Inscrição"!');
     clicouAcompanhar = true;
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!clicouAcompanhar) {
      await novaAba.waitForTimeout(2000);
    }
  }
  
  if (!clicouAcompanhar) {
    console.log('   ⚠️ "Acompanhar Inscrição" não encontrado após todas tentativas');
     const botoesVisiveis = await novaAba.locator('button:visible').allTextContents().catch(() => []);
     console.log('   Botões disponíveis:', botoesVisiveis.join(' | '));
   }
   
   // ═══════════════════════════════════════════════════════════════════════════
  // PASSO 2: Encontrar "Acessar prova" dentro da MODAL (PRIMEIRO da lista)
   // ═══════════════════════════════════════════════════════════════════════════
   console.log('');
   console.log('🔍 PASSO 2: Procurando "Acessar prova" na modal...');
   
  // Espera modal abrir completamente
  console.log('⏳ Aguardando modal abrir (5s)...');
   await novaAba.waitForTimeout(5000);
   
   let acessarProvaLink = null;
  const MAX_TENTATIVAS_PROVA = 12;
  
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_PROVA && !acessarProvaLink; tentativa++) {
    console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS_PROVA}...`);
    
    // Tenta diferentes seletores para "Acessar prova"
    const seletoresProva = [
      novaAba.locator('a:has(button:has-text("Acessar prova"))').first(),
      novaAba.getByRole('button', { name: 'Acessar prova' }).first(),
      novaAba.locator('button:has-text("Acessar prova")').first(),
      novaAba.locator('a').filter({ hasText: /Acessar prova/i }).first(),
    ];
    
    for (const seletor of seletoresProva) {
      try {
        const count = await seletor.count().catch(() => 0);
        if (count > 0) {
          const isVis = await seletor.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVis) {
     console.log('   ✅ ENCONTROU "Acessar prova" na modal!');
            acessarProvaLink = seletor;
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!acessarProvaLink) {
      await novaAba.waitForTimeout(1000);
    }
  }
  
  if (!acessarProvaLink) {
     console.log('   ⚠️ Botão "Acessar prova" não encontrado');
   }
    
   // ═══════════════════════════════════════════════════════════════════════════
   // PASSO 3: Capturar o link da prova (extrair href do <a>)
   // ═══════════════════════════════════════════════════════════════════════════
   if (acessarProvaLink) {
     console.log('');
     console.log('🔍 PASSO 3: Extraindo link da prova...');
     
     try {
       // Pega o href diretamente do elemento <a>
       const href = await acessarProvaLink.getAttribute('href').catch(() => null);
       if (href && href.startsWith('http')) {
         linkProva = href;
         console.log('   ✅ Link extraído com sucesso!');
       } else {
         // Se não conseguiu o href, tenta clicar e capturar a URL
         console.log('   📍 href não encontrado, clicando para capturar URL...');
         const [provaPage] = await Promise.all([
           novaAba.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
           acessarProvaLink.click()
         ]);
         
         await novaAba.waitForTimeout(1500);
         
         if (provaPage) {
           await provaPage.waitForLoadState('domcontentloaded').catch(() => {});
           linkProva = provaPage.url();
           console.log('   ✅ Link capturado da nova aba!');
           await provaPage.close().catch(() => {});
         } else {
           linkProva = novaAba.url();
           console.log('   ✅ Link capturado da URL atual!');
         }
       }
     } catch (e) {
       console.log(`   ❌ Erro ao capturar link: ${e.message}`);
     }
   } else {
      console.log('');
      console.log('⚠️ "Acessar prova" NÃO ENCONTRADO na modal');
      const botoesVisiveis = await novaAba.locator('button:visible').allTextContents().catch(() => []);
      console.log('   Botões visíveis:', botoesVisiveis.slice(0, 10).join(' | '));
      const linksVisiveis = await novaAba.locator('a:visible').allTextContents().catch(() => []);
      console.log('   Links visíveis:', linksVisiveis.slice(0, 10).join(' | '));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRAÇÃO DO NÚMERO DE INSCRIÇÃO DO TOKEN JWT
  // ═══════════════════════════════════════════════════════════════════════════
  let numeroInscricao = null;
  
  if (linkProva && linkProva.includes('token=')) {
    console.log('');
    console.log('🔍 Extraindo número de inscrição do token JWT...');
    
    try {
      // Extrai o token do link
      const urlObj = new URL(linkProva);
      const token = urlObj.searchParams.get('token');
      
      if (token) {
        // O JWT tem 3 partes: header.payload.signature
        const partes = token.split('.');
        
        if (partes.length >= 2) {
          // Decodifica o payload (segunda parte) - base64
          const payloadBase64 = partes[1];
          
          // Adiciona padding se necessário (base64 precisa ser múltiplo de 4)
          const payloadPadded = payloadBase64 + '='.repeat((4 - payloadBase64.length % 4) % 4);
          
          // Decodifica base64 para string
          const payloadJson = Buffer.from(payloadPadded, 'base64').toString('utf-8');
          
          // Faz parse do JSON
          const payload = JSON.parse(payloadJson);
          
          console.log('   📋 Payload do token JWT decodificado:');
          console.log(`      ${JSON.stringify(payload, null, 2).split('\n').join('\n      ')}`);
          
          // Procura pelo número de inscrição em diferentes campos possíveis
          numeroInscricao = payload.inscricao_id || 
                           payload.inscricaoId || 
                           payload.id_inscricao ||
                           payload.numero_inscricao ||
                           payload.numeroInscricao ||
                           payload.sub ||
                           payload.id;
          
          if (numeroInscricao) {
            console.log(`   ✅ Número de Inscrição encontrado: ${numeroInscricao}`);
            // Imprime no formato esperado pelo server.js
            console.log(`Número de Inscrição extraído do token: ${numeroInscricao}`);
          } else {
            console.log('   ⚠️ Número de inscrição não encontrado no payload');
            // Tenta extrair qualquer número grande do payload
            const jsonStr = JSON.stringify(payload);
            const matchNumero = jsonStr.match(/(\d{8,})/);
            if (matchNumero) {
              numeroInscricao = matchNumero[1];
              console.log(`   ✅ Número extraído (fallback): ${numeroInscricao}`);
              console.log(`Número de Inscrição extraído do token: ${numeroInscricao}`);
            }
          }
        }
      }
    } catch (e) {
      console.log(`   ⚠️ Erro ao decodificar token: ${e.message}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  if (linkProva) {
    console.log('🎉 SUCESSO! LINK DA PROVA CAPTURADO:');
    console.log(`🔗 ${linkProva}`);
    if (numeroInscricao) {
      console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
    }
    
    // Informa mudanças de polo e vestibular
    if (poloUsado.toLowerCase() !== CLIENTE.polo.toLowerCase()) {
      console.log(`📍 POLO ALTERNATIVO UTILIZADO: "${poloUsado}"`);
      console.log(`   (Polo original solicitado: "${CLIENTE.polo}")`);
    }
    if (vestibularUsado.toLowerCase() !== CLIENTE.tipoVestibular.toLowerCase()) {
      console.log(`📝 VESTIBULAR ALTERNATIVO UTILIZADO: "${vestibularUsado}"`);
      console.log(`   (Vestibular original solicitado: "${CLIENTE.tipoVestibular}")`);
    }
  } else {
    console.log('⚠️ FINALIZADO SEM LINK DA PROVA');
  }
  console.log(`📍 URL final: ${page.url()}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
});

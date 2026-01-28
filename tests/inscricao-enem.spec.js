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
  numero: process.env.CLIENTE_NUMERO || '12',
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
  // Localização
  estado: corrigirAcentos(process.env.CLIENTE_ESTADO) || 'São Paulo',
  cidade: corrigirAcentos(process.env.CLIENTE_CIDADE) || 'São Paulo',
  // Curso
  curso: corrigirAcentos(process.env.CLIENTE_CURSO) || 'pedagogia',
  polo: corrigirAcentos(process.env.CLIENTE_POLO) || 'vila mariana',
  // Forma de ingresso ENEM
  tipoVestibular: 'ENEM',
};

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DO ENEM - Via variáveis de ambiente
// ═══════════════════════════════════════════════════════════════════════════
const ENEM = {
  cienciasHumanas: process.env.ENEM_CIENCIAS_HUMANAS || '600',
  cienciasNatureza: process.env.ENEM_CIENCIAS_NATUREZA || '580',
  linguagens: process.env.ENEM_LINGUAGENS || '620',
  matematica: process.env.ENEM_MATEMATICA || '590',
  redacao: process.env.ENEM_REDACAO || '700',
  ano: process.env.ENEM_ANO || '2024',
};

test('test-enem', async ({ page }) => {
  
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
  console.log(`   Forma de Ingresso: ${CLIENTE.tipoVestibular}`);
  console.log('');
  console.log('📋 NOTAS DO ENEM:');
  console.log(`   Ciências Humanas: ${ENEM.cienciasHumanas}`);
  console.log(`   Ciências da Natureza: ${ENEM.cienciasNatureza}`);
  console.log(`   Linguagens: ${ENEM.linguagens}`);
  console.log(`   Matemática: ${ENEM.matematica}`);
  console.log(`   Redação: ${ENEM.redacao}`);
  console.log(`   Ano: ${ENEM.ano}`);
  console.log('');

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
  console.log('🚀 INICIANDO SCRIPT DE INSCRIÇÃO ENEM - CRUZEIRO DO SUL');
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
  await page.waitForTimeout(2000);
  
  // Senha
  const senhaInput = page.getByRole('textbox', { name: 'Senha' });
  await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
  await senhaInput.fill('MFPedu!t678@!');
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
  await page.waitForTimeout(3000);
  
  async function aceitarCookiesObrigatorio() {
    const MAX_TENTATIVAS = 5;
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`   🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} de aceitar cookies...`);
      
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
        } catch (e) {}
      }
      
      if (tentativa < MAX_TENTATIVAS) {
        console.log(`   ⏳ Aguardando mais 2s...`);
        await page.waitForTimeout(2000);
      }
    }
    return false;
  }
  
  const cookieAceito = await aceitarCookiesObrigatorio();
  if (!cookieAceito) {
    console.log('⚠️ AVISO: Banner de cookies não encontrado');
  }
  
  // Fecha modais se existirem
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  
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
  
  // Clica em "Entrar como cliente"
  const entrarComoCliente = page.getByText('Entrar como cliente').first();
  await entrarComoCliente.waitFor({ state: 'visible', timeout: 15000 });
  await entrarComoCliente.click({ force: true });
  await page.waitForTimeout(2000);
  
  // Fecha modal novamente se necessário
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Preenche email do cliente
  const emailCliente = page.getByPlaceholder('Ex: example@mail.com');
  await preencherCampo(emailCliente, CLIENTE.email, 'Email cliente', false);
  
  // Clica em Entrar
  await page.getByRole('button', { name: 'Entrar' }).click({ force: true });
  await page.waitForTimeout(3000);
  
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
  
  const searchInput = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.click();
  
  // Usa texto sem acentos para a busca (evita problemas de encoding)
  const cursoParaBusca = removerAcentos(CLIENTE.curso);
  console.log(`🔍 Digitando na busca: "${cursoParaBusca}" (original: ${CLIENTE.curso})`);
  await searchInput.type(cursoParaBusca, { delay: 100 });
  await page.waitForTimeout(1000);
  await searchInput.press('Enter');
  
  // Aguarda resultados carregarem completamente
  console.log('⏳ Aguardando resultados da busca...');
  await page.waitForTimeout(4000);
  await aguardarCarregandoDesaparecer();
  await page.waitForTimeout(2000);
  
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
  await page.waitForTimeout(5000); // Espera página estabilizar
  
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
  
  // Cidade
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(2),
    CLIENTE.cidade,
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
  await page.waitForTimeout(3000);
  
  // Clica em "Sim" se aparecer (usando seletor do codegen original)
  console.log('📍 Verificando botão "Sim"...');
  try {
    const simNao = page.getByText('SimNão');
    if (await simNao.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('📍 Clicando em "Sim"...');
      await simNao.click();
      await page.waitForTimeout(2000);
      console.log('✅ Clicou em "Sim"!');
    }
  } catch (e) {
    console.log('ℹ️ Botão SimNão não encontrado');
  }
  
  await page.waitForTimeout(2000);
  
  // Preenche CEP
  console.log('📝 Preenchendo CEP...');
  try {
    const campoCep = page.getByRole('textbox', { name: 'CEP *' });
    await campoCep.click();
    await page.waitForTimeout(500);
    await campoCep.fill(CLIENTE.cep);
    console.log(`✅ CEP: ${CLIENTE.cep}`);
    await page.waitForTimeout(1000);
    await campoCep.press('Tab');
    await page.waitForTimeout(5000); // Aguarda busca do CEP
  } catch (e) {
    console.log('⚠️ Erro no CEP:', e.message);
  }
  
  // Verifica se o campo Endereço foi preenchido automaticamente
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
  
  // Preenche Número
  console.log('📝 Preenchendo Número...');
  try {
    const campoNumero = page.getByRole('textbox', { name: 'Número *' });
    await campoNumero.click();
    await page.waitForTimeout(300);
    await campoNumero.fill(CLIENTE.numero);
    console.log(`✅ Número: ${CLIENTE.numero}`);
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
      await page.waitForTimeout(300);
      await campoBairro.fill('Centro');
      console.log('✅ Bairro: Centro');
    } else {
      console.log(`✅ Bairro já preenchido: "${bairroAtual}"`);
    }
  } catch (e) {
    console.log('⚠️ Erro ao verificar Bairro:', e.message);
  }
  
  await page.waitForTimeout(1000);
  
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
  
  if (novaAba) {
    console.log('⏳ Página aberta, buscando botões...');
    await novaAba.waitForTimeout(2000); // Espera mínima
    console.log(`📍 URL da nova aba: ${novaAba.url()}`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 1: Encontrar e clicar em "Acompanhar Inscrição"
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('🔍 PASSO 1: Procurando "Acompanhar Inscrição"...');
    
    let clicouAcompanhar = false;
    
    // Usa o seletor exato do Codegen
    const btnAcompanhar = novaAba.getByRole('button', { name: 'Acompanhar Inscrição' });
    
    try {
      await btnAcompanhar.waitFor({ state: 'visible', timeout: 15000 });
      console.log('   ✅ ENCONTROU "Acompanhar Inscrição"!');
      await btnAcompanhar.click();
      console.log('   ✅ Clicou em "Acompanhar Inscrição"!');
      clicouAcompanhar = true;
      await novaAba.waitForTimeout(3000); // Espera modal abrir
    } catch (e) {
      console.log('   ⚠️ "Acompanhar Inscrição" não encontrado');
      const botoesVisiveis = await novaAba.locator('button:visible').allTextContents().catch(() => []);
      console.log('   Botões disponíveis:', botoesVisiveis.join(' | '));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 2: MODAL ENEM - Preencher notas do ENEM
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('🔍 PASSO 2: Preenchendo notas do ENEM na modal...');
    
    // Aguarda a modal abrir completamente
    await novaAba.waitForTimeout(5000);
    
    // Preenche as notas do ENEM
    console.log('📝 Preenchendo Nota ENEM de Ciências Humanas...');
    const campoCienciasHumanas = novaAba.getByLabel('Nota ENEM de Ciências Humanas*');
    try {
      await campoCienciasHumanas.waitFor({ state: 'visible', timeout: 10000 });
      await campoCienciasHumanas.click();
      await campoCienciasHumanas.fill(ENEM.cienciasHumanas);
      console.log(`   ✅ Ciências Humanas: ${ENEM.cienciasHumanas}`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message}`);
    }
    
    console.log('📝 Preenchendo Nota ENEM de Ciências da Natureza...');
    const campoCienciasNatureza = novaAba.getByLabel('Nota ENEM de Ciências da Natureza*');
    try {
      await campoCienciasNatureza.click();
      await campoCienciasNatureza.fill(ENEM.cienciasNatureza);
      console.log(`   ✅ Ciências da Natureza: ${ENEM.cienciasNatureza}`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message}`);
    }
    
    console.log('📝 Preenchendo Nota ENEM Linguagens...');
    const campoLinguagens = novaAba.getByLabel('Nota ENEM Linguagens*');
    try {
      await campoLinguagens.click();
      await campoLinguagens.fill(ENEM.linguagens);
      console.log(`   ✅ Linguagens: ${ENEM.linguagens}`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message}`);
    }
    
    console.log('📝 Preenchendo Nota ENEM de Matemática...');
    const campoMatematica = novaAba.getByLabel('Nota ENEM de Matemática*');
    try {
      await campoMatematica.click();
      await campoMatematica.fill(ENEM.matematica);
      console.log(`   ✅ Matemática: ${ENEM.matematica}`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message}`);
    }
    
    console.log('📝 Preenchendo Nota ENEM de Redação...');
    const campoRedacao = novaAba.getByLabel('Nota ENEM de Redação*');
    try {
      await campoRedacao.click();
      await campoRedacao.fill(ENEM.redacao);
      console.log(`   ✅ Redação: ${ENEM.redacao}`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 3: Selecionar ano do ENEM
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('📝 Selecionando Ano do ENEM...');
    const selectAnoEnem = novaAba.getByLabel('Selecione o Ano do Enem');
    try {
      await selectAnoEnem.waitFor({ state: 'visible', timeout: 10000 });
      await selectAnoEnem.click();
      await novaAba.waitForTimeout(500);
      
      // Seleciona o ano
      const opcaoAno = novaAba.getByRole('option', { name: ENEM.ano });
      if (await opcaoAno.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opcaoAno.click();
      } else {
        // Tenta selecionar via valor
        await selectAnoEnem.selectOption(ENEM.ano);
      }
      console.log(`   ✅ Ano do ENEM: ${ENEM.ano}`);
    } catch (e) {
      console.log(`   ⚠️ Erro ao selecionar ano: ${e.message}`);
      // Tenta alternativa
      try {
        const selectAlternativo = novaAba.locator('select').filter({ hasText: /Selecione/i }).first();
        await selectAlternativo.selectOption(ENEM.ano);
        console.log(`   ✅ Ano do ENEM (alternativo): ${ENEM.ano}`);
      } catch (e2) {
        console.log(`   ⚠️ Erro alternativo: ${e2.message}`);
      }
    }
    
    await novaAba.waitForTimeout(1000);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 4: Marcar checkbox de termos
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('📝 Marcando checkbox de termos...');
    try {
      const checkboxTermos = novaAba.getByLabel(/Declaro que li e aceito os termos/i);
      await checkboxTermos.check();
      console.log('   ✅ Checkbox de termos marcado!');
    } catch (e) {
      // Tenta alternativa
      try {
        const checkboxAlt = novaAba.locator('input[type="checkbox"]').last();
        await checkboxAlt.check();
        console.log('   ✅ Checkbox marcado (alternativo)!');
      } catch (e2) {
        console.log(`   ⚠️ Erro ao marcar checkbox: ${e2.message}`);
      }
    }
    
    await novaAba.waitForTimeout(1000);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 5: Clicar em "Enviar notas para análise"
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('📍 Clicando em "Enviar notas para análise"...');
    const btnEnviarNotas = novaAba.getByRole('button', { name: 'Enviar notas para análise' });
    
    try {
      await btnEnviarNotas.waitFor({ state: 'visible', timeout: 10000 });
      await btnEnviarNotas.scrollIntoViewIfNeeded();
      await novaAba.waitForTimeout(500);
      await btnEnviarNotas.click();
      console.log('   ✅ Clicou em "Enviar notas para análise"!');
      
      // Aguarda processamento
      await novaAba.waitForTimeout(5000);
      
    } catch (e) {
      console.log(`   ⚠️ Erro ao clicar no botão: ${e.message}`);
      
      // Lista botões disponíveis
      const botoesVisiveis = await novaAba.locator('button:visible').allTextContents().catch(() => []);
      console.log('   Botões disponíveis:', botoesVisiveis.join(' | '));
    }
    
    // Screenshot final
    await novaAba.screenshot({ path: 'inscricao-enem-finalizada.png', fullPage: true });
    console.log('📸 Screenshot salvo em: inscricao-enem-finalizada.png');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 INSCRIÇÃO ENEM FINALIZADA!');
  console.log(`📍 URL final: ${page.url()}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
});

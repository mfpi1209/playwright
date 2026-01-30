import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT DE INSCRIÇÃO - PÓS-GRADUAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

// Função para remover acentos
function removerAcentos(texto) {
  if (!texto) return texto;
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
    if (mapa[char]) {
      resultado += mapa[char];
    } else if (code >= 32 && code <= 126) {
      resultado += char;
    }
  }
  return resultado;
}

// Função para corrigir acentos corrompidos
function corrigirAcentos(texto) {
  if (!texto) return texto;
  return texto
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
    .replace(/Ã¢/g, 'â').replace(/Ãª/g, 'ê').replace(/Ã®/g, 'î').replace(/Ã´/g, 'ô').replace(/Ã»/g, 'û')
    .replace(/Ã£/g, 'ã').replace(/Ãµ/g, 'õ').replace(/Ã§/g, 'ç')
    .replace(/Á£/g, 'ã').replace(/Á´/g, 'ô').replace(/Á©/g, 'é').replace(/Á¡/g, 'á')
    .replace(/Áº/g, 'ú').replace(/Á§/g, 'ç').replace(/Áª/g, 'ê').replace(/Á­/g, 'í')
    .replace(/Á³/g, 'ó').replace(/Áµ/g, 'õ').replace(/Á¢/g, 'â').replace(/Á®/g, 'î')
    .replace(/SÁ£o/g, 'São');
}

// Gera número de residência aleatório
const numeroAleatorio = Math.floor(Math.random() * 999) + 1;

// Função para formatar telefone
function formatarTelefone(telefone) {
  if (!telefone) return telefone;
  let numeros = telefone.replace(/\D/g, '');
  if (numeros.startsWith('55') && numeros.length > 11) {
    numeros = numeros.substring(2);
  }
  return numeros;
}

// Função para capitalizar nome
function capitalizarNome(nome) {
  return corrigirAcentos(nome).toLowerCase().split(' ').map(palavra => 
    palavra.charAt(0).toUpperCase() + palavra.slice(1)
  ).join(' ');
}

const CLIENTE = {
  nome: capitalizarNome(process.env.CLIENTE_NOME || 'Carlos Eduardo Ribeiro'),
  cpf: process.env.CLIENTE_CPF || '96724754038',
  email: (process.env.CLIENTE_EMAIL || 'ceduardoribeiro@hotmail.com').toLowerCase(),
  telefone: formatarTelefone(process.env.CLIENTE_TELEFONE || '11974562318'),
  nascimento: process.env.CLIENTE_NASCIMENTO || '14/02/1985',
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || String(numeroAleatorio),
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
  estado: corrigirAcentos(process.env.CLIENTE_ESTADO) || 'São Paulo',
  cidade: corrigirAcentos(process.env.CLIENTE_CIDADE) || 'São Paulo',
  curso: corrigirAcentos(process.env.CLIENTE_CURSO) || 'Psicanálise',
  polo: corrigirAcentos(process.env.CLIENTE_POLO) || 'sapopemba',
  // Campanha: deixar vazio para "Não aplicar campanha", ou colocar o código (ex: "2542")
  campanha: process.env.CLIENTE_CAMPANHA || '',
};

test('test-pos', async ({ page }) => {
  
  let poloUsado = CLIENTE.polo;
  let campanhaAplicada = CLIENTE.campanha;
  let numeroInscricao = null;
  
  console.log('');
  console.log('📋 DADOS DO CLIENTE (PÓS-GRADUAÇÃO):');
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
  console.log(`   Campanha: ${CLIENTE.campanha || '(não aplicar)'}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════════
  
  async function aguardarCarregamento(descricao, timeout = 20000) {
    console.log(`⏳ Aguardando: ${descricao}...`);
    const inicio = Date.now();
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {}
    await page.waitForTimeout(800);
    await aguardarCarregandoDesaparecer();
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`✅ ${descricao} - carregado em ${duracao}s`);
  }
  
  async function aguardarCarregandoDesaparecer(maxTentativas = 10) {
    const carregandoTexto = page.locator('text=Carregando...').first();
    try {
      const visivel = await carregandoTexto.isVisible({ timeout: 500 });
      if (visivel) {
        console.log('   ⏳ Aguardando "Carregando..." desaparecer...');
        for (let i = 0; i < maxTentativas; i++) {
          await page.waitForTimeout(500);
          const aindaVisivel = await carregandoTexto.isVisible().catch(() => false);
          if (!aindaVisivel) {
            console.log('   ✅ Carregamento concluído!');
            break;
          }
        }
      }
    } catch (e) {}
  }
  
  async function preencherCampo(locator, valor, descricao, limparAntes = true) {
    console.log(`📝 Preenchendo: ${descricao}...`);
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    if (limparAntes) {
      await locator.fill('');
    }
    await locator.type(valor, { delay: 20 });
    console.log(`✅ ${descricao}: "${valor}"`);
  }
  
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
  console.log('🚀 INICIANDO SCRIPT DE INSCRIÇÃO - PÓS-GRADUAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: LOGIN ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 1: Login Admin');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  await page.goto('https://cruzeirodosul.myvtex.com/_v/segment/admin-login/v1/login?returnUrl=%2F%3F');
  await aguardarCarregamento('Página de login');
  
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await preencherCampo(emailInput, 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', 'Email admin', false);
  
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(1000);
  
  const senhaInput = page.getByRole('textbox', { name: 'Senha' });
  await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
  await senhaInput.fill('MFPedu!t678@!');
  console.log('✅ Senha preenchida');
  
  await page.getByRole('button', { name: 'Continuar' }).click();
  await aguardarCarregamento('Login');
  await page.waitForTimeout(1500);
  
  console.log(`✅ ETAPA 1 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO PARA PÓS-GRADUAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Pós-Graduação');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      console.log(`   Tentativa ${tentativa}/3 de navegar para pós-graduação...`);
      await page.goto('https://cruzeirodosul.myvtex.com/pos-graduacao', { timeout: 60000 });
      await aguardarCarregamento('Página de pós-graduação');
      break;
    } catch (e) {
      console.log(`   ⚠️ Erro na tentativa ${tentativa}: ${e.message}`);
      if (tentativa === 3) throw e;
      await page.waitForTimeout(2000);
    }
  }
  
  // Aceitar cookies
  console.log('📍 Aguardando banner de cookies...');
  await page.waitForTimeout(2000);
  
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`   🔄 Tentativa ${i}/5 de aceitar cookies...`);
      const cookieBtn = page.getByText('Aceitar todos os Cookies');
      const visivel = await cookieBtn.isVisible({ timeout: 2000 });
      if (visivel) {
        console.log('   📍 Encontrou botão de cookies');
        await cookieBtn.click({ force: true });
        await page.waitForTimeout(1000);
        console.log('   ✅ Cookies aceitos!');
        break;
      }
    } catch (e) {}
    await page.waitForTimeout(500);
  }
  
  console.log(`✅ ETAPA 2 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: LOGIN COMO CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 3: Login como Cliente');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
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
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        continue;
      }
      
      // 4. Aguarda processamento do login
      console.log('   ⏳ Aguardando login ser processado...');
      await page.waitForTimeout(3000);
      
      // 5. Valida se login foi feito
      console.log('   🔍 Validando login...');
      const headerText = await page.locator('header').textContent().catch(() => '');
      const headerLower = headerText.toLowerCase();
      const emailPrefix = CLIENTE.email.split('@')[0].toLowerCase();
      
      const clienteLogado = headerLower.includes(emailPrefix) || 
                            headerLower.includes('olá') ||
                            headerLower.includes(CLIENTE.email.toLowerCase());
      
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
  }
  
  // Aceita cookies após login
  console.log('📍 Verificando cookies após login...');
  await page.waitForTimeout(1000);
  
  try {
    const aceitarCookies = page.getByText('Aceitar todos', { exact: false }).first();
    if (await aceitarCookies.isVisible({ timeout: 3000 })) {
      await aceitarCookies.click({ force: true });
      console.log('   ✅ Cookies aceitos após login');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  try {
    const cookieBtn = page.getByText('Aceitar todos os Cookies');
    if (await cookieBtn.isVisible({ timeout: 2000 })) {
      await cookieBtn.click({ force: true });
      console.log('   ✅ Cookies aceitos (alternativo)');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  console.log('✅ ETAPA 3 CONCLUÍDA - Cliente logado');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: BUSCA E SELEÇÃO DO CURSO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 4: Busca e Seleção do Curso');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Fecha modais se houver
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  const searchInput = page.getByRole('textbox', { name: 'O que você procura? Buscar' });
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.click();
  
  const cursoParaBusca = removerAcentos(CLIENTE.curso);
  console.log(`🔍 Digitando na busca: "${cursoParaBusca}" (original: ${CLIENTE.curso})`);
  await searchInput.type(cursoParaBusca, { delay: 30 });
  
  await page.keyboard.press('Enter');
  console.log('⏳ Aguardando resultados da busca...');
  await aguardarCarregandoDesaparecer();
  await page.waitForTimeout(2000);
  
  console.log(`📍 URL após busca: ${page.url()}`);
  
  // Procura o curso nos resultados
  if (page.url().includes('?') || page.url().includes('map=ft')) {
    console.log('🔍 Página de resultados detectada, procurando curso...');
    
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);
    
    // Normaliza o nome do curso para busca
    const cursoNormalizado = removerAcentos(CLIENTE.curso).toLowerCase();
    const palavrasChave = cursoNormalizado.split(' ').filter(p => p.length > 3);
    console.log(`   🔍 Palavras-chave: ${palavrasChave.join(', ')}`);
    
    // Tenta vários seletores para encontrar os cards de curso
    const seletoresCurso = [
      'a[href*="/pos-"][href$="/p"]',
      'a[href*="/p"]:has-text("meses")',
      '.vtex-product-summary-2-x-clearLink',
      '[class*="product"] a[href*="/p"]',
      'a[href*="cruzeiro-do-sul-virtual/p"]',
    ];
    
    let cursoEncontrado = false;
    
    for (const seletor of seletoresCurso) {
      const links = await page.locator(seletor).all();
      console.log(`   📋 Seletor "${seletor}": ${links.length} links`);
      
      if (links.length > 0) {
        // Procura link que contenha palavras do curso
        for (const link of links) {
          const href = await link.getAttribute('href') || '';
          const texto = await link.textContent() || '';
          const conteudo = (href + ' ' + texto).toLowerCase();
          
          const match = palavrasChave.some(palavra => conteudo.includes(palavra));
          
          if (match) {
            console.log(`   ✅ Curso encontrado: ${href}`);
            await link.click();
            cursoEncontrado = true;
            break;
          }
        }
        
        // Se não encontrou específico, pega o primeiro link de pós
        if (!cursoEncontrado) {
          for (const link of links) {
            const href = await link.getAttribute('href') || '';
            if (href.includes('/pos-') || href.includes('meses')) {
              console.log(`   📍 Usando resultado: ${href}`);
              await link.click();
              cursoEncontrado = true;
              break;
            }
          }
        }
        
        if (cursoEncontrado) break;
      }
    }
    
    // Se ainda não encontrou, tenta clicar no primeiro produto visível
    if (!cursoEncontrado) {
      console.log('   ⚠️ Tentando clicar no primeiro produto visível...');
      const primeiroCard = page.locator('[class*="product"] a, [class*="gallery"] a').first();
      if (await primeiroCard.isVisible({ timeout: 3000 })) {
        await primeiroCard.click();
        cursoEncontrado = true;
      }
    }
    
    if (cursoEncontrado) {
      await aguardarCarregamento('Página do produto');
    } else {
      console.log('   ❌ Nenhum curso encontrado nos resultados');
    }
  }
  
  console.log(`📍 URL atual: ${page.url()}`);
  console.log('✅ ETAPA 4 CONCLUÍDA - Curso selecionado');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  const formProduto = page.locator('form, .vtex-product-summary-2-x-container, [class*="product"]').first();
  console.log('⏳ Aguardando formulário do produto...');
  await formProduto.waitFor({ state: 'visible', timeout: 30000 });
  console.log('✅ Formulário do produto carregado!');
  
  // Fecha modal se houver
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Aceita cookies - tenta vários seletores
  console.log('📍 Verificando banner de cookies...');
  
  // Tenta "Aceitar todos" (banner do meio da página)
  try {
    const aceitarTodos = page.getByText('Aceitar todos', { exact: true });
    if (await aceitarTodos.isVisible({ timeout: 2000 })) {
      await aceitarTodos.click({ force: true });
      console.log('   ✅ Cookies aceitos (Aceitar todos)');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Tenta "Aceitar todos os Cookies"
  try {
    const cookieBtn = page.getByText('Aceitar todos os Cookies');
    if (await cookieBtn.isVisible({ timeout: 1500 })) {
      await cookieBtn.click({ force: true });
      console.log('   ✅ Cookies aceitos');
      await page.waitForTimeout(500);
    }
  } catch (e) {}
  
  // Fecha banner de cookies alternativo
  try {
    const fecharCookie = page.locator('button:has-text("Aceitar todos"), button:has-text("aceitar todos")').first();
    if (await fecharCookie.isVisible({ timeout: 1000 })) {
      await fecharCookie.click({ force: true });
      await page.waitForTimeout(500);
    }
  } catch (e) {}
  
  // Rola para ver o formulário
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(1000);
  
  // Nome - tenta vários seletores
  console.log('📝 Procurando campo Nome...');
  let nomeInput = page.locator('input[name="nomecompleto"]').first();
  
  if (!await nomeInput.isVisible({ timeout: 3000 })) {
    nomeInput = page.locator('input[name="userName"]').first();
  }
  if (!await nomeInput.isVisible({ timeout: 2000 })) {
    nomeInput = page.locator('input[placeholder*="nome" i]').first();
  }
  if (!await nomeInput.isVisible({ timeout: 2000 })) {
    nomeInput = page.locator('input[type="text"]').first();
  }
  
  await nomeInput.waitFor({ state: 'visible', timeout: 15000 });
  await nomeInput.fill('');
  await nomeInput.type(CLIENTE.nome, { delay: 20 });
  console.log(`✅ Nome completo: "${CLIENTE.nome}"`);
  
  // Email - campo obrigatório para pós (pode estar readonly se já logado)
  console.log('📝 Procurando campo Email...');
  const seletoresEmail = [
    'input[name="email"]',
    'input[name="userEmail"]',
    'input[type="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="e-mail" i]',
  ];
  
  let emailPreenchido = false;
  for (const seletor of seletoresEmail) {
    const campo = page.locator(seletor).first();
    if (await campo.isVisible({ timeout: 1500 })) {
      // Verifica se o campo é readonly (já vem preenchido após login)
      const readonly = await campo.getAttribute('readonly');
      const valorAtual = await campo.inputValue();
      
      if (readonly !== null || valorAtual) {
        console.log(`   ℹ️ Campo email já preenchido (readonly): ${valorAtual || CLIENTE.email}`);
        emailPreenchido = true;
        break;
      }
      
      console.log(`   📍 Encontrou campo email editável: ${seletor}`);
      await campo.click();
      await campo.fill('');
      await campo.type(CLIENTE.email, { delay: 30 });
      console.log(`✅ Email preenchido: ${CLIENTE.email}`);
      emailPreenchido = true;
      break;
    }
  }
  
  if (!emailPreenchido) {
    console.log('⚠️ Campo email não encontrado');
  }
  
  // Telefone - tenta vários seletores
  console.log('📝 Procurando campo Telefone...');
  
  // Lista de seletores para tentar
  const seletoresTelefone = [
    'input[name="telefone"]',
    'input[name="userPhone"]',
    'input[placeholder*="XXXXX" i]',
    'input[placeholder*="telefone" i]',
    'input[type="tel"]',
    'input[inputmode="tel"]',
    'input[data-mask]',
  ];
  
  let telefonePreenchido = false;
  
  for (const seletor of seletoresTelefone) {
    const campo = page.locator(seletor).first();
    if (await campo.isVisible({ timeout: 1500 })) {
      console.log(`   📍 Encontrou campo com seletor: ${seletor}`);
      await campo.click();
      await page.waitForTimeout(200);
      await campo.fill('');
      await page.waitForTimeout(100);
      
      // Digita o telefone formatado
      const telFormatado = CLIENTE.telefone;
      await campo.type(telFormatado, { delay: 50 });
      console.log(`✅ Telefone preenchido: ${telFormatado}`);
      telefonePreenchido = true;
      break;
    }
  }
  
  if (!telefonePreenchido) {
    // Tenta encontrar qualquer input que pareça ser telefone pelo contexto
    const todosInputs = await page.locator('input[type="text"], input:not([type])').all();
    console.log(`   📋 Total de inputs na página: ${todosInputs.length}`);
    
    for (let i = 0; i < todosInputs.length; i++) {
      const input = todosInputs[i];
      const placeholder = await input.getAttribute('placeholder') || '';
      const value = await input.inputValue() || '';
      
      // Se tem placeholder com X ou está vazio e próximo do nome
      if (placeholder.includes('X') || placeholder.toLowerCase().includes('tel')) {
        console.log(`   📍 Tentando input #${i} com placeholder: "${placeholder}"`);
        await input.click();
        await page.waitForTimeout(200);
        await input.type(CLIENTE.telefone, { delay: 50 });
        console.log(`✅ Telefone preenchido via input #${i}`);
        telefonePreenchido = true;
        break;
      }
    }
  }
  
  if (!telefonePreenchido) {
    console.log('⚠️ Campo telefone não encontrado');
  }
  
  // Checkbox termos
  console.log('📝 Marcando checkbox de termos...');
  try {
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 })) {
      const isChecked = await checkbox.isChecked();
      if (!isChecked) {
        await checkbox.click({ force: true });
      }
      console.log('✅ Checkbox de termos marcado');
    } else {
      // Tenta clicar no label do checkbox
      const labelCheckbox = page.locator('label:has(input[type="checkbox"])').first();
      if (await labelCheckbox.isVisible({ timeout: 2000 })) {
        await labelCheckbox.click();
        console.log('✅ Checkbox de termos marcado (via label)');
      } else {
        console.log('⚠️ Checkbox não encontrado, continuando...');
      }
    }
  } catch (e) {
    console.log('⚠️ Erro ao marcar checkbox, continuando...');
  }
  
  // Clica em Inscreva-se
  console.log('🔄 Clicando em Inscreva-se...');
  
  // Tenta vários seletores para o botão
  const seletoresBotao = [
    'button:has-text("Inscreva-se")',
    'button:has-text("INSCREVA-SE")',
    '[class*="subscribe"] button',
    'button[type="submit"]',
  ];
  
  let clicouBotao = false;
  
  for (const seletor of seletoresBotao) {
    const btn = page.locator(seletor).first();
    if (await btn.isVisible({ timeout: 2000 })) {
      console.log(`   📍 Encontrou botão com seletor: ${seletor}`);
      
      // Verifica se está habilitado
      const disabled = await btn.getAttribute('disabled');
      console.log(`   📋 Botão desabilitado: ${disabled !== null}`);
      
      // Rola até o botão
      await btn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Clica com force
      await btn.click({ force: true });
      console.log('   ✅ Clicou em Inscreva-se');
      clicouBotao = true;
      break;
    }
  }
  
  if (!clicouBotao) {
    console.log('   ⚠️ Não encontrou botão Inscreva-se');
  }
  
  // Aguarda navegação ou mudança na página
  console.log('⏳ Aguardando navegação...');
  
  // Aguarda um pouco mais para dar tempo de carregar
  await page.waitForTimeout(3000);
  
  // Aguarda até 20 segundos pela mudança de URL ou aparecimento de formulário
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const urlAgora = page.url();
    
    if (urlAgora.includes('campanha-comercial') || urlAgora.includes('/checkout') || urlAgora.includes('/cart')) {
      console.log(`   ✅ Navegou para: ${urlAgora}`);
      break;
    }
    
    // Verifica se apareceu formulário de localização (react-select)
    const temSelects = await page.locator('.react-select__input-container').count();
    if (temSelects > 0) {
      console.log(`   ✅ Formulário de localização apareceu (${temSelects} selects)`);
      break;
    }
    
    // Verifica se apareceu seção de localização por texto
    const secaoLocalizacao = await page.locator('text=País, text=Estado, text=Cidade, text=Polo').first().isVisible().catch(() => false);
    if (secaoLocalizacao) {
      console.log('   ✅ Seção de localização detectada');
      break;
    }
    
    // Verifica se apareceu algum select dropdown
    const selectDropdown = await page.locator('select, [class*="select"]').count();
    if (selectDropdown > 3) {
      console.log(`   ✅ Selects detectados: ${selectDropdown}`);
      break;
    }
    
    // Verifica se apareceu modal ou sidebar ou step
    const modal = await page.locator('[class*="modal"], [class*="sidebar"], [class*="drawer"], [class*="step"]').first().isVisible().catch(() => false);
    if (modal) {
      console.log('   📋 Modal/Sidebar/Step detectado');
      // Aguarda um pouco para carregar o conteúdo
      await page.waitForTimeout(2000);
      break;
    }
    
    if (i === 39) {
      console.log(`   ⚠️ URL não mudou após 20s: ${urlAgora}`);
      
      // Verifica elementos na página
      const botoes = await page.locator('button').all();
      console.log(`   📋 Botões na página: ${botoes.length}`);
      for (let j = 0; j < Math.min(botoes.length, 5); j++) {
        const txt = await botoes[j].textContent().catch(() => '');
        console.log(`      - "${txt.trim().substring(0, 50)}"`);
      }
      
      // Tenta rolar para baixo para ver se há mais conteúdo
      await page.evaluate(() => window.scrollBy(0, 500));
      
      await page.screenshot({ path: 'debug-apos-inscrever.png', fullPage: true });
      console.log('   📸 Screenshot salvo: debug-apos-inscrever.png');
    }
  }
  
  await page.waitForTimeout(2000);
  console.log(`📍 URL após Inscreva-se: ${page.url()}`);
  console.log('✅ ETAPA 5 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 6: DADOS DE LOCALIZAÇÃO (se necessário)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Verifica se já foi para a campanha comercial (pós pode pular localização)
  let urlAtual = page.url();
  
  if (urlAtual.includes('campanha-comercial') || urlAtual.includes('/checkout')) {
    console.log('📌 ETAPA 6: Pulada (já na campanha/checkout)');
    console.log('─────────────────────────────────────────────────────────────────────────');
    console.log('   ℹ️ Formulário de localização não necessário para este curso');
    console.log('');
  } else {
    console.log('📌 ETAPA 6: Dados de Localização');
    console.log('─────────────────────────────────────────────────────────────────────────');
    
    await page.waitForTimeout(1000);
    
    // Verifica se há selects na página
    const temSelects = await page.locator('.react-select__input-container').count();
    console.log(`   📋 Selects encontrados: ${temSelects}`);
    
    if (temSelects > 0) {
      // País
      await selecionarOpcao(
        page.locator('.react-select__input-container').first(),
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
      
      // Polo - com fallbacks
      const polosFallback = ['sapopemba', 'vila prudente 2', 'vila mariana', 'santana 2', 'morumbi'];
      
      let poloSelecionado = await selecionarOpcao(
        page.locator('.react-select__input-container').nth(3),
        CLIENTE.polo,
        null,
        'Polo'
      );
      
      if (!poloSelecionado) {
        console.log('⚠️ Polo solicitado não encontrado, tentando alternativos...');
        for (const poloAlt of polosFallback) {
          if (poloAlt.toLowerCase() === CLIENTE.polo.toLowerCase()) continue;
          console.log(`   🔄 Tentando polo: "${poloAlt}"...`);
          poloSelecionado = await selecionarOpcao(
            page.locator('.react-select__input-container').nth(3),
            poloAlt,
            null,
            `Polo (${poloAlt})`
          );
          if (poloSelecionado) {
            poloUsado = poloAlt;
            console.log(`   ✅ POLO ALTERNATIVO: "${poloAlt}"`);
            break;
          }
        }
      }
      
      // CPF
      const cpfInput = page.locator('input[name="userDocument"]');
      if (await cpfInput.isVisible({ timeout: 3000 })) {
        await preencherCampo(cpfInput, CLIENTE.cpf, 'CPF');
      }
      
      // Continuar Inscrição
      console.log('📍 Clicando em "Continuar Inscrição"...');
      const btnContinuar = page.getByRole('button', { name: 'Continuar Inscrição' });
      if (await btnContinuar.isVisible({ timeout: 5000 })) {
        await btnContinuar.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btnContinuar.click({ force: true });
        console.log('   ✅ Clicou em "Continuar Inscrição"');
        
        // Aguarda navegação para campanha comercial
        console.log('   ⏳ Aguardando navegação para campanha comercial...');
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(500);
          const urlAgora = page.url();
          if (urlAgora.includes('campanha-comercial')) {
            console.log(`   ✅ Navegou para: ${urlAgora}`);
            break;
          }
        }
      }
    } else {
      console.log('   ℹ️ Nenhum select encontrado, curso pode ser 100% EAD');
    }
    
    console.log('✅ ETAPA 6 CONCLUÍDA');
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 7: PÁGINA DE CAMPANHA COMERCIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Campanha Comercial');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Aguarda a página de campanha comercial
  await page.waitForTimeout(3000);
  urlAtual = page.url();
  console.log(`📍 URL atual: ${urlAtual}`);
  
  if (urlAtual.includes('campanha-comercial')) {
    console.log('📍 Página de campanha comercial detectada!');
    
    // Aceita cookies primeiro
    console.log('📍 Verificando cookies...');
    try {
      const aceitarCookies = page.getByText('Aceitar todos', { exact: false }).first();
      if (await aceitarCookies.isVisible({ timeout: 3000 })) {
        await aceitarCookies.click({ force: true });
        console.log('   ✅ Cookies aceitos');
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Tenta também o botão "Aceitar todos os Cookies"
    try {
      const cookieBtn = page.getByText('Aceitar todos os Cookies');
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click({ force: true });
        console.log('   ✅ Cookies aceitos (alternativo)');
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Fecha o modal de atenção se aparecer (botão X)
    try {
      const closeX = page.locator('[class*="close"], button:has(svg)').first();
      if (await closeX.isVisible({ timeout: 2000 })) {
        await closeX.click();
        console.log('   ✅ Modal de atenção fechado');
        await page.waitForTimeout(500);
      }
    } catch (e) {}
    
    // Pressiona Escape para fechar qualquer modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Rola para cima para ver o dropdown de campanhas
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    
    // Sempre selecionar campanha (usar código fornecido ou padrão)
    const codigoCampanha = CLIENTE.campanha || '2542'; // 2542 é Balcão 10%CT - Pós EAD
    console.log(`📝 Selecionando campanha: ${codigoCampanha}...`);
    
    // Clica no dropdown de campanhas
    const selectCampanha = page.locator('select, [class*="select"]').first();
    
    if (await selectCampanha.isVisible({ timeout: 5000 })) {
      await selectCampanha.click();
      await page.waitForTimeout(500);
      
      // Digita o código da campanha
      await page.keyboard.type(codigoCampanha, { delay: 50 });
      await page.waitForTimeout(800);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      campanhaAplicada = codigoCampanha;
      console.log(`   ✅ Campanha ${codigoCampanha} digitada`);
    } else {
      console.log('   ⚠️ Dropdown de campanhas não encontrado');
    }
    
    // Captura informações do produto/parcelas
    try {
      const infoProduto = await page.locator('text=Valor parcela').textContent().catch(() => '');
      const infoParcelas = await page.locator('text=Quantidade de parcelas').textContent().catch(() => '');
      console.log(`   📋 ${infoProduto}`);
      console.log(`   📋 ${infoParcelas}`);
    } catch (e) {}
    
    // Rola para baixo para ver os botões
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Clica em "Aplicar campanha" (botão azul à esquerda)
    console.log('📍 Clicando em "Aplicar campanha"...');
    
    const btnAplicar = page.locator('button:has-text("Aplicar campanha")').first();
    
    if (await btnAplicar.isVisible({ timeout: 5000 })) {
      await btnAplicar.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await btnAplicar.click({ force: true });
      console.log('   ✅ Clicou em "Aplicar campanha"');
    } else {
      // Tenta por texto
      const btnTexto = page.getByText('Aplicar campanha', { exact: false }).first();
      if (await btnTexto.isVisible({ timeout: 3000 })) {
        await btnTexto.click({ force: true });
        console.log('   ✅ Clicou via texto');
      }
    }
    
    // Aguarda navegação para o carrinho
    console.log('   ⏳ Aguardando navegação para carrinho...');
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      if (page.url().includes('/cart') || page.url().includes('/checkout')) {
        console.log(`   ✅ Navegou para: ${page.url()}`);
        break;
      }
    }
    
    await page.waitForTimeout(2000);
  }
  
  console.log('✅ ETAPA 7 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 8: CARRINHO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 8: Carrinho');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Aguarda página do carrinho
  await page.waitForTimeout(2000);
  console.log(`📍 URL atual: ${page.url()}`);
  
  if (page.url().includes('/checkout/#/cart') || page.url().includes('/cart')) {
    console.log('📍 Página do carrinho detectada!');
    
    // Fecha modal de atenção se aparecer
    try {
      const btnFecharAtencao = page.locator('button:has-text("×"), svg[class*="close"], [class*="close"]').first();
      if (await btnFecharAtencao.isVisible({ timeout: 2000 })) {
        await btnFecharAtencao.click();
        console.log('   ✅ Modal fechado');
        await page.waitForTimeout(500);
      }
    } catch (e) {}
    
    // Pressiona Escape para fechar modais
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Clica em "Continuar Inscrição"
    console.log('📍 Procurando "Continuar Inscrição" no carrinho...');
    
    // Aguarda o botão aparecer
    await page.waitForTimeout(2000);
    
    // Tenta clicar no botão
    const btnContinuar = page.locator('button:has-text("Continuar Inscrição")').first();
    
    if (await btnContinuar.isVisible({ timeout: 10000 })) {
      await btnContinuar.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await btnContinuar.click({ force: true });
      console.log('   ✅ Clicou em "Continuar Inscrição"');
    } else {
      console.log('   ⚠️ Botão não visível, tentando por texto...');
      const btnTexto = page.getByText('Continuar Inscrição').first();
      await btnTexto.click({ force: true });
      console.log('   ✅ Clicou via texto');
    }
    
    // Aguarda navegação para /profile
    console.log('   ⏳ Aguardando navegação para dados pessoais...');
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      if (page.url().includes('/profile')) {
        console.log(`   ✅ Navegou para: ${page.url()}`);
        break;
      }
    }
    
    await page.waitForTimeout(2000);
  }
  
  console.log('✅ ETAPA 8 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 9: CHECKOUT - DADOS PESSOAIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 9: Checkout - Dados Pessoais');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  console.log(`📍 URL atual: ${page.url()}`);
  await page.waitForTimeout(2000);
  
  // Preenche data de nascimento
  console.log('📝 Procurando campo de data de nascimento...');
  const campoData = page.locator('input[name="birthDate"], input[type="date"], input[placeholder*="dd/mm"]').first();
  
  if (await campoData.isVisible({ timeout: 5000 })) {
    const valorAtual = await campoData.inputValue();
    console.log(`   Valor atual: "${valorAtual}"`);
    
    if (!valorAtual || valorAtual.includes('aaaa')) {
      await campoData.fill('');
      await campoData.type(CLIENTE.nascimento, { delay: 30 });
      console.log(`✅ Data de nascimento preenchida: ${CLIENTE.nascimento}`);
    }
  }
  
  // Procura botão para próxima etapa
  console.log('📍 Procurando botão para próxima etapa...');
  
  const btnIrEndereco = page.getByRole('button', { name: 'Ir para o Endereço' });
  const btnIrPagamento = page.getByRole('button', { name: 'Ir para o pagamento' });
  
  if (await btnIrEndereco.isVisible({ timeout: 3000 })) {
    await btnIrEndereco.click();
    console.log('   ✅ Clicou em "Ir para o Endereço"');
  } else if (await btnIrPagamento.isVisible({ timeout: 3000 })) {
    await btnIrPagamento.click();
    console.log('   ✅ Clicou em "Ir para o pagamento"');
  }
  
  await page.waitForTimeout(2000);
  console.log('✅ ETAPA 9 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: CHECKOUT - ENDEREÇO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Checkout - Endereço');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Verifica se precisa preencher CEP
  const campoCep = page.locator('input[name="postalCode"], input[placeholder*="CEP"]').first();
  
  if (await campoCep.isVisible({ timeout: 5000 })) {
    const cepAtual = await campoCep.inputValue();
    console.log(`📝 Campo CEP visível, valor atual: "${cepAtual}"`);
    
    if (!cepAtual) {
      console.log('📝 Preenchendo CEP...');
      await campoCep.fill(CLIENTE.cep);
      console.log(`✅ CEP: ${CLIENTE.cep}`);
      await page.waitForTimeout(2000);
      
      // Verifica se CEP foi encontrado
      const erroCep = page.locator('text=CEP não foi encontrado');
      if (await erroCep.isVisible({ timeout: 2000 })) {
        console.log('❌ ERRO: CEP não foi encontrado');
        await page.screenshot({ path: 'erro-cep-pos.png', fullPage: true });
        return;
      }
    }
  }
  
  // Preenche número
  console.log('📝 Procurando campo Número...');
  const campoNumero = page.locator('input[name="number"], input[placeholder*="Número"]').first();
  
  for (let i = 1; i <= 5; i++) {
    if (await campoNumero.isVisible({ timeout: 3000 })) {
      const numeroAtual = await campoNumero.inputValue();
      if (!numeroAtual) {
        await campoNumero.fill(CLIENTE.numero);
        console.log(`✅ Número preenchido: ${CLIENTE.numero}`);
        break;
      } else {
        console.log(`   ℹ️ Número já preenchido: ${numeroAtual}`);
        break;
      }
    }
    await page.waitForTimeout(1000);
  }
  
  // Clica em "Ir para o pagamento"
  const btnPagamento = page.getByRole('button', { name: 'Ir para o pagamento' });
  if (await btnPagamento.isVisible({ timeout: 5000 })) {
    await btnPagamento.click();
    console.log('   ✅ Clicou em "Ir para o pagamento"');
    await page.waitForTimeout(2000);
  }
  
  console.log('✅ ETAPA 10 CONCLUÍDA');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 11: FINALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 11: Finalização');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Procura "Continuar Inscrição" no checkout
  const btnFinalizar = page.getByRole('button', { name: 'Continuar Inscrição' });
  if (await btnFinalizar.isVisible({ timeout: 10000 })) {
    await btnFinalizar.click();
    console.log('   ✅ Clicou em "Continuar Inscrição"');
    await page.waitForTimeout(5000);
  }
  
  // Verifica se chegou na página de confirmação
  const urlFinal = page.url();
  console.log(`📍 URL final: ${urlFinal}`);
  
  if (urlFinal.includes('orderPlaced')) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🎉 INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADA COM SUCESSO!');
    
    // Tenta extrair número da inscrição da URL
    const ogMatch = urlFinal.match(/og=(\d+)/);
    if (ogMatch) {
      numeroInscricao = ogMatch[1];
      console.log(`📋 Número de Inscrição: ${numeroInscricao}`);
    }
    
    if (poloUsado !== CLIENTE.polo) {
      console.log(`📍 POLO ALTERNATIVO UTILIZADO: "${poloUsado}"`);
    }
    if (campanhaAplicada) {
      console.log(`📋 CAMPANHA APLICADA: ${campanhaAplicada}`);
    }
    console.log('═══════════════════════════════════════════════════════════════════════════');
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('❌ INSCRIÇÃO PÓS-GRADUAÇÃO NÃO FINALIZADA');
    console.log(`📍 URL final: ${urlFinal}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    await page.screenshot({ path: 'erro-pos-nao-finalizada.png', fullPage: true });
  }
});

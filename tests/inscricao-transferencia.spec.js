const { test, expect } = require('./stealth-fixture');
const { validarPolo: validarPoloWhitelist } = require('./polos-atendidos');

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

// Polo solicitado (precisa ser obtido antes de CLIENTE para ajustar cidade).
// Sem default: validarPoloWhitelist falha logo no início do test se vier vazio.
const poloSolicitado = normalizarPolo(corrigirAcentos(process.env.CLIENTE_POLO) || '');
const cidadePadrao = corrigirAcentos(process.env.CLIENTE_CIDADE) || 'São Paulo';

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
  // Localização (cidade ajustada automaticamente para polos específicos)
  estado: corrigirAcentos(process.env.CLIENTE_ESTADO) || 'São Paulo',
  cidade: obterCidadeDoPolo(poloSolicitado, cidadePadrao),
  // Curso
  curso: corrigirAcentos(process.env.CLIENTE_CURSO) || 'pedagogia',
  polo: poloSolicitado,
  tipoVestibular: corrigirAcentos(process.env.CLIENTE_TIPO_VESTIBULAR) || 'Vestibular Múltipla Escolha',
  tipoIngresso: corrigirAcentos(process.env.CLIENTE_TIPO_INGRESSO) || 'Segunda Graduação',
};

test('test', async ({ page }) => {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VARIÁVEIS DE CONTROLE PARA FALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════
  let poloUsado = CLIENTE.polo;
  let vestibularUsado = CLIENTE.tipoVestibular;
  let ingressoUsado = CLIENTE.tipoIngresso;
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
  console.log(`   Cidade: ${CLIENTE.cidade}${getInfoAjusteCidade(CLIENTE.polo)}`);
  console.log(`   Curso: ${CLIENTE.curso}`);
  console.log(`   Polo: ${CLIENTE.polo}`);
  console.log(`   Vestibular: ${CLIENTE.tipoVestibular}`);
  console.log(`   Tipo Ingresso: ${CLIENTE.tipoIngresso}`);
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
  poloUsado = CLIENTE.polo;

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
  
  // Monta lista de admins: usa VTEX_ADMINS (formato email:senha|email:senha) ou fallback
  const ADMINS = [];
  if (process.env.VTEX_ADMINS) {
    process.env.VTEX_ADMINS.split('|').forEach(par => {
      const [email, senha] = par.split(':');
      if (email && senha) ADMINS.push({ email: email.trim(), senha: senha.trim() });
    });
  }
  if (process.env.VTEX_ADMIN_EMAIL && process.env.VTEX_ADMIN_PASSWORD) {
    const jaExiste = ADMINS.some(a => a.email === process.env.VTEX_ADMIN_EMAIL);
    if (!jaExiste) ADMINS.push({ email: process.env.VTEX_ADMIN_EMAIL, senha: process.env.VTEX_ADMIN_PASSWORD });
  }
  if (ADMINS.length === 0) {
    ADMINS.push(
      { email: 'fabio.boas50@polo.cruzeirodosul.edu.br', senha: 'Eduit123@!' },
      { email: 'marcelo.pinheiro1876@polo.cruzeirodosul.edu.br', senha: 'Eduit123@!' },
    );
  }
  const adminEscolhido = ADMINS[Math.floor(Math.random() * ADMINS.length)];
  console.log(`   🔑 Admin: ${adminEscolhido.email}`);
  
  // Email
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await preencherCampo(emailInput, adminEscolhido.email, 'Email admin', false);
  
  // Clica continuar
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForTimeout(1000);
  
  // Senha
  const senhaInput = page.getByRole('textbox', { name: 'Senha' });
  await senhaInput.waitFor({ state: 'visible', timeout: 15000 });
  await senhaInput.fill(adminEscolhido.senha);
  console.log('✅ Senha preenchida');
  
  // Clica continuar para login
  await page.getByRole('button', { name: 'Continuar' }).click();
  await aguardarCarregamento('Login', 30000);
  await page.waitForTimeout(1500);
  
  console.log(`✅ ETAPA 1 CONCLUÍDA - URL: ${page.url()}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: NAVEGAÇÃO PARA GRADUAÇÃO (com verificação robusta)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 2: Navegação para Graduação');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Função auxiliar para verificar se está na página de login
  const estaNaPaginaDeLogin = () => {
    const url = page.url();
    return url.includes('admin-login') || url.includes('returnUrl=');
  };

  // Navega para graduação com retry robusto
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      console.log(`   Tentativa ${tentativa}/5 de navegar para graduação...`);
      await page.goto('https://cruzeirodosul.myvtex.com/graduacao', { 
        waitUntil: 'networkidle', 
        timeout: 45000 
      });
      await page.waitForTimeout(3000);
      
      // Verifica se ainda está na página de login (sessão não persistiu)
      if (estaNaPaginaDeLogin()) {
        console.log(`   ⚠️ Ainda na página de login, tentando login novamente...`);
        
        // Tenta fazer login novamente
        const emailInputRetry = page.getByRole('textbox', { name: 'Email' });
        const emailVisivel = await emailInputRetry.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (emailVisivel) {
          const adminRetry = ADMINS[0];
          await emailInputRetry.fill(adminRetry.email);
          await page.getByRole('button', { name: 'Continuar' }).click();
          await page.waitForTimeout(2000);
          
          const senhaInputRetry = page.getByRole('textbox', { name: 'Senha' });
          const senhaVisivel = await senhaInputRetry.isVisible({ timeout: 5000 }).catch(() => false);
          if (senhaVisivel) {
            await senhaInputRetry.fill(adminRetry.senha);
            await page.getByRole('button', { name: 'Continuar' }).click();
            await page.waitForTimeout(5000);
          }
        }
        
        // Tenta navegar novamente após login
        await page.goto('https://cruzeirodosul.myvtex.com/graduacao', { 
          waitUntil: 'networkidle', 
          timeout: 45000 
        });
        await page.waitForTimeout(3000);
      }
      
      // Verifica novamente após todas as tentativas
      if (!estaNaPaginaDeLogin()) {
        console.log(`   ✅ Navegação para graduação bem-sucedida!`);
        break;
      }
      
      if (tentativa === 5 && estaNaPaginaDeLogin()) {
        throw new Error(`Não foi possível permanecer na página de graduação após login admin. URL: ${page.url()}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Erro na tentativa ${tentativa}: ${e.message}`);
      if (tentativa < 5) {
        await page.waitForTimeout(3000);
      } else {
        throw e;
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

  // Verificação final: garante que não está mais na página de login
  const urlFinalEtapa2 = page.url();
  if (urlFinalEtapa2.includes('admin-login') || urlFinalEtapa2.includes('returnUrl=')) {
    console.log(`   ⚠️ Ainda na página de login após todas as tentativas. URL: ${urlFinalEtapa2}`);
    throw new Error(`Não foi possível sair da página de login admin. URL: ${urlFinalEtapa2}`);
  }

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
  
  // Remove overlays novamente (podem ter reaparecido)
  await removerOverlays();
  
  // Usa page.evaluate para focar e preencher o campo diretamente (mais confiável em headless)
  console.log('   📍 Preenchendo campo de busca via JavaScript...');
  await page.evaluate((curso) => {
    const input = document.querySelector('input[placeholder*="procura"]') || 
                  document.querySelector('input[class*="search"]') ||
                  document.querySelector('[class*="search"] input');
    if (input) {
      input.focus();
      input.value = curso;
      // Dispara eventos para o React detectar a mudança
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, cursoParaBusca);
  await page.waitForTimeout(1000);
  
  // Pressiona Enter para buscar
  console.log('   📍 Pressionando Enter...');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Se não navegou, tenta submeter o formulário diretamente ou navegar via URL
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
  
  // Nome completo do CANDIDATO - usa force para evitar problemas com overlays
  // IMPORTANTE: Evitar campos de "nome da mãe", "nome do pai", "nome do responsável"
  console.log('📝 Preenchendo: Nome completo do candidato...');
  
  // Função para verificar se é campo de nome de parente
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
  
  // Tenta o seletor específico "Nome completo" (exato)
  let nomePreenchido = false;
  const nomeInput = page.getByRole('textbox', { name: 'Nome completo' });
  
  try {
    await nomeInput.waitFor({ state: 'visible', timeout: 15000 });
    
    // Verifica se não é campo de parente
    if (await ehCampoParente(nomeInput)) {
      console.log('   ⚠️ Campo "Nome completo" é de parente, buscando alternativa...');
    } else {
      await nomeInput.scrollIntoViewIfNeeded();
      await nomeInput.click({ force: true });
      await page.waitForTimeout(100);
      await nomeInput.fill(CLIENTE.nome);
      console.log(`✅ Nome completo do candidato: "${CLIENTE.nome}"`);
      nomePreenchido = true;
    }
  } catch (e) {
    console.log(`⚠️ Erro ao preencher nome: ${e.message}`);
  }
  
  // Fallback: tenta outros seletores específicos (excluindo parentes)
  if (!nomePreenchido) {
    const seletoresNomeFallback = [
      'input[placeholder*="nome completo" i]:not([placeholder*="mãe" i]):not([placeholder*="mae" i])',
      'input[name="userName"]',
      'input[name="nomecompleto"]:not([name*="mae"]):not([name*="mãe"])',
    ];
    
    for (const seletor of seletoresNomeFallback) {
      try {
        const campo = page.locator(seletor).first();
        if (await campo.isVisible({ timeout: 2000 })) {
          if (!(await ehCampoParente(campo))) {
            await campo.click({ force: true });
            await campo.fill(CLIENTE.nome);
            console.log(`✅ Nome completo do candidato (fallback): "${CLIENTE.nome}"`);
            nomePreenchido = true;
            break;
          }
        }
      } catch (e) {}
    }
  }
  
  if (!nomePreenchido) {
    console.log('   ⚠️ ALERTA: Não conseguiu preencher nome do candidato de forma segura!');
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
  
  // Remove overlays que interceptam cliques (helpCenter, chat, etc)
  await page.evaluate(() => {
    const seletores = [
      '[class*="helpCenter"]', '[class*="HelpCenter"]',
      '[class*="zendesk"]', '[class*="chat-widget"]',
      '[class*="intercom"]', '[class*="drift"]',
      '.cruzeirodosul-store-theme-3-x-helpCenterBgOpen'
    ];
    for (const sel of seletores) {
      document.querySelectorAll(sel).forEach(el => el.remove());
    }
  }).catch(() => {});
  
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
  const MAX_TENTATIVAS = 4;
  let tentativaAtual = 0;
  let formularioCarregado = false;
  
  while (tentativaAtual < MAX_TENTATIVAS && !formularioCarregado) {
    tentativaAtual++;
    console.log(`🔄 Tentativa ${tentativaAtual}/${MAX_TENTATIVAS} - Clicando em Inscreva-se...`);
    
    // Localiza o botão (pode ter mudado após reload)
    const btnInscreva = page.getByRole('button', { name: /inscreva-se/i }).first();
    const btnVisivel = await btnInscreva.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (btnVisivel) {
      // Remove overlays que interceptam cliques (helpCenter, chat, etc)
      await page.evaluate(() => {
        const seletores = [
          '[class*="helpCenter"]', '[class*="HelpCenter"]',
          '[class*="zendesk"]', '[class*="chat-widget"]',
          '[class*="intercom"]', '[class*="drift"]',
          '.cruzeirodosul-store-theme-3-x-helpCenterBgOpen'
        ];
        for (const sel of seletores) {
          document.querySelectorAll(sel).forEach(el => el.remove());
        }
      }).catch(() => {});
      
      await btnInscreva.scrollIntoViewIfNeeded().catch(() => {});
      await btnInscreva.click({ force: true });
    }
    
    await aguardarCarregamento('Formulário de inscrição', 60000);
    await page.waitForTimeout(2000);
    
    // Scroll para baixo para forçar o carregamento dos componentes React
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);
    
    // Verifica se os selects de localização existem
    const urlAtual = page.url();
    const selectsEncontrados = await page.locator('.react-select__input-container').count();
    const selectsControlEncontrados = await page.locator('.react-select__control').count();
    const campoCPFvisivel = await page.locator('input[name="userDocument"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log(`   📍 URL: ${urlAtual}`);
    console.log(`   📋 Selects: ${selectsEncontrados} (input), ${selectsControlEncontrados} (control), CPF visível: ${campoCPFvisivel}`);
    
    // Se encontrou pelo menos 3 selects OU o campo CPF está visível, o formulário carregou
    if (selectsEncontrados >= 3 || selectsControlEncontrados >= 3 || campoCPFvisivel) {
      formularioCarregado = true;
      console.log(`   ✅ Formulário de localização encontrado!`);
    } else {
      // Tenta esperar mais um pouco (componentes React podem demorar)
      console.log('   ⏳ Aguardando mais 5s para componentes React renderizarem...');
      await page.waitForTimeout(5000);
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(1000);
      
      const selectsApos = await page.locator('.react-select__input-container').count();
      const selectsControlApos = await page.locator('.react-select__control').count();
      const cpfApos = await page.locator('input[name="userDocument"]').isVisible({ timeout: 1000 }).catch(() => false);
      
      if (selectsApos >= 3 || selectsControlApos >= 3 || cpfApos) {
        formularioCarregado = true;
        console.log(`   ✅ Formulário apareceu após espera extra! (${selectsApos} selects)`);
      } else if (tentativaAtual < MAX_TENTATIVAS) {
        console.log(`   ⚠️ Formulário não carregou, recarregando página...`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2000);
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
  }
  
  if (!formularioCarregado) {
    console.log('   ⚠️ Formulário não carregou, tentando continuar mesmo assim...');
    // Não lança erro - tenta continuar para ver se o formulário aparece na ETAPA 6
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
  
  // Polo - somente o polo solicitado. Sem fallback: nunca inscrever em polo diferente do pedido.
  console.log(`🔽 Tentando polo solicitado: "${CLIENTE.polo}"`);
  const poloSelecionado = await selecionarOpcao(
    page.locator('.react-select__input-container').nth(3),
    CLIENTE.polo,
    null,
    'Polo'
  );

  if (!poloSelecionado) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('❌ POLO_INDISPONIVEL_PARA_CURSO');
    console.log(`   Polo solicitado: "${CLIENTE.polo}"`);
    console.log(`   Curso: "${CLIENTE.curso}"`);
    console.log('   O curso solicitado NÃO está disponível neste polo. Inscrição abortada.');
    console.log('   (Nunca trocamos de polo automaticamente — peça ao operador escolher outro.)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    await page.screenshot({ path: 'erro-polo-nao-encontrado.png', fullPage: true });
    console.log('📸 Screenshot salvo: erro-polo-nao-encontrado.png');

    throw new Error(`POLO_INDISPONIVEL_PARA_CURSO: curso "${CLIENTE.curso}" não disponível no polo "${CLIENTE.polo}".`);
  }

  poloUsado = CLIENTE.polo;

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
  // ETAPA 7: FORMA DE INGRESSO E CONDIÇÕES (Transferência / Segunda Graduação)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Forma de Ingresso e Condições');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Determina o texto de busca baseado no tipo de ingresso
  let textoBuscaIngresso = '';
  const tipoLower = CLIENTE.tipoIngresso.toLowerCase();
  
  if (tipoLower.includes('transfer')) {
    textoBuscaIngresso = 'transfer';
  } else if (tipoLower.includes('segunda')) {
    textoBuscaIngresso = 'segunda';
  } else {
    textoBuscaIngresso = CLIENTE.tipoIngresso.substring(0, 6).toLowerCase();
  }
  
  console.log(`   🔍 Buscando forma de ingresso com: "${textoBuscaIngresso}" para: "${CLIENTE.tipoIngresso}"`);
  
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    textoBuscaIngresso,
    null,
    'Forma de Ingresso'
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
    console.log('');
    console.log('❌ ════════════════════════════════════════════════════════════════════════════');
    console.log('❌  CPF JÁ POSSUI INSCRIÇÃO COM ESTE TIPO DE INGRESSO!');
    console.log(`❌  Tipo: "${CLIENTE.tipoIngresso}"`);
    console.log('❌  Não é possível realizar a inscrição com este CPF.');
    console.log('❌ ════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('CPF já possui uma inscrição');
    console.log('🛑 Processo interrompido.');
    return;
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
  // ETAPAS FINAIS: Página de Checkout VTEX (com retry + refresh)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const MAX_TENTATIVAS_CHECKOUT_TOTAL = 3;
  let checkoutConcluido = false;
  
  for (let tentativaCheckout = 1; tentativaCheckout <= MAX_TENTATIVAS_CHECKOUT_TOTAL && !checkoutConcluido; tentativaCheckout++) {
  
  console.log(`📌 ETAPAS FINAIS: Página de Checkout (tentativa ${tentativaCheckout}/${MAX_TENTATIVAS_CHECKOUT_TOTAL})`);
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  urlAtual = page.url();
  console.log(`📍 URL atual: ${urlAtual}`);
  
  // Se não estamos no checkout, algo deu errado
  if (!urlAtual.includes('/checkout')) {
    console.log('   ⚠️ Não estamos no checkout, tentando navegar...');
    await page.goto(urlAtual, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    urlAtual = page.url();
    if (!urlAtual.includes('/checkout')) {
      console.log(`   ❌ Ainda não estamos no checkout: ${urlAtual}`);
      continue;
    }
  }
  
  // ── Detecta em qual step do checkout estamos ──
  async function detectarStepCheckout() {
    const url = page.url();
    if (url.includes('#/payment')) return 'payment';
    if (url.includes('#/shipping')) return 'shipping';
    if (url.includes('#/profile')) return 'profile';
    if (url.includes('#/cart')) return 'cart';
    return 'unknown';
  }
  
  let stepAtual = await detectarStepCheckout();
  console.log(`   📍 Step do checkout: ${stepAtual}`);
  
  // Aguarda página de checkout carregar completamente
  console.log('   ⏳ Aguardando checkout carregar...');
  await page.waitForTimeout(1000);
  
  // Aguarda até que existam inputs visíveis na página
  for (let t = 0; t < 15; t++) {
    const inputs = await page.locator('input:visible').count();
    if (inputs >= 3) break;
    await page.waitForTimeout(1000);
  }
  
  await page.waitForTimeout(1000);
  
  // ═════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 1: Dados Pessoais (se estamos em #/profile ou #/cart)
  // ═════════════════════════════════════════════════════════════════════════
  stepAtual = await detectarStepCheckout();
  
  if (stepAtual === 'profile' || stepAtual === 'cart' || stepAtual === 'unknown') {
    console.log('📌 CHECKOUT: Dados Pessoais...');
    
    // Tenta preencher data de nascimento
    const seletoresData = [
      page.locator('input[name*="birthDate"]').first(),
      page.locator('input[name*="birth"]').first(),
      page.locator('input[placeholder*="nascimento"]').first(),
      page.locator('input[type="date"]').first(),
      page.getByRole('textbox', { name: /nascimento/i }),
    ];
    
    for (const campo of seletoresData) {
      try {
        if (await campo.isVisible({ timeout: 2000 })) {
          const valorAtual = await campo.inputValue().catch(() => '');
          if (!valorAtual || valorAtual.length < 8) {
            await campo.click();
            await page.waitForTimeout(300);
            await campo.clear();
            await campo.type(CLIENTE.nascimento, { delay: 50 });
            console.log(`   ✅ Data de nascimento: ${CLIENTE.nascimento}`);
          } else {
            console.log(`   ✅ Data já preenchida: ${valorAtual}`);
          }
          break;
        }
      } catch (e) {}
    }
    
    await page.waitForTimeout(1000);
    
    // Clica no botão para avançar (Ir para Endereço / Ir para Pagamento)
    const seletoresBtnProximo = [
      page.locator('button:has-text("Ir para o pagamento")'),
      page.getByRole('button', { name: /Ir para o pagamento/i }),
      page.locator('button:has-text("Ir para o Endereço")'),
      page.locator('button:has-text("Ir para o endereço")'),
      page.getByRole('button', { name: /endereço/i }),
      page.locator('#go-to-shipping'),
      page.locator('#btn-go-to-shipping'),
      page.locator('button:has-text("Prosseguir")'),
    ];
    
    for (const btn of seletoresBtnProximo) {
      try {
        if (await btn.isVisible({ timeout: 2000 })) {
          const textoBtn = await btn.innerText().catch(() => 'botão');
          console.log(`   📍 Clicando "${textoBtn.trim().substring(0, 40)}"...`);
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);
          await btn.click({ force: true });
          console.log(`   ✅ Clicou!`);
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {}
    }
  }
  
  // ═════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 2: Endereço
  // ═════════════════════════════════════════════════════════════════════════
  stepAtual = await detectarStepCheckout();
  console.log(`   📍 Step após dados pessoais: ${stepAtual}`);
  
  if (stepAtual === 'shipping' || stepAtual === 'profile') {
    console.log('📌 CHECKOUT: Verificando Endereço...');
    await page.waitForTimeout(1500);
    
    // Se ainda estamos em profile, tenta navegar via hash
    if (stepAtual === 'profile') {
      console.log('   ⚠️ Ainda em profile, tentando navegar para shipping...');
      await page.evaluate(() => { window.location.hash = '#/shipping'; });
      await page.waitForTimeout(3000);
      stepAtual = await detectarStepCheckout();
      console.log(`   📍 Step após navegação: ${stepAtual}`);
    }
    
    // Clica em "Sim" se aparecer
    try {
      const simBtn = page.locator('button:has-text("Sim")').first();
      if (await simBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await simBtn.click();
        console.log('   ✅ Clicou em "Sim"');
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Verifica se precisa preencher CEP
    const campoCep = page.getByRole('textbox', { name: 'CEP *' });
    const cepVisivel = await campoCep.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (cepVisivel) {
      const cepAtual = await campoCep.inputValue().catch(() => '');
      if (!cepAtual || cepAtual.length < 8) {
        console.log('   📝 Preenchendo CEP...');
        try {
          await campoCep.click();
          await campoCep.fill(CLIENTE.cep);
          console.log(`   ✅ CEP: ${CLIENTE.cep}`);
          await campoCep.press('Tab');
          await page.waitForTimeout(3000);
        } catch (e) {
          console.log(`   ⚠️ Erro no CEP: ${e.message.split('\n')[0]}`);
        }
      }
    }
    
    // Preenche campos de endereço se visíveis
    try {
      const campoEnd = page.getByRole('textbox', { name: 'Endereço *' });
      if (await campoEnd.isVisible({ timeout: 1000 }).catch(() => false)) {
        const endAtual = await campoEnd.inputValue().catch(() => '');
        if (!endAtual || endAtual.trim() === '') {
          await campoEnd.fill('Null');
          console.log('   ✅ Endereço: Null');
        }
      }
    } catch (e) {}
    
    try {
      const campoNum = page.getByRole('textbox', { name: 'Número *' });
      if (await campoNum.isVisible({ timeout: 1000 }).catch(() => false)) {
        const numAtual = await campoNum.inputValue().catch(() => '');
        if (!numAtual || numAtual.trim() === '') {
          await campoNum.fill(CLIENTE.numero);
          console.log(`   ✅ Número: ${CLIENTE.numero}`);
        }
      }
    } catch (e) {}
    
    try {
      const campoBairro = page.getByRole('textbox', { name: 'Bairro *' });
      if (await campoBairro.isVisible({ timeout: 1000 }).catch(() => false)) {
        const bairroAtual = await campoBairro.inputValue().catch(() => '');
        if (!bairroAtual || bairroAtual.trim() === '') {
          await campoBairro.fill('Centro');
          console.log('   ✅ Bairro: Centro');
        }
      }
    } catch (e) {}
    
    await page.waitForTimeout(500);
    
    // Avança para pagamento
    const seletoresAvancar = [
      page.locator('button:has-text("Ir para o pagamento")'),
      page.getByRole('button', { name: /Ir para o pagamento/i }),
      page.locator('button:has-text("Continuar Inscrição")'),
      page.locator('button:has-text("Ir para o Endereço")'),
      page.locator('button:has-text("Prosseguir")'),
    ];
    
    for (const btn of seletoresAvancar) {
      try {
        if (await btn.isVisible({ timeout: 1500 })) {
          const textoBtn = await btn.innerText().catch(() => '');
          console.log(`   📍 Clicando "${textoBtn.trim().substring(0, 40)}"...`);
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await btn.click({ force: true });
          console.log('   ✅ Clicou!');
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {}
    }
  }
  
  // ═════════════════════════════════════════════════════════════════════════
  // CHECKOUT ETAPA 3: Pagamento → Continuar Inscrição / Finalizar
  // ═════════════════════════════════════════════════════════════════════════
  stepAtual = await detectarStepCheckout();
  console.log(`   📍 Step antes de pagamento: ${stepAtual}`);
  
  // Se ainda está preso em profile/shipping após tudo isso, faz refresh e tenta novamente
  if (stepAtual === 'profile' && tentativaCheckout < MAX_TENTATIVAS_CHECKOUT_TOTAL) {
    console.log(`   ❌ Ainda preso em #/profile. Fazendo refresh para tentar novamente...`);
    await page.screenshot({ path: `debug-checkout-stuck-t${tentativaCheckout}.png`, fullPage: true }).catch(() => {});
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);
    continue; // Volta para o início do loop
  }
  
  console.log('📌 CHECKOUT: Página de Pagamento...');
  await page.waitForTimeout(1000);
  
  // Remove overlays
  await removerOverlays();
  
  // Procura botão de finalização com múltiplos seletores
  console.log('   📍 Procurando botão de finalização...');
  const seletoresFinalizacao = [
    page.getByRole('button', { name: 'Continuar Inscrição' }),
    page.locator('button:has-text("Continuar Inscrição")').first(),
    page.locator('#payment-data-submit'),
    page.getByRole('button', { name: /Finalizar compra/i }),
    page.locator('button:has-text("Finalizar compra")').first(),
    page.locator('button:has-text("Continuar com a compra")').first(),
  ];
  
  let clicouFinalizar = false;
  
  for (const btn of seletoresFinalizacao) {
    try {
      if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const textoBtn = await btn.innerText().catch(() => 'botão');
        console.log(`   📍 Encontrou "${textoBtn.trim().substring(0, 40)}", clicando...`);
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(500);
        await btn.click({ force: true });
        console.log('   ✅ Clicou no botão de finalização!');
        clicouFinalizar = true;
        
        // Aguarda confirmação
        console.log('   ⏳ Aguardando confirmação do pedido...');
        await page.waitForTimeout(15000);
        break;
      }
    } catch (e) {}
  }
  
  if (!clicouFinalizar) {
    console.log('   ⚠️ Botão de finalização não encontrado');
    
    // Se não é a última tentativa, refresh e retry
    if (tentativaCheckout < MAX_TENTATIVAS_CHECKOUT_TOTAL) {
      console.log(`   🔄 Fazendo refresh para tentar novamente...`);
      await page.screenshot({ path: `debug-checkout-nofinal-t${tentativaCheckout}.png`, fullPage: true }).catch(() => {});
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(5000);
      continue;
    }
  }
  
  // Verifica se o checkout foi concluído (URL mudou para orderPlaced ou similar)
  const urlPosCheckout = page.url();
  if (urlPosCheckout.includes('orderPlaced') || clicouFinalizar) {
    checkoutConcluido = true;
  } else if (tentativaCheckout < MAX_TENTATIVAS_CHECKOUT_TOTAL) {
    console.log(`   ⚠️ URL pós-checkout: ${urlPosCheckout} - tentando novamente...`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);
    continue;
  }
  
  } // fim do loop de retry do checkout
  
  if (!checkoutConcluido) {
    console.log('');
    console.log('❌ CHECKOUT NÃO CONCLUÍDO após todas as tentativas');
    await page.screenshot({ path: 'erro-checkout-final.png', fullPage: true }).catch(() => {});
  }
  
  console.log(`✅ CHECKOUT CONCLUÍDO`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 10: FINALIZAÇÃO - Transferência / Segunda Graduação
  // Captura inscricaoSIAA via API VTEX na página orderPlaced.
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 10: Finalização (Transferência/Segunda Graduação)');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  const urlFinal = page.url();
  console.log(`📍 URL final: ${urlFinal}`);
  
  let numeroInscricaoSIAA = null;
  let orderId = null;
  
  if (urlFinal.includes('orderPlaced')) {
    // Extrai og da URL
    const ogMatch = urlFinal.match(/og=(\d+)/);
    orderId = ogMatch ? ogMatch[1] : null;
    console.log(`📋 Order ID: ${orderId || '(não encontrado)'}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // CAPTURA inscricaoSIAA via API VTEX /api/dataentities/OP/documents/
    // ═══════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('🔍 Capturando inscricaoSIAA via API VTEX...');
    
    // Aguarda a página orderPlaced carregar e fazer as requisições
    await page.waitForTimeout(5000);
    
    // Tenta capturar via JavaScript na própria página
    try {
      const resultado = await page.evaluate(async () => {
        // Busca todas as requisições feitas para dataentities/OP
        // Tenta buscar diretamente via fetch
        try {
          // Procura links ou dados na página que contenham o document ID
          const scripts = document.querySelectorAll('script');
          let documentId = null;
          
          // Tenta extrair o document ID do conteúdo da página
          const pageContent = document.body.innerHTML;
          const docIdMatch = pageContent.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
          if (docIdMatch) {
            documentId = docIdMatch[1];
          }
          
          if (documentId) {
            const response = await fetch(`/api/dataentities/OP/documents/${documentId}?an=cruzeirodosul&_fields=inscricaoSIAA,orderId,firstName,lastName,email,formaIngresso,product,codigoDoCurso,unidade`, {
              headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
              return await response.json();
            }
          }
          
          return null;
        } catch (e) {
          return { erro: e.message };
        }
      });
      
      if (resultado && resultado.inscricaoSIAA) {
        numeroInscricaoSIAA = resultado.inscricaoSIAA;
        console.log(`✅ inscricaoSIAA capturado via API: ${numeroInscricaoSIAA}`);
        console.log(`   📋 Dados: ${JSON.stringify(resultado)}`);
      } else {
        console.log(`   ⚠️ Resultado da API: ${JSON.stringify(resultado)}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Erro ao buscar via evaluate: ${e.message}`);
    }
    
    // Fallback: Intercepta as requisições já feitas pela página
    if (!numeroInscricaoSIAA) {
      console.log('');
      console.log('🔍 Tentando interceptar via requisições da página...');
      
      // Registra interceptador e recarrega para capturar
      let capturedData = null;
      
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/dataentities/OP/documents/') && url.includes('inscricaoSIAA')) {
          try {
            const body = await response.json();
            if (body && body.inscricaoSIAA) {
              capturedData = body;
              console.log(`   ✅ INTERCEPTADO inscricaoSIAA: ${body.inscricaoSIAA}`);
            }
          } catch (e) {}
        }
      });
      
      // Recarrega a página para capturar a requisição
      console.log('   🔄 Recarregando página para interceptar...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(8000);
      
      if (capturedData && capturedData.inscricaoSIAA) {
        numeroInscricaoSIAA = capturedData.inscricaoSIAA;
        orderId = capturedData.orderId || orderId;
        console.log(`   ✅ inscricaoSIAA capturado via interceptação: ${numeroInscricaoSIAA}`);
      }
    }
    
    // Fallback final: busca diretamente na página
    if (!numeroInscricaoSIAA) {
      console.log('');
      console.log('🔍 Tentando extrair do conteúdo da página...');
      
      const pageText = await page.locator('body').innerText().catch(() => '');
      
      // Procura padrões como "inscricaoSIAA":"265229682" ou SIAA: 265229682
      const siaaMatch = pageText.match(/(?:inscricaoSIAA|SIAA)[:\s"]*(\d{6,})/i);
      if (siaaMatch) {
        numeroInscricaoSIAA = siaaMatch[1];
        console.log(`   ✅ inscricaoSIAA encontrado no texto: ${numeroInscricaoSIAA}`);
      } else {
        console.log('   ⚠️ inscricaoSIAA não encontrado no texto da página');
      }
    }
  }
  
  // Marca para extração pelo server.js
  if (numeroInscricaoSIAA) {
    console.log(`NUMERO_INSCRICAO_EXTRAIDO: ${numeroInscricaoSIAA}`);
  } else if (orderId) {
    console.log(`NUMERO_INSCRICAO_EXTRAIDO: ${orderId}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  if (urlFinal.includes('orderPlaced')) {
    console.log('INSCRICAO_TRANSFERENCIA_SUCESSO');
    console.log(`📋 inscricaoSIAA: ${numeroInscricaoSIAA || '(não capturado)'}`);
    console.log(`📋 Order ID: ${orderId || '(não encontrado)'}`);
    console.log(`📋 Tipo de Ingresso: ${CLIENTE.tipoIngresso}`);
    console.log(`📋 Curso: ${CLIENTE.curso}`);
    console.log(`📋 CPF: ${CLIENTE.cpf}`);
    if (poloUsado.toLowerCase() !== CLIENTE.polo.toLowerCase()) {
      console.log(`📍 POLO ALTERNATIVO UTILIZADO: "${poloUsado}"`);
    }
  } else {
    console.log('INSCRICAO_TRANSFERENCIA_FALHA');
    console.log(`📍 URL final não é orderPlaced: ${urlFinal}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════════');
});

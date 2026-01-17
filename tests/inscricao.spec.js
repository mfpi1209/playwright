import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DO CLIENTE - Via variáveis de ambiente ou valores padrão
// ═══════════════════════════════════════════════════════════════════════════
const CLIENTE = {
  // Dados pessoais
  nome: process.env.CLIENTE_NOME || 'Carlos Eduardo Ribeiro',
  cpf: process.env.CLIENTE_CPF || '96724754038',
  email: process.env.CLIENTE_EMAIL || 'ceduardoribeiro@hotmail.com',
  telefone: process.env.CLIENTE_TELEFONE || '11974562318',
  nascimento: process.env.CLIENTE_NASCIMENTO || '14/02/1985',
  // Endereço
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || '12',
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
  // Localização
  estado: process.env.CLIENTE_ESTADO || 'São Paulo',
  cidade: process.env.CLIENTE_CIDADE || 'São Paulo',
  // Curso
  curso: process.env.CLIENTE_CURSO || 'pedagogia',
  polo: process.env.CLIENTE_POLO || 'vila mariana',
  tipoVestibular: process.env.CLIENTE_TIPO_VESTIBULAR || 'Vestibular Múltipla Escolha',
};

test('test', async ({ page }) => {
  
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
  
  await page.evaluate(() => {
    window.location.href = 'https://cruzeirodosul.myvtex.com/graduacao';
  });
  
  await page.waitForURL('**/graduacao**', { timeout: 30000 });
  await aguardarCarregamento('Página de graduação', 30000);
  await page.waitForTimeout(3000);
  
  // Aceita cookies
  try {
    await page.getByText('Aceitar todos').click({ timeout: 5000 });
    console.log('✅ Cookies aceitos');
  } catch (e) {
    console.log('ℹ️ Banner de cookies não encontrado');
  }
  
  // Fecha modais
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
  await searchInput.type(CLIENTE.curso, { delay: 80 });
  await searchInput.press('Enter');
  
  await aguardarCarregamento('Resultados da busca');
  
  // Clica no primeiro resultado que contém o curso (link com "View product details")
  const produtoLink = page.getByRole('link', { name: /View product details/i }).first();
  await produtoLink.waitFor({ state: 'visible', timeout: 15000 });
  console.log('📍 Produto encontrado, clicando...');
  await produtoLink.click();
  
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
  
  await inscreverBtn.click();
  
  await aguardarCarregamento('Formulário de inscrição', 60000);
  await page.waitForTimeout(5000);
  
  console.log(`✅ ETAPA 5 CONCLUÍDA`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 6: DADOS DE LOCALIZAÇÃO (País, Estado, Cidade, Polo, CPF)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 6: Dados de Localização');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Aguarda formulário estar completamente carregado
  console.log('⏳ Verificando se formulário está pronto...');
  await aguardarCarregandoDesaparecer();
  
  // Aguarda o primeiro select estar visível e interativo
  const primeiroSelect = page.locator('.react-select__input-container').first();
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
  // ETAPA 7: VESTIBULAR E CONDIÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 7: Vestibular e Condições');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  // Vestibular
  await selecionarOpcao(
    page.locator('.react-select__control').filter({ hasText: 'Selecione' }).first(),
    'vest',
    CLIENTE.tipoVestibular,
    'Tipo de Vestibular'
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
    await page.screenshot({ path: 'cpf-ja-inscrito.png', fullPage: true });
    console.log('📸 Screenshot salvo em: cpf-ja-inscrito.png');
    console.log('🛑 Processo interrompido.');
    return;
  }
  
  console.log('✅ CPF liberado para inscrição');
  console.log(`✅ ETAPA 7 CONCLUÍDA`);
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
  
  // Clica em "Ir para o Endereço" - SEMPRE tenta clicar
  console.log('📍 Procurando botão "Ir para o Endereço"...');
  
  const seletoresBtnEndereco = [
    page.locator('button:has-text("Ir para o Endereço")'),
    page.locator('button:has-text("Ir para o endereço")'),
    page.getByRole('button', { name: /endereço/i }),
    page.locator('button').filter({ hasText: 'Endereço' }).first()
  ];
  
  let clicouEndereco = false;
  
  for (const btn of seletoresBtnEndereco) {
    try {
      if (await btn.isVisible({ timeout: 3000 })) {
        console.log('📍 Encontrou botão "Ir para o Endereço", clicando...');
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await btn.click();
        clicouEndereco = true;
        console.log('✅ Clicou em "Ir para o Endereço"!');
        await page.waitForTimeout(5000);
        break;
      }
    } catch (e) {
      // Tenta próximo
    }
  }
  
  if (!clicouEndereco) {
    console.log('⚠️ Não encontrou botão "Ir para o Endereço"');
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
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log('⚠️ Erro no CEP:', e.message);
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
  
  await page.waitForTimeout(1000);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CLICA EM "IR PARA O PAGAMENTO" (seletor correto do Codegen)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📍 Clicando em "Ir para o pagamento"...');
  const btnPagamento = page.getByRole('button', { name: 'Ir para o pagamento Prosseguir' });
  
  if (await btnPagamento.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btnPagamento.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await btnPagamento.click();
    console.log('✅ Clicou em "Ir para o pagamento"!');
    await page.waitForTimeout(5000);
  } else {
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
  
  let linkProva = null;
  
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
   // PASSO 2: Encontrar "Acessar prova" dentro da MODAL
   // ═══════════════════════════════════════════════════════════════════════════
   console.log('');
   console.log('🔍 PASSO 2: Procurando "Acessar prova" na modal...');
   
   // Aguarda a modal abrir completamente (5 segundos)
   await novaAba.waitForTimeout(5000);
   
   // Usa o seletor exato do Codegen - o botão está dentro de um <a>
   const btnAcessarProva = novaAba.getByRole('button', { name: 'Acessar prova' });
   let acessarProvaLink = null;
   
   try {
     await btnAcessarProva.waitFor({ state: 'visible', timeout: 10000 });
     console.log('   ✅ ENCONTROU "Acessar prova" na modal!');
     // Pega o elemento pai <a> que contém o href
     acessarProvaLink = novaAba.locator('a:has(button:has-text("Acessar prova"))');
   } catch (e) {
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
         
         await novaAba.waitForTimeout(3000);
         
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
  // RESULTADO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  if (linkProva) {
    console.log('🎉 SUCESSO! LINK DA PROVA CAPTURADO:');
    console.log(`🔗 ${linkProva}`);
  } else {
    console.log('⚠️ FINALIZADO SEM LINK DA PROVA');
  }
  console.log(`📍 URL final: ${page.url()}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
});

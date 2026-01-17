import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DO CLIENTE - Via variáveis de ambiente ou valores padrão
// ═══════════════════════════════════════════════════════════════════════════
const CLIENTE = {
  // Dados pessoais
  nome: process.env.CLIENTE_NOME || 'Camila Souza Pinto',
  cpf: process.env.CLIENTE_CPF || '61414460007',
  email: process.env.CLIENTE_EMAIL || 'csouza85@yahoo.com.br',
  telefone: process.env.CLIENTE_TELEFONE || '11981284567',
  nascimento: process.env.CLIENTE_NASCIMENTO || '02/11/1985',
  // Endereço
  cep: process.env.CLIENTE_CEP || '05315030',
  numero: process.env.CLIENTE_NUMERO || '12',
  complemento: process.env.CLIENTE_COMPLEMENTO || '',
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
  console.log(`   Curso: ${CLIENTE.curso}`);
  console.log(`   Polo: ${CLIENTE.polo}`);
  console.log(`   Vestibular: ${CLIENTE.tipoVestibular}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÃO AUXILIAR: Aguarda carregamento com verificação
  // ═══════════════════════════════════════════════════════════════════════════
  async function aguardarCarregamento(descricao, timeout = 10000) {
    console.log(`⏳ Aguardando: ${descricao}...`);
    const inicio = Date.now();
    await page.waitForLoadState('networkidle', { timeout });
    await page.waitForTimeout(1000);
    
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
  
  const produtoLink = page.locator(`a[href*="${CLIENTE.curso}"]`).first();
  await produtoLink.waitFor({ state: 'visible', timeout: 15000 });
  await produtoLink.click();
  
  await aguardarCarregamento('Página do produto', 30000);
  await page.waitForTimeout(5000); // Espera página estabilizar
  
  console.log(`✅ ETAPA 4 CONCLUÍDA - Curso selecionado`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: FORMULÁRIO INICIAL (Nome, Telefone, Termos)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📌 ETAPA 5: Formulário Inicial');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
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
    'são paulo',
    null,
    'Estado'
  );
  
  // Cidade
  await selecionarOpcao(
    page.locator('.react-select__input-container').nth(2),
    'são paulo',
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
  
  // Aguarda seção de endereço expandir/carregar
  await page.waitForTimeout(5000);
  
  // Verifica se precisa responder "Você mora no Brasil?"
  console.log('📍 Verificando botão "Sim"...');
  const btnSim = page.locator('button:has-text("Sim")').first();
  try {
    if (await btnSim.isVisible({ timeout: 5000 })) {
      console.log('📍 Clicando em "Sim" (mora no Brasil)...');
      await btnSim.click();
      console.log('✅ Clicou em "Sim"!');
    } else {
      console.log('ℹ️ Botão "Sim" não visível');
    }
  } catch (e) {
    console.log('ℹ️ Botão "Sim" não encontrado');
  }
  
  // Aguarda campos de endereço carregarem
  console.log('⏳ Aguardando campo de CEP aparecer...');
  await page.waitForTimeout(5000);
  
  // Procura campo de CEP
  console.log('📝 Procurando campo de CEP...');
  const campoCep = page.getByRole('textbox', { name: 'CEP *' });
  
  try {
    await campoCep.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Campo de CEP encontrado!');
    
    // Preenche CEP usando type() para digitar letra por letra
    console.log('📝 Preenchendo CEP...');
    await campoCep.click();
    await page.waitForTimeout(300);
    await campoCep.clear();
    await page.waitForTimeout(300);
    await campoCep.type(CLIENTE.cep, { delay: 100 });
    console.log(`✅ CEP preenchido: ${CLIENTE.cep}`);
    
    // Pressiona Tab para acionar busca do CEP
    await page.keyboard.press('Tab');
    
    // Aguarda busca do CEP preencher o endereço
    console.log('⏳ Aguardando busca do CEP...');
    await page.waitForTimeout(8000);
    console.log('✅ Busca de CEP concluída!');
    
  } catch (e) {
    console.log('⚠️ Erro ao preencher CEP:', e.message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PREENCHE NÚMERO (seletor correto do Codegen)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📝 Preenchendo Número...');
  const campoNumero = page.getByRole('textbox', { name: 'Número *' });
  
  if (await campoNumero.isVisible({ timeout: 5000 }).catch(() => false)) {
    await campoNumero.click();
    await page.waitForTimeout(300);
    await campoNumero.fill(CLIENTE.numero);
    console.log(`✅ Número: ${CLIENTE.numero}`);
  } else {
    console.log('ℹ️ Campo de número não encontrado');
  }
  
  await page.waitForTimeout(2000);
  
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
  }
  
  if (novaAba) {
    await novaAba.waitForTimeout(5000);
    
    // Acompanhar Inscrição
    console.log('📍 Procurando "Acompanhar Inscrição"...');
    const acompanharBtn = novaAba.getByRole('button', { name: 'Acompanhar Inscrição' });
    if (await acompanharBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await acompanharBtn.click();
      console.log('✅ Clicou em "Acompanhar Inscrição"');
      await novaAba.waitForTimeout(5000);
    }
    
    // Acessar prova - COPIAR LINK
    console.log('📍 Procurando "Acessar prova"...');
    await novaAba.waitForTimeout(3000);
    
    // Tenta encontrar o link/botão "Acessar prova"
    const acessarProvaLink = novaAba.locator('a:has-text("Acessar prova")').first();
    const acessarProvaBtn = novaAba.getByRole('button', { name: 'Acessar prova' });
    
    let linkProva = null;
    
    // Tenta pegar o href do link
    if (await acessarProvaLink.isVisible({ timeout: 20000 }).catch(() => false)) {
      await acessarProvaLink.scrollIntoViewIfNeeded();
      await novaAba.waitForTimeout(1000);
      
      // Pega o href do link
      linkProva = await acessarProvaLink.getAttribute('href');
      
      if (linkProva) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('🔗 LINK DA PROVA COPIADO:');
        console.log(`   ${linkProva}`);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('');
      }
    } else if (await acessarProvaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await acessarProvaBtn.scrollIntoViewIfNeeded();
      await novaAba.waitForTimeout(1000);
      
      // Se for botão, tenta pegar onclick ou data attribute
      const onclick = await acessarProvaBtn.getAttribute('onclick').catch(() => null);
      const dataHref = await acessarProvaBtn.getAttribute('data-href').catch(() => null);
      
      // Também tenta pegar o link via JavaScript
      linkProva = await novaAba.evaluate(() => {
        const btn = document.querySelector('button:has-text("Acessar prova")');
        if (btn) {
          // Verifica se está dentro de um link
          const parentLink = btn.closest('a');
          if (parentLink) return parentLink.href;
        }
        return null;
      }).catch(() => null);
      
      if (linkProva || onclick || dataHref) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('🔗 LINK DA PROVA ENCONTRADO:');
        if (linkProva) console.log(`   ${linkProva}`);
        if (onclick) console.log(`   onclick: ${onclick}`);
        if (dataHref) console.log(`   data-href: ${dataHref}`);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('');
      } else {
        // Se não conseguiu o link, clica no botão normalmente
        await acessarProvaBtn.click();
        console.log('✅ Clicou em "Acessar prova"');
        await novaAba.waitForTimeout(5000);
        
        // Pega a URL após clicar
        linkProva = novaAba.url();
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('🔗 URL DA PROVA (após clicar):');
        console.log(`   ${linkProva}`);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('');
      }
    } else {
      console.log('⚠️ Elemento "Acessar prova" não encontrado');
      
      // Lista elementos da nova aba para debug
      const botoesAba = await novaAba.locator('button:visible, a:visible').all();
      console.log(`   Elementos clicáveis na nova aba: ${botoesAba.length}`);
      for (let i = 0; i < Math.min(botoesAba.length, 10); i++) {
        const texto = await botoesAba[i].innerText().catch(() => '');
        const href = await botoesAba[i].getAttribute('href').catch(() => '');
        if (texto) console.log(`   - "${texto.trim().substring(0, 40)}" ${href ? '→ ' + href : ''}`);
      }
    }
  }
  
  console.log(`✅ ETAPA 10 CONCLUÍDA`);
  console.log('');
  
  // Captura screenshot final para debug
  await page.screenshot({ path: 'estado-final.png', fullPage: true });
  console.log('📸 Screenshot salvo em: estado-final.png');
  
  // Lista todos os botões e links visíveis para debug
  console.log('');
  console.log('🔍 DEBUG - Elementos encontrados na página:');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  const botoes = await page.locator('button:visible').all();
  console.log(`📍 Botões visíveis (${botoes.length}):`);
  for (const btn of botoes) {
    const texto = await btn.innerText().catch(() => '');
    if (texto.trim()) console.log(`   - "${texto.trim().substring(0, 50)}"`);
  }
  
  const links = await page.locator('a:visible').all();
  console.log(`📍 Links visíveis (${links.length}):`);
  for (const link of links) {
    const texto = await link.innerText().catch(() => '');
    if (texto.trim()) console.log(`   - "${texto.trim().substring(0, 50)}"`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 SCRIPT FINALIZADO!');
  console.log(`📍 URL final: ${page.url()}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // Aguarda 30 segundos para você ver a tela antes de fechar
  console.log('⏳ Aguardando 30 segundos para você verificar a tela...');
  await page.waitForTimeout(30000);
});

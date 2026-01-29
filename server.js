const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Status da execução atual
let execucaoAtual = null;

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Health Check
// ═══════════════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servico: 'Inscricao Cruzeiro do Sul - Bot',
    endpoints: {
      'POST /inscricao': 'Inicia nova inscrição',
      'GET /status': 'Verifica status da execução'
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Iniciar Inscrição
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao', async (req, res) => {
  const { nome, cpf, email, telefone, cep, numero, complemento, estado, cidade, curso, polo, tipoVestibular } = req.body;
  
  // Aceita tanto "nascimento" quanto "data de nascimento"
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento (ou "data de nascimento")'
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA REQUISIÇÃO DE INSCRIÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome}`);
  console.log(`   CPF: ${cpf}`);
  console.log(`   Email: ${email}`);
  console.log(`   Telefone: ${telefone}`);
  console.log(`   Nascimento: ${nascimento}`);
  console.log(`   CEP: ${cep || '(padrão)'}`);
  console.log(`   Número: ${numero || '(padrão)'}`);
  console.log(`   Estado: ${estado || '(padrão)'}`);
  console.log(`   Cidade: ${cidade || '(padrão)'}`);
  console.log(`   Curso: ${curso || '(padrão)'}`);
  console.log(`   Polo: ${polo || '(padrão)'}`);
  console.log(`   Vestibular: ${tipoVestibular || '(padrão)'}`);
  console.log('');

  // Define variáveis de ambiente para o Playwright
  const env = {
    ...process.env,
    CLIENTE_NOME: nome,
    CLIENTE_CPF: cpf,
    CLIENTE_EMAIL: email,
    CLIENTE_TELEFONE: telefone,
    CLIENTE_NASCIMENTO: nascimento,
    CLIENTE_CEP: cep || '',
    CLIENTE_NUMERO: numero || '',
    CLIENTE_COMPLEMENTO: complemento || '',
    CLIENTE_ESTADO: estado || '',
    CLIENTE_CIDADE: cidade || '',
    CLIENTE_CURSO: curso || '',
    CLIENTE_POLO: polo || '',
    CLIENTE_TIPO_VESTIBULAR: tipoVestibular || ''
  };

  // Marca início da execução
  execucaoAtual = {
    inicio: new Date(),
    cliente: { nome, cpf, email },
    status: 'executando',
    resultado: null
  };

  // Responde imediatamente (execução assíncrona)
  res.json({
    sucesso: true,
    mensagem: 'Inscrição iniciada! Acompanhe em GET /status',
    cliente: { nome, cpf, email }
  });

  // Executa o Playwright em background
  const comando = 'npx playwright test --config=playwright.config.server.js';
  
  exec(comando, { env, cwd: __dirname, timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📤 RESULTADO DA EXECUÇÃO');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (error) {
      console.log('❌ ERRO:', error.message);
      execucaoAtual.status = 'erro';
      execucaoAtual.resultado = {
        sucesso: false,
        erro: error.message
      };
    } else {
      console.log('✅ SUCESSO');
      
      // Tenta extrair o link da prova do output (formato: 🔗 https://...)
      const linkMatch = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
      const linkProva = linkMatch ? linkMatch[1] : null;
      
      execucaoAtual.status = 'concluido';
      execucaoAtual.resultado = {
        sucesso: true,
        linkProva: linkProva,
        mensagem: linkProva ? 'Inscrição concluída com sucesso!' : 'Inscrição concluída (link não capturado)'
      };
    }
    
    execucaoAtual.fim = new Date();
    execucaoAtual.duracao = (execucaoAtual.fim - execucaoAtual.inicio) / 1000;
    
    console.log(`   Duração: ${execucaoAtual.duracao}s`);
    console.log('');
    
    // Log completo para debug
    if (stdout) console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Status da Execução
// ═══════════════════════════════════════════════════════════════════════════
app.get('/status', (req, res) => {
  if (!execucaoAtual) {
    return res.json({
      status: 'idle',
      mensagem: 'Nenhuma execução em andamento'
    });
  }

  res.json({
    status: execucaoAtual.status,
    cliente: execucaoAtual.cliente,
    inicio: execucaoAtual.inicio,
    fim: execucaoAtual.fim || null,
    duracao: execucaoAtual.duracao || null,
    resultado: execucaoAtual.resultado
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Inscrição Síncrona (aguarda resultado)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao/sync', async (req, res) => {
  // Debug: mostra o body completo recebido
  console.log('');
  console.log('📦 BODY RECEBIDO:', JSON.stringify(req.body, null, 2));
  
  const { nome, cpf, email, telefone, cep, numero, complemento, estado, cidade, curso, polo, tipoVestibular } = req.body;
  
  // Aceita tanto "nascimento" quanto "data de nascimento"
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento (ou "data de nascimento")'
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA REQUISIÇÃO DE INSCRIÇÃO (SÍNCRONA)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome}`);
  console.log(`   CPF: ${cpf}`);
  console.log(`   Email: ${email}`);
  console.log(`   Telefone: ${telefone}`);
  console.log(`   Nascimento: ${nascimento}`);
  console.log(`   CEP: ${cep || '(padrão)'}`);
  console.log(`   Número: ${numero || '(padrão)'}`);
  console.log(`   Estado: ${estado || '(padrão)'}`);
  console.log(`   Cidade: ${cidade || '(padrão)'}`);
  console.log(`   Curso: ${curso || '(padrão)'}`);
  console.log(`   Polo: ${polo || '(padrão)'}`);
  console.log(`   Vestibular: ${tipoVestibular || '(padrão)'}`);
  console.log('');

  // Define variáveis de ambiente para o Playwright
  const env = {
    ...process.env,
    CLIENTE_NOME: nome,
    CLIENTE_CPF: cpf,
    CLIENTE_EMAIL: email,
    CLIENTE_TELEFONE: telefone,
    CLIENTE_NASCIMENTO: nascimento,
    CLIENTE_CEP: cep || '',
    CLIENTE_NUMERO: numero || '',
    CLIENTE_COMPLEMENTO: complemento || '',
    CLIENTE_ESTADO: estado || '',
    CLIENTE_CIDADE: cidade || '',
    CLIENTE_CURSO: curso || '',
    CLIENTE_POLO: polo || '',
    CLIENTE_TIPO_VESTIBULAR: tipoVestibular || ''
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright...');
  console.log('');
  
  // IMPORTANTE: Usa apenas o script inscricao.spec.js (vestibular)
  const processo = spawn('npx', ['playwright', 'test', 'tests/inscricao.spec.js', '--config=playwright.config.server.js'], {
    env,
    cwd: __dirname,
    shell: true
  });

  let stdout = '';
  let stderr = '';

  // Mostra logs em tempo real
  processo.stdout.on('data', (data) => {
    const texto = data.toString();
    stdout += texto;
    process.stdout.write(texto); // Mostra no console em tempo real
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString();
    stderr += texto;
    process.stderr.write(texto); // Mostra erros em tempo real
  });

  processo.on('close', (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Tenta extrair o link da prova do output (formato: 🔗 https://...)
    const linkMatch = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
    const linkProva = linkMatch ? linkMatch[1] : null;
    
    // Tenta extrair o número da inscrição do output (formato: Número de Inscrição extraído do token: XXXX)
    const numeroInscricaoMatch = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    // Verifica se CPF já tinha inscrição
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    
    if (cpfJaInscrito) {
      console.log('⚠️ CPF já possui inscrição');
      return res.json({
        sucesso: false,
        erro: 'CPF já possui inscrição',
        cliente: { nome, cpf, email }
      });
    }
    
    // Verifica se houve erro de CEP
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    
    if (erroCep) {
      console.log('❌ ERRO - CEP não foi encontrado');
      return res.json({
        sucesso: false,
        erro: 'CEP não foi encontrado. Verifique se o CEP está correto.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se houve erro de polo não encontrado (nenhum disponível)
    const erroPolo = stdout.includes('NENHUM POLO DISPONÍVEL') || stdout.includes('POLO NÃO ENCONTRADO');
    
    if (erroPolo) {
      // Tenta extrair o nome do polo solicitado
      const poloMatch = stdout.match(/Polo solicitado:\s*"([^"]+)"/);
      const poloSolicitado = poloMatch ? poloMatch[1] : polo;
      
      console.log('❌ ERRO - Polo não foi encontrado');
      return res.json({
        sucesso: false,
        erro: `Polo "${poloSolicitado}" não foi encontrado e nenhum polo alternativo está disponível para este curso.`,
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se usou polo alternativo (para incluir na resposta de sucesso)
    const poloAlternativoMatch = stdout.match(/POLO ALTERNATIVO UTILIZADO:\s*"([^"]+)"/);
    const poloUtilizado = poloAlternativoMatch ? poloAlternativoMatch[1] : polo;
    
    // Verifica se usou vestibular alternativo (para incluir na resposta de sucesso)
    const vestibularAlternativoMatch = stdout.match(/VESTIBULAR ALTERNATIVO UTILIZADO:\s*"([^"]+)"/);
    const vestibularUtilizado = vestibularAlternativoMatch ? vestibularAlternativoMatch[1] : tipoVestibular;
    
    // Verifica se CPF já possui inscrição em ambos os tipos
    const cpfJaInscritoAmbos = stdout.includes('CPF JÁ POSSUI INSCRIÇÃO EM AMBOS OS TIPOS');
    
    if (cpfJaInscritoAmbos) {
      console.log('❌ ERRO - CPF já possui inscrição em ambos os tipos de vestibular');
      return res.json({
        sucesso: false,
        erro: 'CPF já possui inscrição em ambos os tipos de vestibular (Múltipla Escolha e Redação). Não é possível realizar nova inscrição.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se não conseguiu ir para o checkout
    const erroCheckout = stdout.includes('NÃO CONSEGUIU IR PARA O CHECKOUT') || stdout.includes('Não conseguiu avançar para o checkout');
    
    if (erroCheckout) {
      console.log('❌ ERRO - Não conseguiu ir para o checkout');
      return res.json({
        sucesso: false,
        erro: 'Não conseguiu avançar para o checkout. O botão "Continuar Inscrição" pode não estar funcionando.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Se capturou o link, considera SUCESSO
    if (linkProva) {
      console.log('✅ SUCESSO - Link capturado!');
      if (numeroInscricao) {
        console.log(`📋 Número da Inscrição: ${numeroInscricao}`);
      }
      
      // Monta mensagem com alterações
      let mensagemFinal = 'Inscrição concluída com sucesso!';
      const alteracoes = [];
      
      if (poloUtilizado && poloUtilizado.toLowerCase() !== (polo || '').toLowerCase()) {
        console.log(`📍 Polo utilizado: ${poloUtilizado} (solicitado: ${polo})`);
        alteracoes.push(`Polo: ${poloUtilizado}`);
      }
      
      if (vestibularUtilizado && vestibularUtilizado.toLowerCase() !== (tipoVestibular || '').toLowerCase()) {
        console.log(`📝 Vestibular utilizado: ${vestibularUtilizado} (solicitado: ${tipoVestibular})`);
        alteracoes.push(`Vestibular: ${vestibularUtilizado}`);
      }
      
      if (alteracoes.length > 0) {
        mensagemFinal = `Inscrição concluída com sucesso! (Alterações: ${alteracoes.join(', ')})`;
      }
      
      return res.json({
        sucesso: true,
        linkProva: linkProva,
        numeroInscricao: numeroInscricao,
        poloUtilizado: poloUtilizado || polo,
        vestibularUtilizado: vestibularUtilizado || tipoVestibular,
        poloSolicitado: polo,
        vestibularSolicitado: tipoVestibular,
        mensagem: mensagemFinal,
        cliente: { nome, cpf, email }
      });
    }
    
    // Se NÃO capturou o link, é ERRO (independente do código de saída)
    console.log('❌ ERRO - Link da prova NÃO foi capturado');
    return res.json({
      sucesso: false,
      erro: code !== 0 ? `Processo terminou com código ${code}` : 'Link da prova não foi capturado',
      logs: stdout.slice(-2000) // Últimos 2000 chars para debug
    });
  });

  processo.on('error', (err) => {
    console.log('❌ ERRO ao iniciar processo:', err.message);
    res.json({
      sucesso: false,
      erro: err.message
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Inscrição ENEM Síncrona (aguarda resultado)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao-enem/sync', async (req, res) => {
  // Debug: mostra o body completo recebido
  console.log('');
  console.log('📦 BODY RECEBIDO (ENEM):', JSON.stringify(req.body, null, 2));
  
  const { 
    nome, cpf, email, telefone, 
    cep, numero, complemento, estado, cidade, curso, polo,
    // Notas do ENEM
    enemCienciasHumanas, enemCienciasNatureza, enemLinguagens, 
    enemMatematica, enemRedacao, enemAno
  } = req.body;
  
  // Aceita tanto "nascimento" quanto "data de nascimento"
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento (ou "data de nascimento")'
    });
  }

  // Validação das notas do ENEM
  if (!enemCienciasHumanas || !enemCienciasNatureza || !enemLinguagens || !enemMatematica || !enemRedacao || !enemAno) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos ENEM obrigatórios: enemCienciasHumanas, enemCienciasNatureza, enemLinguagens, enemMatematica, enemRedacao, enemAno'
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA REQUISIÇÃO DE INSCRIÇÃO ENEM (SÍNCRONA)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome}`);
  console.log(`   CPF: ${cpf}`);
  console.log(`   Email: ${email}`);
  console.log(`   Telefone: ${telefone}`);
  console.log(`   Nascimento: ${nascimento}`);
  console.log(`   CEP: ${cep || '(padrão)'}`);
  console.log(`   Número: ${numero || '(padrão)'}`);
  console.log(`   Estado: ${estado || '(padrão)'}`);
  console.log(`   Cidade: ${cidade || '(padrão)'}`);
  console.log(`   Curso: ${curso || '(padrão)'}`);
  console.log(`   Polo: ${polo || '(padrão)'}`);
  console.log('   --- NOTAS ENEM ---');
  console.log(`   Ciências Humanas: ${enemCienciasHumanas}`);
  console.log(`   Ciências Natureza: ${enemCienciasNatureza}`);
  console.log(`   Linguagens: ${enemLinguagens}`);
  console.log(`   Matemática: ${enemMatematica}`);
  console.log(`   Redação: ${enemRedacao}`);
  console.log(`   Ano: ${enemAno}`);
  console.log('');

  // Define variáveis de ambiente para o Playwright
  const env = {
    ...process.env,
    CLIENTE_NOME: nome,
    CLIENTE_CPF: cpf,
    CLIENTE_EMAIL: email,
    CLIENTE_TELEFONE: telefone,
    CLIENTE_NASCIMENTO: nascimento,
    CLIENTE_CEP: cep || '',
    CLIENTE_NUMERO: numero || '',
    CLIENTE_COMPLEMENTO: complemento || '',
    CLIENTE_ESTADO: estado || '',
    CLIENTE_CIDADE: cidade || '',
    CLIENTE_CURSO: curso || '',
    CLIENTE_POLO: polo || '',
    // Variáveis do ENEM
    ENEM_CIENCIAS_HUMANAS: enemCienciasHumanas,
    ENEM_CIENCIAS_NATUREZA: enemCienciasNatureza,
    ENEM_LINGUAGENS: enemLinguagens,
    ENEM_MATEMATICA: enemMatematica,
    ENEM_REDACAO: enemRedacao,
    ENEM_ANO: enemAno
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright (ENEM)...');
  console.log('');
  
  // IMPORTANTE: Usa o script inscricao-enem.spec.js (caminho completo)
  const processo = spawn('npx', ['playwright', 'test', 'tests/inscricao-enem.spec.js', '--config=playwright.config.server.js'], {
    env,
    cwd: __dirname,
    shell: true
  });

  let stdout = '';
  let stderr = '';

  // Mostra logs em tempo real
  processo.stdout.on('data', (data) => {
    const texto = data.toString();
    stdout += texto;
    process.stdout.write(texto); // Mostra no console em tempo real
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString();
    stderr += texto;
    process.stderr.write(texto); // Mostra erros em tempo real
  });

  processo.on('close', (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO ENEM FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Verifica se CPF já tinha inscrição
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    
    if (cpfJaInscrito) {
      console.log('⚠️ CPF já possui inscrição');
      return res.json({
        sucesso: false,
        erro: 'CPF já possui inscrição',
        cliente: { nome, cpf, email }
      });
    }
    
    // Verifica se houve erro de CEP
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    
    if (erroCep) {
      console.log('❌ ERRO - CEP não foi encontrado');
      return res.json({
        sucesso: false,
        erro: 'CEP não foi encontrado. Verifique se o CEP está correto.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se não conseguiu finalizar o checkout
    const erroCheckout = stdout.includes('NÃO CONSEGUIU FINALIZAR O CHECKOUT') || stdout.includes('Checkout não foi concluído');
    
    if (erroCheckout) {
      console.log('❌ ERRO - Checkout não foi concluído');
      return res.json({
        sucesso: false,
        erro: 'Checkout não foi concluído. Pode haver campos obrigatórios faltando.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se a inscrição ENEM foi finalizada com sucesso
    // IMPORTANTE: Verifica a mensagem específica de SUCESSO, não apenas "FINALIZADA"
    const inscricaoFinalizadaComSucesso = stdout.includes('INSCRIÇÃO ENEM FINALIZADA COM SUCESSO');
    const inscricaoNaoFinalizada = stdout.includes('INSCRIÇÃO ENEM NÃO FINALIZADA');
    
    // Tenta extrair o número da inscrição do output
    const numeroInscricaoMatch = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    if (inscricaoFinalizadaComSucesso && !inscricaoNaoFinalizada) {
      console.log('✅ SUCESSO - Inscrição ENEM concluída!');
      if (numeroInscricao) {
        console.log(`📋 Número da Inscrição: ${numeroInscricao}`);
      }
      return res.json({
        sucesso: true,
        numeroInscricao: numeroInscricao,
        mensagem: 'Inscrição ENEM concluída com sucesso! Notas enviadas para análise.',
        cliente: { nome, cpf, email },
        enem: {
          cienciasHumanas: enemCienciasHumanas,
          cienciasNatureza: enemCienciasNatureza,
          linguagens: enemLinguagens,
          matematica: enemMatematica,
          redacao: enemRedacao,
          ano: enemAno
        }
      });
    }
    
    // Se a inscrição não foi finalizada corretamente
    if (inscricaoNaoFinalizada) {
      console.log('❌ ERRO - Inscrição ENEM não foi finalizada');
      return res.json({
        sucesso: false,
        erro: 'Inscrição ENEM não foi finalizada - processo interrompido antes da conclusão',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Se NÃO encontrou mensagem de finalização, é ERRO
    console.log('❌ ERRO - Inscrição ENEM não foi finalizada corretamente');
    return res.json({
      sucesso: false,
      erro: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição ENEM não foi finalizada corretamente',
      logs: stdout.slice(-2000)
    });
  });

  processo.on('error', (err) => {
    console.log('❌ ERRO ao iniciar processo ENEM:', err.message);
    res.json({
      sucesso: false,
      erro: err.message
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Inscrição ENEM SEM NOTA Síncrona (aguarda resultado)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao-enem-sem-nota/sync', async (req, res) => {
  // Debug: mostra o body completo recebido
  console.log('');
  console.log('📦 BODY RECEBIDO (ENEM SEM NOTA):', JSON.stringify(req.body, null, 2));
  
  const { 
    nome, cpf, email, telefone, 
    cep, numero, complemento, estado, cidade, curso, polo
  } = req.body;
  
  // Aceita tanto "nascimento" quanto "data de nascimento"
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento (ou "data de nascimento")'
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA REQUISIÇÃO DE INSCRIÇÃO ENEM SEM NOTA (SÍNCRONA)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome}`);
  console.log(`   CPF: ${cpf}`);
  console.log(`   Email: ${email}`);
  console.log(`   Telefone: ${telefone}`);
  console.log(`   Nascimento: ${nascimento}`);
  console.log(`   CEP: ${cep || '(padrão)'}`);
  console.log(`   Número: ${numero || '(padrão)'}`);
  console.log(`   Estado: ${estado || '(padrão)'}`);
  console.log(`   Cidade: ${cidade || '(padrão)'}`);
  console.log(`   Curso: ${curso || '(padrão)'}`);
  console.log(`   Polo: ${polo || '(padrão)'}`);
  console.log('   ⚠️ NOTAS DO ENEM: Não disponíveis (serão preenchidas depois)');
  console.log('');

  // Define variáveis de ambiente para o Playwright
  const env = {
    ...process.env,
    CLIENTE_NOME: nome,
    CLIENTE_CPF: cpf,
    CLIENTE_EMAIL: email,
    CLIENTE_TELEFONE: telefone,
    CLIENTE_NASCIMENTO: nascimento,
    CLIENTE_CEP: cep || '',
    CLIENTE_NUMERO: numero || '',
    CLIENTE_COMPLEMENTO: complemento || '',
    CLIENTE_ESTADO: estado || '',
    CLIENTE_CIDADE: cidade || '',
    CLIENTE_CURSO: curso || '',
    CLIENTE_POLO: polo || ''
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright (ENEM SEM NOTA)...');
  console.log('');
  
  // IMPORTANTE: Usa o script inscricao-enem-sem-nota.spec.js
  const processo = spawn('npx', ['playwright', 'test', 'tests/inscricao-enem-sem-nota.spec.js', '--config=playwright.config.server.js'], {
    env,
    cwd: __dirname,
    shell: true
  });

  let stdout = '';
  let stderr = '';

  // Mostra logs em tempo real
  processo.stdout.on('data', (data) => {
    const texto = data.toString();
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString();
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO ENEM SEM NOTA FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Verifica se CPF já tinha inscrição
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    
    if (cpfJaInscrito) {
      console.log('⚠️ CPF já possui inscrição');
      return res.json({
        sucesso: false,
        erro: 'CPF já possui inscrição',
        cliente: { nome, cpf, email }
      });
    }
    
    // Verifica se houve erro de CEP
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    
    if (erroCep) {
      console.log('❌ ERRO - CEP não foi encontrado');
      return res.json({
        sucesso: false,
        erro: 'CEP não foi encontrado. Verifique se o CEP está correto.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se não conseguiu finalizar o checkout
    const erroCheckout = stdout.includes('NÃO CONSEGUIU FINALIZAR O CHECKOUT') || stdout.includes('Checkout não foi concluído');
    
    if (erroCheckout) {
      console.log('❌ ERRO - Checkout não foi concluído');
      return res.json({
        sucesso: false,
        erro: 'Checkout não foi concluído. Pode haver campos obrigatórios faltando.',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Verifica se a inscrição foi finalizada com sucesso
    // IMPORTANTE: Verifica a mensagem específica de SUCESSO
    const inscricaoFinalizadaComSucesso = stdout.includes('INSCRIÇÃO ENEM (SEM NOTA) FINALIZADA COM SUCESSO');
    const inscricaoNaoFinalizada = stdout.includes('INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA');
    
    // Tenta extrair o número da inscrição do output
    const numeroInscricaoMatch = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    if (inscricaoFinalizadaComSucesso && !inscricaoNaoFinalizada) {
      console.log('✅ SUCESSO - Inscrição ENEM (sem nota) concluída!');
      if (numeroInscricao) {
        console.log(`📋 Número da Inscrição: ${numeroInscricao}`);
      }
      return res.json({
      sucesso: true,
        numeroInscricao: numeroInscricao,
        mensagem: 'Inscrição ENEM concluída! Notas deverão ser preenchidas posteriormente pelo aluno.',
        notasPendentes: true,
      cliente: { nome, cpf, email }
      });
    }
    
    // Se a inscrição não foi finalizada corretamente
    if (inscricaoNaoFinalizada) {
      console.log('❌ ERRO - Inscrição ENEM (sem nota) não foi finalizada');
      return res.json({
        sucesso: false,
        erro: 'Inscrição ENEM (sem nota) não foi finalizada - processo interrompido antes da conclusão',
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    // Se NÃO encontrou mensagem de finalização, é ERRO
    console.log('❌ ERRO - Inscrição ENEM (sem nota) não foi finalizada corretamente');
    return res.json({
      sucesso: false,
      erro: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição ENEM não foi finalizada corretamente',
      logs: stdout.slice(-2000)
    });
  });

  processo.on('error', (err) => {
    console.log('❌ ERRO ao iniciar processo ENEM SEM NOTA:', err.message);
    res.json({
      sucesso: false,
      erro: err.message
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INICIA SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 SERVIDOR DE INSCRIÇÃO INICIADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log('');
  console.log('   Endpoints disponíveis:');
  console.log('   POST /inscricao                - Inicia inscrição (assíncrono)');
  console.log('   POST /inscricao/sync           - Inicia inscrição vestibular (aguarda resultado)');
  console.log('   POST /inscricao-enem/sync      - Inicia inscrição ENEM com notas');
  console.log('   POST /inscricao-enem-sem-nota/sync - Inicia inscrição ENEM sem notas');
  console.log('   GET  /status                   - Status da execução atual');
  console.log('');
});

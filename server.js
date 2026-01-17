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
  const { nome, cpf, email, telefone, nascimento, cep, numero, complemento, estado, cidade, curso, polo, tipoVestibular } = req.body;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento'
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
  
  const { nome, cpf, email, telefone, nascimento, cep, numero, complemento, estado, cidade, curso, polo, tipoVestibular } = req.body;

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento'
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
  
  const processo = spawn('npx', ['playwright', 'test', '--config=playwright.config.server.js'], {
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
    
    // Se capturou o link, considera SUCESSO mesmo com código de erro
    // (erros de trace/video no Docker não afetam o resultado)
    if (linkProva) {
      console.log('✅ SUCESSO - Link capturado!');
      return res.json({
        sucesso: true,
        linkProva: linkProva,
        mensagem: 'Inscrição concluída com sucesso!',
        cliente: { nome, cpf, email }
      });
    }
    
    // Se não capturou o link e teve erro, retorna erro
    if (code !== 0) {
      console.log('❌ ERRO na execução');
      return res.status(500).json({
        sucesso: false,
        erro: `Processo terminou com código ${code}`,
        logs: stdout.slice(-2000) // Últimos 2000 chars para debug
      });
    }
    
    // Sucesso sem link (raro)
    console.log('✅ SUCESSO - Sem link');
    res.json({
      sucesso: true,
      linkProva: null,
      mensagem: 'Inscrição concluída',
      cliente: { nome, cpf, email }
    });
  });

  processo.on('error', (err) => {
    console.log('❌ ERRO ao iniciar processo:', err.message);
    res.status(500).json({
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
  console.log('   POST /inscricao      - Inicia inscrição (assíncrono)');
  console.log('   POST /inscricao/sync - Inicia inscrição (aguarda resultado)');
  console.log('   GET  /status         - Status da execução atual');
  console.log('');
});

require('dotenv').config();

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./database/db');
const { validarPolo, POLOS_ATENDIDOS } = require('./tests/polos-atendidos');

// Força encoding UTF-8 no processo Node
process.stdout.setEncoding('utf-8');
process.stderr.setEncoding('utf-8');

const app = express();
app.use(express.json());

// Rotas de inscrição que exigem polo válido (whitelist).
const ROTAS_QUE_EXIGEM_POLO = [
  '/inscricao',
  '/inscricao/sync',
  '/inscricao-enem/sync',
  '/inscricao-enem-sem-nota/sync',
  '/inscricao-pos/sync',
  '/inscricao-transferencia/sync'
];

// Middleware: garante que o polo recebido está na whitelist de polos atendidos.
// Rejeita HTTP 400 quando vazio ou fora da lista. Normaliza para o nome canônico.
function validarPoloMiddleware(req, res, next) {
  const poloRaw = req.body ? req.body.polo : undefined;
  const resultado = validarPolo(poloRaw);

  if (!resultado.valido) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`❌ POLO REJEITADO (${resultado.motivo})`);
    console.log(`   Polo recebido: "${poloRaw || ''}"`);
    console.log(`   Polos atendidos: ${resultado.listaAtendidos.join(', ')}`);
    console.log('═══════════════════════════════════════════════════════════════');
    return res.status(400).json({
      sucesso: false,
      erro: resultado.motivo,
      mensagem: resultado.mensagem,
      poloRecebido: poloRaw || '',
      polosAtendidos: resultado.listaAtendidos
    });
  }

  if (poloRaw !== resultado.canonico) {
    console.log(`ℹ️ POLO NORMALIZADO: "${poloRaw}" → "${resultado.canonico}"`);
  }
  req.body.polo = resultado.canonico;
  next();
}

ROTAS_QUE_EXIGEM_POLO.forEach((rota) => app.use(rota, validarPoloMiddleware));

// Helper: configura spawn com encoding UTF-8
function configuraSpawnUTF8(processo) {
  processo.stdout.setEncoding('utf-8');
  processo.stderr.setEncoding('utf-8');
  return processo;
}

// Helper: garante LANG UTF-8 no env do spawn
function envComUTF8(env) {
  return { ...env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PYTHONIOENCODING: 'utf-8' };
}

const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Executa Playwright com retry automático
// ═══════════════════════════════════════════════════════════════════════════
function executarPlaywrightComRetry(comando, env, maxTentativas = 2) {
  return new Promise((resolve) => {
    let tentativaAtual = 0;
    
    function executar() {
      tentativaAtual++;
      const tentativa = tentativaAtual;
      
      console.log(`\n🚀 Executando Playwright (tentativa ${tentativa}/${maxTentativas})...`);
      
      const processo = spawn(comando, {
        env: envComUTF8(env),
        cwd: __dirname,
        shell: true
      });
      configuraSpawnUTF8(processo);
      
      let stdout = '';
      let stderr = '';
      
      processo.stdout.on('data', (data) => {
        const texto = data.toString('utf-8');
        stdout += texto;
        process.stdout.write(texto);
      });
      
      processo.stderr.on('data', (data) => {
        const texto = data.toString('utf-8');
        stderr += texto;
        process.stderr.write(texto);
      });
      
      processo.on('close', (code) => {
        // Verifica se teve sucesso real (independente do código de saída)
        const temLinkProva = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
        const temSucessoTransferencia = stdout.includes('INSCRICAO_TRANSFERENCIA_SUCESSO');
        const temNumeroInscricao = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
        const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição') || stdout.includes('CPF ja possui');
        const erroCheckout = stdout.includes('NÃO CONSEGUIU IR PARA O CHECKOUT') || stdout.includes('NAO CONSEGUIU IR PARA O CHECKOUT');
        const erroNaoFinalizada = stdout.includes('INSCRIÇÃO NÃO FINALIZADA') || stdout.includes('INSCRICAO NAO FINALIZADA');
        const linkNaoCapturado = stdout.includes('FINALIZADO SEM LINK DA PROVA');
        
        const sucesso = temLinkProva || temSucessoTransferencia || temNumeroInscricao;
        const erroRecuperavel = (erroCheckout || erroNaoFinalizada || linkNaoCapturado) && !cpfJaInscrito;
        
        console.log(`\n📊 Resultado tentativa ${tentativa}: código=${code}, sucesso=${sucesso}, cpfJaInscrito=${cpfJaInscrito}, erroRecuperavel=${erroRecuperavel}`);
        
        // Se deu sucesso ou CPF já inscrito, retorna imediatamente
        if (sucesso || cpfJaInscrito) {
          resolve({ code, stdout, stderr, tentativa });
          return;
        }
        
        // Se erro recuperável e ainda tem tentativas, tenta de novo
        if (erroRecuperavel && tentativa < maxTentativas) {
          console.log(`\n🔄 ════════════════════════════════════════════════════════════`);
          console.log(`🔄 RETRY AUTOMÁTICO: Tentativa ${tentativa} falhou, tentando novamente...`);
          console.log(`🔄 ════════════════════════════════════════════════════════════\n`);
          executar();
          return;
        }
        
        // Sem mais tentativas, retorna o que tem
        resolve({ code, stdout, stderr, tentativa });
      });
      
      processo.on('error', (err) => {
        console.log(`❌ Erro ao iniciar processo: ${err.message}`);
        if (tentativa < maxTentativas) {
          console.log(`🔄 Tentando novamente...`);
          executar();
        } else {
          resolve({ code: 1, stdout, stderr: err.message, tentativa });
        }
      });
    }
    
    executar();
  });
}
const BASE_URL = process.env.BASE_URL || `https://playwright-playwright.6tqx2r.easypanel.host`;

// Pasta padrão para arquivos gerados (acessível por todas as instâncias)
const ARQUIVOS_DIR = process.env.ARQUIVOS_DIR || path.join(__dirname, 'arquivos');
if (!fs.existsSync(ARQUIVOS_DIR)) {
  fs.mkdirSync(ARQUIVOS_DIR, { recursive: true });
  console.log(`📁 Pasta de arquivos criada: ${ARQUIVOS_DIR}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Servir arquivos gerados (screenshots, boletos)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Segurança: só permite arquivos com extensões conhecidas, sem path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ erro: 'Nome de arquivo inválido' });
  }
  
  const allowedExtensions = ['.png', '.pdf', '.jpg', '.jpeg'];
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(400).json({ erro: 'Extensão não permitida' });
  }
  
  // Procura na pasta padrão de arquivos, com fallback para a raiz do projeto
  let filePath = path.join(ARQUIVOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, filename);
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ erro: 'Arquivo não encontrado' });
  }
  
  const contentTypes = {
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.sendFile(filePath);
});


// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Upload seguro de arquivos para Kommo via Playwright
// Valida CPF nos nomes dos arquivos para garantir correspondência com o lead
// ═══════════════════════════════════════════════════════════════════════════
app.post('/kommo/upload-lead', async (req, res) => {
  const { leadId, cpf, screenshotPath, boletoPath } = req.body;

  // Validação obrigatória
  if (!leadId || !cpf) {
    return res.status(400).json({ sucesso: false, erro: 'leadId e cpf são obrigatórios' });
  }
  if (!screenshotPath && !boletoPath) {
    return res.status(400).json({ sucesso: false, erro: 'Pelo menos um arquivo (screenshotPath ou boletoPath) é necessário' });
  }

  // Sanitiza CPF (só números)
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length < 11) {
    return res.status(400).json({ sucesso: false, erro: 'CPF inválido' });
  }

  // Sanitiza leadId (só números)
  const leadIdLimpo = String(leadId).replace(/\D/g, '');
  if (!leadIdLimpo) {
    return res.status(400).json({ sucesso: false, erro: 'leadId inválido' });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SEGURANÇA: Valida que os arquivos pertencem ao CPF informado
  // ═══════════════════════════════════════════════════════════════════════
  const arquivosParaUpload = {};

  if (screenshotPath) {
    // Previne path traversal
    const nomeArquivo = path.basename(screenshotPath);
    if (nomeArquivo.includes('..') || nomeArquivo.includes('/') || nomeArquivo.includes('\\')) {
      return res.status(400).json({ sucesso: false, erro: 'screenshotPath contém caracteres inválidos' });
    }
    // Valida que o CPF está no nome do arquivo
    if (!nomeArquivo.includes(cpfLimpo)) {
      return res.status(400).json({ sucesso: false, erro: `Screenshot "${nomeArquivo}" não corresponde ao CPF ${cpfLimpo}` });
    }
    const caminhoCompleto = path.join(__dirname, nomeArquivo);
    if (!fs.existsSync(caminhoCompleto)) {
      return res.status(404).json({ sucesso: false, erro: `Screenshot não encontrado: ${nomeArquivo}` });
    }
    arquivosParaUpload.screenshot = caminhoCompleto;
  }

  if (boletoPath) {
    const nomeArquivo = path.basename(boletoPath);
    if (nomeArquivo.includes('..') || nomeArquivo.includes('/') || nomeArquivo.includes('\\')) {
      return res.status(400).json({ sucesso: false, erro: 'boletoPath contém caracteres inválidos' });
    }
    if (!nomeArquivo.includes(cpfLimpo)) {
      return res.status(400).json({ sucesso: false, erro: `Boleto "${nomeArquivo}" não corresponde ao CPF ${cpfLimpo}` });
    }
    const caminhoCompleto = path.join(__dirname, nomeArquivo);
    if (!fs.existsSync(caminhoCompleto)) {
      return res.status(404).json({ sucesso: false, erro: `Boleto não encontrado: ${nomeArquivo}` });
    }
    arquivosParaUpload.boleto = caminhoCompleto;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📤 UPLOAD KOMMO - Iniciando');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Lead ID: ${leadIdLimpo}`);
  console.log(`   CPF: ${cpfLimpo}`);
  console.log(`   Screenshot: ${arquivosParaUpload.screenshot || '(nenhum)'}`);
  console.log(`   Boleto: ${arquivosParaUpload.boleto || '(nenhum)'}`);
  console.log('');

  // Executa o Playwright para fazer upload no Kommo
  const envUpload = {
    ...process.env,
    LEAD_ID: leadIdLimpo,
    SCREENSHOT_PATH: arquivosParaUpload.screenshot || '',
    BOLETO_PATH: arquivosParaUpload.boleto || ''
  };

  const processo = spawn('npx playwright test tests/kommo-upload.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(envUpload),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    stderr += data.toString('utf-8');
  });

  processo.on('close', (code) => {
    const sucesso = code === 0 && stdout.includes('UPLOAD CONCLUÍDO COM SUCESSO');
    
    console.log('');
    console.log(`📤 UPLOAD KOMMO - ${sucesso ? '✅ SUCESSO' : '❌ FALHA'} (código: ${code})`);
    console.log('');

    res.json({
      sucesso,
      leadId: leadIdLimpo,
      cpf: cpfLimpo,
      arquivos: {
        screenshot: arquivosParaUpload.screenshot ? path.basename(arquivosParaUpload.screenshot) : null,
        boleto: arquivosParaUpload.boleto ? path.basename(arquivosParaUpload.boleto) : null
      },
      mensagem: sucesso ? 'Arquivos anexados ao lead com sucesso' : 'Falha ao anexar arquivos',
      logs: stdout.slice(-1000)
    });
  });

  processo.on('error', (err) => {
    res.status(500).json({ sucesso: false, erro: err.message });
  });
});

// Status da execução atual
let execucaoAtual = null;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Determinar tipo de inscrição
// ═══════════════════════════════════════════════════════════════════════════
function determinarTipoInscricao(tipoVestibular) {
  if (!tipoVestibular) return 'multipla';
  const tipo = tipoVestibular.toLowerCase();
  if (tipo.includes('redac') || tipo.includes('redação')) return 'redacao';
  if (tipo.includes('mult') || tipo.includes('múltipla')) return 'multipla';
  return 'multipla';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Calcular duração formatada
// ═══════════════════════════════════════════════════════════════════════════
function calcularDuracaoFormatada(inicioMs) {
  const segundos = Math.round((Date.now() - inicioMs) / 1000);
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return min > 0 ? `${min}m ${seg}s` : `${seg}s`;
}

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

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG NO BANCO DE DADOS
  // ═══════════════════════════════════════════════════════════════════════════
  const tipoInscricao = determinarTipoInscricao(tipoVestibular);
  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: tipoInscricao,
    nome, cpf, email, telefone, nascimento,
    curso: curso || '',
    polo: polo || '',
    ip_origem: req.ip,
    user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;

  // Marca início da execução
  execucaoAtual = {
    inicio: new Date(),
    cliente: { nome, cpf, email },
    status: 'executando',
    resultado: null,
    logId: logId
  };

  // Responde imediatamente (execução assíncrona)
  res.json({
    sucesso: true,
    mensagem: 'Inscrição iniciada! Acompanhe em GET /status',
    logId: logId,
    cliente: { nome, cpf, email }
  });

  // Passa LOG_ID para o Playwright
  env.LOG_ID = logId ? logId.toString() : '';

  // Executa o Playwright em background
  const processo = spawn('npx playwright test --config=playwright.config.server.js', {
    env: envComUTF8(env),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
    if (logId) db.appendOutput(logId, texto).catch(() => {});
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString('utf-8');
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📤 RESULTADO DA EXECUÇÃO');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const linkMatch = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
    const linkProva = linkMatch ? linkMatch[1] : null;
    let numeroInscricaoMatch = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    if (!numeroInscricaoMatch) {
      numeroInscricaoMatch = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    }
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    if (code !== 0 || !linkProva) {
      console.log('❌ ERRO:', code !== 0 ? `Código ${code}` : 'Link não capturado');
      execucaoAtual.status = 'erro';
      execucaoAtual.resultado = { sucesso: false, erro: 'Execução falhou' };
      if (logId) await db.finalizarLogErro(logId, {
        erro_mensagem: code !== 0 ? `Processo terminou com código ${code}` : 'Link da prova não capturado',
        etapa_erro: 'execucao_geral',
        output_final: stdout.slice(-3000)
      });
    } else {
      console.log('✅ SUCESSO');
      execucaoAtual.status = 'concluido';
      execucaoAtual.resultado = { sucesso: true, linkProva, mensagem: 'Inscrição concluída!' };
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        numero_inscricao: numeroInscricao,
        output_final: `Link: ${linkProva}`
      });
    }
    
    execucaoAtual.fim = new Date();
    execucaoAtual.duracao = (execucaoAtual.fim - execucaoAtual.inicio) / 1000;
    console.log(`   Duração: ${execucaoAtual.duracao}s`);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG NO BANCO DE DADOS
  // ═══════════════════════════════════════════════════════════════════════════
  const tipoInscricao = determinarTipoInscricao(tipoVestibular);
  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: tipoInscricao,
    nome, cpf, email, telefone, nascimento,
    curso: curso || '',
    polo: polo || '',
    ip_origem: req.ip,
    user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;
  if (logId) await db.atualizarStatusEmAndamento(logId, 'Vestibular sync - iniciando Playwright');

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
    CLIENTE_TIPO_VESTIBULAR: tipoVestibular || '',
    LOG_ID: logId ? logId.toString() : ''
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright...');
  console.log('');
  
  // IMPORTANTE: Usa apenas o script inscricao.spec.js (vestibular)
  const processo = spawn('npx playwright test tests/inscricao.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(env),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  // Mostra logs em tempo real
  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString('utf-8');
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Tenta extrair o link da prova do output
    const linkMatch = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
    const linkProva = linkMatch ? linkMatch[1] : null;
    
    let numeroInscricaoMatch = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    if (!numeroInscricaoMatch) {
      numeroInscricaoMatch = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    }
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    // Verifica se houve alerta/popup de inconsistências no cadastro
    const alertaInscricaoMatch = stdout.match(/ALERTA_INSCRICAO:\s*(.+)/);
    if (alertaInscricaoMatch) {
      const mensagemAlerta = alertaInscricaoMatch[1].trim();
      console.log(`⚠️ ALERTA DE INSCRIÇÃO DETECTADO: ${mensagemAlerta}`);
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: mensagemAlerta, etapa_erro: 'alerta_cadastro', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: mensagemAlerta, tipo_erro: 'alerta_cadastro', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    // Verifica se CPF já tinha inscrição
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    
    if (cpfJaInscrito) {
      console.log('⚠️ CPF já possui inscrição');
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição', etapa_erro: 'validacao_cpf', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CPF já possui inscrição', logId, cliente: { nome, cpf, email } });
    }
    
    // Verifica se houve erro de CEP
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    
    if (erroCep) {
      console.log('❌ ERRO - CEP não foi encontrado');
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CEP não encontrado', etapa_erro: 'validacao_cep', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CEP não foi encontrado.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    // Verifica se houve erro de polo não encontrado
    const erroPolo = stdout.includes('NENHUM POLO DISPONÍVEL') || stdout.includes('POLO NÃO ENCONTRADO');
    
    if (erroPolo) {
      const poloMatch = stdout.match(/Polo solicitado:\s*"([^"]+)"/);
      const poloSolicitado = poloMatch ? poloMatch[1] : polo;
      console.log('❌ ERRO - Polo não foi encontrado');
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: `Polo "${poloSolicitado}" não encontrado`, etapa_erro: 'selecao_polo', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: `Polo "${poloSolicitado}" não encontrado.`, logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const poloAlternativoMatch = stdout.match(/POLO ALTERNATIVO UTILIZADO:\s*"([^"]+)"/);
    const poloUtilizado = poloAlternativoMatch ? poloAlternativoMatch[1] : polo;
    
    const vestibularAlternativoMatch = stdout.match(/VESTIBULAR ALTERNATIVO UTILIZADO:\s*"([^"]+)"/);
    const vestibularUtilizado = vestibularAlternativoMatch ? vestibularAlternativoMatch[1] : tipoVestibular;
    
    const cpfJaInscritoAmbos = stdout.includes('CPF JÁ POSSUI INSCRIÇÃO EM AMBOS OS TIPOS');
    
    if (cpfJaInscritoAmbos) {
      console.log('❌ ERRO - CPF já possui inscrição em ambos os tipos');
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição em ambos os tipos', etapa_erro: 'validacao_cpf_dupla', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CPF já possui inscrição em ambos os tipos de vestibular.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const erroCheckout = stdout.includes('NÃO CONSEGUIU IR PARA O CHECKOUT') || stdout.includes('Não conseguiu avançar para o checkout');
    
    if (erroCheckout) {
      console.log('❌ ERRO - Não conseguiu ir para o checkout');
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'Não conseguiu ir para o checkout', etapa_erro: 'checkout', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'Não conseguiu avançar para o checkout.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    // Se capturou o link, considera SUCESSO
    if (linkProva) {
      console.log('✅ SUCESSO - Link capturado!');
      if (numeroInscricao) console.log(`📋 Número da Inscrição: ${numeroInscricao}`);
      
      let mensagemFinal = 'Inscrição concluída com sucesso!';
      const alteracoes = [];
      if (poloUtilizado && poloUtilizado.toLowerCase() !== (polo || '').toLowerCase()) alteracoes.push(`Polo: ${poloUtilizado}`);
      if (vestibularUtilizado && vestibularUtilizado.toLowerCase() !== (tipoVestibular || '').toLowerCase()) alteracoes.push(`Vestibular: ${vestibularUtilizado}`);
      if (alteracoes.length > 0) mensagemFinal = `Inscrição concluída com sucesso! (Alterações: ${alteracoes.join(', ')})`;
      
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        numero_inscricao: numeroInscricao,
        output_final: `Link: ${linkProva} | Polo: ${poloUtilizado} | Vestibular: ${vestibularUtilizado}`
      });
      
      return res.json({ sucesso: true, linkProva, numeroInscricao, poloUtilizado: poloUtilizado || polo, vestibularUtilizado: vestibularUtilizado || tipoVestibular, poloSolicitado: polo, vestibularSolicitado: tipoVestibular, mensagem: mensagemFinal, logId, cliente: { nome, cpf, email } });
    }
    
    // ERRO
    console.log('❌ ERRO - Link da prova NÃO foi capturado');
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: code !== 0 ? `Processo terminou com código ${code}` : 'Link não capturado', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
    return res.json({ sucesso: false, erro: code !== 0 ? `Processo terminou com código ${code}` : 'Link da prova não foi capturado', logId, logs: stdout.slice(-2000) });
  });

  processo.on('error', async (err) => {
    console.log('❌ ERRO ao iniciar processo:', err.message);
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: err.message, etapa_erro: 'spawn_processo', output_final: '' });
    res.json({ sucesso: false, erro: err.message, logId });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG NO BANCO DE DADOS
  // ═══════════════════════════════════════════════════════════════════════════
  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: 'enem_com_nota',
    nome, cpf, email, telefone, nascimento,
    curso: curso || '',
    polo: polo || '',
    ip_origem: req.ip,
    user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;
  if (logId) await db.atualizarStatusEmAndamento(logId, 'ENEM com nota - iniciando Playwright');

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
    ENEM_ANO: enemAno,
    LOG_ID: logId ? logId.toString() : ''
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright (ENEM)...');
  console.log('');
  
  const processo = spawn('npx playwright test tests/inscricao-enem.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(env),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString('utf-8');
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO ENEM FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    if (cpfJaInscrito) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição', etapa_erro: 'validacao_cpf', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CPF já possui inscrição', logId, cliente: { nome, cpf, email } });
    }
    
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    if (erroCep) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CEP não encontrado', etapa_erro: 'validacao_cep', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CEP não encontrado.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const erroCheckout = stdout.includes('NÃO CONSEGUIU FINALIZAR O CHECKOUT') || stdout.includes('Checkout não foi concluído');
    if (erroCheckout) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'Checkout não concluído', etapa_erro: 'checkout', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'Checkout não foi concluído.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const inscricaoFinalizadaComSucesso = stdout.includes('INSCRIÇÃO ENEM FINALIZADA COM SUCESSO');
    const inscricaoNaoFinalizada = stdout.includes('INSCRIÇÃO ENEM NÃO FINALIZADA');
    
    let numeroInscricaoMatchEnem = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    if (!numeroInscricaoMatchEnem) numeroInscricaoMatchEnem = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatchEnem ? numeroInscricaoMatchEnem[1] : null;
    
    if (inscricaoFinalizadaComSucesso && !inscricaoNaoFinalizada) {
      console.log('✅ SUCESSO - Inscrição ENEM concluída!');
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        numero_inscricao: numeroInscricao,
        output_final: 'Inscrição ENEM com nota finalizada com sucesso'
      });
      return res.json({ sucesso: true, numeroInscricao, mensagem: 'Inscrição ENEM concluída com sucesso! Notas enviadas para análise.', logId, cliente: { nome, cpf, email }, enem: { cienciasHumanas: enemCienciasHumanas, cienciasNatureza: enemCienciasNatureza, linguagens: enemLinguagens, matematica: enemMatematica, redacao: enemRedacao, ano: enemAno } });
    }
    
    if (inscricaoNaoFinalizada) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'Inscrição ENEM não finalizada', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'Inscrição ENEM não finalizada.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: code !== 0 ? `Código ${code}` : 'Não finalizada', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
    return res.json({ sucesso: false, erro: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição ENEM não finalizada.', logId, logs: stdout.slice(-2000) });
  });

  processo.on('error', async (err) => {
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: err.message, etapa_erro: 'spawn_processo', output_final: '' });
    res.json({ sucesso: false, erro: err.message, logId });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG NO BANCO DE DADOS
  // ═══════════════════════════════════════════════════════════════════════════
  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: 'enem_sem_nota',
    nome, cpf, email, telefone, nascimento,
    curso: curso || '',
    polo: polo || '',
    ip_origem: req.ip,
    user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;
  if (logId) await db.atualizarStatusEmAndamento(logId, 'ENEM sem nota - iniciando Playwright');

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
    LOG_ID: logId ? logId.toString() : ''
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright (ENEM SEM NOTA)...');
  console.log('');
  
  const processo = spawn('npx playwright test tests/inscricao-enem-sem-nota.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(env),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString('utf-8');
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO ENEM SEM NOTA FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição');
    if (cpfJaInscrito) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição', etapa_erro: 'validacao_cpf', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CPF já possui inscrição', logId, cliente: { nome, cpf, email } });
    }
    
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    if (erroCep) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CEP não encontrado', etapa_erro: 'validacao_cep', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'CEP não encontrado.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const erroCheckout = stdout.includes('NÃO CONSEGUIU FINALIZAR O CHECKOUT') || stdout.includes('Checkout não foi concluído');
    if (erroCheckout) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'Checkout não concluído', etapa_erro: 'checkout', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'Checkout não concluído.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    const inscricaoFinalizadaComSucesso = stdout.includes('INSCRIÇÃO ENEM (SEM NOTA) FINALIZADA COM SUCESSO');
    const inscricaoNaoFinalizada = stdout.includes('INSCRIÇÃO ENEM (SEM NOTA) NÃO FINALIZADA');
    
    let numeroInscricaoMatchSemNota = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    if (!numeroInscricaoMatchSemNota) numeroInscricaoMatchSemNota = stdout.match(/Número de Inscrição extraído do token:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatchSemNota ? numeroInscricaoMatchSemNota[1] : null;
    
    if (inscricaoFinalizadaComSucesso && !inscricaoNaoFinalizada) {
      console.log('✅ SUCESSO - Inscrição ENEM (sem nota) concluída!');
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        numero_inscricao: numeroInscricao,
        output_final: 'Inscrição ENEM sem nota finalizada com sucesso'
      });
      return res.json({ sucesso: true, numeroInscricao, mensagem: 'Inscrição ENEM concluída! Notas deverão ser preenchidas posteriormente pelo aluno.', notasPendentes: true, logId, cliente: { nome, cpf, email } });
    }
    
    if (inscricaoNaoFinalizada) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'Inscrição ENEM sem nota não finalizada', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
      return res.json({ sucesso: false, erro: 'Inscrição ENEM (sem nota) não finalizada.', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: code !== 0 ? `Código ${code}` : 'Não finalizada', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
    return res.json({ sucesso: false, erro: code !== 0 ? `Processo terminou com código ${code}` : 'Não finalizada.', logId, logs: stdout.slice(-2000) });
  });

  processo.on('error', async (err) => {
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: err.message, etapa_erro: 'spawn_processo', output_final: '' });
    res.json({ sucesso: false, erro: err.message, logId });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Inscrição PÓS-GRADUAÇÃO Síncrona (aguarda resultado)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao-pos/sync', async (req, res) => {
  // Debug: mostra o body completo recebido
  console.log('');
  console.log('📦 BODY RECEBIDO (PÓS-GRADUAÇÃO):', JSON.stringify(req.body, null, 2));
  
  const { 
    nome, cpf, email, telefone, 
    cep, complemento, estado, cidade, 
    curso, polo, campanha,
    leadId, webhookUrl
  } = req.body;
  
  // Aceita "numero", "numero_residencia" ou gera aleatório de 1 a 200
  const numero = req.body.numero || req.body.numero_residencia || String(Math.floor(Math.random() * 200) + 1);

  // Aceita tanto "nascimento" quanto "data de nascimento"
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;
  
  // Limpa R$ e espaços de valores monetários
  const matricula = (req.body.matricula || '').toString().replace(/[R$\s]/g, '').replace(',', '.').trim();
  const mensalidade = (req.body.mensalidade || '').toString().replace(/[R$\s]/g, '').replace(',', '.').trim();
  
  // Extrai duração como número puro (sem "meses")
  // n8n pode enviar "9", "9 meses", "9 Meses" etc → sempre extrair só o número
  let duracaoRaw = (req.body.duracao || '').toString().trim();
  let duracao = '';
  
  // Se veio duração do n8n, extrai só o número
  if (duracaoRaw) {
    const numMatch = duracaoRaw.match(/(\d+)/);
    duracao = numMatch ? numMatch[1] : duracaoRaw;
  }
  
  // Se não veio duração, tenta extrair do nome do curso
  if (!duracao && curso) {
    const duracaoMatch = curso.match(/(\d+)\s*meses?/i);
    if (duracaoMatch) {
      duracao = duracaoMatch[1];
      console.log(`   📏 Duração extraída do nome do curso: ${duracao} meses`);
    }
  }

  // Validação básica
  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(200).json({
      sucesso: false,
      erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento'
    });
  }

  // Validação de campos obrigatórios de pós-graduação
  if (!curso) {
    return res.status(200).json({
      sucesso: false,
      erro: 'Campo obrigatório para pós-graduação: curso'
    });
  }

  // Validação de polo já garantida pelo validarPoloMiddleware (whitelist).

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA REQUISIÇÃO DE INSCRIÇÃO PÓS-GRADUAÇÃO (SÍNCRONA)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome}`);
  console.log(`   CPF: ${cpf}`);
  console.log(`   Email: ${email}`);
  console.log(`   Telefone: ${telefone}`);
  console.log(`   Nascimento: ${nascimento}`);
  console.log(`   CEP: ${cep || '-'}`);
  console.log(`   Número: ${numero || '-'}`);
  console.log(`   Estado: ${estado || '-'}`);
  console.log(`   Cidade: ${cidade || '-'}`);
  console.log('   --- DADOS PÓS-GRADUAÇÃO ---');
  console.log(`   Curso: ${curso}`);
  console.log(`   Duração: ${duracao || '-'} meses`);
  console.log(`   Polo: ${polo || '-'}`);
  console.log(`   Campanha: ${campanha || '-'}`);
  console.log(`   Matrícula: ${matricula || '-'}`);
  console.log(`   Mensalidade: ${mensalidade || '-'}`);
  console.log('   --- INTEGRAÇÃO N8N ---');
  console.log(`   Lead ID: ${leadId || '-'}`);
  console.log(`   Webhook URL: ${webhookUrl || '-'}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG NO BANCO DE DADOS
  // ═══════════════════════════════════════════════════════════════════════════
  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: 'pos',
    nome, cpf, email, telefone, nascimento,
    curso: curso || '',
    duracao: duracao || '',
    polo: polo || '',
    ip_origem: req.ip,
    user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;
  if (logId) await db.atualizarStatusEmAndamento(logId, 'Pós-Graduação - iniciando Playwright');

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
    // Variáveis específicas de pós-graduação
    CLIENTE_CURSO: curso,
    CLIENTE_DURACAO: duracao || '',
    CLIENTE_POLO: polo || '',
    CLIENTE_CAMPANHA: campanha || '',
    // Limpa R$, espaços e vírgulas dos valores monetários
    CLIENTE_MATRICULA: (matricula || '').toString().replace(/[R$\s]/g, '').replace(',', '.').trim(),
    CLIENTE_MENSALIDADE: (mensalidade || '').toString().replace(/[R$\s]/g, '').replace(',', '.').trim(),
    // Variáveis de integração n8n
    LEAD_ID: leadId || '',
    N8N_WEBHOOK_URL: webhookUrl || '',
    LOG_ID: logId ? logId.toString() : '',
    // Pós: por padrão só finaliza no VTEX (sem SIAA/boleto). Defina POS_SKIP_PAGAMENTO_SIAA=0 para fluxo completo.
    POS_SKIP_PAGAMENTO_SIAA: process.env.POS_SKIP_PAGAMENTO_SIAA !== undefined && process.env.POS_SKIP_PAGAMENTO_SIAA !== ''
      ? process.env.POS_SKIP_PAGAMENTO_SIAA
      : '1'
  };

  // Executa o Playwright com spawn para logs em tempo real
  console.log('🚀 Iniciando Playwright (PÓS-GRADUAÇÃO)...');
  console.log('');
  
  const processo = spawn('npx playwright test tests/inscricao-pos.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(env),
    cwd: __dirname,
    shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => {
    const texto = data.toString('utf-8');
    stdout += texto;
    process.stdout.write(texto);
  });

  processo.stderr.on('data', (data) => {
    const texto = data.toString('utf-8');
    stderr += texto;
    process.stderr.write(texto);
  });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO PÓS-GRADUAÇÃO FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Extrai linkCartaoCredito e dados cedo para incluir em TODAS as respostas
    const linkCartaoMatch = stdout.match(/LINK_CARTAO_CREDITO:\s*(\S+)/);
    const linkCartaoCredito = linkCartaoMatch ? linkCartaoMatch[1] : null;
    
    // Verifica se houve alerta/popup de inconsistências no cadastro
    const alertaInscricaoMatch = stdout.match(/ALERTA_INSCRICAO:\s*(.+)/);
    if (alertaInscricaoMatch) {
      const mensagemAlerta = alertaInscricaoMatch[1].trim();
      console.log(`⚠️ ALERTA DE INSCRIÇÃO DETECTADO: ${mensagemAlerta}`);
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: mensagemAlerta, etapa_erro: 'alerta_cadastro', output_final: stdout.slice(-3000) });
      return res.status(200).json({ 
        sucesso: false, 
        erro: mensagemAlerta,
        tipo_erro: 'alerta_cadastro',
        linkCartaoCredito, 
        logId, 
        cliente: { nome, cpf, email },
        logs: stdout.slice(-2000)
      });
    }
    
    const cpfJaInscrito = stdout.includes('CPF já possui uma inscrição') || stdout.includes('cpf já cadastrado');
    if (cpfJaInscrito) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição', etapa_erro: 'validacao_cpf', output_final: stdout.slice(-3000) });
      return res.status(200).json({ sucesso: false, erro: 'CPF já possui inscrição', linkCartaoCredito, logId, cliente: { nome, cpf, email } });
    }
    
    const erroCep = stdout.includes('CEP NÃO FOI ENCONTRADO') || stdout.includes('CEP não encontrado');
    if (erroCep) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CEP não encontrado', etapa_erro: 'validacao_cep', output_final: stdout.slice(-3000) });
      return res.status(200).json({ sucesso: false, erro: 'CEP não encontrado.', linkCartaoCredito, logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
    }
    
    // Extrai informações do output (antes das verificações de sucesso/erro)
    let numeroInscricaoMatch = stdout.match(/Número de Inscrição:\s*(\d+)/);
    if (!numeroInscricaoMatch) numeroInscricaoMatch = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;
    
    // ══════════════════════════════════════════════════════════════
    // SIAA NÃO VINCULADA: inscrição feita no VTEX mas sem vínculo SIAA
    // Retorna sucesso: false com mensagem clara
    // ══════════════════════════════════════════════════════════════
    const siaaNaoVinculada = stdout.includes('INSCRICAO_SIAA_NAO_VINCULADA');
    if (siaaNaoVinculada) {
      console.log('⚠️ Inscrição realizada mas NÃO vinculada ao SIAA');
      if (logId) await db.finalizarLogErro(logId, { 
        erro_mensagem: 'Inscrição realizada mas não vinculada ao SIAA', 
        etapa_erro: 'siaa_nao_vinculada', 
        output_final: stdout.slice(-3000) 
      });
      return res.status(200).json({ 
        sucesso: false, 
        erro: 'Inscrição realizada com sucesso, porém não foi vinculada ao SIAA. Resultados não disponíveis no momento.',
        tipo_erro: 'siaa_nao_vinculada',
        numeroPedidoVtex: numeroInscricao,
        linkCartaoCredito,
        logId, 
        cliente: { nome, cpf, email },
        curso: { nome: curso, duracao, matricula, mensalidade }
      });
    }
    
    // Verifica se o processo foi concluído com sucesso
    // Aceita múltiplas strings de sucesso (o fluxo pode terminar em diferentes pontos)
    const processoCompleto = stdout.includes('PROCESSO COMPLETO DE INSCRIÇÃO PÓS-GRADUAÇÃO') ||
                             stdout.includes('STATUS_INSCRICAO: INSCRICAO_POS_SUCESSO_APENAS_VTEX') ||
                             (stdout.includes('INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADA COM SUCESSO') && code === 0);
    
    // Número de inscrição do SIAA (diferente do pedido VTEX)
    const numeroSiaaMatch = stdout.match(/NUMERO_INSCRICAO_SIAA:\s*(\d+)/);
    const numeroInscricaoSiaa = numeroSiaaMatch ? numeroSiaaMatch[1] : null;
    
    const linhaDigitavelMatch = stdout.match(/Linha digitável:\s*([\d.\s]+)/);
    const linhaDigitavel = linhaDigitavelMatch ? linhaDigitavelMatch[1].trim() : null;
    
    const screenshotMatch = stdout.match(/Screenshot aprovação:\s*(\S+)/);
    const screenshotFilename = screenshotMatch ? screenshotMatch[1] : null;
    
    const boletoMatch = stdout.match(/Boleto:\s*(\S+)/);
    const boletoFilename = boletoMatch ? boletoMatch[1] : null;
    
    const campanhaMatch = stdout.match(/Campanha:\s*(.+)/);
    const campanhaUsada = campanhaMatch ? campanhaMatch[1].trim() : campanha;
    
    // Extrai valores financeiros
    const valorMatriculaMatch = stdout.match(/Valor matrícula:\s*R?\$?\s*([\d,.]+)/);
    const valorMensalidadeMatch = stdout.match(/Valor mensalidade:\s*R?\$?\s*([\d,.]+)/);
    const qtdParcelasMatch = stdout.match(/Parcelas:\s*(\d+)/);
    
    // ═════════════════════════════════════════════════════════════════
    // Lê arquivos e converte para Base64 (entrega confiável via JSON)
    // ═════════════════════════════════════════════════════════════════
    function lerArquivoBase64(filename, mimeType) {
      if (!filename) return null;
      // Procura na pasta de arquivos, com fallback na raiz
      let filePath = path.join(ARQUIVOS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, filename);
      }
      if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️ Arquivo não encontrado para Base64: ${filename}`);
        return null;
      }
      try {
        const buffer = fs.readFileSync(filePath);
        console.log(`   ✅ Arquivo lido para Base64: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        return {
          name: filename,
          mimeType,
          base64: buffer.toString('base64')
        };
      } catch (err) {
        console.log(`   ❌ Erro ao ler arquivo: ${err.message}`);
        return null;
      }
    }
    
    const aprovacaoBase64 = lerArquivoBase64(screenshotFilename, 'image/png');
    const boletoBase64 = lerArquivoBase64(boletoFilename, 'application/pdf');
    
    if (processoCompleto) {
      console.log('✅ SUCESSO - Inscrição Pós-Graduação concluída!');
      if (numeroInscricao) console.log(`📋 Número Pedido VTEX: ${numeroInscricao}`);
      if (numeroInscricaoSiaa) console.log(`📋 Número Inscrição SIAA: ${numeroInscricaoSiaa}`);
      if (linhaDigitavel) console.log(`📊 Linha Digitável: ${linhaDigitavel}`);
      
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        campanha_codigo: campanha || '',
        campanha_nome: campanhaUsada || '',
        valor_matricula: valorMatriculaMatch ? parseFloat(valorMatriculaMatch[1].replace(',', '.')) : (matricula ? parseFloat(matricula) : null),
        valor_mensalidade: valorMensalidadeMatch ? parseFloat(valorMensalidadeMatch[1].replace(',', '.')) : (mensalidade ? parseFloat(mensalidade) : null),
        qtd_parcelas: qtdParcelasMatch ? parseInt(qtdParcelasMatch[1]) : null,
        numero_inscricao: numeroInscricaoSiaa || numeroInscricao,
        numero_inscricao_siaa: numeroInscricaoSiaa,
        output_final: `SIAA: ${numeroInscricaoSiaa || 'N/A'} | Campanha: ${campanhaUsada} | Boleto: ${boletoFilename || 'N/A'}`,
        arquivo_aprovacao: screenshotFilename,
        arquivo_boleto: boletoFilename,
        arquivos: { screenshot: screenshotFilename, boleto: boletoFilename, linhaDigitavel }
      });
      
      return res.status(200).json({
        sucesso: true,
        numeroInscricao: numeroInscricaoSiaa || numeroInscricao,
        numeroInscricaoSiaa,
        numeroPedidoVtex: numeroInscricao,
        linhaDigitavel,
        linkCartaoCredito,
        aprovacao: aprovacaoBase64,
        boleto: boletoBase64,
        screenshotUrl: screenshotFilename ? `${BASE_URL}/files/${screenshotFilename}` : null,
        boletoUrl: boletoFilename ? `${BASE_URL}/files/${boletoFilename}` : null,
        campanhaUsada,
        mensagem: 'Inscrição Pós-Graduação concluída com sucesso!',
        logId,
        cliente: { nome, cpf, email },
        curso: { nome: curso, duracao, matricula, mensalidade }
      });
    }
    
    // ERRO - retorna 200 para o fluxo n8n continuar
    console.log('❌ ERRO - Inscrição Pós-Graduação não finalizada');
    if (logId) await db.finalizarLogErro(logId, {
      erro_mensagem: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição Pós-Graduação não finalizada',
      etapa_erro: 'finalizacao',
      output_final: stdout.slice(-3000)
    });
    return res.status(200).json({
      sucesso: false,
      erro: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição Pós-Graduação não finalizada.',
      linkCartaoCredito,
      numeroInscricao: numeroInscricaoSiaa || numeroInscricao,
      numeroInscricaoSiaa,
      numeroPedidoVtex: numeroInscricao,
      aprovacao: aprovacaoBase64,
      boleto: boletoBase64,
      screenshotUrl: screenshotFilename ? `${BASE_URL}/files/${screenshotFilename}` : null,
      boletoUrl: boletoFilename ? `${BASE_URL}/files/${boletoFilename}` : null,
      logId,
      cliente: { nome, cpf, email },
      logs: stdout.slice(-2000)
    });
  });

  processo.on('error', async (err) => {
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: err.message, etapa_erro: 'spawn_processo', output_final: '' });
    res.status(200).json({ sucesso: false, erro: err.message, logId, cliente: { nome, cpf, email } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Inscrição TRANSFERÊNCIA / SEGUNDA GRADUAÇÃO Síncrona
// ═══════════════════════════════════════════════════════════════════════════
app.post('/inscricao-transferencia/sync', async (req, res) => {
  console.log('');
  console.log('📦 BODY RECEBIDO (TRANSFERÊNCIA):', JSON.stringify(req.body, null, 2));
  
  const { nome, cpf, email, telefone, cep, numero, complemento, estado, cidade, curso, polo, leadId } = req.body;
  const nascimento = req.body.nascimento || req.body['data de nascimento'] || req.body.dataNascimento;
  const tipoIngresso = req.body.tipoIngresso || req.body.tipo_ingresso || 'Segunda Graduação';

  if (!nome || !cpf || !email || !telefone || !nascimento) {
    return res.status(400).json({ sucesso: false, erro: 'Campos obrigatórios: nome, cpf, email, telefone, nascimento' });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 NOVA INSCRIÇÃO TRANSFERÊNCIA / SEGUNDA GRADUAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Nome: ${nome} | CPF: ${cpf} | Tipo: ${tipoIngresso}`);
  console.log(`   Curso: ${curso || '-'} | Polo: ${polo || '-'}`);
  console.log('');

  const inicioMs = Date.now();
  const logDB = await db.iniciarLog({
    tipo_inscricao: 'transferencia',
    nome, cpf, email, telefone, nascimento,
    curso: curso || '', polo: polo || '',
    ip_origem: req.ip, user_agent: req.get('User-Agent')
  });
  const logId = logDB ? logDB.id : null;
  if (logId) await db.atualizarStatusEmAndamento(logId, 'Transferência - iniciando Playwright');

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
    CLIENTE_TIPO_INGRESSO: tipoIngresso,
    LOG_ID: logId ? logId.toString() : ''
  };

  console.log('🚀 Iniciando Playwright (transferência)...');
  const processo = spawn('npx playwright test tests/inscricao-transferencia.spec.js --config=playwright.config.server.js', {
    env: envComUTF8(env), cwd: __dirname, shell: true
  });
  configuraSpawnUTF8(processo);

  let stdout = '';
  let stderr = '';

  processo.stdout.on('data', (data) => { const t = data.toString('utf-8'); stdout += t; process.stdout.write(t); });
  processo.stderr.on('data', (data) => { const t = data.toString('utf-8'); stderr += t; process.stderr.write(t); });

  processo.on('close', async (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📤 PROCESSO TRANSFERÊNCIA FINALIZADO (código: ${code})`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Extrai dados do output
    const linkMatch = stdout.match(/🔗\s*(https?:\/\/[^\s]+)/);
    const linkProva = linkMatch ? linkMatch[1] : null;

    let numeroInscricaoMatch = stdout.match(/NUMERO_INSCRICAO_EXTRAIDO:\s*(\d+)/);
    if (!numeroInscricaoMatch) numeroInscricaoMatch = stdout.match(/Número de Inscrição:\s*(\d+)/);
    const numeroInscricao = numeroInscricaoMatch ? numeroInscricaoMatch[1] : null;

    // Alerta de inconsistência
    const alertaMatch = stdout.match(/ALERTA_INSCRICAO:\s*(.+)/);
    if (alertaMatch) {
      const msg = alertaMatch[1].trim();
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: msg, etapa_erro: 'alerta_cadastro', output_final: stdout.slice(-3000) });
      return res.status(200).json({ sucesso: false, erro: msg, tipo_erro: 'alerta_cadastro', logId, cliente: { nome, cpf, email } });
    }

    // CPF já inscrito
    if (stdout.includes('CPF já possui uma inscrição') || stdout.includes('CPF JÁ POSSUI INSCRIÇÃO')) {
      if (logId) await db.finalizarLogErro(logId, { erro_mensagem: 'CPF já possui inscrição', etapa_erro: 'validacao_cpf', output_final: stdout.slice(-3000) });
      return res.status(200).json({ sucesso: false, erro: 'CPF já possui inscrição', logId, cliente: { nome, cpf, email } });
    }

    // Sucesso - marcador INSCRICAO_TRANSFERENCIA_SUCESSO ou tem número de inscrição
    const transferenciaSucesso = stdout.includes('INSCRICAO_TRANSFERENCIA_SUCESSO');
    if (transferenciaSucesso || numeroInscricao) {
      console.log(`✅ SUCESSO - Inscrição Transferência concluída! Nº ${numeroInscricao || '(sem número)'}`);
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        numero_inscricao: numeroInscricao,
        output_final: `Inscrição transferência finalizada. Nº ${numeroInscricao || 'N/A'}`
      });
      return res.status(200).json({
        sucesso: true,
        mensagem: 'Inscrição realizada com sucesso, necessário anexar documentação do processo',
        numeroInscricao,
        tipoIngresso,
        logId,
        cliente: { nome, cpf, email }
      });
    }

    // Fallback - sem número mas com link
    if (linkProva) {
      console.log('✅ SUCESSO - Link capturado (sem número de inscrição)');
      if (logId) await db.finalizarLogSucesso(logId, {
        duracao_formatada: calcularDuracaoFormatada(inicioMs),
        output_final: `Link: ${linkProva}`
      });
      return res.status(200).json({ sucesso: true, mensagem: 'Inscrição realizada com sucesso', linkProva, tipoIngresso, logId, cliente: { nome, cpf, email } });
    }

    // Erro genérico
    console.log('❌ ERRO - Inscrição transferência não finalizada');
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: code !== 0 ? `Código ${code}` : 'Não finalizada', etapa_erro: 'finalizacao', output_final: stdout.slice(-3000) });
    return res.status(200).json({ sucesso: false, erro: code !== 0 ? `Processo terminou com código ${code}` : 'Inscrição não finalizada', logId, cliente: { nome, cpf, email }, logs: stdout.slice(-2000) });
  });

  processo.on('error', async (err) => {
    if (logId) await db.finalizarLogErro(logId, { erro_mensagem: err.message, etapa_erro: 'spawn_processo', output_final: '' });
    res.status(200).json({ sucesso: false, erro: err.message, logId, cliente: { nome, cpf, email } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Listar Logs de Execução
// ═══════════════════════════════════════════════════════════════════════════
app.get('/logs', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite || req.query.limit || '50');
    const filtros = {};
    
    if (req.query.status) filtros.status = req.query.status;
    if (req.query.tipo) filtros.tipo_inscricao = req.query.tipo;
    if (req.query.cpf) filtros.cpf = req.query.cpf;
    if (req.query.data_inicio) filtros.data_inicio = req.query.data_inicio;
    if (req.query.data_fim) filtros.data_fim = req.query.data_fim;
    
    const logs = await db.buscarLogsRecentes(limite, filtros);
    res.json({
      sucesso: true,
      total: logs.length,
      filtros,
      logs
    });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Buscar Log por ID
// ═══════════════════════════════════════════════════════════════════════════
app.get('/logs/:id', async (req, res) => {
  try {
    const log = await db.buscarLogPorId(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ sucesso: false, erro: 'Log não encontrado' });
    }
    res.json({ sucesso: true, log });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Estatísticas de Execução
// ═══════════════════════════════════════════════════════════════════════════
app.get('/estatisticas', async (req, res) => {
  try {
    const periodo = req.query.periodo || '7 days';
    const stats = await db.obterEstatisticas(periodo);
    
    // Calcula totais
    let totalExecucoes = 0;
    let totalSucesso = 0;
    let totalErro = 0;
    
    stats.forEach(s => {
      const count = parseInt(s.total);
      totalExecucoes += count;
      if (s.status === 'sucesso') totalSucesso += count;
      if (s.status === 'erro') totalErro += count;
    });
    
    res.json({
      sucesso: true,
      periodo,
      resumo: {
        total: totalExecucoes,
        sucesso: totalSucesso,
        erro: totalErro,
        taxa_sucesso: totalExecucoes > 0 ? `${((totalSucesso / totalExecucoes) * 100).toFixed(1)}%` : '0%'
      },
      detalhes: stats
    });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTA: Health Check do Banco de Dados
// ═══════════════════════════════════════════════════════════════════════════
app.get('/db/health', async (req, res) => {
  try {
    const ok = await db.testarConexao();
    res.json({ sucesso: ok, banco: ok ? 'conectado' : 'desconectado' });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INICIA SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════
const server = app.listen(PORT, async () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 SERVIDOR DE INSCRIÇÃO INICIADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log('');
  console.log('   Endpoints disponíveis:');
  console.log('   POST /inscricao                    - Inicia inscrição (assíncrono)');
  console.log('   POST /inscricao/sync               - Inscrição vestibular (síncrono)');
  console.log('   POST /inscricao-enem/sync          - Inscrição ENEM com notas');
  console.log('   POST /inscricao-enem-sem-nota/sync - Inscrição ENEM sem notas');
  console.log('   POST /inscricao-pos/sync           - Inscrição PÓS-GRADUAÇÃO');
  console.log('   POST /inscricao-transferencia/sync - Transferência / Segunda Graduação');
  console.log('   GET  /status                       - Status da execução atual');
  console.log('   GET  /files/:filename              - Serve arquivos gerados');
  console.log('   POST /kommo/upload-lead             - Upload seguro para Kommo (valida CPF)');
  console.log('   GET  /logs                         - Logs de execução (?limite=50&status=sucesso&tipo=pos&cpf=xxx)');
  console.log('   GET  /logs/:id                     - Log específico por ID');
  console.log('   GET  /estatisticas                 - Estatísticas (?periodo=7 days)');
  console.log('   GET  /db/health                    - Health check do banco');
  console.log('');
  
  // Testa conexão com o banco
  const dbOk = await db.testarConexao();
  if (!dbOk) {
    console.log('⚠️  Banco de dados não está acessível. Logs serão ignorados.');
  }
  console.log('');
});

// Timeout de 15 minutos para conexões HTTP (o Playwright pode demorar vários minutos)
server.timeout = 15 * 60 * 1000;           // 15 min - tempo máximo de resposta
server.keepAliveTimeout = 15 * 60 * 1000;  // 15 min - mantém conexão aberta
server.headersTimeout = 15 * 60 * 1000 + 1000; // Deve ser > keepAliveTimeout
console.log('⏱️  Timeout HTTP configurado: 15 minutos');

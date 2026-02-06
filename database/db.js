// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO DE BANCO DE DADOS - LOGS DE EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════════════

const { Pool } = require('pg');

// Configuração do pool de conexões
const pool = new Pool({
  host: process.env.DB_HOST || '31.97.91.47',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'eduit',
  user: process.env.DB_USER || 'adm_eduit',
  password: process.env.DB_PASSWORD || 'IaDm24Sx3HxrYoqT',
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Testa conexão ao iniciar
pool.on('connect', () => {
  console.log('📦 [DB] Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ [DB] Erro no pool de conexões:', err.message);
});

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE LOG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inicia um novo log de execução
 * @returns {Promise<number>} ID do log criado
 */
async function iniciarLog(dados) {
  const query = `
    INSERT INTO logs_execucao (
      tipo_inscricao,
      nome_cliente,
      cpf,
      email,
      telefone,
      data_nascimento,
      curso,
      duracao_curso,
      polo,
      modalidade,
      usuario_admin,
      ip_origem,
      user_agent,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'iniciado')
    RETURNING id, execution_id
  `;

  const valores = [
    dados.tipo_inscricao || 'pos',
    dados.nome,
    dados.cpf,
    dados.email,
    dados.telefone,
    dados.nascimento,
    dados.curso,
    dados.duracao,
    dados.polo,
    dados.modalidade || 'EAD',
    dados.usuario_admin,
    dados.ip_origem,
    dados.user_agent
  ];

  try {
    const result = await pool.query(query, valores);
    console.log(`📝 [DB] Log iniciado: ID ${result.rows[0].id}`);
    return result.rows[0];
  } catch (err) {
    console.error('❌ [DB] Erro ao iniciar log:', err.message);
    return null;
  }
}

/**
 * Atualiza status do log para "em_andamento"
 */
async function atualizarStatusEmAndamento(logId, etapaAtual) {
  const query = `
    UPDATE logs_execucao 
    SET status = 'em_andamento',
        output = COALESCE(output, '') || $2 || E'\\n'
    WHERE id = $1
  `;

  try {
    await pool.query(query, [logId, `[${new Date().toISOString()}] ${etapaAtual}`]);
  } catch (err) {
    console.error('❌ [DB] Erro ao atualizar status:', err.message);
  }
}

/**
 * Adiciona texto ao output do log
 */
async function appendOutput(logId, texto) {
  const query = `
    UPDATE logs_execucao 
    SET output = COALESCE(output, '') || $2 || E'\\n'
    WHERE id = $1
  `;

  try {
    await pool.query(query, [logId, texto]);
  } catch (err) {
    // Silencioso para não interromper execução
  }
}

/**
 * Finaliza log com sucesso
 */
async function finalizarLogSucesso(logId, dados) {
  const dataFim = new Date();
  
  const query = `
    UPDATE logs_execucao 
    SET 
      data_fim = $2,
      duracao_segundos = EXTRACT(EPOCH FROM ($2 - data_inicio))::INTEGER,
      duracao_formatada = $3,
      campanha_codigo = $4,
      campanha_nome = $5,
      valor_matricula = $6,
      valor_mensalidade = $7,
      qtd_parcelas = $8,
      numero_inscricao = $9,
      numero_inscricao_siaa = $10,
      status = 'sucesso',
      output = COALESCE(output, '') || $11 || E'\\n',
      arquivo_aprovacao = $12,
      arquivo_boleto = $13,
      arquivos_json = $14
    WHERE id = $1
    RETURNING duracao_segundos, duracao_formatada
  `;

  // Calcula duração formatada
  const duracaoFormatada = dados.duracao_formatada || '';

  const valores = [
    logId,
    dataFim,
    duracaoFormatada,
    dados.campanha_codigo,
    dados.campanha_nome,
    dados.valor_matricula,
    dados.valor_mensalidade,
    dados.qtd_parcelas,
    dados.numero_inscricao,
    dados.numero_inscricao_siaa,
    dados.output_final || '',
    dados.arquivo_aprovacao,
    dados.arquivo_boleto,
    JSON.stringify(dados.arquivos || {})
  ];

  try {
    const result = await pool.query(query, valores);
    console.log(`✅ [DB] Log finalizado com sucesso: ID ${logId}`);
    return result.rows[0];
  } catch (err) {
    console.error('❌ [DB] Erro ao finalizar log:', err.message);
    return null;
  }
}

/**
 * Finaliza log com erro
 */
async function finalizarLogErro(logId, dados) {
  const dataFim = new Date();
  
  const query = `
    UPDATE logs_execucao 
    SET 
      data_fim = $2,
      duracao_segundos = EXTRACT(EPOCH FROM ($2 - data_inicio))::INTEGER,
      status = 'erro',
      erro_mensagem = $3,
      etapa_erro = $4,
      output = COALESCE(output, '') || $5 || E'\\n'
    WHERE id = $1
  `;

  const valores = [
    logId,
    dataFim,
    dados.erro_mensagem,
    dados.etapa_erro,
    dados.output_final || ''
  ];

  try {
    await pool.query(query, valores);
    console.log(`❌ [DB] Log finalizado com erro: ID ${logId}`);
  } catch (err) {
    console.error('❌ [DB] Erro ao registrar erro:', err.message);
  }
}

/**
 * Busca logs recentes
 */
async function buscarLogsRecentes(limite = 50, filtros = {}) {
  let query = `
    SELECT 
      id,
      tipo_inscricao,
      TO_CHAR(data_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS inicio_sp,
      TO_CHAR(data_fim AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS fim_sp,
      duracao_formatada,
      duracao_segundos,
      nome_cliente,
      cpf,
      curso,
      polo,
      campanha_nome,
      valor_matricula,
      valor_mensalidade,
      numero_inscricao,
      status,
      etapa_erro,
      arquivo_aprovacao,
      arquivo_boleto
    FROM logs_execucao
    WHERE 1=1
  `;

  const valores = [];
  let paramIndex = 1;

  if (filtros.status) {
    query += ` AND status = $${paramIndex++}`;
    valores.push(filtros.status);
  }

  if (filtros.tipo_inscricao) {
    query += ` AND tipo_inscricao = $${paramIndex++}`;
    valores.push(filtros.tipo_inscricao);
  }

  if (filtros.cpf) {
    query += ` AND cpf = $${paramIndex++}`;
    valores.push(filtros.cpf);
  }

  if (filtros.data_inicio) {
    query += ` AND data_inicio >= $${paramIndex++}`;
    valores.push(filtros.data_inicio);
  }

  if (filtros.data_fim) {
    query += ` AND data_inicio <= $${paramIndex++}`;
    valores.push(filtros.data_fim);
  }

  query += ` ORDER BY data_inicio DESC LIMIT $${paramIndex}`;
  valores.push(limite);

  try {
    const result = await pool.query(query, valores);
    return result.rows;
  } catch (err) {
    console.error('❌ [DB] Erro ao buscar logs:', err.message);
    return [];
  }
}

/**
 * Busca log por ID
 */
async function buscarLogPorId(logId) {
  const query = `
    SELECT 
      *,
      TO_CHAR(data_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS inicio_sp,
      TO_CHAR(data_fim AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS fim_sp
    FROM logs_execucao
    WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [logId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('❌ [DB] Erro ao buscar log:', err.message);
    return null;
  }
}

/**
 * Estatísticas gerais
 */
async function obterEstatisticas(periodo = '7 days') {
  const query = `
    SELECT 
      tipo_inscricao,
      status,
      COUNT(*) as total,
      AVG(duracao_segundos) as duracao_media,
      MIN(duracao_segundos) as duracao_min,
      MAX(duracao_segundos) as duracao_max
    FROM logs_execucao
    WHERE data_inicio >= NOW() - INTERVAL '${periodo}'
    GROUP BY tipo_inscricao, status
    ORDER BY tipo_inscricao, status
  `;

  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error('❌ [DB] Erro ao obter estatísticas:', err.message);
    return [];
  }
}

/**
 * Formata duração em segundos para string legível
 */
function formatarDuracao(segundos) {
  if (!segundos || segundos < 0) return '0s';
  
  const minutos = Math.floor(segundos / 60);
  const segs = segundos % 60;
  
  if (minutos === 0) {
    return `${segs}s`;
  }
  
  return `${minutos}m ${segs}s`;
}

/**
 * Testa conexão com o banco
 */
async function testarConexao() {
  try {
    const result = await pool.query('SELECT NOW() AT TIME ZONE \'America/Sao_Paulo\' AS agora_sp');
    console.log(`✅ [DB] Conexão OK - Horário SP: ${result.rows[0].agora_sp}`);
    return true;
  } catch (err) {
    console.error('❌ [DB] Falha na conexão:', err.message);
    return false;
  }
}

/**
 * Fecha o pool de conexões
 */
async function fecharConexao() {
  await pool.end();
  console.log('📦 [DB] Pool de conexões fechado');
}

module.exports = {
  pool,
  iniciarLog,
  atualizarStatusEmAndamento,
  appendOutput,
  finalizarLogSucesso,
  finalizarLogErro,
  buscarLogsRecentes,
  buscarLogPorId,
  obterEstatisticas,
  formatarDuracao,
  testarConexao,
  fecharConexao
};

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT PARA EXECUTAR O SETUP DO BANCO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do pool de conexões
const pool = new Pool({
  host: process.env.DB_HOST || '31.97.91.47',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'eduit',
  user: process.env.DB_USER || 'adm_eduit',
  password: process.env.DB_PASSWORD || 'IaDm24Sx3HxrYoqT',
  ssl: false,
});

async function runSetup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 SETUP DO BANCO DE DADOS - LOGS DE EXECUÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    // Testa conexão
    console.log('\n📦 Testando conexão...');
    const testResult = await pool.query('SELECT NOW() AS agora');
    console.log(`✅ Conexão OK - Servidor: ${testResult.rows[0].agora}`);
    
    // Cria os tipos ENUM se não existirem
    console.log('\n📝 Criando tipos ENUM...');
    
    // Tipo de inscrição
    try {
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE tipo_inscricao_enum AS ENUM (
            'pos', 'mba', 'graduacao', 'multipla', 'redacao',
            'enem_com_nota', 'enem_sem_nota', 'profissionalizante', 'outro'
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('   ✅ tipo_inscricao_enum');
    } catch (e) {
      console.log('   ℹ️ tipo_inscricao_enum já existe');
    }
    
    // Status de execução
    try {
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE status_execucao_enum AS ENUM (
            'iniciado', 'em_andamento', 'sucesso', 'erro', 'timeout', 'cancelado'
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('   ✅ status_execucao_enum');
    } catch (e) {
      console.log('   ℹ️ status_execucao_enum já existe');
    }
    
    // Cria a tabela
    console.log('\n📝 Criando tabela logs_execucao...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs_execucao (
        id SERIAL PRIMARY KEY,
        execution_id UUID DEFAULT gen_random_uuid(),
        tipo_inscricao tipo_inscricao_enum NOT NULL DEFAULT 'pos',
        data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        data_fim TIMESTAMP WITH TIME ZONE,
        duracao_segundos INTEGER,
        duracao_formatada VARCHAR(20),
        nome_cliente VARCHAR(255),
        cpf VARCHAR(14),
        email VARCHAR(255),
        telefone VARCHAR(20),
        data_nascimento VARCHAR(10),
        curso VARCHAR(255),
        duracao_curso VARCHAR(50),
        polo VARCHAR(100),
        modalidade VARCHAR(50),
        campanha_codigo VARCHAR(50),
        campanha_nome VARCHAR(255),
        valor_matricula DECIMAL(10, 2),
        valor_mensalidade DECIMAL(10, 2),
        qtd_parcelas INTEGER,
        numero_inscricao VARCHAR(50),
        numero_inscricao_siaa VARCHAR(50),
        status status_execucao_enum NOT NULL DEFAULT 'iniciado',
        output TEXT,
        erro_mensagem TEXT,
        etapa_erro VARCHAR(100),
        arquivo_aprovacao VARCHAR(500),
        arquivo_boleto VARCHAR(500),
        arquivos_json JSONB,
        usuario_admin VARCHAR(100),
        ip_origem VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('   ✅ Tabela criada/verificada');
    
    // Cria índices
    console.log('\n📝 Criando índices...');
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_logs_execucao_cpf ON logs_execucao(cpf)',
      'CREATE INDEX IF NOT EXISTS idx_logs_execucao_status ON logs_execucao(status)',
      'CREATE INDEX IF NOT EXISTS idx_logs_execucao_tipo ON logs_execucao(tipo_inscricao)',
      'CREATE INDEX IF NOT EXISTS idx_logs_execucao_data_inicio ON logs_execucao(data_inicio)',
      'CREATE INDEX IF NOT EXISTS idx_logs_execucao_numero_inscricao ON logs_execucao(numero_inscricao)'
    ];
    
    for (const idx of indices) {
      await pool.query(idx);
    }
    console.log('   ✅ Índices criados');
    
    // Cria função e trigger para updated_at
    console.log('\n📝 Criando trigger para updated_at...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_logs_execucao_updated_at ON logs_execucao
    `);
    
    await pool.query(`
      CREATE TRIGGER update_logs_execucao_updated_at
        BEFORE UPDATE ON logs_execucao
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('   ✅ Trigger criado');
    
    // Cria view
    console.log('\n📝 Criando view vw_logs_execucao_sp...');
    await pool.query(`
      CREATE OR REPLACE VIEW vw_logs_execucao_sp AS
      SELECT 
        id,
        execution_id,
        tipo_inscricao,
        TO_CHAR(data_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS inicio_sp,
        TO_CHAR(data_fim AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') AS fim_sp,
        duracao_formatada,
        duracao_segundos,
        nome_cliente,
        cpf,
        email,
        curso,
        polo,
        campanha_nome,
        valor_matricula,
        valor_mensalidade,
        numero_inscricao,
        numero_inscricao_siaa,
        status,
        etapa_erro,
        erro_mensagem,
        arquivo_aprovacao,
        arquivo_boleto,
        usuario_admin
      FROM logs_execucao
      ORDER BY data_inicio DESC
    `);
    console.log('   ✅ View criada');
    
    // Verifica se a tabela foi criada corretamente
    console.log('\n📊 Verificando estrutura...');
    const colunas = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'logs_execucao'
      ORDER BY ordinal_position
    `);
    console.log(`   ✅ Tabela tem ${colunas.rows.length} colunas`);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ SETUP CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error('\n❌ ERRO NO SETUP:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSetup();

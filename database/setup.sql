-- ═══════════════════════════════════════════════════════════════════════════
-- TABELA DE LOGS DE EXECUÇÃO - SCRIPT DE INSCRIÇÃO
-- ═══════════════════════════════════════════════════════════════════════════

-- Tipo de inscrição
CREATE TYPE IF NOT EXISTS tipo_inscricao_enum AS ENUM (
    'pos',
    'mba',
    'graduacao',
    'multipla',
    'redacao',
    'enem_com_nota',
    'enem_sem_nota',
    'profissionalizante',
    'outro'
);

-- Status da execução
CREATE TYPE IF NOT EXISTS status_execucao_enum AS ENUM (
    'iniciado',
    'em_andamento',
    'sucesso',
    'erro',
    'timeout',
    'cancelado'
);

-- Tabela principal de logs
CREATE TABLE IF NOT EXISTS logs_execucao (
    id SERIAL PRIMARY KEY,
    
    -- Identificação da execução
    execution_id UUID DEFAULT gen_random_uuid(),
    
    -- Tipo de inscrição
    tipo_inscricao tipo_inscricao_enum NOT NULL DEFAULT 'pos',
    
    -- Timestamps (sempre em horário de São Paulo)
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMP WITH TIME ZONE,
    duracao_segundos INTEGER,
    duracao_formatada VARCHAR(20), -- Ex: "5m 32s"
    
    -- Dados do cliente
    nome_cliente VARCHAR(255),
    cpf VARCHAR(14),
    email VARCHAR(255),
    telefone VARCHAR(20),
    data_nascimento VARCHAR(10),
    
    -- Dados do curso
    curso VARCHAR(255),
    duracao_curso VARCHAR(50),
    polo VARCHAR(100),
    modalidade VARCHAR(50), -- EAD, Presencial, etc.
    
    -- Dados da campanha
    campanha_codigo VARCHAR(50),
    campanha_nome VARCHAR(255),
    valor_matricula DECIMAL(10, 2),
    valor_mensalidade DECIMAL(10, 2),
    qtd_parcelas INTEGER,
    
    -- Resultado
    numero_inscricao VARCHAR(50),
    numero_inscricao_siaa VARCHAR(50),
    status status_execucao_enum NOT NULL DEFAULT 'iniciado',
    
    -- Output e erros
    output TEXT, -- Log completo da execução
    erro_mensagem TEXT,
    etapa_erro VARCHAR(100), -- Em qual etapa ocorreu o erro
    
    -- Arquivos gerados
    arquivo_aprovacao VARCHAR(500),
    arquivo_boleto VARCHAR(500),
    arquivos_json JSONB, -- Outros arquivos em formato JSON
    
    -- Metadados
    usuario_admin VARCHAR(100), -- Email do admin que executou
    ip_origem VARCHAR(50),
    user_agent TEXT,
    
    -- Controle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_logs_execucao_cpf ON logs_execucao(cpf);
CREATE INDEX IF NOT EXISTS idx_logs_execucao_status ON logs_execucao(status);
CREATE INDEX IF NOT EXISTS idx_logs_execucao_tipo ON logs_execucao(tipo_inscricao);
CREATE INDEX IF NOT EXISTS idx_logs_execucao_data_inicio ON logs_execucao(data_inicio);
CREATE INDEX IF NOT EXISTS idx_logs_execucao_numero_inscricao ON logs_execucao(numero_inscricao);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_logs_execucao_updated_at ON logs_execucao;
CREATE TRIGGER update_logs_execucao_updated_at
    BEFORE UPDATE ON logs_execucao
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View para consultas com horário de São Paulo formatado
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
ORDER BY data_inicio DESC;

-- Comentários na tabela
COMMENT ON TABLE logs_execucao IS 'Logs de execução dos scripts de inscrição';
COMMENT ON COLUMN logs_execucao.tipo_inscricao IS 'Tipo: pos, mba, graduacao, multipla, redacao, enem_com_nota, enem_sem_nota';
COMMENT ON COLUMN logs_execucao.duracao_formatada IS 'Duração legível, ex: 5m 32s';
COMMENT ON COLUMN logs_execucao.etapa_erro IS 'Etapa onde ocorreu o erro (ex: ETAPA_6, LOGIN, CHECKOUT)';

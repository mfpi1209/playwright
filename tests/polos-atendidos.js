// ═══════════════════════════════════════════════════════════════════════════
// WHITELIST DE POLOS ATENDIDOS — fonte única de verdade
// ═══════════════════════════════════════════════════════════════════════════
// Usado por: server.js (middleware) e tests/*.spec.js (validação pré-flight)
// Regra: se polo recebido não casar com nenhum canônico/alias, ABORTAR.
// ═══════════════════════════════════════════════════════════════════════════

const POLOS_ATENDIDOS = [
  {
    canonico: 'vila mariana',
    aliases: ['vila mariana', 'vl mariana'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Vila Mariana - SP'
  },
  {
    canonico: 'ouro verde',
    aliases: ['ouro verde', 'jardim cristina', 'jd cristina', 'campinas - ouro verde', 'campinas ouro verde'],
    cidade: 'Campinas',
    estado: 'SP',
    vtexLabel: 'Campinas - Ouro Verde (Jardim Cristina) - SP'
  },
  {
    canonico: 'capivari',
    aliases: ['capivari', 'capivari - centro', 'capivari centro'],
    cidade: 'Capivari',
    estado: 'SP',
    vtexLabel: 'Capivari - Centro - SP'
  },
  {
    canonico: 'taboão centro',
    aliases: [
      'taboão centro', 'taboao centro',
      'parque santos dumont', 'pq santos dumont',
      'taboão da serra - centro', 'taboao da serra - centro',
      'taboão da serra centro', 'taboao da serra centro'
    ],
    cidade: 'Taboão da Serra',
    estado: 'SP',
    vtexLabel: 'Taboão da Serra - Centro (Parque Santos Dumont) - SP'
  },
  {
    canonico: 'ibirapuera',
    aliases: ['ibirapuera', 'indianópolis', 'indianopolis', 'são paulo - ibirapuera', 'sao paulo - ibirapuera'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Ibirapuera (Indianópolis) - SP'
  },
  {
    canonico: 'mituzi',
    aliases: ['mituzi', 'jardim mituzi', 'jd mituzi', 'taboão da serra - mituzi', 'taboao da serra - mituzi'],
    cidade: 'Taboão da Serra',
    estado: 'SP',
    vtexLabel: 'Taboão da Serra - Jardim Mituzi - SP'
  },
  {
    canonico: 'sapopemba (vila ema)',
    aliases: ['sapopemba', 'sapopemba (vila ema)', 'sapopemba vila ema', 'sapopemba 6', 'vila ema', 'vl ema'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Sapopemba 6 (Vl Ema) - SP'
  },
  {
    canonico: 'freguesia do ó',
    aliases: ['freguesia do ó', 'freguesia do o', 'moinho velho', 'freguesia', 'freguesia do ó (moinho velho)'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Freguesia do Ó (Moinho Velho) - SP'
  },
  {
    canonico: 'vila prudente 2',
    aliases: ['vila prudente 2', 'vila prudente', 'vl prudente', 'vl prudente 2', 'prudente'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Vila Prudente 2 - SP'
  },
  {
    canonico: 'santana 2',
    aliases: ['santana 2', 'santana', 'são paulo - santana 2', 'sao paulo - santana 2'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Santana 2 - SP'
  },
  {
    canonico: 'morumbi',
    aliases: ['morumbi', 'vila progredior', 'vl progredior', 'morumbi (vila progredior)'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Morumbi (Vila Progredior) - SP'
  },
  {
    canonico: 'barra funda',
    aliases: ['barra funda', 'são paulo - barra funda', 'sao paulo - barra funda'],
    cidade: 'São Paulo',
    estado: 'SP',
    vtexLabel: 'São Paulo - Barra Funda - SP'
  }
];

const MOTIVOS = {
  OK: 'OK',
  POLO_NAO_INFORMADO: 'POLO_NAO_INFORMADO',
  POLO_NAO_ATENDIDO: 'POLO_NAO_ATENDIDO'
};

function normalizarTexto(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function buscarPolo(raw) {
  const alvo = normalizarTexto(raw);
  if (!alvo) return null;

  for (const polo of POLOS_ATENDIDOS) {
    for (const alias of polo.aliases) {
      if (normalizarTexto(alias) === alvo) {
        return polo;
      }
    }
  }
  return null;
}

function normalizarPolo(raw) {
  const polo = buscarPolo(raw);
  return polo ? polo.canonico : (raw || '');
}

function validarPolo(raw) {
  const trimmed = (raw === null || raw === undefined) ? '' : String(raw).trim();

  if (!trimmed) {
    return {
      valido: false,
      canonico: null,
      motivo: MOTIVOS.POLO_NAO_INFORMADO,
      mensagem: 'Polo não informado. É obrigatório selecionar um dos polos atendidos.',
      listaAtendidos: POLOS_ATENDIDOS.map(p => p.canonico)
    };
  }

  const polo = buscarPolo(trimmed);
  if (!polo) {
    return {
      valido: false,
      canonico: null,
      motivo: MOTIVOS.POLO_NAO_ATENDIDO,
      mensagem: `Polo "${trimmed}" não está na rede atendida. Use um dos polos: ${POLOS_ATENDIDOS.map(p => p.canonico).join(', ')}.`,
      listaAtendidos: POLOS_ATENDIDOS.map(p => p.canonico)
    };
  }

  return {
    valido: true,
    canonico: polo.canonico,
    polo,
    motivo: MOTIVOS.OK,
    mensagem: 'OK',
    listaAtendidos: POLOS_ATENDIDOS.map(p => p.canonico)
  };
}

module.exports = {
  POLOS_ATENDIDOS,
  MOTIVOS,
  normalizarTexto,
  normalizarPolo,
  validarPolo
};

// Modelo de dados da Fase 1 — Parecer Técnico aprovado em 17/11/2026, item 4,
// com os acréscimos da etapa 5 (portal do cliente, orçamento, tabela de preços).
// Valores monetários em centavos (inteiro). Datas de calendário em `date`; instantes em `timestamptz`.
import {
  pgTable, pgEnum, uuid, text, integer, boolean, date, timestamp, jsonb,
  uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () => timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow();

// ---------- Enums ----------
export const tipoConsumidor = pgEnum('tipo_consumidor', ['socio', 'cliente', 'agente']);
export const areaUsuario = pgEnum('area_usuario', ['juridico', 'desenvolvimento', 'ciberseguranca']);
export const origemContato = pgEnum('origem_contato', [
  'site_simulador', 'ia_generativa', 'instagram', 'google_ads', 'whatsapp', 'indicacao', 'presencial', 'agente',
]);
export const estadoOportunidade = pgEnum('estado_oportunidade', [
  'cadastro_site', 'orcamento_gerado', 'contato_recebido', 'reuniao_agendada', 'reuniao_realizada',
  'proposta_contrato_enviados', 'contrato_assinado', 'aguardando_retorno', 'desistiu',
]);
export const estadoProjeto = pgEnum('estado_projeto', [
  'aguardando_primeiro_pagamento', 'em_desenvolvimento', 'prazo_suspenso', 'aguardando_aceite', 'entregue', 'garantia_encerrada',
]);
export const tipoAceite = pgEnum('tipo_aceite', ['expresso', 'decurso_prazo', 'uso_real']);
export const gatilhoParcela = pgEnum('gatilho_parcela', ['assinatura', 'aceite', 'entrega']);
export const statusParcela = pgEnum('status_parcela', ['prevista', 'a_receber', 'paga']);
export const meioPagamento = pgEnum('meio_pagamento', ['pix', 'cartao_credito', 'transferencia_internacional']);
export const tipoDocumento = pgEnum('tipo_documento', [
  'proposta', 'contrato', 'termo_recebimento', 'comprovante', 'aditivo', 'evidencia_aceite', 'outro',
]);
export const viaEvento = pgEnum('via_evento', ['painel', 'portal', 'site', 'api', 'agente', 'sistema']);

// ---------- Usuários e escopos (R2) ----------
export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey(),                     // = id do usuário no Supabase Auth
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  tipo: tipoConsumidor('tipo').notNull(),
  area: areaUsuario('area'),                       // só para sócios; identifica, não restringe
  clienteId: uuid('cliente_id'),                   // só para tipo 'cliente'
  ativo: boolean('ativo').notNull().default(true),
  liberadoPor: uuid('liberado_por'),               // sócio que liberou o acesso (cliente)
  liberadoEm: timestamp('liberado_em', { withTimezone: true }),
  deveTrocarSenha: boolean('deve_trocar_senha').notNull().default(false), // senha inicial provisória
  criadoEm: criadoEm(),
}, (t) => [uniqueIndex('usuario_email_uq').on(t.email)]);

export const usuarioEscopo = pgTable('usuario_escopo', {
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id),
  escopo: text('escopo').notNull(),
}, (t) => [primaryKey({ columns: [t.usuarioId, t.escopo] })]);

// ---------- Comercial (R3) ----------
export const contato = pgTable('contato', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  nomeComercial: text('nome_comercial'),
  email: text('email'),
  telefone: text('telefone'),
  pais: text('pais'),
  cidade: text('cidade'),
  origem: origemContato('origem').notNull(),
  origemDetalhe: text('origem_detalhe'),
  idConversaExterna: text('id_conversa_externa'),
  consentimentoPrivacidadeEm: timestamp('consentimento_privacidade_em', { withTimezone: true }),
  versaoAvisoPrivacidade: text('versao_aviso_privacidade'),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}, (t) => [uniqueIndex('contato_email_uq').on(t.email)]);

export const oportunidade = pgTable('oportunidade', {
  id: uuid('id').primaryKey().defaultRandom(),
  contatoId: uuid('contato_id').notNull().references(() => contato.id),
  estado: estadoOportunidade('estado').notNull(),
  estadoAnterior: estadoOportunidade('estado_anterior'), // usado para retomar de 'aguardando_retorno'
  dataReuniao: timestamp('data_reuniao', { withTimezone: true }),
  motivoDesistencia: text('motivo_desistencia'),
  origem: origemContato('origem').notNull(),
  idConversaExterna: text('id_conversa_externa'),
  textoExterno: text('texto_externo'),             // conteúdo de terceiro: DADO, nunca instrução
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}, (t) => [index('oportunidade_estado_idx').on(t.estado)]);

export const tabelaPreco = pgTable('tabela_preco', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull(),
  nome: text('nome').notNull(),
  descricao: text('descricao').notNull(),
  precoCentavos: integer('preco_centavos').notNull(),
  base: boolean('base').notNull().default(false),
  versao: integer('versao').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: criadoEm(),
}, (t) => [uniqueIndex('tabela_preco_codigo_versao_uq').on(t.codigo, t.versao)]);

export const orcamento = pgTable('orcamento', {
  id: uuid('id').primaryKey().defaultRandom(),
  contatoId: uuid('contato_id').notNull().references(() => contato.id),
  oportunidadeId: uuid('oportunidade_id').notNull().references(() => oportunidade.id),
  itens: jsonb('itens').notNull(),                 // preço congelado no momento do orçamento
  totalCentavos: integer('total_centavos').notNull(),
  versaoTabela: integer('versao_tabela').notNull(),
  textoAviso: text('texto_aviso').notNull(),       // aviso de não vinculação gravado junto
  criadoEm: criadoEm(),
});

// ---------- Contrato, prazo, aceite ----------
export const contrato = pgTable('contrato', {
  id: uuid('id').primaryKey().defaultRandom(),
  oportunidadeId: uuid('oportunidade_id').notNull().references(() => oportunidade.id),
  contatoId: uuid('contato_id').notNull().references(() => contato.id),
  objeto: text('objeto').notNull(),
  valorTotalCentavos: integer('valor_total_centavos').notNull(),
  moeda: text('moeda').notNull().default('BRL'),
  dataAssinatura: date('data_assinatura').notNull(),
  prazoDiasCorridos: integer('prazo_dias_corridos').notNull(),
  dataPrimeiroPagamento: date('data_primeiro_pagamento'),   // marco inicial do prazo
  estadoProjeto: estadoProjeto('estado_projeto').notNull(),
  dataComunicacaoEntrega: date('data_comunicacao_entrega'),
  tipoAceite: tipoAceite('tipo_aceite'),
  dataAceite: date('data_aceite'),
  diasGarantia: integer('dias_garantia').notNull(),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const suspensaoPrazo = pgTable('suspensao_prazo', {
  id: uuid('id').primaryKey().defaultRandom(),
  contratoId: uuid('contrato_id').notNull().references(() => contrato.id),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  motivo: text('motivo').notNull(),
  criadoEm: criadoEm(),
});

export const parcela = pgTable('parcela', {
  id: uuid('id').primaryKey().defaultRandom(),
  contratoId: uuid('contrato_id').notNull().references(() => contrato.id),
  numero: integer('numero').notNull(),
  descricao: text('descricao').notNull(),
  valorCentavos: integer('valor_centavos').notNull(),
  gatilho: gatilhoParcela('gatilho').notNull(),
  diasUteisAposGatilho: integer('dias_uteis_apos_gatilho').notNull().default(0),
  vencimento: date('vencimento'),
  status: statusParcela('status').notNull(),
  dataPagamento: date('data_pagamento'),
  meio: meioPagamento('meio'),
  comprovanteDocumentoId: uuid('comprovante_documento_id'),
  criadoEm: criadoEm(),
}, (t) => [uniqueIndex('parcela_contrato_numero_uq').on(t.contratoId, t.numero)]);

export const manutencao = pgTable('manutencao', {
  id: uuid('id').primaryKey().defaultRandom(),
  contratoId: uuid('contrato_id').notNull().references(() => contrato.id),
  valorMensalCentavos: integer('valor_mensal_centavos').notNull(),
  inicio: date('inicio').notNull(),
  diaVencimento: integer('dia_vencimento').notNull(),
  fim: date('fim'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: criadoEm(),
});

export const documento = pgTable('documento', {
  id: uuid('id').primaryKey().defaultRandom(),
  contatoId: uuid('contato_id').notNull().references(() => contato.id),
  contratoId: uuid('contrato_id').references(() => contrato.id),
  tipo: tipoDocumento('tipo').notNull(),
  nomeArquivo: text('nome_arquivo').notNull(),
  caminho: text('caminho').notNull(),              // clientes/{contato_id}/{documento_id}-{nome}
  hashSha256: text('hash_sha256'),                 // preenchido na confirmação do envio
  tamanhoBytes: integer('tamanho_bytes'),
  confirmado: boolean('confirmado').notNull().default(false),
  enviadoPor: uuid('enviado_por').notNull(),
  excluidoEm: timestamp('excluido_em', { withTimezone: true }),
  criadoEm: criadoEm(),
});

// ---------- R4: registro de eventos (imutável — gatilho na migração 0001) ----------
export const evento = pgTable('evento', {
  id: uuid('id').primaryKey().defaultRandom(),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
  atorId: uuid('ator_id'),                         // null só para cadastro público do site
  atorTipo: text('ator_tipo').notNull(),           // socio | cliente | agente | publico
  via: viaEvento('via').notNull(),
  entidade: text('entidade').notNull(),
  entidadeId: uuid('entidade_id').notNull(),
  acao: text('acao').notNull(),
  antes: jsonb('antes'),
  depois: jsonb('depois'),
}, (t) => [index('evento_entidade_idx').on(t.entidade, t.entidadeId)]);

// ---------- R5: idempotência ----------
export const chaveIdempotencia = pgTable('chave_idempotencia', {
  chave: uuid('chave').notNull(),
  consumidor: text('consumidor').notNull(),        // id do usuário ou 'publico:<ip>'
  operacao: text('operacao').notNull(),
  hashRequisicao: text('hash_requisicao').notNull(),
  resposta: jsonb('resposta').notNull(),
  criadaEm: criadoEm(),
}, (t) => [primaryKey({ columns: [t.consumidor, t.chave] })]);

// ---------- Medição (critério (d) da Fase 3) ----------
export const tempoLancamento = pgTable('tempo_lancamento', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull(),
  operacao: text('operacao').notNull(),
  duracaoMs: integer('duracao_ms').notNull(),
  registradoEm: criadoEm(),
});

// ---------- Limite de envios do cadastro público ----------
export const limiteEnvio = pgTable('limite_envio', {
  chave: text('chave').notNull(),                  // 'ip:<ip>' ou 'email:<email>'
  janela: timestamp('janela', { withTimezone: true }).notNull(),
  total: integer('total').notNull(),
}, (t) => [primaryKey({ columns: [t.chave, t.janela] })]);

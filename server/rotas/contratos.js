// Contratos, prazo, suspensões, entrega, aceite, parcelas e manutenção.
// Regras tiradas do contrato do 1º cliente (Contrato_TheKings_Arkosys.pdf):
//   cl. 3.2 parcelas e gatilhos; cl. 4.1 prazo contado do 1º pagamento;
//   cl. 4.2 suspensão; cl. 4.5 aceite expresso, por decurso ou por uso real;
//   cl. 7.1 manutenção opcional; cl. 7.4 garantia contada do aceite.
// Os valores (30 dias, 5 dias úteis, 30 dias de garantia) são dados de cada contrato.
import { z } from 'zod';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { contrato, documento, manutencao, oportunidade, parcela, suspensaoPrazo } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { validar, UUID_RE } from '../core/validar.js';
import { exigirDocumento } from './documentos.js';
import { entregaPrevista, fimGarantia, paraData, paraIso, vencimentoParcela } from '../regras/prazos.js';

const DATA = z.iso.date();
const centavos = z.number().int().positive();

const esquemaContrato = z.object({
  oportunidadeId: z.string().regex(UUID_RE),
  objeto: z.string().trim().min(5).max(5000),
  valorTotalCentavos: centavos,
  moeda: z.literal('BRL').default('BRL'),
  dataAssinatura: DATA,
  prazoDiasCorridos: z.number().int().positive().max(3650),
  diasGarantia: z.number().int().min(0).max(3650),
  documentoContratoId: z.string().regex(UUID_RE),
  parcelas: z.array(z.object({
    descricao: z.string().trim().min(2).max(300),
    valorCentavos: centavos,
    gatilho: z.enum(['assinatura', 'entrega', 'aceite']),
    diasUteisAposGatilho: z.number().int().min(0).max(365),
  })).min(1).max(36),
});

async function carregarContrato(db, id, { travar = false } = {}) {
  if (!UUID_RE.test(id)) throw erros.naoEncontrado('Contrato');
  const q = db.select().from(contrato).where(eq(contrato.id, id));
  const [c] = travar ? await q.for('update') : await q;
  if (!c) throw erros.naoEncontrado('Contrato');
  return c;
}

/** Libera as parcelas de um gatilho: passam a "a receber" com vencimento calculado. */
async function liberarParcelas(db, registrar, contratoId, gatilho, dataGatilho) {
  const lista = await db.select().from(parcela)
    .where(and(eq(parcela.contratoId, contratoId), eq(parcela.gatilho, gatilho), eq(parcela.status, 'prevista')));
  for (const p of lista) {
    const [nova] = await db.update(parcela)
      .set({ status: 'a_receber', vencimento: paraIso(vencimentoParcela(p, dataGatilho)) })
      .where(eq(parcela.id, p.id)).returning();
    await registrar({ entidade: 'parcela', entidadeId: p.id, acao: `liberar:${gatilho}`, antes: p, depois: nova });
  }
}

async function mudarEstado(db, registrar, c, para, extra = {}) {
  const [novo] = await db.update(contrato).set({ estadoProjeto: para, atualizadoEm: new Date(), ...extra })
    .where(eq(contrato.id, c.id)).returning();
  await registrar({ entidade: 'contrato', entidadeId: c.id, acao: `estado:${c.estadoProjeto}->${para}`, antes: c, depois: novo });
  return novo;
}

export function resumoContrato(c, suspensoes, hoje) {
  return {
    ...c,
    entregaPrevista: paraIso(entregaPrevista(c, suspensoes, hoje)),
    fimGarantia: paraIso(fimGarantia(c)),
  };
}

export const rotasContratos = [
  {
    metodo: 'POST', caminho: '/api/contratos', escopo: 'contratos:escrever', escrita: true,
    operacao: 'criar_contrato', statusCriacao: 201,
    async executar({ db, dados, registrar }) {
      const d = validar(esquemaContrato, dados);
      const soma = d.parcelas.reduce((t, p) => t + p.valorCentavos, 0);
      if (soma !== d.valorTotalCentavos) throw erros.validacao('A soma das parcelas difere do valor total.', 'parcelas');

      const [op] = await db.select().from(oportunidade).where(eq(oportunidade.id, d.oportunidadeId)).for('update');
      if (!op) throw erros.naoEncontrado('Oportunidade');
      if (op.estado !== 'proposta_contrato_enviados') throw erros.transicaoInvalida(op.estado, 'contrato_assinado');
      const doc = await exigirDocumento(db, { id: d.documentoContratoId, tipos: ['contrato'], contatoId: op.contatoId });

      const [novo] = await db.insert(contrato).values({
        oportunidadeId: op.id, contatoId: op.contatoId, objeto: d.objeto,
        valorTotalCentavos: d.valorTotalCentavos, moeda: d.moeda, dataAssinatura: d.dataAssinatura,
        prazoDiasCorridos: d.prazoDiasCorridos, diasGarantia: d.diasGarantia,
        estadoProjeto: 'aguardando_primeiro_pagamento',
      }).returning();
      const parcelas = await db.insert(parcela).values(d.parcelas.map((p, i) => ({
        contratoId: novo.id, numero: i + 1, descricao: p.descricao, valorCentavos: p.valorCentavos,
        gatilho: p.gatilho, diasUteisAposGatilho: p.diasUteisAposGatilho,
        status: p.gatilho === 'assinatura' ? 'a_receber' : 'prevista',
        vencimento: p.gatilho === 'assinatura' ? paraIso(vencimentoParcela(p, d.dataAssinatura)) : null,
      }))).returning();
      await db.update(documento).set({ contratoId: novo.id }).where(eq(documento.id, doc.id));
      const [opNova] = await db.update(oportunidade).set({ estado: 'contrato_assinado', atualizadoEm: new Date() })
        .where(eq(oportunidade.id, op.id)).returning();

      await registrar({ entidade: 'contrato', entidadeId: novo.id, acao: 'criar', depois: { ...novo, parcelas } });
      await registrar({ entidade: 'oportunidade', entidadeId: op.id, acao: `estado:${op.estado}->contrato_assinado`, antes: op, depois: opNova });
      return { contrato: novo, parcelas };
    },
  },
  {
    metodo: 'GET', caminho: '/api/contratos', escopo: 'contratos:ler',
    async executar({ db, agora }) {
      const lista = await db.select().from(contrato).orderBy(desc(contrato.criadoEm));
      const susp = await db.select().from(suspensaoPrazo);
      return { itens: lista.map((c) => resumoContrato(c, susp.filter((s) => s.contratoId === c.id), agora)) };
    },
  },
  {
    metodo: 'GET', caminho: '/api/contratos/:id', escopo: 'contratos:ler',
    async executar({ db, params, agora }) {
      const c = await carregarContrato(db, params.id);
      const [suspensoes, parcelas, documentos, manutencoes] = await Promise.all([
        db.select().from(suspensaoPrazo).where(eq(suspensaoPrazo.contratoId, c.id)).orderBy(asc(suspensaoPrazo.inicio)),
        db.select().from(parcela).where(eq(parcela.contratoId, c.id)).orderBy(asc(parcela.numero)),
        db.select().from(documento).where(and(eq(documento.contratoId, c.id), isNull(documento.excluidoEm))),
        db.select().from(manutencao).where(eq(manutencao.contratoId, c.id)),
      ]);
      return { contrato: resumoContrato(c, suspensoes, agora), suspensoes, parcelas, documentos, manutencoes };
    },
  },
  {
    metodo: 'POST', caminho: '/api/parcelas/:id/pagamento', escopo: 'cobrancas:escrever', escrita: true,
    operacao: 'registrar_pagamento',
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({
        dataPagamento: DATA,
        meio: z.enum(['pix', 'cartao_credito', 'transferencia_internacional']),
        comprovanteDocumentoId: z.string().regex(UUID_RE).optional(),
      }), dados);
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Parcela');
      const [p] = await db.select().from(parcela).where(eq(parcela.id, params.id)).for('update');
      if (!p) throw erros.naoEncontrado('Parcela');
      if (p.status !== 'a_receber') throw erros.conflito(`Parcela está "${p.status}"; só parcela a receber pode ser paga.`, 'status');
      const c = await carregarContrato(db, p.contratoId, { travar: true });
      if (d.comprovanteDocumentoId) await exigirDocumento(db, { id: d.comprovanteDocumentoId, tipos: ['comprovante'], contatoId: c.contatoId });

      const [paga] = await db.update(parcela).set({
        status: 'paga', dataPagamento: d.dataPagamento, meio: d.meio, comprovanteDocumentoId: d.comprovanteDocumentoId ?? null,
      }).where(eq(parcela.id, p.id)).returning();
      await registrar({ entidade: 'parcela', entidadeId: p.id, acao: 'pagar', antes: p, depois: paga });

      // cl. 4.1: o prazo começa a contar com a confirmação do pagamento da 1ª parcela.
      let contratoAtual = c;
      if (p.numero === 1 && c.estadoProjeto === 'aguardando_primeiro_pagamento') {
        contratoAtual = await mudarEstado(db, registrar, c, 'em_desenvolvimento', { dataPrimeiroPagamento: d.dataPagamento });
      }
      return { parcela: paga, contrato: contratoAtual };
    },
  },
  {
    metodo: 'POST', caminho: '/api/parcelas/:id/vencimento', escopo: 'cobrancas:escrever', escrita: true,
    operacao: 'ajustar_vencimento',
    // O cálculo de dias úteis não conhece feriados (limitação declarada): o sócio corrige à mão,
    // com motivo obrigatório, e o ajuste fica no registro de eventos.
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({ vencimento: DATA, motivo: z.string().trim().min(3).max(500) }), dados);
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Parcela');
      const [p] = await db.select().from(parcela).where(eq(parcela.id, params.id)).for('update');
      if (!p) throw erros.naoEncontrado('Parcela');
      if (p.status !== 'a_receber') throw erros.conflito('Só parcela a receber tem vencimento ajustável.', 'status');
      const [nova] = await db.update(parcela).set({ vencimento: d.vencimento }).where(eq(parcela.id, p.id)).returning();
      await registrar({ entidade: 'parcela', entidadeId: p.id, acao: `ajustar_vencimento: ${d.motivo}`, antes: p, depois: nova });
      return { parcela: nova };
    },
  },
  {
    metodo: 'POST', caminho: '/api/contratos/:id/suspensoes', escopo: 'contratos:escrever', escrita: true,
    operacao: 'abrir_suspensao', statusCriacao: 201,
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({ inicio: DATA, motivo: z.string().trim().min(5).max(1000) }), dados);
      const c = await carregarContrato(db, params.id, { travar: true });
      if (c.estadoProjeto !== 'em_desenvolvimento') throw erros.transicaoInvalida(c.estadoProjeto, 'prazo_suspenso');
      if (paraData(d.inicio) < paraData(c.dataPrimeiroPagamento)) throw erros.validacao('A suspensão não pode começar antes do início do prazo.', 'inicio');
      const [s] = await db.insert(suspensaoPrazo).values({ contratoId: c.id, inicio: d.inicio, motivo: d.motivo }).returning();
      await registrar({ entidade: 'suspensao_prazo', entidadeId: s.id, acao: 'abrir', depois: s });
      const novo = await mudarEstado(db, registrar, c, 'prazo_suspenso');
      return { suspensao: s, contrato: novo };
    },
  },
  {
    metodo: 'POST', caminho: '/api/suspensoes/:id/encerrar', escopo: 'contratos:escrever', escrita: true,
    operacao: 'encerrar_suspensao',
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({ fim: DATA }), dados);
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Suspensão');
      const [s] = await db.select().from(suspensaoPrazo).where(eq(suspensaoPrazo.id, params.id)).for('update');
      if (!s || s.fim) throw erros.naoEncontrado('Suspensão aberta');
      if (paraData(d.fim) < paraData(s.inicio)) throw erros.validacao('O fim não pode ser anterior ao início.', 'fim');
      const [fechada] = await db.update(suspensaoPrazo).set({ fim: d.fim }).where(eq(suspensaoPrazo.id, s.id)).returning();
      await registrar({ entidade: 'suspensao_prazo', entidadeId: s.id, acao: 'encerrar', antes: s, depois: fechada });
      const c = await carregarContrato(db, s.contratoId, { travar: true });
      const novo = await mudarEstado(db, registrar, c, 'em_desenvolvimento');
      return { suspensao: fechada, contrato: novo };
    },
  },
  {
    metodo: 'POST', caminho: '/api/contratos/:id/entrega', escopo: 'contratos:escrever', escrita: true,
    operacao: 'comunicar_entrega',
    // cl. 4.3: a entrega é comunicada por escrito; abre o prazo de testes do cliente.
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({ data: DATA }), dados);
      const c = await carregarContrato(db, params.id, { travar: true });
      if (c.estadoProjeto !== 'em_desenvolvimento') throw erros.transicaoInvalida(c.estadoProjeto, 'aguardando_aceite');
      const novo = await mudarEstado(db, registrar, c, 'aguardando_aceite', { dataComunicacaoEntrega: d.data });
      await liberarParcelas(db, registrar, c.id, 'entrega', d.data);
      return { contrato: novo };
    },
  },
  {
    metodo: 'POST', caminho: '/api/contratos/:id/aceite', escopo: 'contratos:escrever', escrita: true,
    operacao: 'registrar_aceite',
    // cl. 4.5: aceite expresso exige o termo de recebimento; aceite tácito (decurso ou uso real)
    // exige a evidência (ex.: print da conversa, registro de uso). Decisão aprovada no Parecer.
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({
        tipo: z.enum(['expresso', 'decurso_prazo', 'uso_real']),
        data: DATA,
        documentoId: z.string().regex(UUID_RE),
      }), dados);
      const c = await carregarContrato(db, params.id, { travar: true });
      if (c.estadoProjeto !== 'aguardando_aceite') throw erros.transicaoInvalida(c.estadoProjeto, 'entregue');
      if (paraData(d.data) < paraData(c.dataComunicacaoEntrega)) throw erros.validacao('O aceite não pode ser anterior à comunicação da entrega.', 'data');
      const tipos = d.tipo === 'expresso' ? ['termo_recebimento'] : ['evidencia_aceite', 'termo_recebimento'];
      const doc = await exigirDocumento(db, { id: d.documentoId, tipos, contatoId: c.contatoId });
      await db.update(documento).set({ contratoId: c.id }).where(eq(documento.id, doc.id));
      const novo = await mudarEstado(db, registrar, c, 'entregue', { tipoAceite: d.tipo, dataAceite: d.data });
      await liberarParcelas(db, registrar, c.id, 'aceite', d.data);
      return { contrato: novo };
    },
  },
  {
    metodo: 'POST', caminho: '/api/contratos/:id/manutencao', escopo: 'contratos:escrever', escrita: true,
    operacao: 'registrar_manutencao', statusCriacao: 201,
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({
        valorMensalCentavos: centavos, inicio: DATA, diaVencimento: z.number().int().min(1).max(28),
      }), dados);
      const c = await carregarContrato(db, params.id);
      const [ativa] = await db.select().from(manutencao).where(and(eq(manutencao.contratoId, c.id), eq(manutencao.ativo, true)));
      if (ativa) throw erros.conflito('Este contrato já tem manutenção ativa.', 'manutencao');
      const [m] = await db.insert(manutencao).values({ contratoId: c.id, ...d }).returning();
      await registrar({ entidade: 'manutencao', entidadeId: m.id, acao: 'criar', depois: m });
      return { manutencao: m };
    },
  },
  {
    metodo: 'POST', caminho: '/api/manutencoes/:id/encerrar', escopo: 'contratos:escrever', escrita: true,
    operacao: 'encerrar_manutencao',
    async executar({ db, params, dados, registrar }) {
      const d = validar(z.object({ fim: DATA }), dados);
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Manutenção');
      const [m] = await db.select().from(manutencao).where(eq(manutencao.id, params.id)).for('update');
      if (!m || !m.ativo) throw erros.naoEncontrado('Manutenção ativa');
      const [fim] = await db.update(manutencao).set({ ativo: false, fim: d.fim }).where(eq(manutencao.id, m.id)).returning();
      await registrar({ entidade: 'manutencao', entidadeId: m.id, acao: 'encerrar', antes: m, depois: fim });
      return { manutencao: fim };
    },
  },
];

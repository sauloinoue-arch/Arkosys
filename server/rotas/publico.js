// Rotas públicas do site: tabela de preços, cadastro (e-mail antes do orçamento) e orçamento.
// Todo conteúdo que chega daqui é de terceiro desconhecido: é DADO, guardado como texto,
// nunca interpretado (PromptInjectionDefenseModule, regra 1). Nenhuma ação externa é disparada.
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { contato, oportunidade, orcamento, tabelaPreco } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { validar, UUID_RE } from '../core/validar.js';
import { consumirLimite, ipDaRequisicao, LIMITES } from '../core/limite.js';

// Texto aprovado pelo usuário em 17/11/2026 (etapa 5).
export const AVISO_ORCAMENTO = 'Este orçamento é uma estimativa inicial, sem caráter vinculante. Escopo, valores e prazos podem ser alterados conforme o que for definido na reunião e só se tornam obrigatórios com a assinatura do contrato.';

// Versão do aviso de privacidade exibida no cadastro. RASCUNHO pendente de aprovação do usuário.
export const VERSAO_AVISO_PRIVACIDADE = 'rascunho-2026-11-19';

// Parcelamento exibido no simulador: "12x" com acréscimo de 15% (Simulator.jsx, linha 134, versão anterior).
export const PARCELAMENTO = Object.freeze({ vezes: 12, fatorAcrescimo: 1.15 });

const publico = (request) => ({ id: null, tipo: 'publico', chaveLimite: ipDaRequisicao(request) });

async function tabelaVigente(db) {
  const [ultima] = await db.select({ versao: tabelaPreco.versao }).from(tabelaPreco)
    .where(eq(tabelaPreco.ativo, true)).orderBy(desc(tabelaPreco.versao)).limit(1);
  if (!ultima) return { versao: null, itens: [] };
  const itens = await db.select().from(tabelaPreco).where(and(eq(tabelaPreco.versao, ultima.versao), eq(tabelaPreco.ativo, true)));
  return { versao: ultima.versao, itens };
}

export const rotasPublicas = [
  {
    metodo: 'GET', caminho: '/api/publico/precos', publica: true,
    async executar({ db }) {
      const { versao, itens } = await tabelaVigente(db);
      return {
        versao,
        base: itens.filter((i) => i.base).map(({ codigo, nome, descricao, precoCentavos }) => ({ codigo, nome, descricao, precoCentavos }))[0] ?? null,
        adicionais: itens.filter((i) => !i.base).map(({ codigo, nome, descricao, precoCentavos }) => ({ codigo, nome, descricao, precoCentavos })),
        parcelamento: PARCELAMENTO,
        avisoOrcamento: AVISO_ORCAMENTO,
        versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
      };
    },
  },
  {
    metodo: 'POST', caminho: '/api/publico/cadastro', publica: true, escrita: true,
    operacao: 'cadastro_site', statusCriacao: 201, consumidorPublico: publico,
    async executar({ db, dados, request, agora, registrar }) {
      const d = validar(z.object({
        nome: z.string().trim().min(2).max(200),
        email: z.string().trim().toLowerCase().email().max(254),
        telefone: z.string().trim().max(40).optional(),
        aceitePrivacidade: z.literal(true, { message: 'É preciso aceitar o aviso de privacidade.' }),
        versaoAvisoPrivacidade: z.literal(VERSAO_AVISO_PRIVACIDADE),
      }), dados);
      await consumirLimite(db, `ip:${ipDaRequisicao(request)}`, LIMITES.cadastroPorIp, agora);
      await consumirLimite(db, `email:${d.email}`, LIMITES.cadastroPorEmail, agora);

      let [c] = await db.select().from(contato).where(eq(contato.email, d.email));
      if (!c) {
        [c] = await db.insert(contato).values({
          nome: d.nome, email: d.email, telefone: d.telefone, origem: 'site_simulador',
          consentimentoPrivacidadeEm: agora, versaoAvisoPrivacidade: d.versaoAvisoPrivacidade,
        }).returning();
        await registrar({ entidade: 'contato', entidadeId: c.id, acao: 'cadastro_site', depois: c });
      }
      // E-mail já existente: não revela nada; abre nova oportunidade no mesmo contato.
      const [op] = await db.insert(oportunidade).values({ contatoId: c.id, estado: 'cadastro_site', origem: 'site_simulador' }).returning();
      await registrar({ entidade: 'oportunidade', entidadeId: op.id, acao: 'criar', depois: op });
      return { cadastro: op.id };
    },
  },
  {
    metodo: 'POST', caminho: '/api/publico/orcamento', publica: true, escrita: true,
    operacao: 'gerar_orcamento', statusCriacao: 201, consumidorPublico: publico,
    async executar({ db, dados, request, agora, registrar }) {
      const d = validar(z.object({
        cadastro: z.string().regex(UUID_RE),
        adicionais: z.array(z.string().max(40)).max(20),
      }), dados);
      await consumirLimite(db, `ip-orcamento:${ipDaRequisicao(request)}`, LIMITES.orcamentoPorIp, agora);
      const [op] = await db.select().from(oportunidade).where(eq(oportunidade.id, d.cadastro)).for('update');
      if (!op || !['cadastro_site', 'orcamento_gerado'].includes(op.estado)) throw erros.naoEncontrado('Cadastro');

      // R1: o preço e o total são calculados aqui, com a tabela vigente — nunca na tela.
      const { versao, itens } = await tabelaVigente(db);
      const base = itens.find((i) => i.base);
      const escolhidos = itens.filter((i) => !i.base && d.adicionais.includes(i.codigo));
      if (escolhidos.length !== new Set(d.adicionais).size) throw erros.validacao('Item de orçamento inexistente.', 'adicionais');
      const linhas = [base, ...escolhidos].map(({ codigo, nome, precoCentavos }) => ({ codigo, nome, precoCentavos }));
      const total = linhas.reduce((t, i) => t + i.precoCentavos, 0);

      const [orc] = await db.insert(orcamento).values({
        contatoId: op.contatoId, oportunidadeId: op.id, itens: linhas, totalCentavos: total, versaoTabela: versao, textoAviso: AVISO_ORCAMENTO,
      }).returning();
      await registrar({ entidade: 'orcamento', entidadeId: orc.id, acao: 'gerar', depois: orc });
      if (op.estado === 'cadastro_site') {
        const [nova] = await db.update(oportunidade).set({ estado: 'orcamento_gerado', atualizadoEm: new Date() }).where(eq(oportunidade.id, op.id)).returning();
        await registrar({ entidade: 'oportunidade', entidadeId: op.id, acao: 'estado:cadastro_site->orcamento_gerado', antes: op, depois: nova });
      }
      const parcelaCartaoCentavos = Math.round((total * PARCELAMENTO.fatorAcrescimo) / PARCELAMENTO.vezes);
      return { orcamento: { id: orc.id, itens: linhas, totalCentavos: total, parcelamento: { ...PARCELAMENTO, parcelaCentavos: parcelaCartaoCentavos }, aviso: AVISO_ORCAMENTO } };
    },
  },
];


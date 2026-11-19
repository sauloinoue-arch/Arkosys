// Contatos (R3: origem obrigatória e id externo da conversa).
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { contato, oportunidade } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { validar } from '../core/validar.js';
import { ESTADOS_ENTRADA, proximosEstados } from '../regras/funil.js';
import { contrato, orcamento } from '../db/schema.js';

const ORIGENS_MANUAIS = ['ia_generativa', 'instagram', 'google_ads', 'whatsapp', 'indicacao', 'presencial'];

const esquemaNovoContato = z.object({
  nome: z.string().trim().min(2).max(200),
  nomeComercial: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  telefone: z.string().trim().max(40).optional(),
  pais: z.string().trim().max(80).optional(),
  cidade: z.string().trim().max(120).optional(),
  origem: z.enum(ORIGENS_MANUAIS),
  origemDetalhe: z.string().trim().max(500).optional(),
  idConversaExterna: z.string().trim().max(200).optional(),
  textoExterno: z.string().max(10_000).optional(),
});

export const rotasContatos = [
  {
    metodo: 'POST', caminho: '/api/contatos', escopo: 'contatos:escrever', escrita: true,
    operacao: 'criar_contato', statusCriacao: 201,
    // Cria o contato e a oportunidade de entrada ('contato_recebido') na mesma transação.
    async executar({ db, dados, registrar }) {
      const d = validar(esquemaNovoContato, dados);
      if (d.email) {
        const [existe] = await db.select({ id: contato.id }).from(contato).where(eq(contato.email, d.email));
        if (existe) throw erros.conflito('Já existe contato com este e-mail.', 'email');
      }
      const { textoExterno, ...camposContato } = d;
      const [novo] = await db.insert(contato).values(camposContato).returning();
      const [op] = await db.insert(oportunidade).values({
        contatoId: novo.id, estado: ESTADOS_ENTRADA.outros, origem: d.origem,
        idConversaExterna: d.idConversaExterna, textoExterno,
      }).returning();
      await registrar({ entidade: 'contato', entidadeId: novo.id, acao: 'criar', depois: novo });
      await registrar({ entidade: 'oportunidade', entidadeId: op.id, acao: 'criar', depois: op });
      return { contato: novo, oportunidade: op };
    },
  },
  {
    metodo: 'GET', caminho: '/api/contatos', escopo: 'contatos:ler',
    async executar({ db }) {
      return { itens: await db.select().from(contato).orderBy(desc(contato.criadoEm)).limit(500) };
    },
  },
  {
    metodo: 'GET', caminho: '/api/contatos/:id', escopo: 'contatos:ler',
    async executar({ db, params }) {
      const [c] = await db.select().from(contato).where(eq(contato.id, params.id));
      if (!c) throw erros.naoEncontrado('Contato');
      const ops = await db.select().from(oportunidade).where(eq(oportunidade.contatoId, c.id));
      const contratos = await db.select({ id: contrato.id, oportunidadeId: contrato.oportunidadeId, estadoProjeto: contrato.estadoProjeto })
        .from(contrato).where(eq(contrato.contatoId, c.id));
      const orcamentos = await db.select().from(orcamento).where(eq(orcamento.contatoId, c.id));
      return {
        contato: c,
        oportunidades: ops.map((o) => ({ ...o, proximosEstados: proximosEstados(o), podeRegistrarContrato: o.estado === 'proposta_contrato_enviados' })),
        contratos, orcamentos, podeLiberarAcesso: contratos.length > 0 && Boolean(c.email),
      };
    },
  },
];

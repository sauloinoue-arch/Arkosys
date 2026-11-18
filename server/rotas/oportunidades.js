// Oportunidades e mudança de estado do funil (Parecer, item 5).
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { oportunidade } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { validar, UUID_RE } from '../core/validar.js';
import { transicaoPermitida } from '../regras/funil.js';

const esquemaMudanca = z.object({
  // 'contrato_assinado' não entra aqui: só a rota de registro do contrato (lote 2) faz essa
  // transição, porque ela exige o contrato e o documento assinado.
  // 'orcamento_gerado' também não: só o simulador do site gera orçamento.
  para: z.enum(['reuniao_agendada', 'reuniao_realizada', 'proposta_contrato_enviados',
    'aguardando_retorno', 'desistiu', 'cadastro_site', 'contato_recebido']),
  dataReuniao: z.iso.datetime({ offset: true }).optional(),
  motivoDesistencia: z.string().trim().max(1000).optional(),
});

export const rotasOportunidades = [
  {
    metodo: 'GET', caminho: '/api/oportunidades', escopo: 'oportunidades:ler',
    async executar({ db, query }) {
      const estado = query.get('estado');
      const base = db.select().from(oportunidade);
      const itens = estado ? await base.where(eq(oportunidade.estado, estado)).orderBy(asc(oportunidade.criadoEm))
        : await base.orderBy(asc(oportunidade.criadoEm));
      return { itens };
    },
  },
  {
    metodo: 'POST', caminho: '/api/oportunidades/:id/estado', escopo: 'oportunidades:escrever', escrita: true,
    operacao: 'mudar_estado_oportunidade',
    async executar({ db, params, dados, registrar }) {
      if (!UUID_RE.test(params.id)) throw erros.naoEncontrado('Oportunidade');
      const d = validar(esquemaMudanca, dados);
      const [atual] = await db.select().from(oportunidade).where(eq(oportunidade.id, params.id)).for('update');
      if (!atual) throw erros.naoEncontrado('Oportunidade');
      if (!transicaoPermitida({ de: atual.estado, para: d.para, estadoAnterior: atual.estadoAnterior })) {
        throw erros.transicaoInvalida(atual.estado, d.para);
      }
      if (d.para === 'reuniao_agendada' && !d.dataReuniao) throw erros.validacao('Informe a data da reunião.', 'dataReuniao');

      const mudancas = {
        estado: d.para,
        estadoAnterior: d.para === 'aguardando_retorno' ? atual.estado : null,
        atualizadoEm: new Date(),
      };
      if (d.dataReuniao) mudancas.dataReuniao = new Date(d.dataReuniao);
      if (d.para === 'desistiu') mudancas.motivoDesistencia = d.motivoDesistencia ?? null;

      const [nova] = await db.update(oportunidade).set(mudancas).where(eq(oportunidade.id, atual.id)).returning();
      await registrar({ entidade: 'oportunidade', entidadeId: atual.id, acao: `estado:${atual.estado}->${d.para}`, antes: atual, depois: nova });
      return { oportunidade: nova };
    },
  },
];

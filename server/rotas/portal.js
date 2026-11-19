// Portal do cliente (aprovado em 17/11/2026): status do projeto, data prevista de entrega,
// parcelas e os documentos dele. Nada além disso. O cliente só enxerga o próprio contato.
import { and, asc, eq, isNull } from 'drizzle-orm';
import { contrato, documento, parcela, suspensaoPrazo } from '../db/schema.js';
import { erros } from '../core/erros.js';
import { UUID_RE } from '../core/validar.js';
import { entregaPrevista, paraIso } from '../regras/prazos.js';

const TIPOS_VISIVEIS = ['proposta', 'contrato', 'termo_recebimento', 'aditivo'];

export const rotasPortal = [
  {
    metodo: 'GET', caminho: '/api/portal/meu-projeto', escopo: 'portal:ler_proprio',
    async executar({ db, consumidor, agora }) {
      if (!consumidor.clienteId) return { projetos: [] };
      const contratos = await db.select().from(contrato).where(eq(contrato.contatoId, consumidor.clienteId));
      const projetos = [];
      for (const c of contratos) {
        const susp = await db.select().from(suspensaoPrazo).where(eq(suspensaoPrazo.contratoId, c.id));
        const parcelas = await db.select({
          numero: parcela.numero, descricao: parcela.descricao, valorCentavos: parcela.valorCentavos,
          vencimento: parcela.vencimento, status: parcela.status,
        }).from(parcela).where(eq(parcela.contratoId, c.id)).orderBy(asc(parcela.numero));
        const docs = (await db.select({ id: documento.id, tipo: documento.tipo, nomeArquivo: documento.nomeArquivo, criadoEm: documento.criadoEm })
          .from(documento).where(and(eq(documento.contratoId, c.id), eq(documento.confirmado, true), isNull(documento.excluidoEm))))
          .filter((d) => TIPOS_VISIVEIS.includes(d.tipo));
        projetos.push({
          id: c.id, objeto: c.objeto, estadoProjeto: c.estadoProjeto,
          entregaPrevista: paraIso(entregaPrevista(c, susp, agora)), dataAceite: c.dataAceite,
          parcelas, documentos: docs,
        });
      }
      return { projetos };
    },
  },
  {
    metodo: 'GET', caminho: '/api/portal/documentos/:id/download', escopo: 'portal:ler_proprio',
    async executar({ db, params, consumidor, armazenamento }) {
      if (!UUID_RE.test(params.id) || !consumidor.clienteId) throw erros.naoEncontrado('Documento');
      const [d] = await db.select().from(documento).where(eq(documento.id, params.id));
      // Documento de outro cliente responde "não encontrado", sem revelar que existe.
      if (!d || d.contatoId !== consumidor.clienteId || !d.confirmado || d.excluidoEm || !TIPOS_VISIVEIS.includes(d.tipo)) {
        throw erros.naoEncontrado('Documento');
      }
      return armazenamento.linkDownload(d.caminho, d.nomeArquivo);
    },
  },
];

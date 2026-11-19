// Painel de alertas (Parecer, item 8, tela 2). Só leitura: nenhum alerta envia
// mensagem a cliente nem altera dado (Restrição 10). Não há limiar inventado:
// a lista mostra quantos dias faltam (negativo = atrasado) e a tela ordena por urgência.
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { contato, contrato, documento, manutencao, parcela, suspensaoPrazo } from '../db/schema.js';
import { diferencaDias, entregaPrevista, fimGarantia, paraData, paraIso } from '../regras/prazos.js';

const UMA_HORA_MS = 3_600_000; // Parecer, item 14: documento sem confirmação após 1 hora vira alerta

function proximoVencimentoMensal(diaVencimento, hoje) {
  const a = hoje.getUTCFullYear(); const m = hoje.getUTCMonth();
  const desteMes = new Date(Date.UTC(a, m, diaVencimento));
  return desteMes >= new Date(Date.UTC(a, m, hoje.getUTCDate())) ? desteMes : new Date(Date.UTC(a, m + 1, diaVencimento));
}

export const rotasAlertas = [
  {
    metodo: 'GET', caminho: '/api/alertas', escopo: 'contratos:ler',
    async executar({ db, agora }) {
      const hoje = paraData(agora.toISOString());
      const nomes = Object.fromEntries((await db.select({ id: contato.id, nome: contato.nome }).from(contato)).map((c) => [c.id, c.nome]));
      const alertas = [];

      const abertos = await db.select().from(contrato)
        .where(inArray(contrato.estadoProjeto, ['em_desenvolvimento', 'prazo_suspenso', 'aguardando_primeiro_pagamento', 'entregue']));
      const susp = await db.select().from(suspensaoPrazo);
      for (const c of abertos) {
        const cliente = nomes[c.contatoId];
        if (c.estadoProjeto === 'em_desenvolvimento' || c.estadoProjeto === 'prazo_suspenso') {
          const prev = entregaPrevista(c, susp.filter((s) => s.contratoId === c.id), hoje);
          alertas.push({ tipo: 'prazo_entrega', contratoId: c.id, cliente, data: paraIso(prev), diasRestantes: diferencaDias(hoje, prev), suspenso: c.estadoProjeto === 'prazo_suspenso' });
        }
        if (c.estadoProjeto === 'entregue') {
          const fim = fimGarantia(c);
          const dias = diferencaDias(hoje, fim);
          // Fim da garantia também marca o fim do papel de operadora (cl. 9.2(b)) — devolver ou apagar dados.
          if (dias >= 0) alertas.push({ tipo: 'fim_garantia', contratoId: c.id, cliente, data: paraIso(fim), diasRestantes: dias });
        }
      }

      const aReceber = await db.select().from(parcela).where(eq(parcela.status, 'a_receber'));
      const contratosPorId = Object.fromEntries((await db.select().from(contrato)).map((c) => [c.id, c]));
      for (const p of aReceber) {
        const venc = paraData(p.vencimento);
        alertas.push({
          tipo: 'parcela_a_receber', parcelaId: p.id, contratoId: p.contratoId,
          cliente: nomes[contratosPorId[p.contratoId]?.contatoId], valorCentavos: p.valorCentavos,
          data: p.vencimento, diasRestantes: venc ? diferencaDias(hoje, venc) : null,
        });
      }

      for (const m of await db.select().from(manutencao).where(eq(manutencao.ativo, true))) {
        const venc = proximoVencimentoMensal(m.diaVencimento, hoje);
        alertas.push({ tipo: 'manutencao', manutencaoId: m.id, contratoId: m.contratoId, cliente: nomes[contratosPorId[m.contratoId]?.contatoId], valorCentavos: m.valorMensalCentavos, data: paraIso(venc), diasRestantes: diferencaDias(hoje, venc) });
      }

      const pendentes = await db.select().from(documento)
        .where(and(eq(documento.confirmado, false), isNull(documento.excluidoEm), lt(documento.criadoEm, new Date(agora.getTime() - UMA_HORA_MS))));
      for (const d of pendentes) alertas.push({ tipo: 'documento_sem_confirmacao', documentoId: d.id, cliente: nomes[d.contatoId], nomeArquivo: d.nomeArquivo });

      alertas.sort((a, b) => (a.diasRestantes ?? -9999) - (b.diasRestantes ?? -9999));
      return { geradoEm: agora.toISOString(), itens: alertas };
    },
  },
];

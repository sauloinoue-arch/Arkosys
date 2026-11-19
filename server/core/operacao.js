// Toda escrita passa por aqui. Numa única transação:
//   1. confere a chave de idempotência (R5);
//   2. executa a regra de negócio;
//   3. grava os eventos (R4);
//   4. guarda a resposta associada à chave.
// Se qualquer passo falhar, nada é gravado.
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { chaveIdempotencia, evento } from '../db/schema.js';
import { erros } from './erros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashCanonico(valor) {
  const ordenar = (v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, k) => ({ ...o, [k]: ordenar(v[k]) }), {})
    : Array.isArray(v) ? v.map(ordenar) : v);
  return createHash('sha256').update(JSON.stringify(ordenar(valor ?? null))).digest('hex');
}

/**
 * @param {object} db         instância Drizzle
 * @param {object} p
 * @param {object} p.consumidor  { id, tipo, escopos } ou { id: null, tipo: 'publico', chaveLimite }
 * @param {string} p.chave       Idempotency-Key (uuid)
 * @param {string} p.operacao    nome da operação, ex.: 'criar_contato'
 * @param {object} p.dados       corpo da requisição (entra no hash)
 * @param {string} p.via         painel | portal | site | api | agente
 * @param {(tx, registrar) => Promise<object>} p.executar
 * @returns {Promise<{ resposta: object, repetida: boolean }>}
 */
export async function executarEscrita(db, { consumidor, chave, operacao, dados, via, executar }) {
  if (!chave || !UUID.test(chave)) throw erros.chaveAusente();
  const consumidorChave = consumidor.id ?? `publico:${consumidor.chaveLimite}`;
  const hashRequisicao = hashCanonico({ operacao, dados });

  return db.transaction(async (tx) => {
    const [existente] = await tx.select().from(chaveIdempotencia)
      .where(and(eq(chaveIdempotencia.consumidor, consumidorChave), eq(chaveIdempotencia.chave, chave)));
    if (existente) {
      if (existente.hashRequisicao !== hashRequisicao || existente.operacao !== operacao) throw erros.chaveReutilizada();
      return { resposta: existente.resposta, repetida: true };
    }

    const registrar = async ({ entidade, entidadeId, acao, antes = null, depois = null }) => {
      await tx.insert(evento).values({
        atorId: consumidor.id ?? null,
        atorTipo: consumidor.tipo,
        via,
        entidade,
        entidadeId,
        acao,
        antes,
        depois,
      });
    };

    const bruta = await executar(tx, registrar);
    // Campos sensíveis (ex.: link de convite) voltam só na primeira resposta e não ficam guardados.
    const { _naoGuardar = [], ...resposta } = bruta ?? {};
    const guardada = Object.fromEntries(Object.entries(resposta).filter(([k]) => !_naoGuardar.includes(k)));

    await tx.insert(chaveIdempotencia).values({
      chave, consumidor: consumidorChave, operacao, hashRequisicao, resposta: guardada,
    });
    return { resposta, repetida: false };
  });
}

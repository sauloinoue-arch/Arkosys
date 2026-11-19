// Roteador único da API (uma função Vercel, ver api/index.js).
// R1: toda regra de negócio está nos módulos de `server/rotas`; a tela só chama estes endereços.
import { sql } from 'drizzle-orm';
import { ErroApi, erros } from './core/erros.js';
import { exigirEscopo } from './core/escopos.js';
import { executarEscrita } from './core/operacao.js';
import { tempoLancamento } from './db/schema.js';
import { rotasContatos } from './rotas/contatos.js';
import { rotasOportunidades } from './rotas/oportunidades.js';
import { rotasDocumentos } from './rotas/documentos.js';
import { rotasContratos } from './rotas/contratos.js';
import { rotasAlertas } from './rotas/alertas.js';

const json = (status, corpo) => new Response(JSON.stringify(corpo), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function compilar(caminho) {
  const nomes = [];
  const regex = new RegExp(`^${caminho.replace(/:(\w+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; })}$`);
  return (path) => {
    const m = regex.exec(path);
    return m ? Object.fromEntries(nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])])) : null;
  };
}

/**
 * @param {object} cfg
 * @param {object} cfg.db                       Drizzle
 * @param {(req: Request) => Promise<object|null>} cfg.resolverConsumidor
 * @param {() => Date} [cfg.agora]
 */
export function criarApp({ db, resolverConsumidor, armazenamento = null, agora = () => new Date() }) {
  const rotas = [...rotasContatos, ...rotasOportunidades, ...rotasDocumentos, ...rotasContratos, ...rotasAlertas].map((r) => ({ ...r, casar: compilar(r.caminho) }));

  async function handle(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '');
      const rota = rotas.find((r) => r.metodo === request.method && r.casar(path));
      // Verificação de saúde: confirma que a API sobe e que a conexão com o banco funciona.
      // Pública e sem dados — devolve só "ok" e o tempo da consulta.
      if (request.method === 'GET' && path === '/api/saude') {
        const inicio = Date.now();
        await db.execute(sql`select 1`);
        return json(200, { status: 'ok', banco: 'ok', ms: Date.now() - inicio });
      }
      if (!rota) return json(404, { codigo: 'rota_inexistente', mensagem: 'Endereço não encontrado.', campo: null });
      const params = rota.casar(path);

      const consumidor = rota.publica ? null : await resolverConsumidor(request);
      if (!rota.publica) exigirEscopo(consumidor, rota.escopo);

      let dados = null;
      if (rota.escrita) {
        try { dados = await request.json(); } catch { throw erros.validacao('Corpo JSON inválido.', null); }
      }
      const via = definirVia(consumidor, request.headers.get('x-via'));
      const ctx = { db, consumidor, params, query: url.searchParams, dados, agora: agora(), request, via, armazenamento };

      if (!rota.escrita) return json(200, await rota.executar(ctx));

      const { resposta, repetida } = await executarEscritaComRetentativa(db, {
        consumidor: consumidor ?? rota.consumidorPublico(request),
        chave: request.headers.get('idempotency-key'),
        operacao: rota.operacao,
        dados: { params, dados },
        via,
        executar: (tx, registrar) => rota.executar({ ...ctx, db: tx, registrar }),
      });

      // Medição (Parecer, item 10): tempo entre abrir e salvar o formulário do painel.
      const duracao = Number(request.headers.get('x-duracao-preenchimento-ms'));
      if (!repetida && consumidor && via === 'painel' && Number.isInteger(duracao) && duracao > 0) {
        await db.insert(tempoLancamento).values({ usuarioId: consumidor.id, operacao: rota.operacao, duracaoMs: duracao });
      }
      return json(repetida ? 200 : rota.statusCriacao ?? 200, resposta);
    } catch (e) {
      if (e instanceof ErroApi) return json(e.status, e.corpo());
      // Registra a causa técnica (código e mensagem do banco), nunca credenciais.
      // Só o código técnico e mensagens nossas. A mensagem bruta do driver pode conter
      // trechos do endereço do banco (e, se ele estiver malformado, da senha).
      const codigo = e?.cause?.code ?? e?.code ?? 'sem_codigo';
      const nossa = String(e?.message ?? '').startsWith('DATABASE_URL') ? e.message : '';
      console.error('[api] erro inesperado | código:', codigo, nossa);
      return json(500, { codigo: 'erro_interno', mensagem: 'Erro interno.', campo: null });
    }
  }
  return { handle };
}

// R4 "por qual via": a via não é escolhida livremente pelo chamador.
// Agente grava sempre 'agente'; cliente, 'portal'; público, 'site'; sócio, 'painel' ou 'api'.
function definirVia(consumidor, declarada) {
  if (!consumidor) return 'site';
  if (consumidor.tipo === 'agente') return 'agente';
  if (consumidor.tipo === 'cliente') return 'portal';
  return declarada === 'painel' ? 'painel' : 'api';
}

// Duas chamadas simultâneas com a mesma chave: a segunda colide na chave primária
// de `chave_idempotencia`, a transação dela é desfeita e ela é repetida uma vez,
// já encontrando a resposta gravada pela primeira.
async function executarEscritaComRetentativa(db, args) {
  try {
    return await executarEscrita(db, args);
  } catch (e) {
    const codigo = e?.code ?? e?.cause?.code;
    if (codigo === '23505' && String(e?.constraint_name ?? e?.cause?.constraint_name ?? e?.message).includes('chave_idempotencia')) {
      return executarEscrita(db, args);
    }
    throw e;
  }
}

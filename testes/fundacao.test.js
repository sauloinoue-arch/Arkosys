// Testes da fundação (Lote 1): R1 a R5 e regras do funil e de prazos.
// Rodam contra um Postgres real em memória (PGlite), com as mesmas migrações de produção.
// Executar: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../server/db/schema.js';
import { criarApp } from '../server/app.js';
import { carregarConsumidor } from '../server/core/auth.js';
import { ESCOPOS_PADRAO } from '../server/core/escopos.js';
import { entregaPrevista, vencimentoParcela, fimGarantia, paraIso, paraData } from '../server/regras/prazos.js';

let db, app;
const ids = { socio: randomUUID(), leitor: randomUUID(), cliente: randomUUID() };

before(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: './server/db/migracoes' });
  const { usuario, usuarioEscopo } = schema;
  await db.insert(usuario).values([
    { id: ids.socio, nome: 'Sócio Teste', email: 'socio@teste.local', tipo: 'socio', area: 'juridico' },
    { id: ids.leitor, nome: 'Somente Leitura', email: 'leitor@teste.local', tipo: 'socio', area: 'desenvolvimento' },
    { id: ids.cliente, nome: 'Cliente Teste', email: 'cliente@teste.local', tipo: 'cliente' },
  ]);
  await db.insert(usuarioEscopo).values([
    ...ESCOPOS_PADRAO.socio.map((escopo) => ({ usuarioId: ids.socio, escopo })),
    { usuarioId: ids.leitor, escopo: 'contatos:ler' },
    ...ESCOPOS_PADRAO.cliente.map((escopo) => ({ usuarioId: ids.cliente, escopo })),
  ]);
  // Em teste, o "token" é o próprio id do usuário; em produção, o resolvedor valida no Supabase.
  app = criarApp({
    db,
    resolverConsumidor: async (req) => {
      const t = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
      return t ? carregarConsumidor(db, t) : null;
    },
  });
});

async function chamar(metodo, caminho, { quem = ids.socio, corpo, chave = randomUUID(), cabecalhos = {} } = {}) {
  const headers = { 'content-type': 'application/json', ...cabecalhos };
  if (quem) headers.authorization = `Bearer ${quem}`;
  if (chave) headers['idempotency-key'] = chave;
  const r = await app.handle(new Request(`http://local${caminho}`, {
    method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }));
  return { status: r.status, corpo: await r.json() };
}

const contatoValido = (extra = {}) => ({ nome: 'Contato Exemplo', origem: 'ia_generativa', origemDetalhe: 'ChatGPT', ...extra });

// ---------- R1 / R2 ----------
test('R2: sem token → 401', async () => {
  const r = await chamar('GET', '/api/contatos', { quem: null });
  assert.equal(r.status, 401);
  assert.equal(r.corpo.codigo, 'nao_autenticado');
});

test('R2: usuário só com leitura não escreve → 403 escopo_insuficiente', async () => {
  const r = await chamar('POST', '/api/contatos', { quem: ids.leitor, corpo: contatoValido() });
  assert.equal(r.status, 403);
  assert.equal(r.corpo.codigo, 'escopo_insuficiente');
});

test('R2: cliente não lê contatos da Arkosys → 403', async () => {
  const r = await chamar('GET', '/api/contatos', { quem: ids.cliente });
  assert.equal(r.status, 403);
});

test('R2: usuário desativado perde o acesso', async () => {
  const id = randomUUID();
  await db.insert(schema.usuario).values({ id, nome: 'Ex-sócio', email: 'ex@teste.local', tipo: 'socio', ativo: false });
  await db.insert(schema.usuarioEscopo).values({ usuarioId: id, escopo: 'contatos:ler' });
  const r = await chamar('GET', '/api/contatos', { quem: id });
  assert.equal(r.status, 401);
});

// ---------- R3 ----------
test('R3: contato sem origem é recusado', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: { nome: 'Sem Origem' } });
  assert.equal(r.status, 422);
  assert.equal(r.corpo.campo, 'origem');
});

test('R3: origem "agente" não pode ser lançada à mão na Fase 1', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido({ origem: 'agente' }) });
  assert.equal(r.status, 422);
});

test('R3: origem e id externo da conversa ficam gravados no contato e na oportunidade', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido({ idConversaExterna: 'wa-123', email: 'r3@teste.local' }) });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.contato.origem, 'ia_generativa');
  assert.equal(r.corpo.oportunidade.idConversaExterna, 'wa-123');
  assert.equal(r.corpo.oportunidade.estado, 'contato_recebido');
});

// ---------- R4 ----------
test('R4: cada escrita gera evento com autor, via e estado depois', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'r4@teste.local' }), cabecalhos: { 'x-via': 'painel' } });
  const evs = await db.select().from(schema.evento).where(eq(schema.evento.entidadeId, r.corpo.contato.id));
  assert.equal(evs.length, 1);
  assert.equal(evs[0].atorId, ids.socio);
  assert.equal(evs[0].via, 'painel');
  assert.equal(evs[0].depois.nome, 'Contato Exemplo');
});

test('R4: a via não pode ser falsificada pelo chamador', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'via@teste.local' }), cabecalhos: { 'x-via': 'agente' } });
  const [ev] = await db.select().from(schema.evento).where(eq(schema.evento.entidadeId, r.corpo.contato.id));
  assert.equal(ev.via, 'api');
});

test('R4: evento não pode ser alterado nem apagado', async () => {
  await assert.rejects(db.execute(sql`UPDATE evento SET acao = 'adulterado'`));
  await assert.rejects(db.execute(sql`DELETE FROM evento`));
});

// ---------- R5 ----------
test('R5: mesma chamada repetida não duplica e devolve a mesma resposta', async () => {
  const chave = randomUUID();
  const corpo = contatoValido({ email: 'r5@teste.local' });
  const a = await chamar('POST', '/api/contatos', { corpo, chave });
  const b = await chamar('POST', '/api/contatos', { corpo, chave });
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.deepEqual(b.corpo, a.corpo);
  const linhas = await db.select().from(schema.contato).where(eq(schema.contato.email, 'r5@teste.local'));
  assert.equal(linhas.length, 1);
});

test('R5: chamadas simultâneas com a mesma chave criam um só registro', async () => {
  const chave = randomUUID();
  const corpo = contatoValido({ email: 'simultaneo@teste.local' });
  const rs = await Promise.all([1, 2, 3].map(() => chamar('POST', '/api/contatos', { corpo, chave })));
  assert.ok(rs.every((r) => r.status === 201 || r.status === 200));
  const linhas = await db.select().from(schema.contato).where(eq(schema.contato.email, 'simultaneo@teste.local'));
  assert.equal(linhas.length, 1);
});

test('R5: mesma chave com dados diferentes → 409', async () => {
  const chave = randomUUID();
  await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'k1@teste.local' }), chave });
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'k2@teste.local' }), chave });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.codigo, 'chave_reutilizada_com_dados_diferentes');
});

test('R5: escrita sem chave → 400', async () => {
  const r = await chamar('POST', '/api/contatos', { corpo: contatoValido(), chave: null });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.codigo, 'chave_idempotencia_ausente');
});

// ---------- Funil ----------
test('Funil: só avança para o próximo estado', async () => {
  const c = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'funil@teste.local' }) });
  const id = c.corpo.oportunidade.id;
  const pulo = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'reuniao_realizada' } });
  assert.equal(pulo.status, 409);
  assert.equal(pulo.corpo.codigo, 'transicao_invalida');
  const semData = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'reuniao_agendada' } });
  assert.equal(semData.status, 422);
  const ok = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'reuniao_agendada', dataReuniao: '2026-11-20T14:00:00-03:00' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.oportunidade.estado, 'reuniao_agendada');
});

test('Funil: aguardando retorno volta ao estado anterior; desistiu encerra com motivo opcional', async () => {
  const c = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'retorno@teste.local' }) });
  const id = c.corpo.oportunidade.id;
  await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'aguardando_retorno' } });
  const errado = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'reuniao_realizada' } });
  assert.equal(errado.status, 409);
  const volta = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'contato_recebido' } });
  assert.equal(volta.status, 200);
  const fim = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'desistiu' } });
  assert.equal(fim.corpo.oportunidade.estado, 'desistiu');
  const depois = await chamar('POST', `/api/oportunidades/${id}/estado`, { corpo: { para: 'contato_recebido' } });
  assert.equal(depois.status, 409);
});

test('Funil: "contrato assinado" não é alcançável pela mudança simples de estado', async () => {
  const c = await chamar('POST', '/api/contatos', { corpo: contatoValido({ email: 'assin@teste.local' }) });
  const r = await chamar('POST', `/api/oportunidades/${c.corpo.oportunidade.id}/estado`, { corpo: { para: 'contrato_assinado' } });
  assert.equal(r.status, 422);
});

// ---------- Medição ----------
test('Medição: tempo de preenchimento do painel é gravado', async () => {
  await chamar('POST', '/api/contatos', {
    corpo: contatoValido({ email: 'tempo@teste.local' }),
    cabecalhos: { 'x-via': 'painel', 'x-duracao-preenchimento-ms': '95000' },
  });
  const linhas = await db.select().from(schema.tempoLancamento).where(eq(schema.tempoLancamento.duracaoMs, 95000));
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].operacao, 'criar_contato');
});

// ---------- Prazos (contrato do 1º cliente, cl. 3.2(b), 4.1, 4.2 e 7.4) ----------
test('Prazos: 30 dias corridos a partir do 1º pagamento, somando a suspensão', () => {
  const hoje = paraData('2026-12-31');
  const c = { dataPrimeiroPagamento: '2026-11-10', prazoDiasCorridos: 30 };
  assert.equal(paraIso(entregaPrevista(c, [], hoje)), '2026-12-10');
  assert.equal(paraIso(entregaPrevista(c, [{ inicio: '2026-11-15', fim: '2026-11-20' }], hoje)), '2026-12-15');
  assert.equal(entregaPrevista({ dataPrimeiroPagamento: null, prazoDiasCorridos: 30 }, [], hoje), null);
});

test('Prazos: 2ª parcela vence 5 dias úteis após o aceite (pula fim de semana)', () => {
  // 2026-12-11 é sexta-feira → 5 dias úteis = sexta 2026-12-18
  assert.equal(paraIso(vencimentoParcela({ diasUteisAposGatilho: 5 }, '2026-12-11')), '2026-12-18');
});

test('Prazos: garantia de 30 dias contados do aceite', () => {
  assert.equal(paraIso(fimGarantia({ dataAceite: '2026-12-11', diasGarantia: 30 })), '2027-01-10');
});

test('Saúde: /api/saude responde sem login e confirma o banco', async () => {
  const r = await app.handle(new Request('http://local/api/saude'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).banco, 'ok');
});

test('Conexão: endereço do banco malformado é recusado sem repetir o valor', async () => {
  const { validarEndereco } = await import('../server/db/cliente.js');
  const ruim = 'postgresql://postgres.x:XyZ9@q#Wk@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
  assert.throws(() => validarEndereco(ruim), (e) => !e.message.includes('XyZ9') && !e.message.includes('Wk') && e.message.startsWith('DATABASE_URL'));
  assert.doesNotThrow(() => validarEndereco('postgresql://postgres.x:SenhaSegura123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'));
  assert.throws(() => validarEndereco('postgresql://postgres:abc@db.x.supabase.co:5432/postgres'));
});

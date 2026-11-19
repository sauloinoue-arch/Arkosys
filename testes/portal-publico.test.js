// Testes dos Lotes 3 e 4 (API): senha provisória, configuração inicial, liberação de acesso,
// portal do cliente (isolamento entre clientes) e rotas públicas do site.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../server/db/schema.js';
import { criarApp } from '../server/app.js';
import { carregarConsumidor } from '../server/core/auth.js';

let db, app;
const hoje = new Date('2026-11-19T12:00:00Z');
const arquivos = new Map();
const senhasTrocadas = [];
const armazenamento = {
  async linkEnvio(caminho) { return { url: `https://t/${caminho}`, token: 't', caminho }; },
  async ler(caminho) { return arquivos.get(caminho) ?? null; },
  async linkDownload(caminho) { return { url: `https://t/baixar/${caminho}`, validadeSegundos: 60 }; },
};
const autenticacaoAdmin = {
  async criarUsuario() { return { id: randomUUID() }; },
  async trocarSenha(id, senha) { senhasTrocadas.push({ id, senha }); },
  async gerarConvite() { return { id: randomUUID(), link: 'https://t/convite?token=segredo' }; },
};

before(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: './server/db/migracoes' });
  app = criarApp({
    db, armazenamento, autenticacaoAdmin, agora: () => hoje, env: { SENHA_INICIAL: '123456', URL_PUBLICA: 'https://t' },
    resolverConsumidor: async (req) => {
      const t = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
      return t ? carregarConsumidor(db, t) : null;
    },
  });
});

async function chamar(metodo, caminho, { quem, corpo, ip = '10.0.0.1', chave = randomUUID() } = {}) {
  const headers = { 'content-type': 'application/json', 'idempotency-key': chave, 'x-forwarded-for': ip };
  if (quem) headers.authorization = `Bearer ${quem}`;
  const r = await app.handle(new Request(`http://local${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) }));
  return { status: r.status, corpo: await r.json() };
}

let socios;
test('Configuração inicial: cria os 3 sócios com senha provisória e depois fica inerte', async () => {
  const r = await chamar('GET', '/api/configuracao-inicial');
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.deepEqual(r.corpo.criados, ['juridico@arkosys.com.br', 'desenvolvimento@arkosys.com.br', 'ciberseguranca@arkosys.com.br']);
  socios = await db.select().from(schema.usuario).where(eq(schema.usuario.tipo, 'socio'));
  assert.equal(socios.length, 3);
  assert.ok(socios.every((s) => s.deveTrocarSenha));
  const de_novo = await chamar('GET', '/api/configuracao-inicial');
  assert.equal(de_novo.status, 409);
});

test('Senha provisória: bloqueia tudo até a troca; senha fraca é recusada', async () => {
  const id = socios[0].id;
  assert.equal((await chamar('GET', '/api/contatos', { quem: id })).corpo.codigo, 'troca_de_senha_obrigatoria');
  assert.equal((await chamar('GET', '/api/eu', { quem: id })).corpo.deveTrocarSenha, true);
  assert.equal((await chamar('POST', '/api/eu/senha', { quem: id, corpo: { novaSenha: '123456' } })).status, 422);
  assert.equal((await chamar('POST', '/api/eu/senha', { quem: id, corpo: { novaSenha: '123456789012' } })).status, 422);
  const ok = await chamar('POST', '/api/eu/senha', { quem: id, corpo: { novaSenha: 'Arkosys-Painel-2026!x' } });
  assert.equal(ok.status, 200);
  assert.equal((await chamar('GET', '/api/contatos', { quem: id })).status, 200);
  const evs = await db.select().from(schema.evento).where(eq(schema.evento.acao, 'trocar_senha'));
  assert.ok(evs.length === 1 && evs[0].depois === null, 'o evento não guarda a senha');
});

test('Site: preços vêm da API e o total é calculado no servidor', async () => {
  const p = await chamar('GET', '/api/publico/precos');
  assert.equal(p.corpo.base.precoCentavos, 200000);
  assert.equal(p.corpo.adicionais.length, 5);
  const cad = await chamar('POST', '/api/publico/cadastro', { corpo: { nome: 'Visitante', email: 'v@exemplo.com', aceitePrivacidade: true, versaoAvisoPrivacidade: p.corpo.versaoAvisoPrivacidade } });
  assert.equal(cad.status, 201);
  const orc = await chamar('POST', '/api/publico/orcamento', { corpo: { cadastro: cad.corpo.cadastro, adicionais: ['whatsapp', 'agendamentos'] } });
  assert.equal(orc.corpo.orcamento.totalCentavos, 310000);
  assert.match(orc.corpo.orcamento.aviso, /sem caráter vinculante/);
  const [op] = await db.select().from(schema.oportunidade).where(eq(schema.oportunidade.id, cad.corpo.cadastro));
  assert.equal(op.estado, 'orcamento_gerado');
  const invalido = await chamar('POST', '/api/publico/orcamento', { corpo: { cadastro: cad.corpo.cadastro, adicionais: ['nao_existe'] } });
  assert.equal(invalido.status, 422);
});

test('Site: cadastro exige aceite do aviso e não revela e-mail já cadastrado', async () => {
  const base = { nome: 'Outro', email: 'v@exemplo.com', versaoAvisoPrivacidade: 'rascunho-2026-11-19' };
  assert.equal((await chamar('POST', '/api/publico/cadastro', { ip: '10.0.0.2', corpo: { ...base, aceitePrivacidade: false } })).status, 422);
  const repetido = await chamar('POST', '/api/publico/cadastro', { ip: '10.0.0.2', corpo: { ...base, aceitePrivacidade: true } });
  assert.equal(repetido.status, 201);
  assert.deepEqual(Object.keys(repetido.corpo), ['cadastro']);
});

test('Site: limite de cadastros por IP', async () => {
  const rs = [];
  for (let i = 0; i < 7; i++) {
    rs.push((await chamar('POST', '/api/publico/cadastro', { ip: '10.9.9.9', corpo: { nome: 'Robô', email: `r${i}@exemplo.com`, aceitePrivacidade: true, versaoAvisoPrivacidade: 'rascunho-2026-11-19' } })).status);
  }
  assert.deepEqual(rs, [201, 201, 201, 201, 201, 429, 429]);
});

test('Liberar acesso: só após contrato; link não fica guardado; cliente só vê o próprio projeto', async () => {
  const socio = socios[0].id; // já trocou a senha
  // Dois clientes com contrato.
  const clientes = [];
  for (const email of ['c1@exemplo.com', 'c2@exemplo.com']) {
    const c = await chamar('POST', '/api/contatos', { quem: socio, corpo: { nome: email, origem: 'indicacao', email } });
    const opId = c.corpo.oportunidade.id;
    const semContrato = await chamar('POST', `/api/contatos/${c.corpo.contato.id}/liberar-acesso`, { quem: socio, corpo: {} });
    if (email === 'c1@exemplo.com') assert.equal(semContrato.status, 409);
    await chamar('POST', `/api/oportunidades/${opId}/estado`, { quem: socio, corpo: { para: 'reuniao_agendada', dataReuniao: '2026-11-05T10:00:00-03:00' } });
    await chamar('POST', `/api/oportunidades/${opId}/estado`, { quem: socio, corpo: { para: 'reuniao_realizada' } });
    await chamar('POST', `/api/oportunidades/${opId}/estado`, { quem: socio, corpo: { para: 'proposta_contrato_enviados' } });
    const res = await chamar('POST', '/api/documentos', { quem: socio, corpo: { contatoId: c.corpo.contato.id, tipo: 'contrato', nomeArquivo: 'c.pdf', tamanhoBytes: 3 } });
    arquivos.set(res.corpo.documento.caminho, Buffer.from(email));
    await chamar('POST', `/api/documentos/${res.corpo.documento.id}/confirmar`, { quem: socio, corpo: {} });
    const k = await chamar('POST', '/api/contratos', { quem: socio, corpo: {
      oportunidadeId: opId, documentoContratoId: res.corpo.documento.id, objeto: `Sistema de ${email}`, valorTotalCentavos: 1000,
      dataAssinatura: '2026-11-09', prazoDiasCorridos: 30, diasGarantia: 30,
      parcelas: [{ descricao: 'Única', valorCentavos: 1000, gatilho: 'assinatura', diasUteisAposGatilho: 0 }],
    } });
    assert.equal(k.status, 201, JSON.stringify(k.corpo));
    clientes.push({ contatoId: c.corpo.contato.id, docId: res.corpo.documento.id });
  }
  const chave = randomUUID();
  const lib = await chamar('POST', `/api/contatos/${clientes[0].contatoId}/liberar-acesso`, { quem: socio, corpo: {}, chave });
  assert.equal(lib.status, 201);
  assert.match(lib.corpo.linkConvite, /^https:/);
  const repetida = await chamar('POST', `/api/contatos/${clientes[0].contatoId}/liberar-acesso`, { quem: socio, corpo: {}, chave });
  assert.equal(repetida.corpo.linkConvite, undefined, 'o link não é devolvido de novo nem guardado');

  const cliente1 = lib.corpo.usuarioId;
  // O convidado precisa definir a própria senha antes de ver o portal.
  assert.equal((await chamar('GET', '/api/portal/meu-projeto', { quem: cliente1 })).corpo.codigo, 'troca_de_senha_obrigatoria');
  await chamar('POST', '/api/eu/senha', { quem: cliente1, corpo: { novaSenha: 'Cliente-Barbearia-2026' } });
  const meu = await chamar('GET', '/api/portal/meu-projeto', { quem: cliente1 });
  assert.equal(meu.corpo.projetos.length, 1);
  assert.equal(meu.corpo.projetos[0].objeto, 'Sistema de c1@exemplo.com');
  assert.equal((await chamar('GET', `/api/portal/documentos/${clientes[0].docId}/download`, { quem: cliente1 })).status, 200);
  assert.equal((await chamar('GET', `/api/portal/documentos/${clientes[1].docId}/download`, { quem: cliente1 })).status, 404, 'documento de outro cliente');
  assert.equal((await chamar('GET', '/api/contratos', { quem: cliente1 })).status, 403, 'cliente não usa rotas do painel');
});

test('Auditoria e medição: leitura dos eventos e soma semanal', async () => {
  const socio = socios[0].id;
  const ev = await chamar('GET', '/api/eventos?limite=5', { quem: socio });
  assert.equal(ev.corpo.itens.length, 5);
  const med = await chamar('GET', '/api/medicao', { quem: socio });
  assert.equal(med.corpo.criterioHorasSemana, 2);
});

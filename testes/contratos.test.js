// Testes do Lote 2: ciclo completo de um contrato, com os parâmetros do contrato do
// 1º cliente (R$ 3.750,00 em 2 parcelas de R$ 1.875,00; prazo de 30 dias corridos;
// 2ª parcela 5 dias úteis após o aceite; garantia de 30 dias). Executar: npm test
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
import { ESCOPOS_PADRAO } from '../server/core/escopos.js';

let db, app, hoje = new Date('2026-11-19T12:00:00Z');
const socio = randomUUID();
const arquivos = new Map(); // armazenamento falso, em memória

const armazenamento = {
  async linkEnvio(caminho) { return { url: `https://teste.local/envio/${caminho}`, token: 't', caminho }; },
  async ler(caminho) { return arquivos.get(caminho) ?? null; },
  async linkDownload(caminho) { return { url: `https://teste.local/baixar/${caminho}`, validadeSegundos: 60 }; },
};

before(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: './server/db/migracoes' });
  await db.insert(schema.usuario).values({ id: socio, nome: 'Sócio', email: 's@teste.local', tipo: 'socio', area: 'juridico' });
  await db.insert(schema.usuarioEscopo).values(ESCOPOS_PADRAO.socio.map((escopo) => ({ usuarioId: socio, escopo })));
  app = criarApp({
    db, armazenamento, agora: () => hoje,
    resolverConsumidor: async (req) => carregarConsumidor(db, (req.headers.get('authorization') ?? '').replace('Bearer ', '')),
  });
});

async function chamar(metodo, caminho, corpo) {
  const r = await app.handle(new Request(`http://local${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${socio}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }));
  return { status: r.status, corpo: await r.json() };
}

async function enviarDocumento(contatoId, tipo, conteudo = `arquivo ${tipo} ${randomUUID()}`) {
  const r = await chamar('POST', '/api/documentos', { contatoId, tipo, nomeArquivo: `${tipo}.pdf`, tamanhoBytes: conteudo.length });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  arquivos.set(r.corpo.documento.caminho, Buffer.from(conteudo));
  const c = await chamar('POST', `/api/documentos/${r.corpo.documento.id}/confirmar`, {});
  assert.equal(c.status, 200);
  return c.corpo.documento;
}

async function oportunidadeProntaParaContrato(email) {
  const c = await chamar('POST', '/api/contatos', { nome: 'Cliente Teste', origem: 'ia_generativa', email });
  const id = c.corpo.oportunidade.id;
  await chamar('POST', `/api/oportunidades/${id}/estado`, { para: 'reuniao_agendada', dataReuniao: '2026-11-05T10:00:00-03:00' });
  await chamar('POST', `/api/oportunidades/${id}/estado`, { para: 'reuniao_realizada' });
  await chamar('POST', `/api/oportunidades/${id}/estado`, { para: 'proposta_contrato_enviados' });
  return { contatoId: c.corpo.contato.id, oportunidadeId: id };
}

const contratoBase = (oportunidadeId, documentoContratoId) => ({
  oportunidadeId, documentoContratoId,
  objeto: 'Sistema web de agendamento com painel administrativo, integração com WhatsApp e módulo de agendamentos.',
  valorTotalCentavos: 375000, dataAssinatura: '2026-11-09', prazoDiasCorridos: 30, diasGarantia: 30,
  parcelas: [
    { descricao: 'Entrada (50%)', valorCentavos: 187500, gatilho: 'assinatura', diasUteisAposGatilho: 0 },
    { descricao: 'Saldo (50%)', valorCentavos: 187500, gatilho: 'aceite', diasUteisAposGatilho: 5 },
  ],
});

test('Documento: confirmação calcula o hash e recusa arquivo que não chegou', async () => {
  const { contatoId } = await oportunidadeProntaParaContrato('doc@teste.local');
  const r = await chamar('POST', '/api/documentos', { contatoId, tipo: 'outro', nomeArquivo: 'Ação & Cia.pdf', tamanhoBytes: 10 });
  assert.match(r.corpo.documento.caminho, new RegExp(`^clientes/${contatoId}/[0-9a-f-]+-Acao_Cia\\.pdf$`));
  const semArquivo = await chamar('POST', `/api/documentos/${r.corpo.documento.id}/confirmar`, {});
  assert.equal(semArquivo.status, 409);
  const ok = await enviarDocumento(contatoId, 'contrato', 'conteudo-fixo');
  const esperado = (await import('node:crypto')).createHash('sha256').update('conteudo-fixo').digest('hex');
  assert.equal(ok.hashSha256, esperado);
  assert.equal(ok.hashSha256.length, 64);
});

test('Documento: exclusão exige confirmação explícita', async () => {
  const { contatoId } = await oportunidadeProntaParaContrato('exc@teste.local');
  const d = await enviarDocumento(contatoId, 'outro');
  const sem = await chamar('POST', `/api/documentos/${d.id}/excluir`, {});
  assert.equal(sem.status, 422);
  const com = await chamar('POST', `/api/documentos/${d.id}/excluir`, { confirmar: true });
  assert.ok(com.corpo.documento.excluidoEm);
});

test('Contrato: exige documento de contrato confirmado e do mesmo cliente', async () => {
  const a = await oportunidadeProntaParaContrato('a@teste.local');
  const b = await oportunidadeProntaParaContrato('b@teste.local');
  const docDeB = await enviarDocumento(b.contatoId, 'contrato');
  const r = await chamar('POST', '/api/contratos', contratoBase(a.oportunidadeId, docDeB.id));
  assert.equal(r.status, 409);
  assert.equal(r.corpo.codigo, 'documento_obrigatorio_ausente');
});

test('Contrato: soma das parcelas precisa bater com o total', async () => {
  const a = await oportunidadeProntaParaContrato('soma@teste.local');
  const doc = await enviarDocumento(a.contatoId, 'contrato');
  const corpo = contratoBase(a.oportunidadeId, doc.id);
  corpo.parcelas[1].valorCentavos = 100000;
  const r = await chamar('POST', '/api/contratos', corpo);
  assert.equal(r.status, 422);
  assert.equal(r.corpo.campo, 'parcelas');
});

test('Ciclo completo do contrato do 1º cliente: prazo, suspensão, entrega, aceite tácito e cobrança', async () => {
  const { contatoId, oportunidadeId } = await oportunidadeProntaParaContrato('ciclo@teste.local');
  const doc = await enviarDocumento(contatoId, 'contrato');

  // Assinatura: oportunidade → contrato_assinado; entrada a receber; prazo ainda não corre.
  const criado = await chamar('POST', '/api/contratos', contratoBase(oportunidadeId, doc.id));
  assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
  const contratoId = criado.corpo.contrato.id;
  const [entrada, saldo] = criado.corpo.parcelas;
  assert.equal(entrada.status, 'a_receber');
  assert.equal(saldo.status, 'prevista');
  const [op] = await db.select().from(schema.oportunidade).where(eq(schema.oportunidade.id, oportunidadeId));
  assert.equal(op.estado, 'contrato_assinado');
  let det = await chamar('GET', `/api/contratos/${contratoId}`);
  assert.equal(det.corpo.contrato.entregaPrevista, null);

  // Entrega antes do pagamento é recusada.
  assert.equal((await chamar('POST', `/api/contratos/${contratoId}/entrega`, { data: '2026-11-20' })).status, 409);

  // Pagamento da entrada (cl. 4.1): prazo começa em 10/11 → entrega prevista 10/12.
  const pg = await chamar('POST', `/api/parcelas/${entrada.id}/pagamento`, { dataPagamento: '2026-11-10', meio: 'cartao_credito' });
  assert.equal(pg.corpo.contrato.estadoProjeto, 'em_desenvolvimento');
  det = await chamar('GET', `/api/contratos/${contratoId}`);
  assert.equal(det.corpo.contrato.entregaPrevista, '2026-12-10');
  assert.equal((await chamar('POST', `/api/parcelas/${entrada.id}/pagamento`, { dataPagamento: '2026-11-10', meio: 'pix' })).status, 409);

  // Suspensão (cl. 4.2) de 15/11 a 20/11 → entrega prevista passa para 15/12.
  const s = await chamar('POST', `/api/contratos/${contratoId}/suspensoes`, { inicio: '2026-11-15', motivo: 'Aguardando logotipo e textos do cliente' });
  assert.equal(s.corpo.contrato.estadoProjeto, 'prazo_suspenso');
  await chamar('POST', `/api/suspensoes/${s.corpo.suspensao.id}/encerrar`, { fim: '2026-11-20' });
  det = await chamar('GET', `/api/contratos/${contratoId}`);
  assert.equal(det.corpo.contrato.entregaPrevista, '2026-12-15');
  assert.equal(det.corpo.contrato.estadoProjeto, 'em_desenvolvimento');

  // Alerta de prazo aparece com os dias restantes.
  const alertas = await chamar('GET', '/api/alertas');
  const prazo = alertas.corpo.itens.find((a) => a.tipo === 'prazo_entrega' && a.contratoId === contratoId);
  assert.equal(prazo.data, '2026-12-15');
  assert.equal(prazo.diasRestantes, 26);

  // Entrega comunicada em 11/12; aceite tácito por decurso em 18/12 com evidência.
  await chamar('POST', `/api/contratos/${contratoId}/entrega`, { data: '2026-12-11' });
  const semEvidencia = await chamar('POST', `/api/contratos/${contratoId}/aceite`, { tipo: 'decurso_prazo', data: '2026-12-18', documentoId: doc.id });
  assert.equal(semEvidencia.status, 409);
  const evid = await enviarDocumento(contatoId, 'evidencia_aceite');
  const ac = await chamar('POST', `/api/contratos/${contratoId}/aceite`, { tipo: 'decurso_prazo', data: '2026-12-18', documentoId: evid.id });
  assert.equal(ac.corpo.contrato.estadoProjeto, 'entregue');

  // Saldo liberado: 5 dias úteis após 18/12 (sexta) → 25/12. Garantia até 17/01/2027.
  det = await chamar('GET', `/api/contratos/${contratoId}`);
  const saldoAgora = det.corpo.parcelas.find((p) => p.numero === 2);
  assert.equal(saldoAgora.status, 'a_receber');
  assert.equal(saldoAgora.vencimento, '2026-12-25');
  assert.equal(det.corpo.contrato.fimGarantia, '2027-01-17');

  // 25/12 é feriado, que o cálculo não conhece: o vencimento é corrigido à mão, com evento.
  const aj = await chamar('POST', `/api/parcelas/${saldoAgora.id}/vencimento`, { vencimento: '2026-12-28', motivo: 'Feriado de Natal' });
  assert.equal(aj.corpo.parcela.vencimento, '2026-12-28');
  const evAj = await db.select().from(schema.evento).where(eq(schema.evento.entidadeId, saldoAgora.id));
  assert.ok(evAj.some((e) => e.acao.startsWith('ajustar_vencimento')));

  // Cada passo deixou rastro no registro de eventos.
  const evs = await db.select().from(schema.evento).where(eq(schema.evento.entidadeId, contratoId));
  assert.ok(evs.length >= 6, `eventos do contrato: ${evs.length}`);
});

test('Aceite expresso exige termo de recebimento', async () => {
  const { contatoId, oportunidadeId } = await oportunidadeProntaParaContrato('expresso@teste.local');
  const doc = await enviarDocumento(contatoId, 'contrato');
  const c = await chamar('POST', '/api/contratos', contratoBase(oportunidadeId, doc.id));
  const id = c.corpo.contrato.id;
  await chamar('POST', `/api/parcelas/${c.corpo.parcelas[0].id}/pagamento`, { dataPagamento: '2026-11-10', meio: 'pix' });
  await chamar('POST', `/api/contratos/${id}/entrega`, { data: '2026-12-01' });
  const evid = await enviarDocumento(contatoId, 'evidencia_aceite');
  assert.equal((await chamar('POST', `/api/contratos/${id}/aceite`, { tipo: 'expresso', data: '2026-12-02', documentoId: evid.id })).status, 409);
  const termo = await enviarDocumento(contatoId, 'termo_recebimento');
  assert.equal((await chamar('POST', `/api/contratos/${id}/aceite`, { tipo: 'expresso', data: '2026-12-02', documentoId: termo.id })).status, 200);
});

test('Manutenção mensal: uma ativa por contrato e alerta de vencimento', async () => {
  const { contatoId, oportunidadeId } = await oportunidadeProntaParaContrato('manut@teste.local');
  const doc = await enviarDocumento(contatoId, 'contrato');
  const c = await chamar('POST', '/api/contratos', contratoBase(oportunidadeId, doc.id));
  const id = c.corpo.contrato.id;
  const m = await chamar('POST', `/api/contratos/${id}/manutencao`, { valorMensalCentavos: 50000, inicio: '2026-12-01', diaVencimento: 10 });
  assert.equal(m.status, 201);
  assert.equal((await chamar('POST', `/api/contratos/${id}/manutencao`, { valorMensalCentavos: 50000, inicio: '2026-12-01', diaVencimento: 10 })).status, 409);
  const alertas = await chamar('GET', '/api/alertas');
  const a = alertas.corpo.itens.find((x) => x.tipo === 'manutencao' && x.contratoId === id);
  assert.equal(a.data, '2026-12-10');
});

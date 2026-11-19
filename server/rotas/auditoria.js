// Registro de eventos (R4, somente leitura) e medição do lançamento manual
// (Parecer, item 10 — critério (d) da Fase 3: mais de 2 horas por semana).
import { and, desc, eq, sql } from 'drizzle-orm';
import { evento, tempoLancamento, usuario } from '../db/schema.js';
import { UUID_RE } from '../core/validar.js';

export const rotasAuditoria = [
  {
    metodo: 'GET', caminho: '/api/eventos', escopo: 'eventos:ler',
    async executar({ db, query }) {
      const filtros = [];
      if (query.get('entidade')) filtros.push(eq(evento.entidade, query.get('entidade')));
      if (UUID_RE.test(query.get('entidadeId') ?? '')) filtros.push(eq(evento.entidadeId, query.get('entidadeId')));
      const limite = Math.min(Number(query.get('limite')) || 200, 500);
      const itens = await db.select({
        id: evento.id, ocorridoEm: evento.ocorridoEm, atorTipo: evento.atorTipo, ator: usuario.email,
        via: evento.via, entidade: evento.entidade, entidadeId: evento.entidadeId, acao: evento.acao,
      }).from(evento).leftJoin(usuario, eq(usuario.id, evento.atorId))
        .where(filtros.length ? and(...filtros) : undefined).orderBy(desc(evento.ocorridoEm)).limit(limite);
      return { itens };
    },
  },
  {
    metodo: 'GET', caminho: '/api/medicao', escopo: 'eventos:ler',
    async executar({ db }) {
      const semanas = await db.select({
        semana: sql`to_char(date_trunc('week', ${tempoLancamento.registradoEm}), 'YYYY-MM-DD')`.as('semana'),
        totalMs: sql`sum(${tempoLancamento.duracaoMs})::bigint`.as('total_ms'),
        lancamentos: sql`count(*)::int`.as('lancamentos'),
      }).from(tempoLancamento).groupBy(sql`1`).orderBy(sql`1 desc`).limit(26);
      const CRITERIO_MS = 2 * 3_600_000; // critério (d) da Fase 3 (prompt do usuário, #Model item 9)
      return {
        criterioHorasSemana: 2,
        semanas: semanas.map((s) => ({ ...s, totalMs: Number(s.totalMs), horas: Number(s.totalMs) / 3_600_000, acimaDoCriterio: Number(s.totalMs) > CRITERIO_MS })),
      };
    },
  },
];

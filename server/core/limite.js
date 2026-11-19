// Limite de envios do cadastro público (Parecer, etapa 5: "limite de envios por IP e por e-mail").
// Janela de 1 hora. Os máximos são decisão técnica, ajustáveis aqui.
import { sql } from 'drizzle-orm';
import { limiteEnvio } from '../db/schema.js';
import { erros } from './erros.js';

export const LIMITES = Object.freeze({ cadastroPorIp: 5, cadastroPorEmail: 3, orcamentoPorIp: 20 });

export function ipDaRequisicao(request) {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || 'desconhecido';
}

/** Conta +1 na janela da hora atual e recusa quando passa do máximo. */
export async function consumirLimite(db, chave, maximo, agora) {
  const janela = new Date(Math.floor(agora.getTime() / 3_600_000) * 3_600_000);
  const [linha] = await db.insert(limiteEnvio).values({ chave, janela, total: 1 })
    .onConflictDoUpdate({ target: [limiteEnvio.chave, limiteEnvio.janela], set: { total: sql`${limiteEnvio.total} + 1` } })
    .returning();
  if (linha.total > maximo) throw erros.limite();
}

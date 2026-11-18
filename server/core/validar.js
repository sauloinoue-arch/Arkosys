import { erros } from './erros.js';

/** Valida com zod e converte a primeira falha no formato de erro da API. */
export function validar(esquema, dados) {
  const r = esquema.safeParse(dados ?? {});
  if (r.success) return r.data;
  const p = r.error.issues[0];
  throw erros.validacao(p.message, p.path.join('.') || null);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

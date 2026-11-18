// Conexão de produção com o Postgres do Supabase pelo pooler compartilhado.
// Fonte: https://supabase.com/docs/guides/database/drizzle (consultado em 17/11/2026):
// usar a URI do "Shared pooler" em DATABASE_URL e `prepare: false`.
// A credencial vive só na variável de ambiente (Restrição 11).
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

let instancia;
export function obterDb(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  if (!instancia) {
    const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
    instancia = drizzle(sql, { schema });
  }
  return instancia;
}

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
    validarEndereco(env.DATABASE_URL);
    const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
    instancia = drizzle(sql, { schema });
  }
  return instancia;
}

// Confere o formato sem nunca repetir o valor (que contém a senha) em mensagem ou log.
// Falha típica: senha com @ # / ? % sem codificação, que desloca o "host" para dentro da senha.
export function validarEndereco(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('DATABASE_URL inválida: formato não reconhecido'); }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('DATABASE_URL inválida: protocolo deve ser postgresql://');
  if (!u.hostname.endsWith('.pooler.supabase.com')) {
    throw new Error('DATABASE_URL inválida: o endereço não é o do pooler do Supabase. Se a senha tiver @ # / ? %, eles precisam ser codificados.');
  }
  if (u.port !== '6543') throw new Error('DATABASE_URL inválida: use a porta 6543 (Transaction pooler)');
}

// Identifica quem chama a API (R2). O token vem do Supabase Auth no cabeçalho
// Authorization: Bearer <token>. Usuário sem cadastro ativo na tabela `usuario`
// não tem escopo nenhum — o login sozinho não dá acesso.
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { usuario, usuarioEscopo } from '../db/schema.js';

export async function carregarConsumidor(db, usuarioId) {
  const [u] = await db.select().from(usuario).where(eq(usuario.id, usuarioId));
  if (!u || !u.ativo) return null;
  const linhas = await db.select({ escopo: usuarioEscopo.escopo }).from(usuarioEscopo)
    .where(eq(usuarioEscopo.usuarioId, usuarioId));
  return {
    id: u.id, tipo: u.tipo, clienteId: u.clienteId, nome: u.nome, email: u.email, area: u.area,
    deveTrocarSenha: u.deveTrocarSenha, escopos: linhas.map((l) => l.escopo),
  };
}

/** Resolvedor de produção: valida o token no Supabase e carrega escopos do banco. */
export function resolvedorSupabase(db, env = process.env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (request) => {
    const cabecalho = request.headers.get('authorization') ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return carregarConsumidor(db, data.user.id);
  };
}

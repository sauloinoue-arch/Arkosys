// Operações administrativas de login (Supabase Auth Admin), só no servidor, com a chave secreta.
// Métodos conferidos nas definições do pacote @supabase/auth-js instalado:
// admin.createUser, admin.updateUserById, admin.generateLink (retorna properties.action_link).
import { createClient } from '@supabase/supabase-js';

export function autenticacaoAdminSupabase(env = process.env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = supabase.auth.admin;
  return {
    async criarUsuario(email, senha) {
      const { data, error } = await admin.createUser({ email, password: senha, email_confirm: true });
      if (error) throw new Error(`auth: ${error.message}`);
      return { id: data.user.id };
    },
    async trocarSenha(id, senha) {
      const { error } = await admin.updateUserById(id, { password: senha });
      if (error) throw new Error(`auth: ${error.message}`);
    },
    /** Convite do cliente: gera o link, NÃO envia. Quem envia é o sócio (Restrição 10). */
    async gerarConvite(email, redirecionarPara) {
      const { data, error } = await admin.generateLink({ type: 'invite', email, options: { redirectTo: redirecionarPara } });
      if (error) throw new Error(`auth: ${error.message}`);
      return { id: data.user.id, link: data.properties.action_link };
    },
  };
}

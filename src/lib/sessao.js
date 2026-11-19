// Login no navegador: só a chave PUBLICÁVEL do Supabase (feita para o navegador).
// A chave secreta nunca chega aqui.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export async function tokenAtual() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

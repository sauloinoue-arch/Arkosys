// Carrega a sessão e o perfil (GET /api/eu) e redireciona conforme o tipo de usuário.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './sessao.js';
import { api } from './api.js';

export function useSessao(tipoEsperado) {
  const [eu, setEu] = useState(null);
  const navegar = useNavigate();
  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navegar('/entrar', { replace: true });
      try {
        const perfil = await api.get('/api/eu');
        if (!ativo) return;
        if (perfil.deveTrocarSenha) return navegar('/trocar-senha', { replace: true });
        if (tipoEsperado && perfil.tipo !== tipoEsperado) return navegar(perfil.tipo === 'cliente' ? '/portal' : '/painel', { replace: true });
        setEu(perfil);
      } catch {
        await supabase.auth.signOut();
        navegar('/entrar', { replace: true });
      }
    })();
    return () => { ativo = false; };
  }, [navegar, tipoEsperado]);
  return eu;
}

export async function sair(navegar) {
  await supabase.auth.signOut();
  navegar('/entrar', { replace: true });
}

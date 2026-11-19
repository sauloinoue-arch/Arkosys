import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/sessao.js';
import { api } from '../lib/api.js';
import '../painel/painel.css';

// Troca obrigatória da senha inicial (ou definição da senha do cliente convidado).
// A regra de força está na API; a tela só repete a mensagem que a API devolver.
export default function TrocarSenha() {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  async function trocar(e) {
    e.preventDefault();
    setErro('');
    if (s1 !== s2) { setErro('As duas senhas não são iguais.'); return; }
    setEnviando(true);
    try {
      await api.post('/api/eu/senha', { novaSenha: s1 });
      await supabase.auth.signOut();
      navegar('/entrar', { replace: true, state: { aviso: 'Senha alterada. Entre com a nova senha.' } });
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="pn-centro">
      <form className="pn-cartao pn-form" onSubmit={trocar}>
        <picture>
          <source srcSet="/images/logo-circulo-512.webp" type="image/webp" />
          <img src="/images/logo-circulo-512.png" alt="Arkosys Tech Solutions" className="pn-logo-login" width="132" height="132" />
        </picture>
        <h1>Defina sua senha</h1>
        <p className="pn-mudo">A senha inicial é provisória. Use pelo menos 12 caracteres.</p>
        <label>Nova senha<input type="password" required value={s1} onChange={(e) => setS1(e.target.value)} autoComplete="new-password" /></label>
        <label>Repita a nova senha<input type="password" required value={s2} onChange={(e) => setS2(e.target.value)} autoComplete="new-password" /></label>
        {erro && <p className="pn-erro">{erro}</p>}
        <button className="btn-primary" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
      </form>
    </div>
  );
}

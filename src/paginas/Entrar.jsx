import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/sessao.js';
import { api } from '../lib/api.js';
import '../painel/painel.css';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  async function seguir() {
    const eu = await api.get('/api/eu');
    if (eu.deveTrocarSenha) return navegar('/trocar-senha');
    navegar(eu.tipo === 'cliente' ? '/portal' : '/painel');
  }

  // Convite do cliente: o link do Supabase volta com a sessão já criada.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) seguir().catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) { setErro('E-mail ou senha incorretos.'); setEnviando(false); return; }
    try { await seguir(); } catch (err) { setErro(err.message); await supabase.auth.signOut(); setEnviando(false); }
  }

  return (
    <div className="pn-centro">
      <form className="pn-cartao pn-form" onSubmit={entrar}>
        <picture>
          <source srcSet="/images/logo-circulo-512.webp" type="image/webp" />
          <img src="/images/logo-circulo-512.png" alt="Arkosys Tech Solutions" className="pn-logo-login" width="132" height="132" />
        </picture>
        <h1>Área restrita</h1>
        <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Senha<input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></label>
        {erro && <p className="pn-erro">{erro}</p>}
        <button className="btn-primary" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <a href="/" className="pn-link">Voltar ao site</a>
      </form>
    </div>
  );
}

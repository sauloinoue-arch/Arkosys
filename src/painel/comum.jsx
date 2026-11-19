import React, { useCallback, useEffect, useState } from 'react';

/** Carrega um recurso da API e expõe recarregar(). */
export function useCarregar(funcao, deps = []) {
  const [estado, setEstado] = useState({ dados: null, erro: '', carregando: true });
  const carregar = useCallback(async () => {
    setEstado((s) => ({ ...s, carregando: true }));
    try { setEstado({ dados: await funcao(), erro: '', carregando: false }); } catch (e) { setEstado({ dados: null, erro: e.message, carregando: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { carregar(); }, [carregar]);
  return { ...estado, recarregar: carregar };
}

export const Carregando = () => <p className="pn-mudo">Carregando…</p>;
export const Erro = ({ mensagem }) => (mensagem ? <p className="pn-erro">{mensagem}</p> : null);

export function Etiqueta({ tom = 'neutro', children }) {
  return <span className={`pn-etiqueta pn-${tom}`}>{children}</span>;
}

/** Tom de urgência por dias restantes (só cor; a ordenação vem da API). */
export const tomPorDias = (d) => (d === null || d === undefined ? 'neutro' : d < 0 ? 'vermelho' : d <= 7 ? 'amarelo' : 'verde');

/**
 * Formulário de ação: confirma antes de enviar quando `confirmar` é informado
 * (Restrição 10 — ações relevantes sempre passam por decisão humana explícita).
 */
export function Acao({ titulo, campos = [], rotuloBotao, confirmar, aoEnviar, depois }) {
  const [valores, setValores] = useState(Object.fromEntries(campos.map((c) => [c.nome, c.inicial ?? ''])));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [inicio] = useState(() => performance.now());
  async function enviar(e) {
    e.preventDefault();
    if (confirmar && !window.confirm(confirmar)) return;
    setErro(''); setEnviando(true);
    try { await aoEnviar(valores, performance.now() - inicio); depois?.(); } catch (err) { setErro(err.message); } finally { setEnviando(false); }
  }
  return (
    <form className="pn-acao pn-form" onSubmit={enviar}>
      {titulo && <h3>{titulo}</h3>}
      {campos.map((c) => (
        <label key={c.nome}>{c.rotulo}
          {c.opcoes ? (
            <select value={valores[c.nome]} required={!c.opcional} onChange={(e) => setValores({ ...valores, [c.nome]: e.target.value })}>
              <option value="">Selecione…</option>
              {c.opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          ) : c.tipo === 'textarea' ? (
            <textarea value={valores[c.nome]} required={!c.opcional} onChange={(e) => setValores({ ...valores, [c.nome]: e.target.value })} />
          ) : (
            <input type={c.tipo ?? 'text'} value={valores[c.nome]} required={!c.opcional} step={c.passo}
              onChange={(e) => setValores({ ...valores, [c.nome]: e.target.value })} />
          )}
        </label>
      ))}
      <Erro mensagem={erro} />
      <button className="btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : rotuloBotao}</button>
    </form>
  );
}

/** Converte "1.875,00" ou "1875" em centavos (só formatação; a validação é da API). */
export const paraCentavos = (texto) => Math.round(Number(String(texto).replace(/\./g, '').replace(',', '.')) * 100);

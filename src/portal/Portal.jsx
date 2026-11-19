import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api, dataBr, reais, ROTULOS } from '../lib/api.js';
import { useSessao, sair } from '../lib/useSessao.js';
import { Carregando, Erro, Etiqueta, useCarregar } from '../painel/comum.jsx';
import '../painel/painel.css';

// Portal do cliente (somente leitura): status, entrega prevista, parcelas e documentos dele.
function Projetos() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/portal/meu-projeto'));
  async function baixar(id) {
    try { const r = await api.get(`/api/portal/documentos/${id}/download`); window.open(r.url, '_blank', 'noopener'); } catch (e) { window.alert(e.message); }
  }
  if (carregando) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  if (dados.projetos.length === 0) return <p>Nenhum projeto encontrado.</p>;
  return dados.projetos.map((p) => (
    <article key={p.id} className="pn-cartao">
      <h2>Seu projeto <Etiqueta>{ROTULOS.projeto[p.estadoProjeto]}</Etiqueta></h2>
      <p>{p.objeto}</p>
      <div className="pn-grade">
        <div><span className="pn-mudo">Entrega prevista</span><br /><strong>{dataBr(p.entregaPrevista)}</strong></div>
        <div><span className="pn-mudo">Aceite</span><br />{dataBr(p.dataAceite)}</div>
      </div>
      <h3>Pagamentos</h3>
      <table className="pn-tabela">
        <thead><tr><th>#</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Situação</th></tr></thead>
        <tbody>{p.parcelas.map((x) => (
          <tr key={x.numero}><td>{x.numero}</td><td>{x.descricao}</td><td>{reais(x.valorCentavos)}</td><td>{dataBr(x.vencimento)}</td>
            <td><Etiqueta tom={x.status === 'paga' ? 'verde' : x.status === 'a_receber' ? 'amarelo' : 'neutro'}>{ROTULOS.parcela[x.status]}</Etiqueta></td></tr>
        ))}</tbody>
      </table>
      <h3>Documentos</h3>
      {p.documentos.length === 0 && <p className="pn-mudo">Nenhum documento disponível.</p>}
      <ul>{p.documentos.map((d) => (
        <li key={d.id}>{ROTULOS.documento[d.tipo]} — {d.nomeArquivo} <button className="pn-botao-link" onClick={() => baixar(d.id)}>baixar</button></li>
      ))}</ul>
    </article>
  ));
}

export default function Portal() {
  const eu = useSessao('cliente');
  const navegar = useNavigate();
  if (!eu) return <div className="pn-centro"><Carregando /></div>;
  return (
    <div className="pn-portal">
      <header className="pn-cabecalho">
        <span className="pn-marca">
          <picture>
            <source srcSet="/images/icone-512.webp" type="image/webp" />
            <img src="/images/icone-512.png" alt="Arkosys Tech Solutions" className="pn-logo" width="40" height="40" />
          </picture>
          <span className="marca-texto" aria-hidden="true"><strong>ARKOSYS</strong><small>TECH SOLUTIONS</small></span>
        </span>
        <div><span className="pn-mudo">{eu.email}</span> <button className="btn-outline" onClick={() => sair(navegar)}>Sair</button></div>
      </header>
      <Projetos />
    </div>
  );
}

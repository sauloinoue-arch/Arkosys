import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dataBr, dataHoraBr, enviarArquivo, reais, ROTULOS } from '../lib/api.js';
import { Acao, Carregando, Erro, Etiqueta, useCarregar } from './comum.jsx';

const TIPOS_DOC = Object.entries(ROTULOS.documento);

export function PastaDocumentos({ contatoId, contratoId, aoMudar }) {
  const docs = useCarregar(() => api.get(`/api/contatos/${contatoId}/documentos`), [contatoId]);
  const [tipo, setTipo] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try { await enviarArquivo({ contatoId, contratoId, tipo, arquivo }); setArquivo(null); e.target.reset(); docs.recarregar(); aoMudar?.(); }
    catch (err) { setErro(err.message); } finally { setEnviando(false); }
  }
  async function baixar(id) {
    try { const r = await api.get(`/api/documentos/${id}/download`); window.open(r.url, '_blank', 'noopener'); } catch (err) { setErro(err.message); }
  }
  async function excluir(d) {
    if (!window.confirm(`Excluir "${d.nomeArquivo}"? O registro fica no histórico.`)) return;
    try { await api.post(`/api/documentos/${d.id}/excluir`, { confirmar: true }); docs.recarregar(); } catch (err) { setErro(err.message); }
  }

  return (
    <div className="pn-cartao">
      <h2>Pasta do cliente</h2>
      {docs.carregando && <Carregando />}<Erro mensagem={docs.erro || erro} />
      <table className="pn-tabela">
        <thead><tr><th>Tipo</th><th>Arquivo</th><th>Enviado em</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {(docs.dados?.itens ?? []).map((d) => (
            <tr key={d.id}>
              <td>{ROTULOS.documento[d.tipo]}</td><td>{d.nomeArquivo}</td><td>{dataHoraBr(d.criadoEm)}</td>
              <td>{d.confirmado ? <Etiqueta tom="verde">confirmado</Etiqueta> : <Etiqueta tom="amarelo">não confirmado</Etiqueta>}</td>
              <td className="pn-direita">
                {d.confirmado && <button className="pn-botao-link" onClick={() => baixar(d.id)}>baixar</button>}
                <button className="pn-botao-link" onClick={() => excluir(d)}>excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="pn-form pn-linha-form" onSubmit={enviar}>
        <select required value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo de documento…</option>
          {TIPOS_DOC.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <input type="file" required onChange={(e) => setArquivo(e.target.files[0])} />
        <button className="btn-primary" disabled={enviando || !arquivo}>{enviando ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </div>
  );
}

export default function Contato() {
  const { id } = useParams();
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.get(`/api/contatos/${id}`), [id]);
  const [convite, setConvite] = useState(null);
  const [erroConvite, setErroConvite] = useState('');

  async function liberar() {
    if (!window.confirm('Liberar acesso ao portal para este cliente? Será gerado um link de convite para você enviar.')) return;
    setErroConvite('');
    try { setConvite(await api.post(`/api/contatos/${id}/liberar-acesso`, {})); } catch (e) { setErroConvite(e.message); }
  }

  if (carregando) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const { contato: c, oportunidades, contratos, orcamentos, podeLiberarAcesso } = dados;
  return (
    <section>
      <Link to="/painel/funil">← Funil</Link>
      <h1>{c.nome}</h1>
      <div className="pn-cartao pn-grade">
        <div><span className="pn-mudo">E-mail</span><br />{c.email ?? '—'}</div>
        <div><span className="pn-mudo">Telefone</span><br />{c.telefone ?? '—'}</div>
        <div><span className="pn-mudo">Origem</span><br />{ROTULOS.origem[c.origem]}{c.origemDetalhe ? ` — ${c.origemDetalhe}` : ''}</div>
        <div><span className="pn-mudo">Conversa externa</span><br />{c.idConversaExterna ?? '—'}</div>
        <div><span className="pn-mudo">Local</span><br />{[c.cidade, c.pais].filter(Boolean).join(', ') || '—'}</div>
        <div><span className="pn-mudo">Aceite de privacidade</span><br />{c.consentimentoPrivacidadeEm ? `${dataHoraBr(c.consentimentoPrivacidadeEm)} (${c.versaoAvisoPrivacidade})` : '—'}</div>
      </div>

      {oportunidades.map((o) => (
        <div key={o.id} className="pn-cartao">
          <h2>Oportunidade <Etiqueta>{ROTULOS.estado[o.estado]}</Etiqueta></h2>
          <p className="pn-mudo">Aberta em {dataHoraBr(o.criadoEm)}{o.dataReuniao ? ` · reunião ${dataHoraBr(o.dataReuniao)}` : ''}{o.motivoDesistencia ? ` · motivo: ${o.motivoDesistencia}` : ''}</p>
          {o.textoExterno && <blockquote className="pn-externo"><span className="pn-mudo">Mensagem recebida (conteúdo externo, apenas texto):</span><br />{o.textoExterno}</blockquote>}
          {o.proximosEstados.length > 0 && (
            <Acao rotuloBotao="Mudar estado" confirmar="Confirmar a mudança de estado?"
              campos={[
                { nome: 'para', rotulo: 'Novo estado', opcoes: o.proximosEstados.map((e) => [e, ROTULOS.estado[e]]) },
                { nome: 'dataReuniao', rotulo: 'Data da reunião (se agendando)', tipo: 'datetime-local', opcional: true },
                { nome: 'motivoDesistencia', rotulo: 'Motivo (se desistiu, opcional)', opcional: true },
              ]}
              aoEnviar={(v, ms) => api.post(`/api/oportunidades/${o.id}/estado`, {
                para: v.para,
                dataReuniao: v.dataReuniao ? new Date(v.dataReuniao).toISOString() : undefined,
                motivoDesistencia: v.motivoDesistencia || undefined,
              }, { duracaoMs: ms })}
              depois={recarregar}
            />
          )}
          {o.podeRegistrarContrato && <Link className="btn-primary" to={`/painel/oportunidades/${o.id}/contrato`}>Registrar contrato assinado</Link>}
          {contratos.filter((k) => k.oportunidadeId === o.id).map((k) => (
            <p key={k.id}><Link to={`/painel/contratos/${k.id}`}>Ver contrato — {ROTULOS.projeto[k.estadoProjeto]}</Link></p>
          ))}
        </div>
      ))}

      {orcamentos.length > 0 && (
        <div className="pn-cartao">
          <h2>Orçamentos do simulador</h2>
          {orcamentos.map((q) => (
            <p key={q.id}>{dataHoraBr(q.criadoEm)} — {reais(q.totalCentavos)} — {q.itens.map((i) => i.nome).join(', ')}</p>
          ))}
        </div>
      )}

      <PastaDocumentos contatoId={c.id} />

      <div className="pn-cartao">
        <h2>Acesso do cliente ao portal</h2>
        {!podeLiberarAcesso && <p className="pn-mudo">Disponível depois do contrato assinado e com e-mail cadastrado.</p>}
        {podeLiberarAcesso && !convite && <button className="btn-primary" onClick={liberar}>Liberar acesso</button>}
        <Erro mensagem={erroConvite} />
        {convite && (
          <div>
            <p>{convite.instrucao}</p>
            <input className="pn-copiar" readOnly value={convite.linkConvite} onFocus={(e) => e.target.select()} />
            <p className="pn-mudo">Este link aparece só agora. Ele não fica guardado no sistema.</p>
          </div>
        )}
      </div>
      <p className="pn-mudo">Primeiro lançamento em {dataBr(c.criadoEm)}.</p>
    </section>
  );
}

import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dataBr, enviarArquivo, reais, ROTULOS } from '../lib/api.js';
import { Acao, Carregando, Erro, Etiqueta, paraCentavos, useCarregar } from './comum.jsx';
import { PastaDocumentos } from './Contato.jsx';

export function Contratos() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/contratos'));
  const contatos = useCarregar(() => api.get('/api/contatos'));
  const nome = Object.fromEntries((contatos.dados?.itens ?? []).map((c) => [c.id, c.nome]));
  return (
    <section>
      <h1>Contratos</h1>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      <table className="pn-tabela">
        <thead><tr><th>Cliente</th><th>Objeto</th><th>Valor</th><th>Situação</th><th>Entrega prevista</th><th>Fim da garantia</th></tr></thead>
        <tbody>
          {(dados?.itens ?? []).map((c) => (
            <tr key={c.id}>
              <td><Link to={`/painel/contratos/${c.id}`}>{nome[c.contatoId] ?? '—'}</Link></td>
              <td>{c.objeto.slice(0, 80)}</td><td>{reais(c.valorTotalCentavos)}</td>
              <td><Etiqueta>{ROTULOS.projeto[c.estadoProjeto]}</Etiqueta></td>
              <td>{dataBr(c.entregaPrevista)}</td><td>{dataBr(c.fimGarantia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AceiteComDocumento({ contrato, depois }) {
  const [tipo, setTipo] = useState('');
  const [data, setData] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    if (!window.confirm('Registrar o aceite? A parcela vinculada ao aceite será liberada para cobrança.')) return;
    setErro(''); setEnviando(true);
    try {
      const doc = await enviarArquivo({ contatoId: contrato.contatoId, contratoId: contrato.id, tipo: tipo === 'expresso' ? 'termo_recebimento' : 'evidencia_aceite', arquivo });
      await api.post(`/api/contratos/${contrato.id}/aceite`, { tipo, data, documentoId: doc.id });
      depois();
    } catch (err) { setErro(err.message); } finally { setEnviando(false); }
  }
  return (
    <form className="pn-acao pn-form" onSubmit={enviar}>
      <h3>Registrar aceite</h3>
      <label>Tipo de aceite
        <select required value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Selecione…</option>
          {Object.entries(ROTULOS.aceite).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      <label>Data do aceite<input type="date" required value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>{tipo === 'expresso' ? 'Termo de recebimento assinado' : 'Evidência do aceite (print, registro de uso)'}
        <input type="file" required onChange={(e) => setArquivo(e.target.files[0])} />
      </label>
      <Erro mensagem={erro} />
      <button className="btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Registrar aceite'}</button>
    </form>
  );
}

export function ContratoDetalhe() {
  const { id } = useParams();
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.get(`/api/contratos/${id}`), [id]);
  if (carregando) return <Carregando />;
  if (erro) return <Erro mensagem={erro} />;
  const { contrato: c, parcelas, suspensoes, manutencoes, acoes } = dados;
  const aberta = suspensoes.find((s) => !s.fim);
  return (
    <section>
      <Link to="/painel/contratos">← Contratos</Link>
      <h1>Contrato <Etiqueta>{ROTULOS.projeto[c.estadoProjeto]}</Etiqueta></h1>
      <div className="pn-cartao">
        <p>{c.objeto}</p>
        <div className="pn-grade">
          <div><span className="pn-mudo">Valor total</span><br />{reais(c.valorTotalCentavos)}</div>
          <div><span className="pn-mudo">Assinatura</span><br />{dataBr(c.dataAssinatura)}</div>
          <div><span className="pn-mudo">Início do prazo (1º pagamento)</span><br />{dataBr(c.dataPrimeiroPagamento)}</div>
          <div><span className="pn-mudo">Entrega prevista</span><br /><strong>{dataBr(c.entregaPrevista)}</strong></div>
          <div><span className="pn-mudo">Entrega comunicada</span><br />{dataBr(c.dataComunicacaoEntrega)}</div>
          <div><span className="pn-mudo">Aceite</span><br />{c.dataAceite ? `${dataBr(c.dataAceite)} — ${ROTULOS.aceite[c.tipoAceite]}` : '—'}</div>
          <div><span className="pn-mudo">Fim da garantia</span><br />{dataBr(c.fimGarantia)}</div>
        </div>
        <Link to={`/painel/contatos/${c.contatoId}`}>Ver cliente</Link>
      </div>

      <div className="pn-cartao">
        <h2>Parcelas</h2>
        <table className="pn-tabela">
          <thead><tr><th>#</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Situação</th><th>Pagamento</th></tr></thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.id}>
                <td>{p.numero}</td><td>{p.descricao}</td><td>{reais(p.valorCentavos)}</td><td>{dataBr(p.vencimento)}</td>
                <td><Etiqueta tom={p.status === 'paga' ? 'verde' : p.status === 'a_receber' ? 'amarelo' : 'neutro'}>{ROTULOS.parcela[p.status]}</Etiqueta></td>
                <td>{p.dataPagamento ? `${dataBr(p.dataPagamento)} — ${ROTULOS.meio[p.meio]}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parcelas.filter((p) => p.podePagar).map((p) => (
          <div key={p.id} className="pn-grade">
            <Acao titulo={`Registrar pagamento da parcela ${p.numero}`} rotuloBotao="Marcar como paga"
              confirmar={`Confirmar o recebimento de ${reais(p.valorCentavos)}?`}
              campos={[{ nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'date' },
                { nome: 'meio', rotulo: 'Meio', opcoes: Object.entries(ROTULOS.meio) }]}
              aoEnviar={(v, ms) => api.post(`/api/parcelas/${p.id}/pagamento`, v, { duracaoMs: ms })} depois={recarregar} />
            <Acao titulo={`Corrigir vencimento da parcela ${p.numero}`} rotuloBotao="Corrigir"
              campos={[{ nome: 'vencimento', rotulo: 'Novo vencimento', tipo: 'date' }, { nome: 'motivo', rotulo: 'Motivo (ex.: feriado)' }]}
              aoEnviar={(v, ms) => api.post(`/api/parcelas/${p.id}/vencimento`, v, { duracaoMs: ms })} depois={recarregar} />
          </div>
        ))}
      </div>

      <div className="pn-cartao">
        <h2>Prazo e entrega</h2>
        {suspensoes.length > 0 && (
          <ul>{suspensoes.map((s) => <li key={s.id}>Suspenso de {dataBr(s.inicio)} a {s.fim ? dataBr(s.fim) : 'em aberto'} — {s.motivo}</li>)}</ul>
        )}
        <div className="pn-grade">
          {acoes.includes('abrir_suspensao') && (
            <Acao titulo="Suspender prazo (cliente pendente)" rotuloBotao="Suspender"
              campos={[{ nome: 'inicio', rotulo: 'Desde', tipo: 'date' }, { nome: 'motivo', rotulo: 'O que o cliente deve enviar' }]}
              aoEnviar={(v, ms) => api.post(`/api/contratos/${c.id}/suspensoes`, v, { duracaoMs: ms })} depois={recarregar} />
          )}
          {acoes.includes('encerrar_suspensao') && aberta && (
            <Acao titulo="Retomar prazo" rotuloBotao="Retomar"
              campos={[{ nome: 'fim', rotulo: 'Prazo volta a correr em', tipo: 'date' }]}
              aoEnviar={(v, ms) => api.post(`/api/suspensoes/${aberta.id}/encerrar`, v, { duracaoMs: ms })} depois={recarregar} />
          )}
          {acoes.includes('comunicar_entrega') && (
            <Acao titulo="Comunicar entrega ao cliente" rotuloBotao="Registrar entrega" confirmar="Registrar que a entrega foi comunicada por escrito ao cliente?"
              campos={[{ nome: 'data', rotulo: 'Data da comunicação', tipo: 'date' }]}
              aoEnviar={(v, ms) => api.post(`/api/contratos/${c.id}/entrega`, v, { duracaoMs: ms })} depois={recarregar} />
          )}
          {acoes.includes('registrar_aceite') && <AceiteComDocumento contrato={c} depois={recarregar} />}
        </div>
      </div>

      <div className="pn-cartao">
        <h2>Manutenção mensal</h2>
        {manutencoes.map((m) => (
          <p key={m.id}>{reais(m.valorMensalCentavos)} por mês, vencimento no dia {m.diaVencimento}, desde {dataBr(m.inicio)}{m.fim ? ` até ${dataBr(m.fim)}` : ''} {m.ativo ? <Etiqueta tom="verde">ativa</Etiqueta> : <Etiqueta>encerrada</Etiqueta>}</p>
        ))}
        {manutencoes.filter((m) => m.ativo).map((m) => (
          <Acao key={m.id} titulo="Encerrar manutenção" rotuloBotao="Encerrar" confirmar="Encerrar a manutenção deste contrato?"
            campos={[{ nome: 'fim', rotulo: 'Data de encerramento', tipo: 'date' }]}
            aoEnviar={(v) => api.post(`/api/manutencoes/${m.id}/encerrar`, v)} depois={recarregar} />
        ))}
        {acoes.includes('registrar_manutencao') && (
          <Acao titulo="Contratar manutenção" rotuloBotao="Registrar manutenção"
            campos={[{ nome: 'valor', rotulo: 'Valor mensal (R$)' }, { nome: 'inicio', rotulo: 'Início', tipo: 'date' },
              { nome: 'diaVencimento', rotulo: 'Dia do vencimento (1 a 28)', tipo: 'number' }]}
            aoEnviar={(v, ms) => api.post(`/api/contratos/${c.id}/manutencao`, { valorMensalCentavos: paraCentavos(v.valor), inicio: v.inicio, diaVencimento: Number(v.diaVencimento) }, { duracaoMs: ms })}
            depois={recarregar} />
        )}
      </div>

      <PastaDocumentos contatoId={c.contatoId} contratoId={c.id} aoMudar={recarregar} />
    </section>
  );
}

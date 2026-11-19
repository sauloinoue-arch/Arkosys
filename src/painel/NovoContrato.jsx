import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, cronometro, ROTULOS } from '../lib/api.js';
import { Carregando, Erro, paraCentavos, useCarregar } from './comum.jsx';

// Registro do contrato assinado. Os valores sugeridos (30 dias de prazo, 30 de garantia,
// 50% + 50% com 5 dias úteis após o aceite) são os do contrato do 1º cliente e podem ser alterados.
// Toda validação (soma das parcelas, documento confirmado, estado do funil) é feita pela API.
export default function NovoContrato() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [fim] = useState(() => cronometro());
  const opsCarregadas = useCarregar(() => api.get('/api/oportunidades'));
  const op = opsCarregadas.dados?.itens.find((o) => o.id === id);
  const docs = useCarregar(() => (op ? api.get(`/api/contatos/${op.contatoId}/documentos`) : Promise.resolve({ itens: [] })), [op?.contatoId]);
  const [f, setF] = useState({ objeto: '', valorTotal: '', dataAssinatura: '', prazoDiasCorridos: '30', diasGarantia: '30', documentoContratoId: '' });
  const [parcelas, setParcelas] = useState([
    { descricao: 'Entrada (50%)', valor: '', gatilho: 'assinatura', diasUteisAposGatilho: '0' },
    { descricao: 'Saldo (50%)', valor: '', gatilho: 'aceite', diasUteisAposGatilho: '5' },
  ]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (opsCarregadas.carregando) return <Carregando />;
  if (!op) return <Erro mensagem="Oportunidade não encontrada." />;
  const contratosConfirmados = (docs.dados?.itens ?? []).filter((d) => d.tipo === 'contrato' && d.confirmado);
  const mudarParcela = (i, campo, valor) => setParcelas(parcelas.map((p, j) => (i === j ? { ...p, [campo]: valor } : p)));

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try {
      const r = await api.post('/api/contratos', {
        oportunidadeId: id, objeto: f.objeto, valorTotalCentavos: paraCentavos(f.valorTotal), dataAssinatura: f.dataAssinatura,
        prazoDiasCorridos: Number(f.prazoDiasCorridos), diasGarantia: Number(f.diasGarantia), documentoContratoId: f.documentoContratoId,
        parcelas: parcelas.map((p) => ({ descricao: p.descricao, valorCentavos: paraCentavos(p.valor), gatilho: p.gatilho, diasUteisAposGatilho: Number(p.diasUteisAposGatilho) })),
      }, { duracaoMs: fim() });
      navegar(`/painel/contratos/${r.contrato.id}`);
    } catch (err) { setErro(err.message); setEnviando(false); }
  }

  return (
    <section>
      <Link to={`/painel/contatos/${op.contatoId}`}>← Contato</Link>
      <h1>Registrar contrato assinado</h1>
      {contratosConfirmados.length === 0 && (
        <p className="pn-erro">Antes, envie o PDF do contrato assinado na pasta do cliente (tipo "Contrato").</p>
      )}
      <form className="pn-cartao pn-form" onSubmit={salvar}>
        <label>Objeto da contratação<textarea required value={f.objeto} onChange={(e) => setF({ ...f, objeto: e.target.value })} /></label>
        <div className="pn-grade">
          <label>Valor total (R$)<input required inputMode="decimal" value={f.valorTotal} onChange={(e) => setF({ ...f, valorTotal: e.target.value })} /></label>
          <label>Data da assinatura<input required type="date" value={f.dataAssinatura} onChange={(e) => setF({ ...f, dataAssinatura: e.target.value })} /></label>
          <label>Prazo de entrega (dias corridos após o 1º pagamento)<input required type="number" min="1" value={f.prazoDiasCorridos} onChange={(e) => setF({ ...f, prazoDiasCorridos: e.target.value })} /></label>
          <label>Garantia (dias após o aceite)<input required type="number" min="0" value={f.diasGarantia} onChange={(e) => setF({ ...f, diasGarantia: e.target.value })} /></label>
        </div>
        <label>PDF do contrato assinado
          <select required value={f.documentoContratoId} onChange={(e) => setF({ ...f, documentoContratoId: e.target.value })}>
            <option value="">Selecione…</option>
            {contratosConfirmados.map((d) => <option key={d.id} value={d.id}>{d.nomeArquivo}</option>)}
          </select>
        </label>
        <h3>Parcelas</h3>
        {parcelas.map((p, i) => (
          <div key={i} className="pn-grade">
            <label>Descrição<input required value={p.descricao} onChange={(e) => mudarParcela(i, 'descricao', e.target.value)} /></label>
            <label>Valor (R$)<input required inputMode="decimal" value={p.valor} onChange={(e) => mudarParcela(i, 'valor', e.target.value)} /></label>
            <label>Vence a partir de
              <select value={p.gatilho} onChange={(e) => mudarParcela(i, 'gatilho', e.target.value)}>
                <option value="assinatura">Assinatura</option><option value="entrega">Entrega</option><option value="aceite">Aceite</option>
              </select>
            </label>
            <label>Dias úteis depois<input type="number" min="0" value={p.diasUteisAposGatilho} onChange={(e) => mudarParcela(i, 'diasUteisAposGatilho', e.target.value)} /></label>
          </div>
        ))}
        <div className="pn-linha-form">
          <button type="button" className="btn-outline" onClick={() => setParcelas([...parcelas, { descricao: '', valor: '', gatilho: 'aceite', diasUteisAposGatilho: '0' }])}>+ parcela</button>
          {parcelas.length > 1 && <button type="button" className="btn-outline" onClick={() => setParcelas(parcelas.slice(0, -1))}>− parcela</button>}
        </div>
        <Erro mensagem={erro} />
        <button className="btn-primary" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar contrato'}</button>
        <p className="pn-mudo">Ao salvar, a oportunidade passa para "{ROTULOS.estado.contrato_assinado}".</p>
      </form>
    </section>
  );
}

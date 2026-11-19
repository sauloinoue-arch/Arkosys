import React, { useEffect, useState } from 'react';
import './Simulator.css';
import { createWhatsAppUrl } from '../utils/contact';
import { api, reais } from '../lib/api';

// R1: preços, total e parcelamento vêm da API (/api/publico/precos e /api/publico/orcamento).
// A tela só exibe e envia. O e-mail é registrado antes do orçamento (decisão do usuário, 17/11/2026).
const Simulator = () => {
  const [tabela, setTabela] = useState(null);
  const [erroTabela, setErroTabela] = useState('');
  const [selecionados, setSelecionados] = useState([]);
  const [etapa, setEtapa] = useState('escolha'); // escolha | cadastro | orcamento
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', aceite: false });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [orcamento, setOrcamento] = useState(null);

  useEffect(() => {
    api.get('/api/publico/precos', { publico: true }).then(setTabela).catch(() => setErroTabela('Não foi possível carregar a tabela de preços agora.'));
  }, []);

  const alternar = (codigo) => setSelecionados((p) => (p.includes(codigo) ? p.filter((c) => c !== codigo) : [...p, codigo]));
  const escolhidos = tabela ? tabela.adicionais.filter((a) => selecionados.includes(a.codigo)) : [];
  // Soma apenas para exibição durante a escolha; o valor oficial é o devolvido pela API no orçamento.
  const somaExibida = tabela ? (tabela.base?.precoCentavos ?? 0) + escolhidos.reduce((t, a) => t + a.precoCentavos, 0) : 0;

  async function gerar(e) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try {
      const { cadastro } = await api.post('/api/publico/cadastro', {
        nome: form.nome, email: form.email, telefone: form.telefone || undefined,
        aceitePrivacidade: form.aceite, versaoAvisoPrivacidade: tabela.versaoAvisoPrivacidade,
      }, { publico: true });
      const r = await api.post('/api/publico/orcamento', { cadastro, adicionais: selecionados }, { publico: true });
      setOrcamento(r.orcamento);
      setEtapa('orcamento');
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function abrirWhatsApp() {
    const linhas = orcamento.itens.map((i) => `• ${i.nome} (${reais(i.precoCentavos)})`).join('\n');
    const url = createWhatsAppUrl(`Olá! Gerei um orçamento no site da Arkosys:\n\n${linhas}\n\n*Total estimado: ${reais(orcamento.totalCentavos)}*\n(Código ${orcamento.id.slice(0, 8)})`);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section id="simulador" className="simulator-section">
      <div className="simulator-container">
        <div className="simulator-header">
          <span className="section-badge">Calculadora em Tempo Real</span>
          <h2 className="section-title">Simule o Investimento do seu Sistema</h2>
          <p className="section-desc">Personalize as funcionalidades necessárias para o seu negócio e veja o orçamento atualizar na hora.</p>
        </div>

        {erroTabela && <p className="simulator-erro">{erroTabela}</p>}
        {tabela && (
          <div className="simulator-grid">
            <div className="options-panel">
              {tabela.base && (
                <div className="base-card glassmorphism">
                  <div className="base-card-info">
                    <div className="base-badge">Incluso no Pacote Base</div>
                    <h3 className="base-title">{tabela.base.nome}</h3>
                    <p className="base-desc">{tabela.base.descricao}</p>
                  </div>
                  <div className="base-price">
                    <span className="price-tag">{reais(tabela.base.precoCentavos)}</span>
                    <span className="price-type">taxa inicial de setup</span>
                  </div>
                </div>
              )}
              <div className="addons-section-title">
                <h3>Personalize com Módulos Adicionais</h3>
                <p>Selecione as ferramentas complementares para o seu projeto:</p>
              </div>
              <div className="addons-list">
                {tabela.adicionais.map((a) => {
                  const marcado = selecionados.includes(a.codigo);
                  return (
                    <div key={a.codigo} className={`addon-item glassmorphism ${marcado ? 'active' : ''}`} onClick={() => etapa === 'escolha' && alternar(a.codigo)}>
                      <label className="checkbox-container" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={marcado} disabled={etapa !== 'escolha'} onChange={() => alternar(a.codigo)} />
                        <span className="checkmark"></span>
                      </label>
                      <div className="addon-details">
                        <div className="addon-header">
                          <span className="addon-name">{a.nome}</span>
                          <span className="addon-price">+{reais(a.precoCentavos)}</span>
                        </div>
                        <p className="addon-desc">{a.descricao}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="summary-wrapper">
              <div className="summary-panel glassmorphism">
                {etapa === 'escolha' && (
                  <>
                    <h3 className="summary-title">Resumo do Orçamento</h3>
                    <p className="summary-subtitle">Investimento total estimado em tempo real</p>
                    <div className="summary-items">
                      <div className="summary-item"><span>Sistema Base</span><span>{reais(tabela.base?.precoCentavos)}</span></div>
                      {escolhidos.map((i) => (
                        <div key={i.codigo} className="summary-item summary-addon-item"><span>{i.nome}</span><span>+{reais(i.precoCentavos)}</span></div>
                      ))}
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-total-container">
                      <span className="total-label">Investimento Total</span>
                      <span className="total-amount">{reais(somaExibida)}</span>
                    </div>
                    <button type="button" className="btn-primary summary-cta" onClick={() => setEtapa('cadastro')}>Gerar meu orçamento</button>
                    <div className="summary-guarantee"><span>🔒 Sem compromisso inicial.</span></div>
                  </>
                )}

                {etapa === 'cadastro' && (
                  <form onSubmit={gerar} className="simulator-cadastro">
                    <h3 className="summary-title">Antes do orçamento</h3>
                    <p className="summary-subtitle">Informe seus dados para receber o orçamento e o retorno da equipe.</p>
                    <label>Nome<input required minLength={2} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
                    <label>E-mail<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label>Telefone (opcional)<input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></label>
                    <label className="simulator-aceite">
                      <input type="checkbox" checked={form.aceite} onChange={(e) => setForm({ ...form, aceite: e.target.checked })} />
                      <span>Li e aceito o <a href="/privacidade" target="_blank" rel="noopener">aviso de privacidade</a>.</span>
                    </label>
                    {erro && <p className="simulator-erro">{erro}</p>}
                    <button type="submit" className="btn-primary summary-cta" disabled={enviando || !form.aceite}>{enviando ? 'Gerando…' : 'Ver orçamento'}</button>
                    <button type="button" className="btn-outline" onClick={() => setEtapa('escolha')}>Voltar</button>
                  </form>
                )}

                {etapa === 'orcamento' && orcamento && (
                  <>
                    <h3 className="summary-title">Seu orçamento</h3>
                    <div className="summary-items">
                      {orcamento.itens.map((i) => (
                        <div key={i.codigo} className="summary-item"><span>{i.nome}</span><span>{reais(i.precoCentavos)}</span></div>
                      ))}
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-total-container">
                      <span className="total-label">Investimento Total</span>
                      <span className="total-amount">{reais(orcamento.totalCentavos)}</span>
                      <span className="total-installment">à vista</span>
                    </div>
                    {/* CDC, arts. 52 e 54-B: informações da venda a prazo, todas calculadas pela API. */}
                    <div className="simulator-prazo">
                      <p><strong>Ou {orcamento.parcelamento.vezes}x de {reais(orcamento.parcelamento.parcelaCentavos)}</strong> no {orcamento.parcelamento.meio}, em parcelas mensais.</p>
                      <p>Total a prazo: {reais(orcamento.parcelamento.totalAPrazoCentavos)} — acréscimo de {reais(orcamento.parcelamento.acrescimoCentavos)} ({orcamento.parcelamento.acrescimoPercentual.toLocaleString('pt-BR')}% sobre o valor à vista de {reais(orcamento.parcelamento.valorAVistaCentavos)}).</p>
                      <p>Taxa efetiva equivalente: {orcamento.parcelamento.taxaEfetivaMensalPercentual.toLocaleString('pt-BR')}% ao mês ({orcamento.parcelamento.taxaEfetivaAnualPercentual.toLocaleString('pt-BR')}% ao ano).</p>
                      <p>Condições válidas até {new Date(`${orcamento.parcelamento.validadeOferta}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}. Fornecedor: Arkosys Tech Solutions — atendimento@arkosys.com.br.</p>
                    </div>
                    <p className="simulator-aviso">{orcamento.aviso}</p>
                    {createWhatsAppUrl('') ? (
                      <button type="button" className="btn-primary summary-cta" onClick={abrirWhatsApp}>Falar com a equipe no WhatsApp</button>
                    ) : (
                      <p className="summary-subtitle">Orçamento registrado. A equipe da Arkosys entrará em contato pelo e-mail informado.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Simulator;

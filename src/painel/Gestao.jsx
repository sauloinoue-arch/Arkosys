import React from 'react';
import { Link } from 'react-router-dom';
import { api, dataBr, dataHoraBr, reais } from '../lib/api.js';
import { Carregando, Erro, Etiqueta, tomPorDias, useCarregar } from './comum.jsx';

export function Cobrancas() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/alertas'));
  const itens = (dados?.itens ?? []).filter((a) => a.tipo === 'parcela_a_receber' || a.tipo === 'manutencao');
  return (
    <section>
      <h1>Cobranças</h1>
      <p className="pn-mudo">Parcelas a receber e manutenções ativas. O pagamento é marcado na tela do contrato, com o comprovante na pasta do cliente.</p>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      <table className="pn-tabela">
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th></th></tr></thead>
        <tbody>
          {itens.map((a, i) => (
            <tr key={i}>
              <td>{a.cliente ?? '—'}</td><td>{a.tipo === 'manutencao' ? 'Manutenção mensal' : 'Parcela'}</td><td>{reais(a.valorCentavos)}</td>
              <td><Etiqueta tom={tomPorDias(a.diasRestantes)}>{dataBr(a.data)}</Etiqueta></td>
              <td><Link to={`/painel/contratos/${a.contratoId}`}>abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Eventos() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/eventos?limite=300'));
  return (
    <section>
      <h1>Registro de eventos</h1>
      <p className="pn-mudo">Quem alterou o quê, quando e por qual via. Não pode ser editado nem apagado.</p>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      <table className="pn-tabela">
        <thead><tr><th>Quando</th><th>Quem</th><th>Via</th><th>Entidade</th><th>Ação</th></tr></thead>
        <tbody>
          {(dados?.itens ?? []).map((e) => (
            <tr key={e.id}>
              <td>{dataHoraBr(e.ocorridoEm)}</td><td>{e.ator ?? (e.atorTipo === 'publico' ? 'visitante do site' : '—')}</td>
              <td>{e.via}</td><td>{e.entidade}</td><td>{e.acao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Usuarios({ eu }) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.get('/api/usuarios'));
  async function alternar(u) {
    if (!window.confirm(`${u.ativo ? 'Desativar' : 'Reativar'} o acesso de ${u.email}?`)) return;
    try { await api.post(`/api/usuarios/${u.id}/ativo`, { ativo: !u.ativo }); recarregar(); } catch (e) { window.alert(e.message); }
  }
  return (
    <section>
      <h1>Usuários</h1>
      <p className="pn-mudo">Os três sócios têm os mesmos poderes; a área só identifica. Clientes veem apenas o próprio projeto.</p>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      <table className="pn-tabela">
        <thead><tr><th>E-mail</th><th>Tipo</th><th>Área</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {(dados?.itens ?? []).map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td><td>{u.tipo}</td><td>{u.area ?? '—'}</td>
              <td>{u.ativo ? <Etiqueta tom="verde">ativo</Etiqueta> : <Etiqueta tom="vermelho">desativado</Etiqueta>}
                {u.deveTrocarSenha && <> <Etiqueta tom="amarelo">senha provisória</Etiqueta></>}</td>
              <td>{u.id !== eu.id && <button className="pn-botao-link" onClick={() => alternar(u)}>{u.ativo ? 'desativar' : 'reativar'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Medicao() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/medicao'));
  return (
    <section>
      <h1>Medição do lançamento manual</h1>
      <p className="pn-mudo">Tempo entre abrir e salvar cada formulário do painel. Critério (d) da Fase 3: mais de {dados?.criterioHorasSemana ?? 2} horas por semana.</p>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      <table className="pn-tabela">
        <thead><tr><th>Semana iniciada em</th><th>Lançamentos</th><th>Horas</th><th>Critério (d)</th></tr></thead>
        <tbody>
          {(dados?.semanas ?? []).map((s) => (
            <tr key={s.semana}>
              <td>{dataBr(s.semana)}</td><td>{s.lancamentos}</td><td>{s.horas.toFixed(2)}</td>
              <td>{s.acimaDoCriterio ? <Etiqueta tom="amarelo">acima</Etiqueta> : <Etiqueta>abaixo</Etiqueta>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dados && dados.semanas.length === 0 && <p>Ainda não há medições.</p>}
    </section>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { api, dataBr, reais } from '../lib/api.js';
import { Carregando, Erro, Etiqueta, tomPorDias, useCarregar } from './comum.jsx';

const DESCRICAO = {
  prazo_entrega: (a) => `Entrega prevista${a.suspenso ? ' (prazo suspenso)' : ''}`,
  parcela_a_receber: (a) => `Parcela a receber — ${reais(a.valorCentavos)}`,
  fim_garantia: () => 'Fim da garantia e do tratamento de dados como operadora',
  manutencao: (a) => `Manutenção mensal — ${reais(a.valorCentavos)}`,
  documento_sem_confirmacao: (a) => `Documento enviado sem confirmação: ${a.nomeArquivo}`,
};

const textoDias = (d) => (d === null || d === undefined ? '' : d < 0 ? `${-d} dia(s) de atraso` : d === 0 ? 'hoje' : `faltam ${d} dia(s)`);

export default function Alertas() {
  const { dados, erro, carregando } = useCarregar(() => api.get('/api/alertas'));
  return (
    <section>
      <h1>Alertas</h1>
      <p className="pn-mudo">Somente aviso interno. Nada aqui é enviado ao cliente.</p>
      {carregando && <Carregando />}<Erro mensagem={erro} />
      {dados && dados.itens.length === 0 && <p>Nenhum alerta.</p>}
      {dados && (
        <ul className="pn-lista">
          {dados.itens.map((a, i) => (
            <li key={i} className="pn-cartao pn-linha">
              <div>
                <strong>{DESCRICAO[a.tipo]?.(a) ?? a.tipo}</strong>
                <div className="pn-mudo">{a.cliente ?? '—'} · {dataBr(a.data)}</div>
              </div>
              <div className="pn-direita">
                {a.diasRestantes !== undefined && <Etiqueta tom={tomPorDias(a.diasRestantes)}>{textoDias(a.diasRestantes)}</Etiqueta>}
                {a.contratoId && <Link to={`/painel/contratos/${a.contratoId}`}>abrir</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

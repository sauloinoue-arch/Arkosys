import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dataBr, ROTULOS } from '../lib/api.js';
import { Acao, Carregando, Erro, useCarregar } from './comum.jsx';

const COLUNAS = ['cadastro_site', 'orcamento_gerado', 'contato_recebido', 'reuniao_agendada', 'reuniao_realizada',
  'proposta_contrato_enviados', 'contrato_assinado', 'aguardando_retorno', 'desistiu'];
const ORIGENS_MANUAIS = ['ia_generativa', 'instagram', 'google_ads', 'whatsapp', 'indicacao', 'presencial'];

export default function Funil() {
  const ops = useCarregar(() => api.get('/api/oportunidades'));
  const contatos = useCarregar(() => api.get('/api/contatos'));
  const [novo, setNovo] = useState(false);
  const nome = Object.fromEntries((contatos.dados?.itens ?? []).map((c) => [c.id, c.nome]));
  return (
    <section>
      <div className="pn-cabecalho">
        <h1>Funil comercial</h1>
        <button className="btn-primary" onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : 'Novo contato'}</button>
      </div>
      {novo && (
        <Acao titulo="Novo contato (lançamento manual)" rotuloBotao="Salvar contato"
          campos={[
            { nome: 'nome', rotulo: 'Nome' },
            { nome: 'nomeComercial', rotulo: 'Nome comercial', opcional: true },
            { nome: 'email', rotulo: 'E-mail', tipo: 'email', opcional: true },
            { nome: 'telefone', rotulo: 'Telefone', opcional: true },
            { nome: 'pais', rotulo: 'País', opcional: true },
            { nome: 'cidade', rotulo: 'Cidade', opcional: true },
            { nome: 'origem', rotulo: 'Origem', opcoes: ORIGENS_MANUAIS.map((o) => [o, ROTULOS.origem[o]]) },
            { nome: 'origemDetalhe', rotulo: 'Detalhe da origem', opcional: true },
            { nome: 'idConversaExterna', rotulo: 'Identificador da conversa (WhatsApp etc.)', opcional: true },
            { nome: 'textoExterno', rotulo: 'Mensagem recebida (guardada como texto, nunca executada)', tipo: 'textarea', opcional: true },
          ]}
          aoEnviar={(v, ms) => api.post('/api/contatos', Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')), { duracaoMs: ms })}
          depois={() => { setNovo(false); ops.recarregar(); contatos.recarregar(); }}
        />
      )}
      {(ops.carregando || contatos.carregando) && <Carregando />}
      <Erro mensagem={ops.erro || contatos.erro} />
      {ops.dados && (
        <div className="pn-colunas">
          {COLUNAS.map((col) => {
            const itens = ops.dados.itens.filter((o) => o.estado === col);
            return (
              <div key={col} className="pn-coluna">
                <h3>{ROTULOS.estado[col]} <span className="pn-mudo">({itens.length})</span></h3>
                {itens.map((o) => (
                  <Link key={o.id} to={`/painel/contatos/${o.contatoId}`} className="pn-cartao pn-ficha">
                    <strong>{nome[o.contatoId] ?? 'Contato'}</strong>
                    <span className="pn-mudo">{ROTULOS.origem[o.origem]} · {dataBr(o.criadoEm)}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

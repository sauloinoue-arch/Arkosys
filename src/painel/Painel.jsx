import React from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useSessao, sair } from '../lib/useSessao.js';
import { Carregando } from './comum.jsx';
import Alertas from './Alertas.jsx';
import Funil from './Funil.jsx';
import Contato from './Contato.jsx';
import NovoContrato from './NovoContrato.jsx';
import { Contratos, ContratoDetalhe } from './Contratos.jsx';
import { Cobrancas, Eventos, Usuarios, Medicao } from './Gestao.jsx';
import './painel.css';

const MENU = [
  ['/painel', 'Alertas', true], ['/painel/funil', 'Funil'], ['/painel/contratos', 'Contratos'],
  ['/painel/cobrancas', 'Cobranças'], ['/painel/eventos', 'Eventos'], ['/painel/usuarios', 'Usuários'], ['/painel/medicao', 'Medição'],
];

export default function Painel() {
  const eu = useSessao('socio');
  const navegar = useNavigate();
  if (!eu) return <div className="pn-centro"><Carregando /></div>;
  return (
    <div className="pn-layout">
      <aside className="pn-lateral">
        <span className="pn-marca">
          <picture>
            <source srcSet="/images/icone-512.webp" type="image/webp" />
            <img src="/images/icone-512.png" alt="Arkosys Tech Solutions" className="pn-logo" width="40" height="40" />
          </picture>
          <span className="marca-texto" aria-hidden="true"><strong>ARKOSYS</strong><small>TECH SOLUTIONS</small></span>
        </span>
        <nav>{MENU.map(([to, rotulo, fim]) => <NavLink key={to} to={to} end={fim}>{rotulo}</NavLink>)}</nav>
        <div className="pn-usuario">
          <span>{eu.email}</span>
          <button className="btn-outline" onClick={() => sair(navegar)}>Sair</button>
        </div>
      </aside>
      <main className="pn-conteudo">
        <Routes>
          <Route index element={<Alertas />} />
          <Route path="funil" element={<Funil />} />
          <Route path="contatos/:id" element={<Contato />} />
          <Route path="oportunidades/:id/contrato" element={<NovoContrato />} />
          <Route path="contratos" element={<Contratos />} />
          <Route path="contratos/:id" element={<ContratoDetalhe />} />
          <Route path="cobrancas" element={<Cobrancas />} />
          <Route path="eventos" element={<Eventos />} />
          <Route path="usuarios" element={<Usuarios eu={eu} />} />
          <Route path="medicao" element={<Medicao />} />
        </Routes>
      </main>
    </div>
  );
}

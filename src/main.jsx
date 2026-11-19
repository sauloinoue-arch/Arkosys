import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import Entrar from './paginas/Entrar.jsx';
import TrocarSenha from './paginas/TrocarSenha.jsx';
import Privacidade from './paginas/Privacidade.jsx';
import Painel from './painel/Painel.jsx';
import Portal from './portal/Portal.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/trocar-senha" element={<TrocarSenha />} />
        <Route path="/painel/*" element={<Painel />} />
        <Route path="/portal" element={<Portal />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

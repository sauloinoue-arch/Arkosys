import React from 'react';
import './Features.css';

const featureData = [
  {
    title: 'Design Premium',
    desc: 'Interface moderna e limpa, desenhada para o seu cliente encontrar o que precisa sem esforço.',
    icon: '✨'
  },
  {
    title: 'Simulador em Tempo Real',
    desc: 'Dê autonomia para o cliente montar seu próprio orçamento instantaneamente, eliminando atritos.',
    icon: '⚡'
  },
  {
    title: 'Totalmente Responsivo',
    desc: 'Layout adaptado para computador, tablet e celular.',
    icon: '📱'
  },
  {
    title: 'Foco em Conversão',
    desc: 'Telas organizadas para levar o visitante ao contato e ao pedido de orçamento.',
    icon: '🚀'
  }
];

const FeatureCard = ({ title, desc, icon }) => (
  <div className="feature-card glassmorphism">
    <div className="card-icon">{icon}</div>
    <h3 className="card-title">{title}</h3>
    <p className="card-desc">{desc}</p>
  </div>
);

const Features = () => {
  return (
    <section id="recursos" className="features-section">
      <div className="features-container">
        <h2 className="section-title">Por que escolher nosso sistema?</h2>
        <div className="features-grid">
          {featureData.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>

        {/* Spotlight Showcase: Mobile & Realtime Integration */}
        <div className="features-spotlight glassmorphism">
          <div className="spotlight-content">
            <span className="spotlight-tag">Módulo Mobile (orçado à parte)</span>
            <h3 className="spotlight-title">Gestão Completa na Palma da sua Mão</h3>
            <p className="spotlight-desc">
              Além do painel web, o sistema pode ganhar um aplicativo para Android e iOS.
              Acompanhe pedidos, receba alertas de novos contatos e consulte o financeiro onde estiver.
            </p>
            <ul className="spotlight-list">
              <li>
                <span className="spotlight-bullet">✓</span> Notificações de vendas e agendamentos
              </li>
              <li>
                <span className="spotlight-bullet">✓</span> Dados sincronizados com a nuvem
              </li>
              <li>
                <span className="spotlight-bullet">✓</span> Acesso com login individual e conexão criptografada (HTTPS)
              </li>
            </ul>
            <div className="spotlight-action">
              <a href="#simulador" className="btn-primary">
                Incluir App no Orçamento
              </a>
            </div>
          </div>
          <div className="spotlight-media">
            <img
              src="/images/mobile-preview.png"
              alt="Exemplo de tela em celular com dados fictícios"
              className="spotlight-img"
              width="390"
              height="760"
              loading="lazy"
              decoding="async"
            />
            <p className="ilustrativa">Imagem ilustrativa com dados fictícios.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;

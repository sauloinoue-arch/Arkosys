import React from 'react';
import './Footer.css';
import { CONTACT_NUMBERS, formatPhoneNumber, createWhatsAppUrl } from '../utils/contact';

const Footer = () => {
  const handleWhatsAppGeneralClick = (e) => {
    e.preventDefault();
    const url = createWhatsAppUrl('Olá! Gostaria de mais informações sobre o desenvolvimento de sistemas.');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSpecificNumberClick = (phone, e) => {
    e.preventDefault();
    const message = encodeURIComponent('Olá! Gostaria de conversar com a equipe de atendimento sobre os sistemas.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <footer id="contato" className="footer">
      <div className="footer-container">
        {/* Brand Column */}
        <div className="footer-brand">
          <div className="footer-logo">
            <picture>
            <source srcSet="/images/icone-512.webp" type="image/webp" />
            <img src="/images/icone-512.png" alt="Arkosys Tech Solutions" className="footer-logo-img" width="56" height="56" decoding="async" />
          </picture>
          <span className="marca-texto" aria-hidden="true"><strong>ARKOSYS</strong><small>TECH SOLUTIONS</small></span>
          </div>
          <p className="footer-tagline">
            Desenvolvimento de sistemas sob medida para pequenas empresas, no Brasil e no exterior.
          </p>
          <div className="footer-status-pill">
            <span>Atendimento por WhatsApp e e-mail</span>
          </div>
        </div>

        {/* Quick Navigation Column */}
        <div className="footer-col">
          <h4 className="footer-heading">Navegação</h4>
          <ul className="footer-nav-list">
            <li><a href="#inicio">Início</a></li>
            <li><a href="#recursos">Funcionalidades & App</a></li>
            <li><a href="#simulador">Simulador de Orçamento</a></li>
          </ul>
        </div>

        {/* Direct Contact Column */}
        <div className="footer-col footer-contact-col">
          <h4 className="footer-heading">Canais Oficiais</h4>
          
          <div className="contact-item">
            <span className="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7 L12 13 L20 7" /></svg></span>
            <div className="contact-meta">
              <span className="contact-label">E-mail Comercial</span>
              <a href="mailto:atendimento@arkosys.com.br" className="contact-value-link">
                atendimento@arkosys.com.br
              </a>
            </div>
          </div>

          <div className="contact-item">
            <span className="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18.5 L5.3 14.8 A8 8 0 1 1 8.6 18 Z" /><path d="M9 11 H9.01 M12 11 H12.01 M15 11 H15.01" /></svg></span>
            <div className="contact-meta">
              <span className="contact-label">Atendimento WhatsApp</span>
              <div className="phone-numbers-list">
                {CONTACT_NUMBERS.map((phone) => (
                  <button
                    key={phone}
                    type="button"
                    onClick={(e) => handleSpecificNumberClick(phone, e)}
                    className="phone-chip"
                    title={`Conversar com ${formatPhoneNumber(phone)}`}
                  >
                    <span>{formatPhoneNumber(phone)}</span>
                    <span className="chip-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <p>&copy; {new Date().getFullYear()} Arkosys — Desenvolvimento de Sistemas. Todos os direitos reservados.
            {' '}<a href="/privacidade">Aviso de privacidade</a> · <a href="/entrar">Área restrita</a></p>
          <div className="footer-guarantee-note">
            <span>🔒 Conexão criptografada (HTTPS)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

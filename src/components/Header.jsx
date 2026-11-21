import React, { useState } from 'react';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="header glassmorphism">
      <div className="header-container">
        <a href="#inicio" className="logo-link" aria-label="Arkosys Tech Solutions Início">
          <picture>
            <source srcSet="/images/icone-512.webp" type="image/webp" />
            <img src="/images/icone-512.png" alt="Arkosys Tech Solutions" className="header-logo-img" width="46" height="46" decoding="async" />
          </picture>
          <span className="marca-texto" aria-hidden="true"><strong>ARKOSYS</strong><small>TECH SOLUTIONS</small></span>
        </a>
        
        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <a href="#inicio">Início</a>
          <a href="#recursos">Recursos</a>
          <a href="#simulador">Simulador</a>
          <a href="#contato">Contato</a>
        </nav>
        
        <div className="cta-container desktop-cta">
          <a href="/entrar" className="btn-entrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16.6 7.6 14 12 14 C16.4 14 20 16.6 20 21" /></svg>
            Entrar
          </a>
          <a href="#simulador" className="btn-primary">Simular Orçamento</a>
        </div>

        {/* Mobile Hamburger Button */}
        <button className="hamburger" onClick={toggleMenu} aria-label="Abrir Menu">
          <span className={`bar ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`bar ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`bar ${isMenuOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Overlay Menu */}
      <div className={`mobile-overlay ${isMenuOpen ? 'open' : ''}`}>
        <nav className="mobile-nav">
          <a href="#inicio" onClick={toggleMenu}>Início</a>
          <a href="#recursos" onClick={toggleMenu}>Recursos</a>
          <a href="#simulador" onClick={toggleMenu}>Simulador</a>
          <a href="#contato" onClick={toggleMenu}>Contato</a>
          <a href="#simulador" onClick={toggleMenu} className="btn-primary">Simular Orçamento</a>
          <a href="/entrar" className="btn-entrar">Entrar — sócios e clientes</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;

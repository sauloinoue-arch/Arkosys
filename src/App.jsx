import React from 'react';
import TechBackground from './components/TechBackground';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Simulator from './components/Simulator';
import Footer from './components/Footer';
import Protecao from './components/Protecao';

function App() {
  return (
    <div className="app-container">
      <Protecao silencioso><TechBackground /></Protecao>
      <Header />
      <main>
        <Protecao><Hero /></Protecao>
        <Protecao><Features /></Protecao>
        <Protecao><Simulator /></Protecao>
      </main>
      <Footer />
    </div>
  );
}

export default App;

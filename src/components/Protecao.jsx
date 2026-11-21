import React from 'react';

// Isola falhas de um bloco da página: se um componente quebrar, só ele some,
// com um aviso, em vez de a página inteira ficar em branco.
export default class Protecao extends React.Component {
  constructor(props) { super(props); this.state = { falhou: false }; }
  static getDerivedStateFromError() { return { falhou: true }; }
  componentDidCatch(erro) { console.error('Falha em bloco da página:', erro?.message); }
  render() {
    if (this.state.falhou) {
      return this.props.silencioso ? null : (
        <p className="pn-mudo" style={{ textAlign: 'center', padding: 24 }}>
          Esta parte da página não carregou. Atualize a página ou fale com atendimento@arkosys.com.br.
        </p>
      );
    }
    return this.props.children;
  }
}

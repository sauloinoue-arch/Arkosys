import React, { useId } from 'react';

/*
  Ícones da marca: o cubo isométrico do logo da Arkosys com o símbolo de cada
  recurso "impresso" na face frontal do cubo. Desenho próprio (SVG), sem
  biblioteca de ícones nem emoji.

  Geometria (viewBox 64×64), a mesma silhueta hexagonal do logo:
    topo (32,6) · direita (54,18)/(54,42) · base (32,54) · esquerda (10,42)/(10,18) · centro (32,30)
  Face frontal-direita: quadrado unitário mapeado por matrix(22,-12,0,24,32,30).
  Os símbolos são desenhados numa grade 24×24 e projetados nessa face.
*/

const SIMBOLOS = {
  // Brilho de quatro pontas: acabamento de design.
  design: <path d="M12 3.5 L13.9 10.1 L20.5 12 L13.9 13.9 L12 20.5 L10.1 13.9 L3.5 12 L10.1 10.1 Z" />,
  // Raio: cálculo instantâneo.
  tempoReal: <path d="M13.5 3 L6 13.5 H11.5 L10.5 21 L18 10.5 H12.5 Z" />,
  // Telas de tamanhos diferentes: responsivo.
  responsivo: (
    <>
      <rect x="3" y="5" width="12" height="9" rx="1.5" />
      <rect x="15.5" y="8.5" width="5.5" height="11" rx="1.2" />
      <path d="M6 18 H12" />
    </>
  ),
  // Linha de crescimento: conversão.
  conversao: (
    <>
      <path d="M3.5 17.5 L9.5 11.5 L13 15 L20 8" />
      <path d="M15 8 H20 V13" />
    </>
  ),
};

const IconeCubo = ({ tipo, tamanho = 76, titulo }) => {
  const id = useId().replace(/:/g, '');
  const traco = `ic-traco-${id}`;
  const topo = `ic-topo-${id}`;
  const lado = `ic-lado-${id}`;
  return (
    <svg
      className="icone-cubo"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 64"
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      <defs>
        <linearGradient id={traco} x1="10" y1="6" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={topo} x1="10" y1="6" x2="54" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F97316" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F97316" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={lado} x1="32" y1="18" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F97316" stopOpacity="0.22" />
          <stop offset="1" stopColor="#F97316" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* Faces do cubo */}
      <polygon className="icone-cubo-topo" points="32,6 54,18 32,30 10,18" fill={`url(#${topo})`} />
      <polygon points="10,18 32,30 32,54 10,42" fill="#F97316" fillOpacity="0.06" />
      <polygon points="54,18 54,42 32,54 32,30" fill={`url(#${lado})`} />

      {/* Arestas, como no logo */}
      <g fill="none" stroke={`url(#${traco})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <polygon points="32,6 54,18 54,42 32,54 10,42 10,18" />
        <path d="M10 18 L32 30 L54 18 M32 30 V54" />
        {/* Aresta interna do topo, o "furo" do cubo do logo */}
        <polygon points="32,12 43,18 32,24 21,18" strokeWidth="1.4" opacity="0.7" />
      </g>

      {/* Símbolo projetado na face frontal */}
      <g transform="matrix(0.9167,-0.5,0,1,32,30)">
        <g
          fill="none"
          stroke="#FFF7ED"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="icone-cubo-simbolo"
          transform="translate(0.5 0) scale(0.96)"
        >
          {SIMBOLOS[tipo]}
        </g>
      </g>
    </svg>
  );
};

export default IconeCubo;

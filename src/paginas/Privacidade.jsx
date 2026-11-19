import React from 'react';
import '../painel/painel.css';

// RASCUNHO — versão "rascunho-2026-11-19". Pendente de revisão e aprovação do sócio responsável
// pelo jurídico antes de ir ao ar em arkosys.com.br. Não cita artigos de lei: o texto oficial
// da Lei nº 13.709/2018 não pôde ser consultado no portal do Planalto (acesso bloqueado em 17/11/2026).
export default function Privacidade() {
  return (
    <div className="pn-centro pn-texto">
      <article className="pn-cartao">
        <p className="pn-selo">Rascunho para aprovação — versão rascunho-2026-11-19</p>
        <h1>Aviso de privacidade — cadastro e orçamento</h1>

        <h2>Quem trata os seus dados</h2>
        <p>ARKOSYS TECH SOLUTIONS, marca comercial de 46.329.183 KARLA SAYARA DOS SANTOS DE SOUSA, microempreendedora individual,
          CNPJ 46.329.183/0001-94, com sede em Paço do Lumiar/MA, Brasil.</p>

        <h2>Quais dados</h2>
        <p>Nome, e-mail e, se você informar, telefone; os módulos que você escolheu no simulador e o valor do orçamento gerado;
          data e hora do aceite deste aviso.</p>

        <h2>Para que</h2>
        <p>Registrar o seu pedido de orçamento, entrar em contato sobre ele e, se houver contratação, preparar a proposta e o contrato.
          Os dados não são usados para publicidade de terceiros nem vendidos.</p>

        <h2>Com quem são compartilhados</h2>
        <p>Com os provedores que hospedam o sistema: Supabase (banco de dados e arquivos, servidores em São Paulo) e Vercel
          (hospedagem do site). Não há outro compartilhamento.</p>

        <h2>Por quanto tempo</h2>
        <p className="pn-pendente">PENDENTE — prazo de guarda dos dados de quem não contratou: a definir pelo sócio responsável pelo jurídico.</p>

        <h2>Seus direitos</h2>
        <p>Você pode pedir acesso, correção ou exclusão dos seus dados, ou retirar este aceite, pelo e-mail
          {' '}<a href="mailto:juridico@arkosys.com.br">juridico@arkosys.com.br</a>.</p>

        <a href="/" className="pn-link">Voltar ao site</a>
      </article>
    </div>
  );
}

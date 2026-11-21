-- Retira "emissão de notas" do Módulo Financeiro até a Arkosys confirmar que entrega
-- integração com emissor de nota fiscal nesse preço (CDC, art. 30: a oferta vincula o fornecedor).
UPDATE tabela_preco SET descricao = 'Fluxo de caixa e contas a pagar e a receber. Emissão de nota fiscal não incluída.'
WHERE codigo = 'financeiro' AND versao = 1;

-- Tabela de preços versão 1: valores copiados do simulador do site
-- (src/components/Simulator.jsx, linhas 5 a 13, versão anterior a esta mudança).
-- A partir daqui o preço vive na API (R1); o site só exibe.
INSERT INTO tabela_preco (codigo, nome, descricao, preco_centavos, base, versao) VALUES
  ('base', 'Sistema Base & Estrutura Completa', 'Painel de controle administrativo, autenticação de usuários segura, banco de dados otimizado e layout responsivo de alta conversão.', 200000, true, 1),
  ('financeiro', 'Módulo Financeiro', 'Fluxo de caixa, contas a pagar/receber e emissão de notas', 80000, false, 1),
  ('whatsapp', 'Integração WhatsApp', 'Notificações automáticas, cobranças e avisos via WhatsApp', 50000, false, 1),
  ('app_mobile', 'App Mobile Dedicado', 'Aplicativo Android e iOS personalizado com sua marca', 300000, false, 1),
  ('agendamentos', 'Módulo de Agendamentos', 'Calendário integrado, gestão de horários e confirmação', 60000, false, 1),
  ('relatorios', 'Relatórios Avançados', 'Dashboards analíticos, métricas e exportação de dados em PDF/Excel', 40000, false, 1);

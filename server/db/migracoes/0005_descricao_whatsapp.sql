-- Informação de custo de terceiros no item "Integração WhatsApp" (CDC, art. 31: informação clara sobre preço).
-- Fonte do conteúdo: cláusula 6.1(a) do contrato padrão da Arkosys (custos de mensagens da Meta por conta do cliente).
UPDATE tabela_preco SET descricao = 'Notificações automáticas, cobranças e avisos via WhatsApp. Não inclui as tarifas de mensagens cobradas pela Meta, pagas diretamente pelo cliente.'
WHERE codigo = 'whatsapp' AND versao = 1;

# Roteiro de testes e publicação — Fase 1

## 1. Testes automáticos (antes de cada envio ao GitHub)
`npm install` e depois `npm test`. Devem passar todos (37 em 19/11/2026). Rodam contra um Postgres
em memória com as mesmas migrações de produção. Cobrem: R1 a R5, funil, prazos do contrato,
ciclo completo do contrato, documentos, portal (isolamento entre clientes), rotas públicas e limites.

## 2. Verificações em produção (depois de cada publicação)
| # | Verificação | Resultado esperado |
|---|---|---|
| 1 | Abrir `/api/saude` | `{"status":"ok","banco":"ok"}` |
| 2 | Entrar com cada sócio | pede troca de senha na primeira vez |
| 3 | Acessar `/api/contatos` sem login | 401 |
| 4 | No Supabase, conferir que `anon` e `authenticated` não têm permissão nas tabelas | nenhuma permissão |
| 5 | Gerar orçamento no simulador | contato aparece no funil em "Orçamento gerado" |
| 6 | Enviar um PDF na pasta de um cliente e baixar de volta | mesmo arquivo; situação "confirmado" |
| 7 | Tela Eventos | cada ação acima registrada com autor e via |

## 3. Publicação
- Todo envio ao ramo `main` do repositório `sauloinoue-arch/Arkosys` publica automaticamente o projeto Vercel `arkosys`.
- Variáveis (Vercel → Settings → Environment Variables): `DATABASE_URL` e `SUPABASE_SECRET_KEY` (Secret),
  `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `URL_PUBLICA`, `VITE_WHATSAPP_ARKOSYS`.
- Mudança de banco: alterar `server/db/schema.js`, rodar `npm run db:gerar` e aplicar a migração gerada.
- Credenciais nunca entram no repositório nem nos logs (Restrição 11).

## 4. Antes de ir para arkosys.com.br (implantação)
- [ ] Supabase Pro (backup diário) antes de lançar o contrato real.
- [ ] Vercel Pro: o plano Hobby é só para uso pessoal ou não comercial.
- [ ] Aviso de privacidade aprovado pelo jurídico (hoje é rascunho).
- [ ] Número único de WhatsApp em `VITE_WHATSAPP_ARKOSYS`.
- [ ] No Supabase Auth, endereço do site e de redirecionamento apontando para o domínio final.
- [ ] Apagar a variável `SENHA_INICIAL` depois da configuração inicial.

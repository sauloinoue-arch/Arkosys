# Contrato da API — Sistema de Controle Operacional Arkosys (Fase 1)

Fonte da verdade: o próprio código em `server/rotas/*.js`. Esta página descreve o que já existe.
A integração com o OpenBot **não** está implementada; a seção final descreve como um agente
consumirá esta mesma API na Fase 3, sem nada novo a construir além de um usuário do tipo `agente`.

## Autenticação
- Cabeçalho `Authorization: Bearer <token>`, com o token de sessão do Supabase Auth.
- O login sozinho não dá acesso: o usuário precisa existir e estar ativo na tabela `usuario`.
- Senha provisória: enquanto `deve_trocar_senha = true`, só `GET /api/eu` e `POST /api/eu/senha` respondem.

## Escopos (R2)
| Tipo | Escopos |
|---|---|
| sócio | todos, exceto `portal:ler_proprio` |
| cliente | `portal:ler_proprio` |
| agente (Fase 3, hoje inativo) | nenhum até a ativação; receberá o mínimo |

## Escritas (R4 e R5)
- Toda escrita exige `Idempotency-Key: <uuid>`. A mesma chave com os mesmos dados devolve a mesma resposta, sem gravar de novo; com dados diferentes, `409 chave_reutilizada_com_dados_diferentes`.
- Toda escrita grava um evento (`evento`) com autor, via, estado anterior e novo, na mesma transação. A via é definida pelo servidor: agente → `agente`, cliente → `portal`, visitante → `site`, sócio → `painel` ou `api`.
- Opcional: `X-Duracao-Preenchimento-Ms` (medição do critério (d) da Fase 3).

## Formato de erro
`{ "codigo": "...", "mensagem": "...", "campo": "..." | null }`

| HTTP | código |
|---|---|
| 400 | `chave_idempotencia_ausente` |
| 401 | `nao_autenticado` |
| 403 | `escopo_insuficiente`, `troca_de_senha_obrigatoria` |
| 404 | `nao_encontrado`, `rota_inexistente` |
| 409 | `transicao_invalida`, `chave_reutilizada_com_dados_diferentes`, `documento_obrigatorio_ausente`, `conflito`, `ja_configurado` |
| 422 | `dados_invalidos` |
| 429 | `limite_de_envios` |
| 500 | `erro_interno` |

## Endereços
| Método | Endereço | Acesso | Operação |
|---|---|---|---|
| GET | /api/saude | público | verificação de API e banco |
| GET | /api/configuracao-inicial | público, uso único | cria os 3 sócios (inerte depois) |
| GET | /api/eu | login | perfil e escopos |
| POST | /api/eu/senha | login | trocar senha |
| POST | /api/contatos | contatos:escrever | criar contato (origem obrigatória) |
| GET | /api/contatos · /api/contatos/:id | contatos:ler | listar · ficha |
| GET | /api/oportunidades | oportunidades:ler | listar (filtro `?estado=`) |
| POST | /api/oportunidades/:id/estado | oportunidades:escrever | mudar estado do funil |
| POST | /api/documentos | documentos:escrever | reservar envio (link assinado) |
| POST | /api/documentos/:id/confirmar | documentos:escrever | confirmar e calcular SHA-256 |
| POST | /api/documentos/:id/excluir | documentos:escrever | exclusão lógica (`{"confirmar": true}`) |
| GET | /api/contatos/:id/documentos · /api/documentos/:id/download | documentos:ler | listar · link de 60 s |
| POST | /api/contratos | contratos:escrever | registrar contrato assinado |
| GET | /api/contratos · /api/contratos/:id | contratos:ler | listar · detalhe com ações válidas |
| POST | /api/parcelas/:id/pagamento | cobrancas:escrever | marcar como paga |
| POST | /api/parcelas/:id/vencimento | cobrancas:escrever | corrigir vencimento (motivo obrigatório) |
| POST | /api/contratos/:id/suspensoes · /api/suspensoes/:id/encerrar | contratos:escrever | suspender · retomar prazo |
| POST | /api/contratos/:id/entrega | contratos:escrever | comunicar entrega |
| POST | /api/contratos/:id/aceite | contratos:escrever | registrar aceite com documento |
| POST | /api/contratos/:id/manutencao · /api/manutencoes/:id/encerrar | contratos:escrever | manutenção mensal |
| GET | /api/alertas | contratos:ler | alertas internos |
| GET | /api/usuarios | usuarios:administrar | listar |
| POST | /api/usuarios/:id/ativo | usuarios:administrar | ativar/desativar |
| POST | /api/contatos/:id/liberar-acesso | usuarios:administrar | gerar convite do cliente (o sócio envia) |
| GET | /api/publico/precos | público | tabela de preços vigente |
| POST | /api/publico/cadastro | público, limitado | cadastro antes do orçamento |
| POST | /api/publico/orcamento | público, limitado | orçamento calculado no servidor |
| GET | /api/portal/meu-projeto | portal:ler_proprio | projeto do próprio cliente |
| GET | /api/portal/documentos/:id/download | portal:ler_proprio | só documentos do próprio cliente |
| GET | /api/eventos | eventos:ler | registro de eventos |
| GET | /api/medicao | eventos:ler | horas semanais de lançamento manual |

## Fase 3 — como o agente consumirá (não implementado)
1. Criar um usuário `tipo = agente`, com token próprio e **apenas** `contatos:escrever` (registro de lead).
2. O agente envia o texto recebido em `textoExterno` e o identificador da conversa em `idConversaExterna`, com `origem = agente`. O campo é guardado como texto e nunca é executado.
3. Pré-requisito de produto ainda não construído: registro criado por agente nasce como **rascunho pendente de aprovação humana** (PromptInjectionDefenseModule, regra 5). Isso entra na especificação da Fase 3.
4. A ativação depende dos quatro critérios do Parecer, item 9.

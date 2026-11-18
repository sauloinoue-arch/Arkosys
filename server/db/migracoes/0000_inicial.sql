CREATE TYPE "public"."area_usuario" AS ENUM('juridico', 'desenvolvimento', 'ciberseguranca');--> statement-breakpoint
CREATE TYPE "public"."estado_oportunidade" AS ENUM('cadastro_site', 'orcamento_gerado', 'contato_recebido', 'reuniao_agendada', 'reuniao_realizada', 'proposta_contrato_enviados', 'contrato_assinado', 'aguardando_retorno', 'desistiu');--> statement-breakpoint
CREATE TYPE "public"."estado_projeto" AS ENUM('aguardando_primeiro_pagamento', 'em_desenvolvimento', 'prazo_suspenso', 'aguardando_aceite', 'entregue', 'garantia_encerrada');--> statement-breakpoint
CREATE TYPE "public"."gatilho_parcela" AS ENUM('assinatura', 'aceite', 'entrega');--> statement-breakpoint
CREATE TYPE "public"."meio_pagamento" AS ENUM('pix', 'cartao_credito', 'transferencia_internacional');--> statement-breakpoint
CREATE TYPE "public"."origem_contato" AS ENUM('site_simulador', 'ia_generativa', 'instagram', 'google_ads', 'whatsapp', 'indicacao', 'presencial', 'agente');--> statement-breakpoint
CREATE TYPE "public"."status_parcela" AS ENUM('prevista', 'a_receber', 'paga');--> statement-breakpoint
CREATE TYPE "public"."tipo_aceite" AS ENUM('expresso', 'decurso_prazo', 'uso_real');--> statement-breakpoint
CREATE TYPE "public"."tipo_consumidor" AS ENUM('socio', 'cliente', 'agente');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('proposta', 'contrato', 'termo_recebimento', 'comprovante', 'aditivo', 'evidencia_aceite', 'outro');--> statement-breakpoint
CREATE TYPE "public"."via_evento" AS ENUM('painel', 'portal', 'site', 'api', 'agente', 'sistema');--> statement-breakpoint
CREATE TABLE "chave_idempotencia" (
	"chave" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"operacao" text NOT NULL,
	"hash_requisicao" text NOT NULL,
	"resposta" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chave_idempotencia_consumidor_chave_pk" PRIMARY KEY("consumidor","chave")
);
--> statement-breakpoint
CREATE TABLE "contato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nome_comercial" text,
	"email" text,
	"telefone" text,
	"pais" text,
	"cidade" text,
	"origem" "origem_contato" NOT NULL,
	"origem_detalhe" text,
	"id_conversa_externa" text,
	"consentimento_privacidade_em" timestamp with time zone,
	"versao_aviso_privacidade" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oportunidade_id" uuid NOT NULL,
	"contato_id" uuid NOT NULL,
	"objeto" text NOT NULL,
	"valor_total_centavos" integer NOT NULL,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"data_assinatura" date NOT NULL,
	"prazo_dias_corridos" integer NOT NULL,
	"data_primeiro_pagamento" date,
	"estado_projeto" "estado_projeto" NOT NULL,
	"data_comunicacao_entrega" date,
	"tipo_aceite" "tipo_aceite",
	"data_aceite" date,
	"dias_garantia" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contato_id" uuid NOT NULL,
	"contrato_id" uuid,
	"tipo" "tipo_documento" NOT NULL,
	"nome_arquivo" text NOT NULL,
	"caminho" text NOT NULL,
	"hash_sha256" text,
	"tamanho_bytes" integer,
	"confirmado" boolean DEFAULT false NOT NULL,
	"enviado_por" uuid NOT NULL,
	"excluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ator_id" uuid,
	"ator_tipo" text NOT NULL,
	"via" "via_evento" NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"acao" text NOT NULL,
	"antes" jsonb,
	"depois" jsonb
);
--> statement-breakpoint
CREATE TABLE "limite_envio" (
	"chave" text NOT NULL,
	"janela" timestamp with time zone NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "limite_envio_chave_janela_pk" PRIMARY KEY("chave","janela")
);
--> statement-breakpoint
CREATE TABLE "manutencao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"valor_mensal_centavos" integer NOT NULL,
	"inicio" date NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"fim" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oportunidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contato_id" uuid NOT NULL,
	"estado" "estado_oportunidade" NOT NULL,
	"estado_anterior" "estado_oportunidade",
	"data_reuniao" timestamp with time zone,
	"motivo_desistencia" text,
	"origem" "origem_contato" NOT NULL,
	"id_conversa_externa" text,
	"texto_externo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contato_id" uuid NOT NULL,
	"oportunidade_id" uuid NOT NULL,
	"itens" jsonb NOT NULL,
	"total_centavos" integer NOT NULL,
	"versao_tabela" integer NOT NULL,
	"texto_aviso" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcela" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"gatilho" "gatilho_parcela" NOT NULL,
	"dias_uteis_apos_gatilho" integer DEFAULT 0 NOT NULL,
	"vencimento" date,
	"status" "status_parcela" NOT NULL,
	"data_pagamento" date,
	"meio" "meio_pagamento",
	"comprovante_documento_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspensao_prazo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"motivo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tabela_preco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"preco_centavos" integer NOT NULL,
	"base" boolean DEFAULT false NOT NULL,
	"versao" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tempo_lancamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"operacao" text NOT NULL,
	"duracao_ms" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"tipo" "tipo_consumidor" NOT NULL,
	"area" "area_usuario",
	"cliente_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"liberado_por" uuid,
	"liberado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario_escopo" (
	"usuario_id" uuid NOT NULL,
	"escopo" text NOT NULL,
	CONSTRAINT "usuario_escopo_usuario_id_escopo_pk" PRIMARY KEY("usuario_id","escopo")
);
--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_oportunidade_id_oportunidade_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_oportunidade_id_oportunidade_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensao_prazo" ADD CONSTRAINT "suspensao_prazo_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_escopo" ADD CONSTRAINT "usuario_escopo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contato_email_uq" ON "contato" USING btree ("email");--> statement-breakpoint
CREATE INDEX "evento_entidade_idx" ON "evento" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "oportunidade_estado_idx" ON "oportunidade" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "parcela_contrato_numero_uq" ON "parcela" USING btree ("contrato_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "tabela_preco_codigo_versao_uq" ON "tabela_preco" USING btree ("codigo","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_email_uq" ON "usuario" USING btree ("email");
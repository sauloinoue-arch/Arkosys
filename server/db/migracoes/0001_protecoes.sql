-- Proteções escritas uma única vez. A equipe não precisa editar este arquivo.

-- R4: o registro de eventos não pode ser alterado nem apagado, por ninguém.
CREATE OR REPLACE FUNCTION evento_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'evento é imutável (R4)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER evento_sem_update BEFORE UPDATE OR DELETE ON evento
  FOR EACH ROW EXECUTE FUNCTION evento_imutavel();
--> statement-breakpoint
CREATE TRIGGER evento_sem_truncate BEFORE TRUNCATE ON evento
  FOR EACH STATEMENT EXECUTE FUNCTION evento_imutavel();
--> statement-breakpoint

-- R1: nenhuma tabela fica acessível pela API automática do Supabase.
-- RLS ligado e nenhuma política criada = os papéis anon e authenticated não leem nem escrevem.
-- Só a API (conexão direta pelo pooler) acessa os dados.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuario','usuario_escopo','contato','oportunidade','tabela_preco','orcamento',
    'contrato','suspensao_prazo','parcela','manutencao','documento','evento','chave_idempotencia',
    'tempo_lancamento','limite_envio']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

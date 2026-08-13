-- Migration 014: Enable Supabase Realtime for dashboard live updates
-- Seguro para re-execução (idempotente)

-- Habilita REPLICA IDENTITY FULL nas tabelas (necessário para receber dados nos eventos DELETE)
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.qa_reports REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;

-- Adiciona cada tabela à publication do Supabase Realtime,
-- ignorando caso já estejam adicionadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'qa_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_reports;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;

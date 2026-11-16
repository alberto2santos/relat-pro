-- A sincronização (src/services/offlineRdoSync.ts) registra fotos e assinatura com o id estável
-- gerado no dispositivo. A concessão por coluna de 20261104180000_harden_database.sql não incluía
-- "id", e o insert falhava com "permission denied for table evidencias_rdo", deixando o RDO como
-- rascunho. As políticas de RLS de inserção continuam valendo.
grant insert (id) on public.evidencias_rdo to authenticated;

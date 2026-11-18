-- A command hash claims an automatic write before business data is changed.
-- This unique index serializes concurrent/retried identical requests per user and tenant.
ALTER TABLE public.ai_action_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_action_logs_tenant_user_idempotency_key_uidx
  ON public.ai_action_logs (company_id, user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

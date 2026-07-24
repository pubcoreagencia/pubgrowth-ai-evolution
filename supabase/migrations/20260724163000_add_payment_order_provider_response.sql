ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

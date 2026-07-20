
-- 1) Promote admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'm4cktheus@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Update handle_new_user to auto-assign admin to that email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'm4cktheus@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.estimation_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3) Payment status enum
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) payment_orders table
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status public.payment_status NOT NULL DEFAULT 'pending',
  pix_txid text UNIQUE,
  pix_qrcode text,
  pix_copy_paste text,
  external_payment_id text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_orders_client ON public.payment_orders(client_id);
CREATE INDEX idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Owner (the invited client user who created the order) can read
CREATE POLICY "Owners read their payment orders"
ON public.payment_orders FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Linked client user can read the orders for their client
CREATE POLICY "Client user reads their client's payment orders"
ON public.payment_orders FOR SELECT
TO authenticated
USING (client_id = public.current_client_id());

-- Admin reads all
CREATE POLICY "Admins read all payment orders"
ON public.payment_orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated: only service_role writes (via server functions / webhook).

CREATE TRIGGER trg_payment_orders_updated_at
BEFORE UPDATE ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

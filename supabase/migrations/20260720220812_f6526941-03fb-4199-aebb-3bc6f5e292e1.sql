
-- 1. Tabela client_users
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_users_client_id_idx ON public.client_users(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_users TO authenticated;
GRANT ALL ON public.client_users TO service_role;

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Cliente vê apenas o próprio vínculo
CREATE POLICY "client_users self read"
  ON public.client_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Agência (admin) enxerga e gerencia todos
CREATE POLICY "client_users admin manage"
  ON public.client_users FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Função helper: client_id do usuário atual
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.client_users WHERE user_id = auth.uid() LIMIT 1
$$;

-- 3. Policies de leitura para o papel `client`

-- clients: só vê o próprio
CREATE POLICY "clients: client role read own"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND id = public.current_client_id()
  );

-- campaigns: só campanhas do próprio cliente
CREATE POLICY "campaigns: client role read own client"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND client_id = public.current_client_id()
  );

-- social_profiles: só perfis do próprio cliente
CREATE POLICY "social_profiles: client role read own client"
  ON public.social_profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND client_id = public.current_client_id()
  );

-- social_metrics_history: por meio dos perfis do cliente
CREATE POLICY "social_metrics_history: client role read own"
  ON public.social_metrics_history FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND social_profile_id IN (
      SELECT id FROM public.social_profiles
      WHERE client_id = public.current_client_id()
    )
  );

-- client_wallets: leitura da própria carteira
CREATE POLICY "client_wallets: client role read own"
  ON public.client_wallets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND client_id = public.current_client_id()
  );

-- wallet_ledger: leitura do próprio histórico
CREATE POLICY "wallet_ledger: client role read own"
  ON public.wallet_ledger FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'client')
    AND client_id = public.current_client_id()
  );

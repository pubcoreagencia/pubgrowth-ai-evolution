
-- ============ Enums ============
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'funded';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'refunded';

CREATE TYPE public.wallet_entry_type AS ENUM (
  'credit',        -- Agência adiciona verba
  'debit',         -- Financiamento de campanha
  'refund',        -- Estorno de campanha
  'adjustment'     -- Ajuste manual
);

-- ============ campaigns.budget ============
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS budget numeric(14,2) NOT NULL DEFAULT 0
  CHECK (budget >= 0);

-- ============ client_wallets ============
CREATE TABLE public.client_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_wallets TO authenticated;
GRANT ALL ON public.client_wallets TO service_role;

ALTER TABLE public.client_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wallets: own select" ON public.client_wallets
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Wallets: own insert" ON public.client_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Updates only via SECURITY DEFINER functions (no direct policy for update/delete)

CREATE TRIGGER trg_client_wallets_updated_at
  BEFORE UPDATE ON public.client_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX client_wallets_user_id_idx ON public.client_wallets(user_id);

-- ============ wallet_ledger (imutável) ============
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.client_wallets(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  entry_type public.wallet_entry_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  balance_after numeric(14,2) NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ledger: own select" ON public.wallet_ledger
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
-- Sem INSERT/UPDATE/DELETE policies para authenticated: inserts só via SECURITY DEFINER

CREATE INDEX wallet_ledger_wallet_id_idx ON public.wallet_ledger(wallet_id, created_at DESC);
CREATE INDEX wallet_ledger_campaign_id_idx ON public.wallet_ledger(campaign_id);
CREATE INDEX wallet_ledger_user_id_idx ON public.wallet_ledger(user_id);

-- Impede UPDATE/DELETE mesmo com futura policy (imutabilidade garantida)
CREATE OR REPLACE FUNCTION public.ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger é imutável';
END;
$$;

CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();
CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

-- ============ Funções ============

-- Adiciona crédito na carteira
CREATE OR REPLACE FUNCTION public.wallet_credit(
  _client_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
) RETURNS public.wallet_ledger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet public.client_wallets;
  v_client_user uuid;
  v_new_balance numeric(14,2);
  v_entry public.wallet_ledger;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'valor deve ser positivo'; END IF;

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = _client_id;
  IF v_client_user IS NULL THEN RAISE EXCEPTION 'cliente não encontrado'; END IF;
  IF v_client_user <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  -- upsert wallet
  INSERT INTO public.client_wallets (user_id, client_id, balance)
  VALUES (v_client_user, _client_id, 0)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.client_wallets WHERE client_id = _client_id FOR UPDATE;

  v_new_balance := v_wallet.balance + _amount;
  UPDATE public.client_wallets SET balance = v_new_balance WHERE id = v_wallet.id;

  INSERT INTO public.wallet_ledger
    (user_id, wallet_id, client_id, entry_type, amount, balance_after, note, created_by)
  VALUES
    (v_client_user, v_wallet.id, _client_id, 'credit', _amount, v_new_balance, _note, v_uid)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

-- Ajuste manual (pode ser negativo, respeita saldo >= 0)
CREATE OR REPLACE FUNCTION public.wallet_adjust(
  _client_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
) RETURNS public.wallet_ledger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet public.client_wallets;
  v_client_user uuid;
  v_new_balance numeric(14,2);
  v_entry public.wallet_ledger;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'valor não pode ser zero'; END IF;

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = _client_id;
  IF v_client_user IS NULL THEN RAISE EXCEPTION 'cliente não encontrado'; END IF;
  IF v_client_user <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  INSERT INTO public.client_wallets (user_id, client_id, balance)
  VALUES (v_client_user, _client_id, 0)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.client_wallets WHERE client_id = _client_id FOR UPDATE;

  v_new_balance := v_wallet.balance + _amount;
  IF v_new_balance < 0 THEN RAISE EXCEPTION 'saldo insuficiente'; END IF;

  UPDATE public.client_wallets SET balance = v_new_balance WHERE id = v_wallet.id;

  INSERT INTO public.wallet_ledger
    (user_id, wallet_id, client_id, entry_type, amount, balance_after, note, created_by)
  VALUES
    (v_client_user, v_wallet.id, _client_id, 'adjustment', _amount, v_new_balance, _note, v_uid)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

-- Financia uma campanha: debita carteira e altera status para funded
CREATE OR REPLACE FUNCTION public.fund_campaign(_campaign_id uuid)
RETURNS public.wallet_ledger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_camp public.campaigns;
  v_wallet public.client_wallets;
  v_new_balance numeric(14,2);
  v_entry public.wallet_ledger;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_camp FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha não encontrada'; END IF;
  IF v_camp.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF v_camp.client_id IS NULL THEN RAISE EXCEPTION 'campanha sem cliente vinculado'; END IF;
  IF v_camp.budget <= 0 THEN RAISE EXCEPTION 'defina um budget total maior que zero'; END IF;
  IF v_camp.status NOT IN ('draft', 'pending_payment') THEN
    RAISE EXCEPTION 'campanha já financiada ou em estado inválido: %', v_camp.status;
  END IF;

  SELECT * INTO v_wallet FROM public.client_wallets WHERE client_id = v_camp.client_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'cliente sem carteira'; END IF;

  v_new_balance := v_wallet.balance - v_camp.budget;
  IF v_new_balance < 0 THEN RAISE EXCEPTION 'saldo insuficiente na carteira do cliente'; END IF;

  UPDATE public.client_wallets SET balance = v_new_balance WHERE id = v_wallet.id;
  UPDATE public.campaigns SET status = 'funded' WHERE id = _campaign_id;

  INSERT INTO public.wallet_ledger
    (user_id, wallet_id, client_id, campaign_id, entry_type, amount, balance_after, note, created_by)
  VALUES
    (v_camp.user_id, v_wallet.id, v_camp.client_id, v_camp.id, 'debit',
     -v_camp.budget, v_new_balance,
     'Financiamento da campanha ' || v_camp.campaign_name, v_uid)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

-- Estorno: devolve verba e volta campanha para pending_payment (ou cancelled se informado)
CREATE OR REPLACE FUNCTION public.refund_campaign(
  _campaign_id uuid,
  _cancel boolean DEFAULT false,
  _note text DEFAULT NULL
) RETURNS public.wallet_ledger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_camp public.campaigns;
  v_wallet public.client_wallets;
  v_new_balance numeric(14,2);
  v_entry public.wallet_ledger;
  v_already_debited numeric(14,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_camp FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha não encontrada'; END IF;
  IF v_camp.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF v_camp.status NOT IN ('funded', 'active') THEN
    RAISE EXCEPTION 'campanha não está financiada';
  END IF;

  SELECT COALESCE(SUM(-amount), 0) INTO v_already_debited
    FROM public.wallet_ledger
    WHERE campaign_id = _campaign_id AND entry_type = 'debit';
  -- Subtrair refunds já feitos
  v_already_debited := v_already_debited - COALESCE((
    SELECT SUM(amount) FROM public.wallet_ledger
    WHERE campaign_id = _campaign_id AND entry_type = 'refund'
  ), 0);

  IF v_already_debited <= 0 THEN RAISE EXCEPTION 'nada a estornar'; END IF;

  SELECT * INTO v_wallet FROM public.client_wallets WHERE client_id = v_camp.client_id FOR UPDATE;

  v_new_balance := v_wallet.balance + v_already_debited;
  UPDATE public.client_wallets SET balance = v_new_balance WHERE id = v_wallet.id;

  UPDATE public.campaigns
    SET status = CASE WHEN _cancel THEN 'cancelled'::campaign_status
                      ELSE 'refunded'::campaign_status END
    WHERE id = _campaign_id;

  INSERT INTO public.wallet_ledger
    (user_id, wallet_id, client_id, campaign_id, entry_type, amount, balance_after, note, created_by)
  VALUES
    (v_camp.user_id, v_wallet.id, v_camp.client_id, v_camp.id, 'refund',
     v_already_debited, v_new_balance,
     COALESCE(_note, 'Estorno da campanha ' || v_camp.campaign_name), v_uid)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

-- Ativar campanha (só se funded)
CREATE OR REPLACE FUNCTION public.activate_campaign(_campaign_id uuid)
RETURNS public.campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_camp public.campaigns;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_camp FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha não encontrada'; END IF;
  IF v_camp.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF v_camp.status <> 'funded' THEN RAISE EXCEPTION 'campanha precisa estar financiada'; END IF;
  UPDATE public.campaigns SET status = 'active' WHERE id = _campaign_id RETURNING * INTO v_camp;
  RETURN v_camp;
END;
$$;

-- Concluir campanha
CREATE OR REPLACE FUNCTION public.complete_campaign(_campaign_id uuid)
RETURNS public.campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_camp public.campaigns;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_camp FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha não encontrada'; END IF;
  IF v_camp.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF v_camp.status NOT IN ('active', 'funded') THEN RAISE EXCEPTION 'estado inválido'; END IF;
  UPDATE public.campaigns SET status = 'completed' WHERE id = _campaign_id RETURNING * INTO v_camp;
  RETURN v_camp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_campaign(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_campaign(uuid) TO authenticated;

-- 1) Enum: novo status para revisão manual (valor divergente)
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'requires_review';

-- 2) Colunas de reconciliação em payment_orders
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS provider_paid_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS reconciliation_error text,
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;

-- 3) Vínculo pedido -> lançamento (para índice único de crédito)
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS payment_order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_payment_order_id
  ON public.wallet_ledger(payment_order_id);

-- 3.1) Proteção estrutural: um pedido só pode gerar UM lançamento de crédito
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_ledger_credit_per_payment_order
  ON public.wallet_ledger(payment_order_id)
  WHERE payment_order_id IS NOT NULL AND entry_type = 'credit';

-- 4) Função transacional idempotente. Não recebe nenhum dado sensível do cliente:
--    resolve user_id, client_id, wallet_id, valor esperado, tudo a partir do pedido.
CREATE OR REPLACE FUNCTION public.confirm_pix_payment(
  p_txid text,
  p_paid_amount numeric,
  p_provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order         public.payment_orders;
  v_wallet        public.client_wallets;
  v_new_balance   numeric(14,2);
  v_entry_id      uuid;
BEGIN
  IF p_txid IS NULL OR length(p_txid) = 0 THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF p_paid_amount IS NULL OR p_paid_amount <= 0 THEN
    RETURN jsonb_build_object('result', 'amount_mismatch');
  END IF;

  -- Bloqueia o pedido para a transação inteira
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE pix_txid = p_txid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;

  -- Marca a chegada do webhook, mesmo que caia em ramo de erro depois
  UPDATE public.payment_orders
    SET last_webhook_at = now(),
        provider_paid_amount = p_paid_amount
    WHERE id = v_order.id;

  -- Idempotência
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object(
      'result', 'already_paid',
      'payment_order_id', v_order.id
    );
  END IF;

  IF v_order.status NOT IN ('pending', 'requires_review') THEN
    RETURN jsonb_build_object(
      'result', 'invalid_status',
      'status', v_order.status::text
    );
  END IF;

  -- Comparação em centavos, sem tolerância
  IF round(p_paid_amount::numeric, 2) <> round(v_order.amount::numeric, 2) THEN
    UPDATE public.payment_orders
      SET status = 'requires_review',
          reconciliation_error = format(
            'amount_mismatch: expected=%s paid=%s',
            v_order.amount::text, p_paid_amount::text
          )
      WHERE id = v_order.id;
    RETURN jsonb_build_object(
      'result', 'amount_mismatch',
      'expected', v_order.amount,
      'paid', p_paid_amount,
      'payment_order_id', v_order.id
    );
  END IF;

  -- Garante carteira do cliente
  INSERT INTO public.client_wallets (user_id, client_id, balance)
  VALUES (v_order.user_id, v_order.client_id, 0)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.client_wallets
  WHERE client_id = v_order.client_id
  FOR UPDATE;

  v_new_balance := v_wallet.balance + v_order.amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'negative_balance_forbidden';
  END IF;

  UPDATE public.client_wallets
    SET balance = v_new_balance
    WHERE id = v_wallet.id;

  -- Inserção do lançamento. O índice único (payment_order_id, entry_type='credit')
  -- garante que dois webhooks concorrentes não gerem crédito duplicado.
  INSERT INTO public.wallet_ledger
    (user_id, wallet_id, client_id, entry_type, amount, balance_after, note, created_by, payment_order_id)
  VALUES
    (v_order.user_id, v_wallet.id, v_order.client_id, 'credit',
     v_order.amount, v_new_balance,
     COALESCE('Recarga PIX carteira' ||
              CASE WHEN p_provider_reference IS NOT NULL
                   THEN ' (' || left(p_provider_reference, 64) || ')'
                   ELSE '' END,
              'Recarga PIX carteira'),
     NULL, v_order.id)
  RETURNING id INTO v_entry_id;

  UPDATE public.payment_orders
    SET status = 'paid',
        paid_at = now(),
        reconciliation_error = NULL
    WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'result', 'credited',
    'payment_order_id', v_order.id,
    'wallet_ledger_id', v_entry_id,
    'balance_after', v_new_balance
  );
END;
$$;

-- 5) Permissões: apenas service_role executa.
REVOKE ALL ON FUNCTION public.confirm_pix_payment(text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_pix_payment(text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_pix_payment(text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pix_payment(text, numeric, text) TO service_role;
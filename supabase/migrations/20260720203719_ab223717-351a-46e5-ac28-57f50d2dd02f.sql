-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.app_plan AS ENUM ('free', 'pro', 'agency');
CREATE TYPE public.campaign_objective AS ENUM ('views', 'engagement', 'traffic', 'conversion', 'sales', 'awareness');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'running', 'completed');

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- user_roles
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- profiles policies
CREATE POLICY "Profiles: own or admin select" ON public.profiles
FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: own update" ON public.profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: own insert" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "User roles: own select" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- =========================
-- subscriptions
-- =========================
CREATE TABLE public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.app_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Subscriptions: own or admin select" ON public.subscriptions
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- =========================
-- clients
-- =========================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  segment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX clients_user_id_idx ON public.clients(user_id);

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Clients: own select" ON public.clients
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients: own insert" ON public.clients
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Clients: own update" ON public.clients
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Clients: own delete" ON public.clients
FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- campaigns
-- =========================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_legacy TEXT,
  campaign_name TEXT NOT NULL,
  video_url TEXT,
  start_date DATE,
  end_date DATE,
  daily_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 0,
  objective public.campaign_objective NOT NULL DEFAULT 'views',
  avg_product_value NUMERIC(14,2),
  avg_upsell_value NUMERIC(14,2),
  avg_cross_sell_value NUMERIC(14,2),
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE INDEX campaigns_user_id_idx ON public.campaigns(user_id);
CREATE INDEX campaigns_client_id_idx ON public.campaigns(client_id);

CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Campaigns: own select" ON public.campaigns
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Campaigns: own insert" ON public.campaigns
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Campaigns: own update" ON public.campaigns
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Campaigns: own delete" ON public.campaigns
FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- estimation_settings
-- =========================
CREATE TABLE public.estimation_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  views_share_of_impressions NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  remarketing_reach_rate NUMERIC(6,4) NOT NULL DEFAULT 0.60,
  cta_view_rate NUMERIC(6,4) NOT NULL DEFAULT 0.40,
  offer_view_rate NUMERIC(6,4) NOT NULL DEFAULT 0.90,
  checkout_initiation_rate NUMERIC(6,4) NOT NULL DEFAULT 0.40,
  recurring_customer_rate NUMERIC(6,4) NOT NULL DEFAULT 0.20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimation_settings TO authenticated;
GRANT ALL ON public.estimation_settings TO service_role;
ALTER TABLE public.estimation_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_estimation_settings_updated_at
BEFORE UPDATE ON public.estimation_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estimation settings: own select" ON public.estimation_settings
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Estimation settings: own insert" ON public.estimation_settings
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Estimation settings: own update" ON public.estimation_settings
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- New user bootstrap trigger
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.estimation_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Enum de plataformas sociais
CREATE TYPE public.social_platform AS ENUM ('instagram', 'tiktok', 'youtube', 'facebook');

-- Tabela de perfis sociais
CREATE TABLE public.social_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  profile_name text NOT NULL,
  username text NOT NULL,
  profile_url text,
  avatar_url text,
  current_followers integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_profiles_client ON public.social_profiles(client_id);
CREATE INDEX idx_social_profiles_user ON public.social_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO authenticated;
GRANT ALL ON public.social_profiles TO service_role;

ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own social profiles"
  ON public.social_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own social profiles"
  ON public.social_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own social profiles"
  ON public.social_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own social profiles"
  ON public.social_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_social_profiles_updated_at
  BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de histórico de métricas
CREATE TABLE public.social_metrics_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_profile_id uuid NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  followers integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  engagement_rate numeric(6,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_profile_id, recorded_at)
);

CREATE INDEX idx_metrics_profile_date ON public.social_metrics_history(social_profile_id, recorded_at DESC);
CREATE INDEX idx_metrics_user ON public.social_metrics_history(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_metrics_history TO authenticated;
GRANT ALL ON public.social_metrics_history TO service_role;

ALTER TABLE public.social_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own metrics"
  ON public.social_metrics_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own metrics"
  ON public.social_metrics_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own metrics"
  ON public.social_metrics_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own metrics"
  ON public.social_metrics_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar current_followers no perfil ao inserir/atualizar snapshot
CREATE OR REPLACE FUNCTION public.sync_current_followers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_followers integer;
BEGIN
  SELECT followers INTO latest_followers
  FROM public.social_metrics_history
  WHERE social_profile_id = NEW.social_profile_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  UPDATE public.social_profiles
  SET current_followers = COALESCE(latest_followers, NEW.followers),
      updated_at = now()
  WHERE id = NEW.social_profile_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_current_followers
  AFTER INSERT OR UPDATE ON public.social_metrics_history
  FOR EACH ROW EXECUTE FUNCTION public.sync_current_followers();
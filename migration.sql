-- Migration script for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  risk_profile TEXT DEFAULT 'Moderate',
  push_enabled BOOLEAN DEFAULT false,
  email_notifications_enabled BOOLEAN DEFAULT true,
  dividend_alert_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Assets (Global catalog) - No persistent current_price
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- STOCK, ETF, CRYPTO, CASH
  sector TEXT,
  currency TEXT DEFAULT 'USD',
  is_dividend_asset BOOLEAN DEFAULT false
);

-- 3. Brokers
CREATE TABLE IF NOT EXISTS public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(user_id, code)
);

-- 4. Account Adjustments (Replaces Broker Balances for more flexibility)
CREATE TABLE IF NOT EXISTS public.account_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE,
  concept TEXT NOT NULL CHECK (concept IN ('CASH', 'EXCESS_INVESTMENT', 'TRANSIT', 'FEES', 'OTHER')),
  amount NUMERIC(20, 2) DEFAULT 0,
  as_of_date TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

-- 5. Positions (Consolidated per user+broker+asset)
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL,
  avg_cost NUMERIC(20, 8) NOT NULL,
  source TEXT DEFAULT 'MARKET', -- MARKET, MANUAL, BROKER
  as_of_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, broker_id, asset_id)
);

-- 6. Price Snapshots (Multidimensional: Public and User-specific)
CREATE TABLE IF NOT EXISTS public.price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for global/market prices
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE, -- Optional broker priority
  price NUMERIC(20, 8) NOT NULL,
  price_date TIMESTAMPTZ DEFAULT now(),
  source TEXT NOT NULL, -- MARKET, MANUAL, BROKER
  currency TEXT DEFAULT 'USD'
);

-- 7. Events
CREATE TABLE IF NOT EXISTS public.portfolio_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- BUY, SELL, DIVIDEND, SPLIT, IMPORT
  quantity_delta NUMERIC(20, 8) NOT NULL,
  price_used NUMERIC(20, 8) NOT NULL,
  date TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

-- Automated updated_at trigger logic
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER tr_positions_updated BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 8. Recommended Indices
CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON public.price_snapshots(asset_id, user_id, broker_id, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_positions_lookup ON public.positions(user_id, broker_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_lookup ON public.account_adjustments(user_id, broker_id, as_of_date DESC);

-- 9. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_events ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
-- Profiles
CREATE POLICY "Profiles viewable/updateable by owner" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Assets (Publicly viewable)
CREATE POLICY "Assets are viewable by everyone" ON public.assets FOR SELECT USING (true);

-- Brokers
CREATE POLICY "Brokers are manageable by owner" ON public.brokers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Adjustments
CREATE POLICY "Adjustments are manageable by owner" ON public.account_adjustments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Positions
CREATE POLICY "Positions are manageable by owner" ON public.positions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Price Snapshots
-- 1. SELECT: Global ones or user's own
CREATE POLICY "Snapshots viewable by public or owner" ON public.price_snapshots 
FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- 2. WRITE: Only user's own (never global from frontend)
CREATE POLICY "Snapshots manageable only by owner" ON public.price_snapshots 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Events
CREATE POLICY "Events are manageable by owner" ON public.portfolio_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

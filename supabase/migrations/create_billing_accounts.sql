-- Canonical billing source of truth.
-- Billing state lives here, keyed by auth.users.id.
-- The users table remains for profile data only.

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  user_id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  text,
  stripe_customer_id     text        UNIQUE,
  stripe_subscription_id text        UNIQUE,
  plan                   text        NOT NULL DEFAULT 'free',
  status                 text,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes for Stripe webhook lookups by customer / subscription ID
CREATE INDEX IF NOT EXISTS billing_accounts_stripe_customer_id_idx
  ON public.billing_accounts (stripe_customer_id);

CREATE INDEX IF NOT EXISTS billing_accounts_stripe_subscription_id_idx
  ON public.billing_accounts (stripe_subscription_id);

-- Backfill: seed billing_accounts from existing paid users in the users table.
-- Free users with no Stripe data are excluded — they default to 'free' at read time.
INSERT INTO public.billing_accounts (
  user_id,
  email,
  stripe_customer_id,
  stripe_subscription_id,
  plan,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  email,
  stripe_customer_id,
  stripe_subscription_id,
  COALESCE(NULLIF(plan, ''), 'free'),
  pro_status,
  now(),
  now()
FROM public.users
WHERE pro = true OR (plan IS NOT NULL AND plan != 'free')
ON CONFLICT (user_id) DO NOTHING;

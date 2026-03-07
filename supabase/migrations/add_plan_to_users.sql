-- Add internal plan column to users table.
-- Values: 'free' | 'pro' | 'team'
-- Backfills existing Pro subscribers; default 'free' for all new rows.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Backfill: promote existing Pro boolean subscribers to plan = 'pro'
UPDATE public.users SET plan = 'pro' WHERE pro = true AND plan = 'free';

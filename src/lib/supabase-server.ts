import { createClient } from "@supabase/supabase-js";

// Service role client — use ONLY in webhook handlers (bypasses RLS)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

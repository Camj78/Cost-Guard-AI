import { createBrowserClient } from "@supabase/ssr";

// Browser client — use in client components for auth state
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

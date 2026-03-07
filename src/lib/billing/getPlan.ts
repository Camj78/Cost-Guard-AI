/**
 * Server-side plan resolution.
 * Single source of truth for reading a user's current plan from the database.
 *
 * Critical rule: always default to "free", never default to "pro".
 */
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { PLANS, type Plan } from "@/config/plans";

export async function getPlan(userId: string): Promise<Plan> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  return (data?.plan as Plan) ?? PLANS.FREE;
}

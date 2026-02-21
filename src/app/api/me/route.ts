import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ pro: false, pro_status: null });
    }

    const { data: row } = await supabase
      .from("users")
      .select("pro, pro_status")
      .eq("id", user.id)
      .single();

    if (!row) {
      // Trigger didn't run or legacy user — upsert the row
      await supabase.from("users").upsert(
        { id: user.id, email: user.email },
        { onConflict: "id" }
      );
      return NextResponse.json({ pro: false, pro_status: null });
    }

    return NextResponse.json({ pro: row.pro, pro_status: row.pro_status });
  } catch {
    return NextResponse.json({ pro: false, pro_status: null });
  }
}

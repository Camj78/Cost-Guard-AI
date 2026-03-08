import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/upgrade?error=auth", req.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Persist first_name/last_name from auth metadata to users profile table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      const firstName = (meta.first_name ?? "").trim() || null;
      const lastName = (meta.last_name ?? "").trim() || null;
      if (firstName || lastName) {
        await supabase
          .from("users")
          .upsert(
            { id: user.id, email: user.email, first_name: firstName, last_name: lastName },
            { onConflict: "id", ignoreDuplicates: false }
          );
      }
    }
  } catch {
    return NextResponse.redirect(new URL("/upgrade?error=auth", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

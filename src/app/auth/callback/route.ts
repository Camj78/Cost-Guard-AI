import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

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

  // If a post-auth redirect was requested, validate origin and follow it.
  // This resumes flows like the GitHub App install callback.
  if (next) {
    try {
      const siteOrigin = new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://costguardai.io"
      ).origin;
      const nextUrl = new URL(next);
      if (nextUrl.origin === siteOrigin) {
        return NextResponse.redirect(nextUrl);
      }
    } catch {
      // next is not a valid absolute URL — ignore and fall through to dashboard
    }
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

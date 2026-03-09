import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const firstName = typeof body.first_name === "string" ? body.first_name.trim() : undefined;
    const lastName = typeof body.last_name === "string" ? body.last_name.trim() : undefined;
    const next = typeof body.next === "string" && body.next.trim() ? body.next.trim() : undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const baseCallback = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
    const emailRedirectTo = next
      ? `${baseCallback}?next=${encodeURIComponent(next)}`
      : baseCallback;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        data: {
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
        },
      },
    });

    if (error) {
      const isRateLimit =
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit");

      console.error("[auth/login] signInWithOtp error:", error.status, error.name);

      if (isRateLimit) {
        return NextResponse.json(
          { error: "Too many sign-in emails were sent. Please wait 60 seconds and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Couldn't send the magic link. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

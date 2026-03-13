import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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

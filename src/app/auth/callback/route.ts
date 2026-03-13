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
  } catch {
    return NextResponse.redirect(new URL("/upgrade?error=auth", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

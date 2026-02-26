import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // RLS enforces revoked=false and expiry — if row is missing/revoked/expired, returns null
    const { data: shareLink } = await supabase
      .from("share_links")
      .select("snapshot")
      .eq("id", id)
      .single();

    if (!shareLink) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return only the snapshot — no user_id, no analysis_id, no internal fields
    return NextResponse.json({ snapshot: shareLink.snapshot });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("share_links")
      .update({ revoked: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("pro")
      .eq("id", user.id)
      .single();

    if (userRow?.pro !== true) {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("saved_prompts")
      .select("id, name, prompt, model_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompts: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("pro")
      .eq("id", user.id)
      .single();

    if (userRow?.pro !== true) {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const prompt = String(body.prompt ?? "").trim();
    const model_id = String(body.model_id ?? "").trim();

    if (!name || !prompt || !model_id) {
      return NextResponse.json(
        { error: "name, prompt, and model_id are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("saved_prompts")
      .insert({ user_id: user.id, name, prompt, model_id })
      .select("id, name, prompt, model_id, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompt: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { validateClientSnapshot } from "@/lib/share-schema";
import { resolveModel, pricingLastUpdated } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const analysis_id = typeof body.analysis_id === "string" ? body.analysis_id.trim() : "";
    if (!analysis_id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate ownership of the analysis_history row
    const { data: historyRow } = await supabase
      .from("analysis_history")
      .select("id")
      .eq("id", analysis_id)
      .eq("user_id", user.id)
      .single();

    if (!historyRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate and allowlist the client-provided snapshot
    const validated = validateClientSnapshot(body.snapshot);
    if (!validated) {
      return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 });
    }

    // Server injects model metadata — never from client
    const modelConfig = resolveModel(validated.modelId);
    const modelName = modelConfig?.name ?? validated.modelId;

    const snapshot = {
      analysis: validated.analysis,
      modelId: validated.modelId,
      modelName,
      pricingLastUpdated,
    };

    const { data: inserted, error } = await supabase
      .from("share_links")
      .insert({
        user_id: user.id,
        analysis_id,
        snapshot,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
    }

    return NextResponse.json({ id: inserted.id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

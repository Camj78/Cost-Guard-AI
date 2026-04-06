import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>).source !== "cli" ||
    (body as Record<string, unknown>).event !== "analyze_run" ||
    typeof (body as Record<string, unknown>).anonymous_id !== "string" ||
    !(body as Record<string, unknown>).anonymous_id ||
    typeof (body as Record<string, unknown>).has_api_key !== "boolean" ||
    typeof (body as Record<string, unknown>).timestamp !== "string" ||
    isNaN(Date.parse((body as Record<string, unknown>).timestamp as string))
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const payload = body as {
    source: string;
    event: string;
    anonymous_id: string;
    timestamp: string;
    has_api_key: boolean;
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("cli_telemetry").insert({
    source: payload.source,
    event: payload.event,
    anonymous_id: payload.anonymous_id,
    has_api_key: payload.has_api_key,
    client_timestamp: payload.timestamp,
  });

  if (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

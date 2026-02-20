import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // can be anon or service role

  if (!supabaseUrl || !key) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/waitlist_count`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({}), // RPC requires a JSON body
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: "Count failed", details: text.slice(0, 500) }, { status: 500 });
  }

  const count = await res.json(); // RPC returns a raw number
  return NextResponse.json({ count });
}

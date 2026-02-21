import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const company = String(body.company || "").trim();
    const source = String(body.source || "").trim();
    const role = String(body.role || "").trim();
    const stage = String(body.stage || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const payload: Record<string, any> = { email };
    if (company) payload.company = company;
    if (source) payload.source = source;
    if (role) payload.role = role;
    if (stage) payload.stage = stage;

    const res = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Insert failed", status: res.status, details: details.slice(0, 800) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

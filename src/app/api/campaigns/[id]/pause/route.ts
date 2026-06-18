import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json() as { action: "pause" | "resume" | "cancel" };
  const sb = createClient(supabaseUrl, supabaseKey);

  const { data: campaign } = await sb.from("campaigns").select("status").eq("id", id).single();
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (action === "pause") {
    await sb.from("campaigns").update({ status: "paused" }).eq("id", id);
    return Response.json({ ok: true, status: "paused" });
  }

  if (action === "resume") {
    await sb.from("campaigns").update({ status: "active" }).eq("id", id);
    return Response.json({ ok: true, status: "active" });
  }

  if (action === "cancel") {
    await sb.from("campaigns").update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    }).eq("id", id);

    // Cancel all pending jobs
    await sb.from("campaign_jobs")
      .update({ status: "cancelled", skip_reason: "campaign_cancelled" })
      .eq("campaign_id", id)
      .in("status", ["pending", "processing"]);

    return Response.json({ ok: true, status: "cancelled" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

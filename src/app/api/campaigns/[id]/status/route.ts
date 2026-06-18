import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createClient(supabaseUrl, supabaseKey);

  const [campaignRes, jobStatsRes, batchesRes] = await Promise.all([
    sb.from("campaigns").select("*").eq("id", id).single(),
    sb.from("campaign_jobs").select("status", { count: "exact" }).eq("campaign_id", id),
    sb.from("campaign_daily_batches").select("*").eq("campaign_id", id).order("batch_date", { ascending: true }),
  ]);

  if (!campaignRes.data) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Aggregate job stats
  const allJobs = jobStatsRes.data ?? [];
  const counts = { pending: 0, processing: 0, sent: 0, delivered: 0, failed: 0, skipped: 0, cancelled: 0 };
  for (const j of allJobs) {
    const s = j.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  const totalJobs = allJobs.length;
  const totalProcessed = counts.sent + counts.delivered + counts.failed + counts.skipped;
  const blockRate = totalProcessed > 0 ? counts.failed / totalProcessed : 0;

  // ETA calculation
  let etaHours: number | null = null;
  if (counts.sent > 0 && counts.pending > 0) {
    const campaign = campaignRes.data;
    const launchedAt = campaign.launched_at ? new Date(campaign.launched_at).getTime() : Date.now();
    const hoursElapsed = (Date.now() - launchedAt) / 3_600_000;
    const sendRate = counts.sent / Math.max(hoursElapsed, 0.1);
    etaHours = Math.round((counts.pending / sendRate) * 10) / 10;
  }

  // Fetch connector quality
  let qualityRating: string | null = null;
  if (campaignRes.data.connector_id) {
    const { data: conn } = await sb.from("connectors").select("quality_rating").eq("id", campaignRes.data.connector_id).single();
    qualityRating = conn?.quality_rating ?? null;
  }

  return Response.json({
    campaign_id: id,
    status: campaignRes.data.status,
    total_jobs: totalJobs,
    sent: counts.sent,
    delivered: counts.delivered,
    failed: counts.failed,
    pending: counts.pending,
    skipped: counts.skipped,
    block_rate: Math.round(blockRate * 10000) / 100,
    eta_hours: etaHours,
    quality_rating: qualityRating,
    daily_batches: (batchesRes.data ?? []).map((b) => ({
      date: b.batch_date,
      total: b.total_contacts,
      sent: b.sent,
      delivered: b.delivered,
      failed: b.failed,
      block_rate: b.block_rate,
      quality: b.quality_at_send,
    })),
  });
}

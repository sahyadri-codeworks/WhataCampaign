import { createClient } from "@supabase/supabase-js";
import type { CampaignPlan, DailyBatchPlan } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const { campaign_id } = await req.json() as { campaign_id: string };

  if (!campaign_id) {
    return Response.json({ error: "campaign_id required" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch campaign with plan
  const { data: campaign, error: cErr } = await sb
    .from("campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (cErr || !campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const plan = campaign.plan_json as unknown as CampaignPlan | null;
  if (!plan || !plan.contact_ids_ordered) {
    return Response.json({ error: "No plan generated. Generate a plan first." }, { status: 400 });
  }

  // Fetch contact phone numbers for the ordered IDs
  const contactMap = new Map<string, string>();
  const BATCH = 500;
  for (let i = 0; i < plan.contact_ids_ordered.length; i += BATCH) {
    const batch = plan.contact_ids_ordered.slice(i, i + BATCH);
    const { data } = await sb.from("contacts").select("id, phone").in("id", batch);
    if (data) data.forEach((c) => contactMap.set(c.id, c.phone));
  }

  // Build jobs from the daily schedule
  const jobs: {
    campaign_id: string;
    contact_id: string;
    contact_phone: string;
    sequence_step: number;
    scheduled_at: string;
    status: string;
  }[] = [];

  let contactIdx = 0;
  for (const day of plan.daily_schedule) {
    for (const hourBatch of day.hourly_batches) {
      for (let j = 0; j < hourBatch.count && contactIdx < plan.contact_ids_ordered.length; j++) {
        const cid = plan.contact_ids_ordered[contactIdx];
        const phone = contactMap.get(cid) || "";
        jobs.push({
          campaign_id,
          contact_id: cid,
          contact_phone: phone,
          sequence_step: 1,
          scheduled_at: `${day.date}T${hourBatch.hour}:00Z`,
          status: "pending",
        });
        contactIdx++;
      }
    }
  }

  // Batch insert jobs (Supabase has row limits, insert in chunks)
  const JOB_BATCH = 500;
  for (let i = 0; i < jobs.length; i += JOB_BATCH) {
    const { error } = await sb.from("campaign_jobs").insert(jobs.slice(i, i + JOB_BATCH));
    if (error) {
      return Response.json({ error: `Failed to insert jobs: ${error.message}` }, { status: 500 });
    }
  }

  // Create daily batch summary rows
  const dailyRows = plan.daily_schedule.map((d: DailyBatchPlan) => ({
    campaign_id,
    batch_date: d.date,
    total_contacts: d.batch_size,
  }));
  if (dailyRows.length > 0) {
    await sb.from("campaign_daily_batches").insert(dailyRows);
  }

  // Update campaign status
  await sb.from("campaigns").update({
    status: "active",
    launched_at: new Date().toISOString(),
  }).eq("id", campaign_id);

  return Response.json({
    ok: true,
    total_jobs: jobs.length,
    total_days: plan.daily_schedule.length,
  });
}

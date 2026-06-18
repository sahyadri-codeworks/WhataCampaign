import { createClient } from "@supabase/supabase-js";
import { generateCampaignPlan } from "@/lib/campaign-planner";
import type { CampaignSortConfig } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const body = await req.json() as {
    user_id: string;
    campaign_id?: string;
    config: CampaignSortConfig;
  };

  if (!body.user_id || !body.config) {
    return Response.json({ error: "user_id and config required" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const config = body.config;

  // Resolve segment contact IDs
  let contactIds: string[] | null = null;
  if (config.audience_segment_ids.length > 0) {
    const { data: segs } = await sb
      .from("segments")
      .select("filter_query")
      .in("id", config.audience_segment_ids);

    if (segs) {
      const ids = new Set<string>();
      for (const seg of segs) {
        try {
          const parsed = JSON.parse(seg.filter_query);
          if (Array.isArray(parsed)) parsed.forEach((id: string) => ids.add(id));
        } catch { /* skip */ }
      }
      contactIds = [...ids];
    }
  }

  // Fetch contacts
  let query = sb
    .from("contacts")
    .select("id, phone, name, optin_category, tier_tag, engagement_score, last_campaign_sent_at, freq_capped_until, tags, last_message_at, block_count")
    .eq("user_id", body.user_id);

  if (contactIds && contactIds.length > 0) {
    // Supabase .in() has a limit, batch if needed
    const BATCH_SIZE = 500;
    const allContacts: Record<string, unknown>[] = [];
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);
      const { data } = await sb
        .from("contacts")
        .select("id, phone, name, optin_category, tier_tag, engagement_score, last_campaign_sent_at, freq_capped_until, tags, last_message_at, block_count")
        .eq("user_id", body.user_id)
        .in("id", batch);
      if (data) allContacts.push(...data);
    }
    const plan = generateCampaignPlan(allContacts as Parameters<typeof generateCampaignPlan>[0], config);

    // Save plan to campaign if campaign_id provided
    if (body.campaign_id) {
      await sb.from("campaigns").update({
        plan_json: plan as unknown as Record<string, unknown>,
        plan_generated_at: plan.generated_at,
        status: "planned",
      }).eq("id", body.campaign_id);
    }

    return Response.json(plan);
  }

  // No segments selected — fetch all user contacts
  const { data: contacts, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const plan = generateCampaignPlan((contacts ?? []) as Parameters<typeof generateCampaignPlan>[0], config);

  if (body.campaign_id) {
    await sb.from("campaigns").update({
      plan_json: plan as unknown as Record<string, unknown>,
      plan_generated_at: plan.generated_at,
      status: "planned",
    }).eq("id", body.campaign_id);
  }

  return Response.json(plan);
}

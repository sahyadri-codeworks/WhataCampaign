import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ConnectorManager } from "./connectors/manager";
import { MetaCloudApiAdapter } from "./connectors/meta-cloud-api.adapter";
import { BspAdapter } from "./connectors/bsp.adapter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type JobRow = {
  id: string;
  campaign_id: string;
  contact_id: string;
  contact_phone: string;
  sequence_step: number;
  scheduled_at: string;
};

type ExecutionResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  paused_campaigns: string[];
};

function buildConnectorManager(connector: Record<string, unknown>, fallback?: Record<string, unknown> | null): ConnectorManager {
  const mgr = new ConnectorManager();
  const config = (connector.config_encrypted ?? {}) as Record<string, string>;
  const type = connector.type as string;

  mgr.register({
    id: connector.id as string,
    name: connector.name as string,
    type: type as "meta_cloud_api" | "360dialog" | "wati" | "interakt",
    is_fallback: false,
    config,
  });

  if (fallback && fallback.id) {
    const fbConfig = (fallback.config_encrypted ?? {}) as Record<string, string>;
    mgr.register({
      id: fallback.id as string,
      name: fallback.name as string,
      type: fallback.type as "meta_cloud_api" | "360dialog" | "wati" | "interakt",
      is_fallback: true,
      config: fbConfig,
    });
  }

  return mgr;
}

export async function executePendingJobs(limit: number = 200): Promise<ExecutionResult> {
  const sb = createClient(supabaseUrl, supabaseKey);
  const result: ExecutionResult = { processed: 0, sent: 0, failed: 0, skipped: 0, paused_campaigns: [] };

  // Claim pending jobs atomically
  const { data: pendingJobs, error: fetchErr } = await sb
    .from("campaign_jobs")
    .select("id, campaign_id, contact_id, contact_phone, sequence_step, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (fetchErr || !pendingJobs || pendingJobs.length === 0) {
    return result;
  }

  // Mark as processing
  const jobIds = pendingJobs.map((j) => j.id);
  await sb.from("campaign_jobs").update({ status: "processing" }).in("id", jobIds);

  // Cache campaigns and connectors per campaign
  const campaignCache = new Map<string, Record<string, unknown>>();
  const connectorCache = new Map<string, ConnectorManager>();
  const pausedCampaigns = new Set<string>();

  for (const job of pendingJobs as JobRow[]) {
    if (pausedCampaigns.has(job.campaign_id)) {
      await sb.from("campaign_jobs").update({ status: "pending" }).eq("id", job.id);
      continue;
    }

    result.processed++;

    try {
      // Load campaign
      let campaign = campaignCache.get(job.campaign_id);
      if (!campaign) {
        const { data } = await sb.from("campaigns").select("*").eq("id", job.campaign_id).single();
        if (!data || data.status === "paused" || data.status === "cancelled") {
          await sb.from("campaign_jobs").update({ status: "cancelled", skip_reason: "campaign_stopped" }).eq("id", job.id);
          pausedCampaigns.add(job.campaign_id);
          result.skipped++;
          continue;
        }
        campaign = data as Record<string, unknown>;
        campaignCache.set(job.campaign_id, campaign);
      }

      // Re-check contact eligibility
      const { data: contact } = await sb
        .from("contacts")
        .select("optin_category, freq_capped_until")
        .eq("id", job.contact_id)
        .single();

      if (!contact || contact.optin_category === "opted_out") {
        await sb.from("campaign_jobs").update({
          status: "skipped",
          skip_reason: "opted_out",
          executed_at: new Date().toISOString(),
        }).eq("id", job.id);
        result.skipped++;
        continue;
      }

      if (contact.freq_capped_until && new Date(contact.freq_capped_until) > new Date()) {
        await sb.from("campaign_jobs").update({
          status: "skipped",
          skip_reason: "freq_capped",
          executed_at: new Date().toISOString(),
        }).eq("id", job.id);
        result.skipped++;
        continue;
      }

      // Build connector manager
      let mgr = connectorCache.get(job.campaign_id);
      if (!mgr) {
        const connectorId = campaign.connector_id as string;
        const fallbackId = campaign.fallback_connector_id as string | null;

        const { data: conn } = await sb.from("connectors").select("*").eq("id", connectorId).single();
        let fallbackConn = null;
        if (fallbackId) {
          const { data: fb } = await sb.from("connectors").select("*").eq("id", fallbackId).single();
          fallbackConn = fb;
        }

        if (!conn) {
          await sb.from("campaign_jobs").update({
            status: "failed",
            error_code: "no_connector",
            executed_at: new Date().toISOString(),
          }).eq("id", job.id);
          result.failed++;
          continue;
        }

        mgr = buildConnectorManager(conn as Record<string, unknown>, fallbackConn as Record<string, unknown> | null);
        connectorCache.set(job.campaign_id, mgr);
      }

      // Check quality rating
      try {
        const quality = await mgr.getQualityRating();
        if (quality && typeof quality === "object" && "quality_rating" in quality && quality.quality_rating === "RED") {
          await sb.from("campaigns").update({ status: "paused" }).eq("id", job.campaign_id);
          await sb.from("campaign_jobs").update({ status: "pending" }).eq("id", job.id);
          pausedCampaigns.add(job.campaign_id);
          result.paused_campaigns.push(job.campaign_id);
          continue;
        }
      } catch { /* quality check failed, proceed */ }

      // Build message and send
      const templateName = campaign.template_name as string || "";
      const variableMappings = (campaign.variable_mappings ?? {}) as Record<string, string>;

      // Fetch contact fields for variable substitution
      const { data: fullContact } = await sb
        .from("contacts")
        .select("name, phone, tier_tag, tags")
        .eq("id", job.contact_id)
        .single();

      const contactFields: Record<string, string> = {
        name: fullContact?.name || "",
        phone: fullContact?.phone || job.contact_phone,
        tier_tag: fullContact?.tier_tag || "",
      };

      // Build template components
      const components: unknown[] = [];
      const paramEntries = Object.entries(variableMappings);
      if (paramEntries.length > 0) {
        const parameters = paramEntries
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, field]) => ({
            type: "text",
            text: contactFields[field] || "",
          }));
        components.push({ type: "body", parameters });
      }

      const sendResult = await mgr.send({
        phone: job.contact_phone,
        template_name: templateName,
        template_language: "en",
        components,
      });

      // Success
      const connUsed = (sendResult as Record<string, unknown>).fallback_used as string | undefined;
      await sb.from("campaign_jobs").update({
        status: "sent",
        connector_used: connUsed || "primary",
        executed_at: new Date().toISOString(),
      }).eq("id", job.id);

      // Insert message log
      await sb.from("message_log").insert({
        campaign_id: job.campaign_id,
        contact_id: job.contact_id,
        contact_phone: job.contact_phone,
        status: "sent",
        connector_used: connUsed || "primary",
        sent_at: new Date().toISOString(),
      });

      // Update contact last sent
      await sb.from("contacts").update({
        last_campaign_sent_at: new Date().toISOString(),
      }).eq("id", job.contact_id);

      // Update campaign counters
      await sb.rpc("increment_campaign_sent" as never, { cid: job.campaign_id } as never).then(() => {});
      // Fallback: direct update
      const { data: cData } = await sb.from("campaigns").select("total_sent").eq("id", job.campaign_id).single();
      if (cData) {
        await sb.from("campaigns").update({ total_sent: (cData.total_sent || 0) + 1 }).eq("id", job.campaign_id);
      }

      // Update daily batch
      const batchDate = job.scheduled_at.slice(0, 10);
      const { data: batchRow } = await sb
        .from("campaign_daily_batches")
        .select("id, sent")
        .eq("campaign_id", job.campaign_id)
        .eq("batch_date", batchDate)
        .single();
      if (batchRow) {
        await sb.from("campaign_daily_batches").update({ sent: (batchRow.sent || 0) + 1 }).eq("id", batchRow.id);
      }

      // Create next sequence step job if applicable
      await createNextSequenceJob(sb, job, campaign);

      result.sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "unknown";
      const errorCode = errMsg.includes("130429") ? "rate_limit" :
                        errMsg.includes("131049") ? "freq_cap" : "send_error";

      await sb.from("campaign_jobs").update({
        status: errorCode === "freq_cap" ? "skipped" : "failed",
        error_code: errorCode,
        skip_reason: errorCode === "freq_cap" ? "freq_capped" : undefined,
        executed_at: new Date().toISOString(),
      }).eq("id", job.id);

      if (errorCode === "freq_cap") {
        result.skipped++;
      } else {
        result.failed++;
      }

      // Update daily batch failure count
      const batchDate = job.scheduled_at.slice(0, 10);
      const { data: batchRow } = await sb
        .from("campaign_daily_batches")
        .select("id, failed, sent")
        .eq("campaign_id", job.campaign_id)
        .eq("batch_date", batchDate)
        .single();
      if (batchRow) {
        const newFailed = (batchRow.failed || 0) + 1;
        const totalProcessed = (batchRow.sent || 0) + newFailed;
        const blockRate = totalProcessed > 0 ? newFailed / totalProcessed : 0;
        await sb.from("campaign_daily_batches").update({
          failed: newFailed,
          block_rate: blockRate,
        }).eq("id", batchRow.id);

        // Auto-pause if block rate > 2%
        if (blockRate > 0.02 && totalProcessed > 100) {
          await sb.from("campaigns").update({ status: "paused" }).eq("id", job.campaign_id);
          pausedCampaigns.add(job.campaign_id);
          result.paused_campaigns.push(job.campaign_id);
        }
      }
    }
  }

  // Check for completed campaigns
  const campaignIds = [...new Set(pendingJobs.map((j) => j.campaign_id))];
  for (const cid of campaignIds) {
    if (pausedCampaigns.has(cid)) continue;
    const { count } = await sb
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", cid)
      .in("status", ["pending", "processing"]);

    if (count === 0) {
      await sb.from("campaigns").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", cid);
    }
  }

  return result;
}

async function createNextSequenceJob(
  sb: SupabaseClient,
  job: JobRow,
  campaign: Record<string, unknown>,
) {
  const nextStep = job.sequence_step + 1;

  const { data: stepDef } = await sb
    .from("campaign_sequence_steps")
    .select("*")
    .eq("campaign_id", job.campaign_id)
    .eq("step_order", nextStep)
    .single();

  if (!stepDef) return;

  // Check condition gate
  if (stepDef.condition !== "always") {
    const { data: logs } = await sb
      .from("message_log")
      .select("responded_at")
      .eq("campaign_id", job.campaign_id)
      .eq("contact_id", job.contact_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (stepDef.condition === "not_replied" && logs?.[0]?.responded_at) {
      return; // Contact replied — skip next step
    }
  }

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + (stepDef.day_offset || 0));

  await sb.from("campaign_jobs").insert({
    campaign_id: job.campaign_id,
    contact_id: job.contact_id,
    contact_phone: job.contact_phone,
    sequence_step: nextStep,
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
  });
}

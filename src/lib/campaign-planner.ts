import type {
  CampaignSortConfig,
  CampaignPlan,
  DailyBatchPlan,
  ExclusionBreakdown,
  PriorityWeights,
} from "./types";

type ContactRow = {
  id: string;
  phone: string;
  name: string | null;
  optin_category: string;
  tier_tag: string;
  engagement_score: number;
  last_campaign_sent_at: string | null;
  freq_capped_until: string | null;
  tags: string[];
  last_message_at: string | null;
  block_count: number;
};

type ScoredContact = ContactRow & { priority_score: number };

// ── Scoring helpers ──────────────────────────────────────────

function recencyScore(lastMessageAt: string | null, now: number): number {
  if (!lastMessageAt) return 0;
  const daysSince = (now - new Date(lastMessageAt).getTime()) / 86_400_000;
  return Math.max(0, Math.min(100, 100 - daysSince));
}

function tagScore(tier: string): number {
  switch (tier) {
    case "VIP": return 100;
    case "Regular": return 50;
    case "New": return 10;
    default: return 10;
  }
}

function optinScore(category: string): number {
  switch (category) {
    case "double_confirmed": return 100;
    case "marketing": return 70;
    case "utility_only": return 40;
    default: return 0;
  }
}

function computePriority(c: ContactRow, w: PriorityWeights, now: number): number {
  const total = w.engagement + w.recency + w.tag + w.optin || 1;
  return (
    (w.engagement / total) * (c.engagement_score ?? 0) +
    (w.recency / total) * recencyScore(c.last_message_at, now) +
    (w.tag / total) * tagScore(c.tier_tag) +
    (w.optin / total) * optinScore(c.optin_category)
  );
}

// ── Eligibility filter ───────────────────────────────────────

type FilterResult = {
  eligible: ContactRow[];
  breakdown: ExclusionBreakdown;
};

function filterContacts(
  contacts: ContactRow[],
  config: CampaignSortConfig,
  now: Date,
): FilterResult {
  const breakdown: ExclusionBreakdown = {
    opted_out: 0,
    cooldown_active: 0,
    optin_missing: 0,
    freq_capped: 0,
    excluded_by_tag: 0,
  };

  const cooldownMs = config.cooldown_hours * 3_600_000;
  const nowMs = now.getTime();
  const excludeTagsSet = new Set(config.exclude_tags.map((t) => t.toLowerCase()));

  const eligible = contacts.filter((c) => {
    if (c.optin_category === "opted_out") {
      breakdown.opted_out++;
      return false;
    }

    if (config.category === "Marketing" && !["marketing", "double_confirmed"].includes(c.optin_category)) {
      breakdown.optin_missing++;
      return false;
    }

    if (c.last_campaign_sent_at) {
      const lastSent = new Date(c.last_campaign_sent_at).getTime();
      if (nowMs - lastSent < cooldownMs) {
        breakdown.cooldown_active++;
        return false;
      }
    }

    if (c.freq_capped_until) {
      const capUntil = new Date(c.freq_capped_until).getTime();
      if (nowMs < capUntil) {
        breakdown.freq_capped++;
        return false;
      }
    }

    if (c.tags && c.tags.some((t) => excludeTagsSet.has(t.toLowerCase()))) {
      breakdown.excluded_by_tag++;
      return false;
    }

    return true;
  });

  return { eligible, breakdown };
}

// ── Batch distribution ───────────────────────────────────────

function parseSendHour(timeStr: string): number {
  const [h] = timeStr.split(":").map(Number);
  return h;
}

function distributeBatches(
  contacts: ScoredContact[],
  config: CampaignSortConfig,
): DailyBatchPlan[] {
  const dailyCap = config.daily_limit;
  const windowStart = parseSendHour(config.send_window_start);
  const windowEnd = parseSendHour(config.send_window_end);
  const windowHours = Math.max(1, windowEnd - windowStart);
  const hourlySize = Math.ceil(dailyCap / windowHours);

  const startDate = new Date(config.start_date + "T00:00:00Z");
  const totalDays = Math.ceil(contacts.length / dailyCap);
  const schedule: DailyBatchPlan[] = [];

  for (let d = 0; d < totalDays; d++) {
    const batchStart = d * dailyCap;
    const batchEnd = Math.min(batchStart + dailyCap, contacts.length);
    const batchSize = batchEnd - batchStart;

    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + d);
    const dateStr = date.toISOString().slice(0, 10);

    const hourly: { hour: string; count: number }[] = [];
    let remaining = batchSize;
    for (let h = windowStart; h < windowEnd && remaining > 0; h++) {
      const count = Math.min(hourlySize, remaining);
      hourly.push({ hour: `${String(h).padStart(2, "0")}:00`, count });
      remaining -= count;
    }

    schedule.push({
      date: dateStr,
      batch_size: batchSize,
      send_window: `${config.send_window_start}–${config.send_window_end}`,
      hourly_batches: hourly,
    });
  }

  return schedule;
}

// ── Main planner function ────────────────────────────────────

export function generateCampaignPlan(
  contacts: ContactRow[],
  config: CampaignSortConfig,
): CampaignPlan {
  const now = new Date();
  const { eligible, breakdown } = filterContacts(contacts, config, now);
  const nowMs = now.getTime();

  // Score and sort
  const weights = config.priority_weights;
  let scored: ScoredContact[];

  if (config.priority_mode === "round_robin") {
    scored = eligible.map((c) => ({ ...c, priority_score: Math.random() }));
  } else {
    scored = eligible
      .map((c) => ({ ...c, priority_score: computePriority(c, weights, nowMs) }))
      .sort((a, b) => b.priority_score - a.priority_score);
  }

  const daily_schedule = distributeBatches(scored, config);
  const totalExcluded = contacts.length - eligible.length;

  // Warnings
  const warnings: string[] = [];
  const excludePct = contacts.length > 0 ? (totalExcluded / contacts.length) * 100 : 0;
  if (excludePct > 20) {
    warnings.push(`${totalExcluded.toLocaleString()} contacts (${excludePct.toFixed(1)}%) excluded from this campaign.`);
  }
  if (breakdown.optin_missing > 0) {
    warnings.push(`${breakdown.optin_missing.toLocaleString()} contacts have no marketing opt-in — excluded automatically.`);
  }
  if (daily_schedule.length > 14) {
    warnings.push(`Campaign will take ${daily_schedule.length} days to complete. Consider increasing daily send cap.`);
  }
  if (config.sequence_steps.length > 1) {
    const totalSeqDays = Math.max(...config.sequence_steps.map((s) => s.day_offset));
    warnings.push(`Multi-step sequence spans ${totalSeqDays} days per contact after initial send.`);
  }

  const estDeliveryLow = 91;
  const estDeliveryHigh = 94;

  return {
    total_contacts_eligible: eligible.length,
    total_contacts_excluded: totalExcluded,
    exclusion_breakdown: breakdown,
    estimated_days_to_complete: daily_schedule.length,
    daily_schedule,
    sequence_steps: config.sequence_steps,
    estimated_delivery_rate: `${estDeliveryLow}–${estDeliveryHigh}%`,
    warnings,
    contact_ids_ordered: scored.map((c) => c.id),
    generated_at: now.toISOString(),
  };
}

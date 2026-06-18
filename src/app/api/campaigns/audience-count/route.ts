import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const body = await req.json() as {
    user_id: string;
    segment_ids?: string[];
    tag_filter?: string[];
    exclude_tags?: string[];
    category?: string;
  };

  if (!body.user_id) {
    return Response.json({ error: "user_id required" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  let contactIds: string[] | null = null;

  if (body.segment_ids && body.segment_ids.length > 0) {
    const { data: segs } = await sb
      .from("segments")
      .select("filter_query")
      .in("id", body.segment_ids);

    if (segs) {
      const ids = new Set<string>();
      for (const seg of segs) {
        try {
          const parsed = JSON.parse(seg.filter_query);
          if (Array.isArray(parsed)) parsed.forEach((id: string) => ids.add(id));
        } catch { /* skip malformed */ }
      }
      contactIds = [...ids];
    }
  }

  let query = sb
    .from("contacts")
    .select("id, optin_category, tags, last_campaign_sent_at, freq_capped_until", { count: "exact", head: true })
    .eq("user_id", body.user_id);

  if (contactIds) {
    query = query.in("id", contactIds);
  }

  if (body.category === "Marketing") {
    query = query.in("optin_category", ["marketing", "double_confirmed"]);
  }

  const { count, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ count: count ?? 0 });
}

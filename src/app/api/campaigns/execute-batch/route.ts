import { executePendingJobs } from "@/lib/campaign-executor";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({})) as { limit?: number };
  const limit = Math.min(body.limit ?? 200, 500);

  const result = await executePendingJobs(limit);
  return Response.json(result);
}

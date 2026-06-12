import { generateSchedule } from "@/lib/scheduler";
import type { CampaignConfig, Contact, ContactHistory } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    contacts?: Contact[];
    config?: CampaignConfig;
    existingHistory?: ContactHistory[];
  };

  if (!body.contacts || !body.config) {
    return Response.json(
      { error: "contacts and config are required." },
      { status: 400 },
    );
  }

  return Response.json(
    generateSchedule(body.contacts, body.config, body.existingHistory ?? []),
  );
}

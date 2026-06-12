import { MetaCloudApiAdapter } from "@/lib/connectors/meta-cloud-api.adapter";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "whatacampaign_verify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const payload = await req.json();

  const adapter = new MetaCloudApiAdapter({
    phone_number_id: "",
    access_token: "",
  });

  const event = adapter.webhookHandler(payload);

  if (!event) {
    return Response.json({ received: true, processed: false });
  }

  // Log the event — in production, this would write to message_log table
  console.log(`[Webhook] ${event.type}:`, JSON.stringify(event.data));

  return Response.json({ received: true, processed: true, type: event.type });
}

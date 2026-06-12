import { MetaCloudApiAdapter, MetaApiError } from "@/lib/connectors/meta-cloud-api.adapter";
import { BspAdapter } from "@/lib/connectors/bsp.adapter";

function createAdapter(type: string, config: Record<string, string>) {
  if (type === "meta_cloud_api") {
    return new MetaCloudApiAdapter({
      phone_number_id: config.phone_number_id,
      access_token: config.access_token,
      api_version: config.api_version,
    });
  }
  if (type === "crm_webhook") {
    return null;
  }
  return new BspAdapter({
    base_url: config.base_url || "",
    api_key: config.api_key || "",
    provider: type as "360dialog" | "wati" | "interakt",
  });
}

async function sendViaWebhook(config: Record<string, string>, msg: Record<string, unknown>) {
  const url = config.webhook_url || config.base_url;
  if (!url) throw new Error("No webhook_url configured");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.auth_header) headers["Authorization"] = config.auth_header;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...msg, source: "whatacampaign", timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status} ${res.statusText}`);
  }

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { message_id: (data.message_id as string) || (data.id as string) || `webhook_${Date.now()}` };
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    phone: string;
    template_name: string;
    template_language: string;
    components?: unknown[];
    connector: { type: string; config: Record<string, string> };
    fallback_connector?: { type: string; config: Record<string, string> };
  };

  if (!body.phone || !body.template_name || !body.connector) {
    return Response.json({ error: "phone, template_name, and connector are required" }, { status: 400 });
  }

  const msg = {
    phone: body.phone,
    template_name: body.template_name,
    template_language: body.template_language || "en",
    components: body.components,
  };

  try {
    if (body.connector.type === "crm_webhook") {
      const result = await sendViaWebhook(body.connector.config, msg);
      return Response.json({ ...result, connector_used: "primary" });
    }

    const adapter = createAdapter(body.connector.type, body.connector.config);
    if (!adapter) {
      return Response.json({ error: "Invalid connector configuration" }, { status: 400 });
    }
    const result = await adapter.send(msg);
    return Response.json({ ...result, connector_used: "primary" });
  } catch (err) {
    if (err instanceof MetaApiError && err.isRateLimit && body.fallback_connector) {
      try {
        if (body.fallback_connector.type === "crm_webhook") {
          const result = await sendViaWebhook(body.fallback_connector.config, msg);
          return Response.json({ ...result, connector_used: "fallback" });
        }
        const fallback = createAdapter(body.fallback_connector.type, body.fallback_connector.config);
        if (!fallback) throw new Error("Invalid fallback config");
        const result = await fallback.send(msg);
        return Response.json({ ...result, connector_used: "fallback" });
      } catch (fbErr) {
        return Response.json({
          error: "Both primary and fallback connectors failed",
          primary_error: err.message,
          fallback_error: fbErr instanceof Error ? fbErr.message : "Unknown",
        }, { status: 502 });
      }
    }

    const errorCode = err instanceof MetaApiError ? err.code : undefined;
    return Response.json({
      error: err instanceof Error ? err.message : "Send failed",
      error_code: errorCode,
    }, { status: err instanceof MetaApiError ? err.httpStatus : 500 });
  }
}

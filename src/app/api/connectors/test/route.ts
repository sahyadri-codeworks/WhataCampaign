import { MetaCloudApiAdapter } from "@/lib/connectors/meta-cloud-api.adapter";
import { BspAdapter } from "@/lib/connectors/bsp.adapter";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type: string;
    config: Record<string, string>;
  };

  if (!body.type || !body.config) {
    return Response.json({ error: "type and config are required" }, { status: 400 });
  }

  try {
    let result: { ok: boolean; phone_number?: string; display_name?: string; error?: string };

    switch (body.type) {
      case "meta_cloud_api": {
        if (!body.config.phone_number_id || !body.config.access_token) {
          return Response.json({ error: "phone_number_id and access_token are required" }, { status: 400 });
        }
        const adapter = new MetaCloudApiAdapter({
          phone_number_id: body.config.phone_number_id,
          access_token: body.config.access_token,
          api_version: body.config.api_version,
        });
        result = await adapter.testConnection();
        break;
      }

      case "360dialog": {
        if (!body.config.api_key) {
          return Response.json({ error: "api_key is required for 360dialog" }, { status: 400 });
        }
        const adapter = new BspAdapter({
          base_url: body.config.base_url || "https://waba.360dialog.io",
          api_key: body.config.api_key,
          provider: "360dialog",
        });
        result = await adapter.testConnection();
        break;
      }

      case "wati": {
        if (!body.config.api_key || !body.config.base_url) {
          return Response.json({ error: "base_url and api_key are required for Wati" }, { status: 400 });
        }
        const adapter = new BspAdapter({
          base_url: body.config.base_url,
          api_key: body.config.api_key,
          provider: "wati",
        });
        result = await adapter.testConnection();
        break;
      }

      case "interakt": {
        if (!body.config.api_key) {
          return Response.json({ error: "api_key is required for Interakt" }, { status: 400 });
        }
        const adapter = new BspAdapter({
          base_url: body.config.base_url || "https://api.interakt.ai",
          api_key: body.config.api_key,
          provider: "interakt",
        });
        result = await adapter.testConnection();
        break;
      }

      case "crm_webhook": {
        const webhookUrl = body.config.webhook_url || body.config.base_url;
        if (!webhookUrl) {
          return Response.json({ error: "webhook_url is required" }, { status: 400 });
        }
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (body.config.auth_header) headers["Authorization"] = body.config.auth_header;

          const res = await fetch(webhookUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ type: "connection_test", source: "whatacampaign", timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(10000),
          });
          const ok = res.status >= 200 && res.status < 400;
          result = {
            ok,
            display_name: ok ? `Webhook OK (${res.status})` : undefined,
            error: ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
          };
        } catch (err) {
          result = { ok: false, error: err instanceof Error ? err.message : "Webhook unreachable" };
        }
        break;
      }

      default:
        return Response.json({ error: `Unknown connector type: ${body.type}` }, { status: 400 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

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
    let result;

    if (body.type === "meta_cloud_api") {
      if (!body.config.phone_number_id || !body.config.access_token) {
        return Response.json({ error: "phone_number_id and access_token are required" }, { status: 400 });
      }

      const adapter = new MetaCloudApiAdapter({
        phone_number_id: body.config.phone_number_id,
        access_token: body.config.access_token,
        api_version: body.config.api_version,
      });

      result = await adapter.testConnection();
    } else if (["360dialog", "wati", "interakt"].includes(body.type)) {
      if (!body.config.base_url || !body.config.api_key) {
        return Response.json({ error: "base_url and api_key are required" }, { status: 400 });
      }

      const adapter = new BspAdapter({
        base_url: body.config.base_url,
        api_key: body.config.api_key,
        provider: body.type as "360dialog" | "wati" | "interakt",
      });

      result = await adapter.testConnection();
    } else {
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

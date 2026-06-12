import { MetaCloudApiAdapter } from "@/lib/connectors/meta-cloud-api.adapter";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    phone_number_id: string;
    access_token: string;
    business_account_id: string;
    api_version?: string;
  };

  if (!body.business_account_id || !body.access_token) {
    return Response.json(
      { error: "business_account_id and access_token are required" },
      { status: 400 },
    );
  }

  try {
    const adapter = new MetaCloudApiAdapter({
      phone_number_id: body.phone_number_id || "",
      access_token: body.access_token,
      business_account_id: body.business_account_id,
      api_version: body.api_version,
    });

    const templates = await adapter.fetchTemplates();
    return Response.json(templates);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 },
    );
  }
}

import { MetaCloudApiAdapter } from "@/lib/connectors/meta-cloud-api.adapter";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    phone_number_id: string;
    access_token: string;
    api_version?: string;
  };

  if (!body.phone_number_id || !body.access_token) {
    return Response.json(
      { error: "phone_number_id and access_token are required" },
      { status: 400 },
    );
  }

  try {
    const adapter = new MetaCloudApiAdapter({
      phone_number_id: body.phone_number_id,
      access_token: body.access_token,
      api_version: body.api_version,
    });

    const rating = await adapter.getQualityRating();
    return Response.json(rating);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch quality rating" },
      { status: 500 },
    );
  }
}

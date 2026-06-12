export interface ConnectorAdapter {
  send(msg: { phone: string; template_name: string; template_language: string; components?: unknown[] }): Promise<{ message_id: string }>;
  getDeliveryStatus(messageId: string): Promise<{ status: string; timestamp?: string }>;
  getQualityRating(): Promise<{ quality_rating: string; messaging_limit_tier: string }>;
  testConnection(): Promise<{ ok: boolean; phone_number?: string; display_name?: string; error?: string }>;
  fetchTemplates(): Promise<{ data: { name: string; category: string; language: string; status: string; components: unknown[] }[] }>;
  webhookHandler(payload: unknown): { type: string; data: unknown } | null;
}

export class MetaCloudApiAdapter implements ConnectorAdapter {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;
  private baseUrl: string;
  private businessAccountId?: string;

  constructor(config: {
    phone_number_id: string;
    access_token: string;
    api_version?: string;
    business_account_id?: string;
  }) {
    this.phoneNumberId = config.phone_number_id;
    this.accessToken = config.access_token;
    this.apiVersion = config.api_version ?? "v18.0";
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.businessAccountId = config.business_account_id;
  }

  async send(msg: { phone: string; template_name: string; template_language: string; components?: unknown[] }) {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: msg.phone,
      type: "template",
      template: {
        name: msg.template_name,
        language: { code: msg.template_language },
      },
    };

    if (msg.components) {
      (body.template as Record<string, unknown>).components = msg.components;
    }

    const res = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorCode = (err as { error?: { code?: number } })?.error?.code;
      throw new MetaApiError(
        `Meta API error: ${res.status}`,
        errorCode?.toString(),
        res.status,
      );
    }

    const data = await res.json() as { messages: { id: string }[] };
    return { message_id: data.messages[0].id };
  }

  async getDeliveryStatus(messageId: string) {
    const res = await fetch(`${this.baseUrl}/${messageId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to get status for message ${messageId}`);
    }

    const data = await res.json() as { status?: string; timestamp?: string };
    return { status: data.status ?? "unknown", timestamp: data.timestamp };
  }

  async getQualityRating() {
    const res = await fetch(
      `${this.baseUrl}/${this.phoneNumberId}?fields=quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );

    if (!res.ok) {
      throw new Error("Failed to fetch quality rating");
    }

    const data = await res.json() as { quality_rating?: string; messaging_limit_tier?: string };
    return {
      quality_rating: data.quality_rating ?? "UNKNOWN",
      messaging_limit_tier: data.messaging_limit_tier ?? "UNKNOWN",
    };
  }

  async testConnection() {
    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(err)}` };
      }

      const data = await res.json() as { display_phone_number?: string; verified_name?: string };
      return {
        ok: true,
        phone_number: data.display_phone_number,
        display_name: data.verified_name,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async fetchTemplates() {
    const accountId = this.businessAccountId;
    if (!accountId) {
      throw new Error("business_account_id is required to fetch templates");
    }

    const res = await fetch(
      `${this.baseUrl}/${accountId}/message_templates?limit=100`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch templates: HTTP ${res.status}`);
    }

    return await res.json() as { data: { name: string; category: string; language: string; status: string; components: unknown[] }[] };
  }

  webhookHandler(payload: unknown) {
    const body = payload as {
      entry?: {
        changes?: {
          value?: {
            statuses?: { id: string; status: string; timestamp: string; errors?: { code: number; title: string }[] }[];
            messages?: { from: string; id: string; timestamp: string; type: string; text?: { body: string } }[];
          };
        }[];
      }[];
    };

    const changes = body?.entry?.[0]?.changes?.[0]?.value;
    if (!changes) return null;

    if (changes.statuses?.[0]) {
      const s = changes.statuses[0];
      return {
        type: "status_update",
        data: {
          message_id: s.id,
          status: s.status,
          timestamp: s.timestamp,
          error_code: s.errors?.[0]?.code?.toString(),
          error_title: s.errors?.[0]?.title,
        },
      };
    }

    if (changes.messages?.[0]) {
      const m = changes.messages[0];
      return {
        type: "incoming_message",
        data: {
          from: m.from,
          message_id: m.id,
          timestamp: m.timestamp,
          type: m.type,
          body: m.text?.body,
        },
      };
    }

    return null;
  }
}

export class MetaApiError extends Error {
  code?: string;
  httpStatus: number;

  constructor(message: string, code?: string, httpStatus: number = 500) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }

  get isRateLimit() {
    return this.code === "130429";
  }

  get isFrequencyCap() {
    return this.code === "131049";
  }

  get isReEngagementExpired() {
    return this.code === "131047";
  }
}

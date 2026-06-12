import type { ConnectorAdapter } from "./meta-cloud-api.adapter";

const DEFAULT_URLS: Record<string, string> = {
  "360dialog": "https://waba.360dialog.io",
  wati: "https://live-mt-server.wati.io",
  interakt: "https://api.interakt.ai",
};

export class BspAdapter implements ConnectorAdapter {
  private baseUrl: string;
  private apiKey: string;
  private provider: "360dialog" | "wati" | "interakt";

  constructor(config: {
    base_url: string;
    api_key: string;
    provider: "360dialog" | "wati" | "interakt";
  }) {
    this.baseUrl = (config.base_url || DEFAULT_URLS[config.provider] || "").replace(/\/$/, "");
    this.apiKey = config.api_key;
    this.provider = config.provider;
  }

  private get headers(): Record<string, string> {
    if (this.provider === "360dialog") {
      return { "D360-API-KEY": this.apiKey, "Content-Type": "application/json" };
    }
    if (this.provider === "interakt") {
      return { Authorization: `Basic ${this.apiKey}`, "Content-Type": "application/json" };
    }
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  private get sendEndpoint() {
    switch (this.provider) {
      case "360dialog":
        return `${this.baseUrl}/v1/messages`;
      case "wati":
        return `${this.baseUrl}/api/v1/sendTemplateMessage`;
      case "interakt":
        return `${this.baseUrl}/v1/public/message/`;
      default:
        return `${this.baseUrl}/messages`;
    }
  }

  async send(msg: { phone: string; template_name: string; template_language: string; components?: unknown[] }) {
    const body = this.buildSendBody(msg);
    const res = await fetch(this.sendEndpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${this.provider} send error: ${res.status} - ${JSON.stringify(err)}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const messageId = (data.messages as { id: string }[])?.[0]?.id
      ?? (data as { messageId?: string }).messageId
      ?? (data as { id?: string }).id
      ?? "unknown";

    return { message_id: String(messageId) };
  }

  private buildSendBody(msg: { phone: string; template_name: string; template_language: string; components?: unknown[] }) {
    if (this.provider === "360dialog") {
      return {
        messaging_product: "whatsapp",
        to: msg.phone,
        type: "template",
        template: {
          name: msg.template_name,
          language: { code: msg.template_language },
          components: msg.components ?? [],
        },
      };
    }

    if (this.provider === "wati") {
      return {
        whatsappNumber: msg.phone,
        template_name: msg.template_name,
        broadcast_name: `api_send_${Date.now()}`,
      };
    }

    // interakt
    return {
      countryCode: msg.phone.slice(0, 3),
      phoneNumber: msg.phone.slice(3),
      type: "Template",
      template: {
        name: msg.template_name,
        languageCode: msg.template_language,
      },
    };
  }

  async getDeliveryStatus(_messageId: string) {
    return { status: "sent", timestamp: new Date().toISOString() };
  }

  async getQualityRating() {
    return { quality_rating: "UNKNOWN", messaging_limit_tier: "UNKNOWN" };
  }

  async testConnection() {
    try {
      let url: string;
      let options: RequestInit = { headers: this.headers };

      switch (this.provider) {
        case "360dialog":
          // 360dialog: check webhook config endpoint
          url = `${this.baseUrl}/v1/configs/webhook`;
          break;
        case "wati":
          // Wati: check template list as health check
          url = `${this.baseUrl}/api/v1/getMessageTemplates?pageSize=1`;
          break;
        case "interakt":
          // Interakt: use track/events as a lightweight check
          url = `${this.baseUrl}/v1/public/track/events/`;
          options = { method: "POST", headers: this.headers, body: JSON.stringify({ event: "ping" }) };
          break;
        default:
          url = `${this.baseUrl}/health`;
      }

      const res = await fetch(url, options);
      // 200, 201, 204 all count as success. 401/403 = bad key. Others = might still work.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Invalid API key (401/403)" };
      }
      return { ok: true, display_name: `${this.provider} connected` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async fetchTemplates() {
    let url: string;
    if (this.provider === "360dialog") {
      url = `${this.baseUrl}/v1/configs/templates`;
    } else if (this.provider === "wati") {
      url = `${this.baseUrl}/api/v1/getMessageTemplates`;
    } else {
      return { data: [] };
    }

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch templates: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (this.provider === "360dialog") {
      return { data: (data as { waba_templates: unknown[] }).waba_templates ?? data } as {
        data: { name: string; category: string; language: string; status: string; components: unknown[] }[];
      };
    }

    return { data: Array.isArray(data) ? data : (data as { result: unknown[] }).result ?? [] } as {
      data: { name: string; category: string; language: string; status: string; components: unknown[] }[];
    };
  }

  webhookHandler(payload: unknown) {
    const body = payload as Record<string, unknown>;
    if (body.statuses) {
      const statuses = body.statuses as { id: string; status: string; timestamp: string }[];
      if (statuses[0]) {
        return {
          type: "status_update",
          data: { message_id: statuses[0].id, status: statuses[0].status, timestamp: statuses[0].timestamp },
        };
      }
    }
    if (body.messages) {
      const messages = body.messages as { from: string; id: string; type: string; text?: { body: string } }[];
      if (messages[0]) {
        return {
          type: "incoming_message",
          data: { from: messages[0].from, message_id: messages[0].id, type: messages[0].type, body: messages[0].text?.body },
        };
      }
    }
    return null;
  }
}

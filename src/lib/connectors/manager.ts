import { MetaCloudApiAdapter, MetaApiError } from "./meta-cloud-api.adapter";
import { BspAdapter } from "./bsp.adapter";
import type { ConnectorAdapter } from "./meta-cloud-api.adapter";

export type ConnectorConfig = {
  id: string;
  name: string;
  type: "meta_cloud_api" | "360dialog" | "wati" | "interakt";
  is_fallback: boolean;
  config: Record<string, string>;
};

export class ConnectorManager {
  private primary: { adapter: ConnectorAdapter; config: ConnectorConfig } | null = null;
  private fallbacks: { adapter: ConnectorAdapter; config: ConnectorConfig }[] = [];

  register(connectorConfig: ConnectorConfig) {
    const adapter = this.createAdapter(connectorConfig);
    const entry = { adapter, config: connectorConfig };

    if (connectorConfig.is_fallback) {
      this.fallbacks.push(entry);
    } else {
      this.primary = entry;
    }
  }

  private createAdapter(config: ConnectorConfig): ConnectorAdapter {
    switch (config.type) {
      case "meta_cloud_api":
        return new MetaCloudApiAdapter({
          phone_number_id: config.config.phone_number_id,
          access_token: config.config.access_token,
          api_version: config.config.api_version,
          business_account_id: config.config.business_account_id,
        });

      case "360dialog":
      case "wati":
      case "interakt":
        return new BspAdapter({
          base_url: config.config.base_url,
          api_key: config.config.api_key,
          provider: config.type,
        });

      default:
        throw new Error(`Unknown connector type: ${config.type}`);
    }
  }

  async send(msg: { phone: string; template_name: string; template_language: string; components?: unknown[] }) {
    if (!this.primary) {
      throw new Error("No primary connector configured");
    }

    try {
      return await this.primary.adapter.send(msg);
    } catch (err) {
      if (err instanceof MetaApiError && err.isRateLimit && this.fallbacks.length > 0) {
        for (const fb of this.fallbacks) {
          try {
            const result = await fb.adapter.send(msg);
            return { ...result, fallback_used: fb.config.name };
          } catch {
            continue;
          }
        }
      }
      throw err;
    }
  }

  async testAll() {
    const results: { name: string; ok: boolean; error?: string; phone_number?: string; display_name?: string }[] = [];

    if (this.primary) {
      const res = await this.primary.adapter.testConnection();
      results.push({ name: this.primary.config.name, ...res });
    }

    for (const fb of this.fallbacks) {
      const res = await fb.adapter.testConnection();
      results.push({ name: fb.config.name, ...res });
    }

    return results;
  }

  async getQualityRating() {
    if (!this.primary) return null;
    return await this.primary.adapter.getQualityRating();
  }

  async fetchTemplates() {
    if (!this.primary) return { data: [] };
    return await this.primary.adapter.fetchTemplates();
  }
}

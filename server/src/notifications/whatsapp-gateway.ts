/**
 * MetaWhatsAppGateway — the real WhatsApp order-confirmation adapter.
 *
 * This adapter implements the same `NotificationGateway` interface as
 * MockNotificationGateway so the checkout flow is agnostic to which
 * implementation is wired in. It sends an order-confirmation message via the
 * Meta WhatsApp Cloud API (Graph API):
 *
 *   POST https://graph.facebook.com/<version>/<PHONE_NUMBER_ID>/messages
 *   Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>
 *   { messaging_product: "whatsapp", to, type: "text", text: { body } }
 *
 * Configuration (phone number id, access token, api version) is supplied either
 * explicitly via the constructor or resolved from environment variables via
 * `MetaWhatsAppGateway.fromEnv()`.
 *
 * The single network boundary — `postMessage` — is clearly marked and
 * overridable (mirroring PaytmGateway's `postTransactionRequest`) so the
 * request-construction and result-mapping code can be tested without live calls.
 */

import type {
  NotificationGateway,
  NotificationResult,
  OrderConfirmationParams,
} from "../../../types/index.js";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  /** Graph API version, e.g. "v21.0". */
  apiVersion?: string;
}

/** The message body POSTed to the WhatsApp Cloud API messages endpoint. */
export interface WhatsAppMessageRequest {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

/** The raw response shape returned by the WhatsApp Cloud API messages endpoint. */
export interface WhatsAppMessageResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string };
}

const DEFAULT_API_VERSION = "v21.0";

export class MetaWhatsAppGateway implements NotificationGateway {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;

  constructor(config: WhatsAppConfig) {
    if (!config.phoneNumberId || !config.accessToken) {
      throw new Error(
        "MetaWhatsAppGateway requires both phoneNumberId and accessToken to be configured."
      );
    }
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
  }

  /**
   * Build a MetaWhatsAppGateway from environment variables. Throws when the
   * required phone number id / access token are absent.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): MetaWhatsAppGateway {
    return new MetaWhatsAppGateway({
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      accessToken: env.WHATSAPP_ACCESS_TOKEN ?? "",
      apiVersion: env.WHATSAPP_API_VERSION,
    });
  }

  /** The Graph API messages endpoint for the configured phone number. */
  get endpoint(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Send an order-confirmation WhatsApp message for the given order. Builds the
   * message body, posts it to the Graph API, and maps the response onto the
   * shared `NotificationResult` shape. A failure is reported (never thrown) so
   * callers can treat a notification failure as non-fatal.
   */
  async sendOrderConfirmation(
    params: OrderConfirmationParams
  ): Promise<NotificationResult> {
    const request = this.buildMessageRequest(params);
    try {
      const response = await this.postMessage(request);
      return this.mapResponse(response);
    } catch (error) {
      return {
        sent: false,
        error:
          error instanceof Error
            ? error.message
            : "WhatsApp message request failed",
      };
    }
  }

  /** Compose the human-readable confirmation text for an order. */
  buildMessageBody(params: OrderConfirmationParams): string {
    const lines = params.items.map(
      (it) => `• ${it.quantity} x ${it.name}`
    );
    const stall = params.stallName ? ` from ${params.stallName}` : "";
    return [
      `Your ByteBites order${stall} is confirmed!`,
      `Token: ${params.token}`,
      ...lines,
      `Total: ₹${params.total}`,
      `Show your token at the stall to collect your order.`,
    ].join("\n");
  }

  /** Construct the WhatsApp Cloud API message request body. */
  buildMessageRequest(
    params: OrderConfirmationParams
  ): WhatsAppMessageRequest {
    return {
      messaging_product: "whatsapp",
      to: params.toMobile,
      type: "text",
      text: { body: this.buildMessageBody(params) },
    };
  }

  /** Map a raw WhatsApp response onto the shared NotificationResult shape. */
  private mapResponse(
    response: WhatsAppMessageResponse
  ): NotificationResult {
    const id = response.messages?.[0]?.id;
    if (id) {
      return { sent: true, ref: id };
    }
    return {
      sent: false,
      error: response.error?.message ?? "WhatsApp reported no message id",
    };
  }

  /**
   * NETWORK BOUNDARY (stubbed).
   *
   * In a fully credentialed deployment this method performs the HTTPS POST to
   * `this.endpoint` with a Bearer `accessToken` and returns the parsed JSON.
   * Because valid WhatsApp Cloud API credentials and network access are not
   * available in this repository, the real call is left to production; this
   * default performs the fetch and is the single seam a test can override to
   * simulate a response without a live call.
   */
  protected async postMessage(
    request: WhatsAppMessageRequest
  ): Promise<WhatsAppMessageResponse> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const json = (await res.json()) as WhatsAppMessageResponse;
    if (!res.ok) {
      throw new Error(
        json.error?.message ?? `WhatsApp request failed with status ${res.status}`
      );
    }
    return json;
  }
}

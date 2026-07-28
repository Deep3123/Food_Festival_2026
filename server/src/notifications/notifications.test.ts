/**
 * Tests for the notification gateways and their wiring into checkout.
 *
 *   - MockNotificationGateway records sends and returns a deterministic ref.
 *   - A successful checkout sends exactly one order confirmation to the
 *     customer's mobile, and a notification failure does NOT fail the order.
 *   - MetaWhatsAppGateway builds a correct WhatsApp Cloud API request and maps
 *     the response, with its single network boundary overridden (no live call).
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { Store } from "../store.js";
import { MockGateway } from "../gateways/mock-gateway.js";
import { MockNotificationGateway } from "./mock-notification-gateway.js";
import { MetaWhatsAppGateway } from "./whatsapp-gateway.js";
import type {
  WhatsAppMessageRequest,
  WhatsAppMessageResponse,
} from "./whatsapp-gateway.js";
import type {
  NotificationResult,
  OrderConfirmationParams,
  Stall,
} from "../../../types/index.js";

const STALL: Stall = { id: "stall-n", name: "Notify Stall", qrSlug: "n" };
const CART = [{ itemId: "i1", name: "Item", unitPrice: 100, quantity: 2 }];

describe("MockNotificationGateway", () => {
  it("records the send and returns a deterministic MOCK ref", async () => {
    const gw = new MockNotificationGateway();
    const params: OrderConfirmationParams = {
      toMobile: "9876543210",
      token: "T-1",
      total: 200,
      items: CART,
      stallName: STALL.name,
    };
    const result = await gw.sendOrderConfirmation(params);
    expect(result.sent).toBe(true);
    expect(result.ref).toMatch(/^MOCK-\d{6}$/);
    expect(gw.sent).toHaveLength(1);
    expect(gw.sent[0]).toEqual(params);
  });
});

describe("checkout sends an order confirmation", () => {
  it("sends exactly one confirmation to the customer's mobile on success", async () => {
    const store = new Store({ stalls: [STALL], foodItems: [] });
    const notificationGateway = new MockNotificationGateway();
    const app = createApp({
      store,
      paymentGateway: new MockGateway({ mode: "success" }),
      notificationGateway,
    });

    const res = await request(app)
      .post("/api/checkout")
      .send({ stallId: STALL.id, customerId: "9876543210", items: CART });

    expect(res.status).toBe(201);
    expect(res.body.notified).toBe(true);
    expect(notificationGateway.sent).toHaveLength(1);
    const sent = notificationGateway.sent[0];
    expect(sent.toMobile).toBe("9876543210");
    expect(sent.token).toBe(res.body.token);
    expect(sent.total).toBe(res.body.total);
    expect(sent.stallName).toBe(STALL.name);
  });

  it("does NOT send a confirmation on a failed payment", async () => {
    const store = new Store({ stalls: [STALL], foodItems: [] });
    const notificationGateway = new MockNotificationGateway();
    const app = createApp({
      store,
      paymentGateway: new MockGateway({ mode: "failure" }),
      notificationGateway,
    });

    const res = await request(app)
      .post("/api/checkout")
      .send({ stallId: STALL.id, customerId: "9876543210", items: CART });

    expect(res.status).toBe(402);
    expect(notificationGateway.sent).toHaveLength(0);
  });

  it("a notification failure does NOT fail the order", async () => {
    // A gateway whose send rejects/returns not-sent must not break checkout.
    const failing: {
      sendOrderConfirmation: (
        p: OrderConfirmationParams
      ) => Promise<NotificationResult>;
    } = {
      async sendOrderConfirmation() {
        throw new Error("whatsapp down");
      },
    };
    const store = new Store({ stalls: [STALL], foodItems: [] });
    const app = createApp({
      store,
      paymentGateway: new MockGateway({ mode: "success" }),
      notificationGateway: failing,
    });

    const res = await request(app)
      .post("/api/checkout")
      .send({ stallId: STALL.id, customerId: "9876543210", items: CART });

    // Order still succeeds; the confirmation is flagged as not sent.
    expect(res.status).toBe(201);
    expect(res.body.notified).toBe(false);
    expect(store.getOrder(res.body.token as string)).toBeDefined();
  });
});

/**
 * A test double over the real WhatsApp adapter that overrides ONLY the network
 * boundary. Every other part (config validation, message-body/request
 * construction, result mapping) is the real production code. The override
 * captures each request and returns a simulated Cloud API success response.
 */
class CapturingWhatsAppGateway extends MetaWhatsAppGateway {
  readonly sentRequests: WhatsAppMessageRequest[] = [];

  protected override async postMessage(
    request: WhatsAppMessageRequest
  ): Promise<WhatsAppMessageResponse> {
    this.sentRequests.push(request);
    return { messages: [{ id: "wamid.TEST123" }] };
  }
}

describe("MetaWhatsAppGateway request construction and mapping", () => {
  it("builds a WhatsApp text message for the order and maps the message id", async () => {
    const gw = new CapturingWhatsAppGateway({
      phoneNumberId: "123456",
      accessToken: "test-token",
    });

    const result = await gw.sendOrderConfirmation({
      toMobile: "919876543210",
      token: "T-42",
      total: 200,
      items: CART,
      stallName: STALL.name,
    });

    expect(gw.sentRequests).toHaveLength(1);
    const sent = gw.sentRequests[0];
    expect(sent.messaging_product).toBe("whatsapp");
    expect(sent.to).toBe("919876543210");
    expect(sent.type).toBe("text");
    expect(sent.text.body).toContain("T-42");
    expect(sent.text.body).toContain(STALL.name);

    expect(result.sent).toBe(true);
    expect(result.ref).toBe("wamid.TEST123");
  });

  it("exposes the correct Graph API endpoint for the configured version", () => {
    const gw = new MetaWhatsAppGateway({
      phoneNumberId: "999",
      accessToken: "t",
      apiVersion: "v21.0",
    });
    expect(gw.endpoint).toBe(
      "https://graph.facebook.com/v21.0/999/messages"
    );
  });

  it("requires phoneNumberId and accessToken", () => {
    expect(() => new MetaWhatsAppGateway({ phoneNumberId: "", accessToken: "t" })).toThrow();
    expect(() => new MetaWhatsAppGateway({ phoneNumberId: "1", accessToken: "" })).toThrow();
  });

  it("reports a failure result when the API returns no message id", async () => {
    class NoIdGateway extends MetaWhatsAppGateway {
      protected override async postMessage(): Promise<WhatsAppMessageResponse> {
        return { error: { message: "invalid recipient" } };
      }
    }
    const gw = new NoIdGateway({ phoneNumberId: "1", accessToken: "t" });
    const result = await gw.sendOrderConfirmation({
      toMobile: "919876543210",
      token: "T-1",
      total: 100,
      items: CART,
    });
    expect(result.sent).toBe(false);
    expect(result.error).toBe("invalid recipient");
  });
});

/**
 * Property-based tests for the checkout, order-tracking, and advance API
 * endpoints (`POST /api/checkout`, `GET /api/orders/:token`,
 * `POST /api/orders/:token/advance`).
 *
 * Each property is exercised over HTTP with supertest against an app built via
 * `createApp` around a seeded `Store` and a deterministic `MockGateway`, using
 * the shared cart generators. Carts drive checkout in the context of a stall
 * that is seeded into the store so the flow uses a valid originating stall.
 *
 * Covers design Properties 8, 9, 11, 12, and 14.
 *
 * Validates: Requirements 4.2, 5.1, 5.3, 5.4, 6.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { MockGateway } from "./gateways/mock-gateway.js";
import { nonEmptyCartArb, cartArb } from "../../types/generators.js";
import { orderTotal } from "../../domain/pricing.js";
import { nextStatus } from "../../domain/order-status.js";
import type { CartItem, OrderStatus, Stall } from "../../types/index.js";

/** A URL-safe, non-empty stall id (avoids HTTP path-normalization artifacts). */
const safeIdArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")),
    { minLength: 1, maxLength: 12 }
  )
  .map((chars) => chars.join(""));

/**
 * Build a test app whose store is seeded with a single stall matching
 * `stallId`, so checkout runs in the context of a valid originating stall.
 */
function buildApp(stallId: string, mode: "success" | "failure") {
  const stall: Stall = { id: stallId, name: "Test Stall", qrSlug: stallId };
  const store = new Store({ stalls: [stall], foodItems: [] });
  const paymentGateway = new MockGateway({ mode });
  return { app: createApp({ store, paymentGateway }), store, paymentGateway };
}

// Feature: bytebites, Property 9: Payment amount equals the recomputed order total
describe("Property 9: Payment amount equals the recomputed order total", () => {
  it("initiates a payment whose amount equals the server-recomputed order total", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeIdArb,
        safeIdArb,
        nonEmptyCartArb,
        async (stallId, customerId, items) => {
          const { app, paymentGateway } = buildApp(stallId, "success");

          const res = await request(app)
            .post("/api/checkout")
            .send({ stallId, customerId, items });

          expect(res.status).toBe(201);
          // The gateway was called exactly once with the recomputed total.
          expect(paymentGateway.calls).toHaveLength(1);
          expect(paymentGateway.calls[0].amountInRupees).toBe(
            orderTotal(items)
          );
          // The response echoes that same server-recomputed total.
          expect(res.body.total).toBe(orderTotal(items));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: bytebites, Property 8: Orders are associated with their originating stall
describe("Property 8: Orders are associated with their originating stall", () => {
  it("creates an order whose stallId equals the checkout stall", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeIdArb,
        safeIdArb,
        nonEmptyCartArb,
        async (stallId, customerId, items) => {
          const { app, store } = buildApp(stallId, "success");

          const res = await request(app)
            .post("/api/checkout")
            .send({ stallId, customerId, items });

          expect(res.status).toBe(201);
          const token = res.body.token as string;
          const stored = store.getOrder(token);
          expect(stored).toBeDefined();
          expect(stored?.stallId).toBe(stallId);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: bytebites, Property 11: Failed payment creates no order and retains the cart
describe("Property 11: Failed payment creates no order and retains the cart", () => {
  it("creates no order and reports failure when the gateway fails", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeIdArb,
        safeIdArb,
        cartArb,
        async (stallId, customerId, items) => {
          const { app, store } = buildApp(stallId, "failure");

          const res = await request(app)
            .post("/api/checkout")
            .send({ stallId, customerId, items });

          // An empty cart is rejected before the gateway (400); a non-empty
          // cart reaches the gateway and fails (402). Either way, the failure
          // path must persist no order.
          if (items.length === 0) {
            expect(res.status).toBe(400);
            expect(res.body.code).toBe("EMPTY_CART");
          } else {
            expect(res.status).toBe(402);
            expect(res.body.code).toBe("PAYMENT_FAILED");
          }
          expect(store.getOrders()).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: bytebites, Property 12: New orders start in "Craving Funded"
describe('Property 12: New orders start in "Craving Funded"', () => {
  it("sets the initial status of a paid order to Craving Funded", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeIdArb,
        safeIdArb,
        nonEmptyCartArb,
        async (stallId, customerId, items) => {
          const { app, store } = buildApp(stallId, "success");

          const res = await request(app)
            .post("/api/checkout")
            .send({ stallId, customerId, items });

          expect(res.status).toBe(201);
          expect(res.body.status).toBe("Craving Funded");
          const stored = store.getOrder(res.body.token as string);
          expect(stored?.status).toBe("Craving Funded");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: bytebites, Property 14: Displayed status matches stored status
describe("Property 14: Displayed status matches stored status", () => {
  it("returns the stored status when viewing the token, after any sequence of advances", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeIdArb,
        safeIdArb,
        nonEmptyCartArb,
        fc.nat({ max: 5 }),
        async (stallId, customerId, items, advanceCount) => {
          const { app, store } = buildApp(stallId, "success");

          const checkout = await request(app)
            .post("/api/checkout")
            .send({ stallId, customerId, items });
          expect(checkout.status).toBe(201);
          const token = checkout.body.token as string;

          // Apply a sequence of advances, tracking the expected status locally
          // via the same domain transition the server uses.
          let expected: OrderStatus = "Craving Funded";
          for (let i = 0; i < advanceCount; i += 1) {
            const adv = await request(app).post(
              `/api/orders/${token}/advance`
            );
            expect(adv.status).toBe(200);
            expected = nextStatus(expected);
          }

          // The displayed status (GET) equals the current stored status.
          const view = await request(app).get(`/api/orders/${token}`);
          expect(view.status).toBe(200);
          expect(view.body.status).toBe(expected);
          expect(view.body.status).toBe(store.getOrder(token)?.status);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// A concrete unit test complements the properties: unknown token → 404.
describe("GET /api/orders/:token — unknown token", () => {
  it("returns 404 with { error, code } for an unknown token", async () => {
    const store = new Store({ stalls: [], foodItems: [] });
    const app = createApp({ store, paymentGateway: new MockGateway() });

    const res = await request(app).get("/api/orders/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "Order not found",
      code: "ORDER_NOT_FOUND",
    });
  });

  it("advancing at Happiness Disbursed is a no-op", async () => {
    const stallId = "stall-x";
    const store = new Store({
      stalls: [{ id: stallId, name: "X", qrSlug: "x" }],
      foodItems: [],
    });
    const app = createApp({ store, paymentGateway: new MockGateway() });
    const items: CartItem[] = [
      { itemId: "i1", name: "Item", unitPrice: 100, quantity: 1 },
    ];

    const checkout = await request(app)
      .post("/api/checkout")
      .send({ stallId, customerId: "c1", items });
    const token = checkout.body.token as string;

    // Advance to the terminal state and then once more.
    await request(app).post(`/api/orders/${token}/advance`); // Flavor Processing
    await request(app).post(`/api/orders/${token}/advance`); // Taste Ready for Pickup
    await request(app).post(`/api/orders/${token}/advance`); // Happiness Disbursed
    const terminal = await request(app).post(`/api/orders/${token}/advance`);

    expect(terminal.status).toBe(200);
    expect(terminal.body.status).toBe("Happiness Disbursed");
  });
});

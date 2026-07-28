/**
 * Property-based and unit tests for the Spin & Win API endpoint
 * (`POST /api/orders/:token/spin`).
 *
 * Tests build an app via `createApp` around a seeded `Store` and a
 * deterministic `MockGateway`, injecting a controlled `rng` so each spin draws
 * a chosen reward. Orders are placed through the real checkout flow (or seeded
 * directly for unpaid cases) so the spin endpoint operates on genuine store
 * state.
 *
 * Covers design Properties 28 and 29.
 *
 * Validates: Requirements 13.1, 13.3, 13.4
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { MockGateway } from "./gateways/mock-gateway.js";
import { SPIN_REWARDS } from "../../types/index.js";
import type { CartItem, Order, SpinReward } from "../../types/index.js";

const safeIdArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")),
    { minLength: 1, maxLength: 12 }
  )
  .map((chars) => chars.join(""));

/** An rng that always returns a value mapping to the reward at `index`. */
function rngForRewardIndex(index: number): () => number {
  // spin() computes floor(r * SPIN_REWARDS.length); pick the bucket midpoint.
  const value = (index + 0.5) / SPIN_REWARDS.length;
  return () => value;
}

/** Place a paid order through checkout and return its token + store. */
async function placePaidOrder(opts: {
  rewardIndex: number;
  customerId: string;
  items: CartItem[];
  initialCoins?: number;
}) {
  const stallId = "stall-x";
  const store = new Store({
    stalls: [{ id: stallId, name: "X", qrSlug: "x" }],
    foodItems: [],
  });
  if (opts.initialCoins !== undefined) {
    store.saveWallet({ customerId: opts.customerId, foodCoins: opts.initialCoins });
  }
  const app = createApp({
    store,
    paymentGateway: new MockGateway({ mode: "success" }),
    rng: rngForRewardIndex(opts.rewardIndex),
  });
  const checkout = await request(app)
    .post("/api/checkout")
    .send({ stallId, customerId: opts.customerId, items: opts.items });
  expect(checkout.status).toBe(201);
  return { app, store, token: checkout.body.token as string };
}

const rewardIndexArb = fc.integer({ min: 0, max: SPIN_REWARDS.length - 1 });
const itemsArb: fc.Arbitrary<CartItem[]> = fc.array(
  fc.record<CartItem>({
    itemId: safeIdArb,
    name: fc.string({ minLength: 1, maxLength: 10 }),
    unitPrice: fc.integer({ min: 10, max: 5000 }).map((p) => p),
    quantity: fc.integer({ min: 1, max: 10 }),
  }),
  { minLength: 1, maxLength: 6 }
);

// Feature: bytebites, Property 28: Awarded spin rewards are applied to the account
describe("Property 28: Awarded spin rewards are applied to the account", () => {
  it("applies the drawn reward's effect to the account exactly once and marks spin used", async () => {
    await fc.assert(
      fc.asyncProperty(
        rewardIndexArb,
        safeIdArb,
        itemsArb,
        fc.integer({ min: 0, max: 1000 }),
        async (rewardIndex, customerId, items, initialCoins) => {
          const { app, store, token } = await placePaidOrder({
            rewardIndex,
            customerId,
            items,
            initialCoins,
          });

          const expectedReward: SpinReward = SPIN_REWARDS[rewardIndex];
          const coinsBeforeSpin = store.getWallet(customerId).foodCoins;

          const res = await request(app).post(`/api/orders/${token}/spin`);
          expect(res.status).toBe(200);
          expect(res.body.reward).toBe(expectedReward);
          expect(res.body.spinUsed).toBe(true);

          // The order records the reward and marks the single spin used.
          const order = store.getOrder(token) as Order;
          expect(order.spinUsed).toBe(true);
          expect(order.spinReward).toBe(expectedReward);

          // The effect is applied exactly once: "double FoodCoins" doubles the
          // balance; other rewards leave the balance unchanged.
          const coinsAfter = store.getWallet(customerId).foodCoins;
          if (expectedReward === "double FoodCoins") {
            expect(coinsAfter).toBe(coinsBeforeSpin * 2);
          } else {
            expect(coinsAfter).toBe(coinsBeforeSpin);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: bytebites, Property 29: Exactly one spin per paid order
describe("Property 29: Exactly one spin per paid order", () => {
  it("allows the first spin only on paid orders and rejects any further attempt; unpaid orders cannot spin", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        rewardIndexArb,
        safeIdArb,
        itemsArb,
        fc.integer({ min: 1, max: 4 }),
        async (paid, rewardIndex, customerId, items, extraAttempts) => {
          if (!paid) {
            // Seed an unpaid order directly: it cannot spin.
            const store = new Store({ stalls: [], foodItems: [] });
            const order: Order = {
              token: "unpaid-token",
              stallId: "s",
              items,
              total: items.reduce(
                (sum, it) => sum + it.unitPrice * it.quantity,
                0
              ),
              status: "Order Received",
              paid: false,
              paymentMethod: "other",
              customerId,
              createdAt: new Date().toISOString(),
              spinUsed: false,
            };
            store.saveOrder(order);
            const app = createApp({
              store,
              paymentGateway: new MockGateway(),
              rng: rngForRewardIndex(rewardIndex),
            });

            const res = await request(app).post(
              `/api/orders/${order.token}/spin`
            );
            expect(res.status).toBe(403);
            expect(res.body.code).toBe("ORDER_NOT_PAID");
            expect(store.getOrder(order.token)?.spinUsed).toBe(false);
            return;
          }

          // Paid order: the first spin succeeds; all further attempts fail.
          const { app, store, token } = await placePaidOrder({
            rewardIndex,
            customerId,
            items,
          });

          const first = await request(app).post(`/api/orders/${token}/spin`);
          expect(first.status).toBe(200);
          expect(store.getOrder(token)?.spinUsed).toBe(true);

          for (let i = 0; i < extraAttempts; i += 1) {
            const again = await request(app).post(
              `/api/orders/${token}/spin`
            );
            expect(again.status).toBe(409);
            expect(again.body.code).toBe("SPIN_ALREADY_USED");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

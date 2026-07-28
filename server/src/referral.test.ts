/**
 * Property-based and unit tests for the referral API endpoints
 * (`GET /api/referral/:customerId`, `POST /api/referral/claim`).
 *
 * Each property is exercised over HTTP with supertest against an app built via
 * `createApp` around a seeded `Store` and a deterministic `MockGateway`, using
 * the shared referral generators.
 *
 * Covers design Properties 24 and 25.
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { MockGateway } from "./gateways/mock-gateway.js";
import { referralScenarioArb } from "../../types/generators.js";

/** A URL-safe, non-empty id (avoids HTTP path-normalization artifacts). */
const safeIdArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")),
    { minLength: 1, maxLength: 12 }
  )
  .map((chars) => chars.join(""));

/** A set of distinct URL-safe customer ids. */
const distinctCustomersArb: fc.Arbitrary<string[]> = fc
  .array(safeIdArb, { minLength: 1, maxLength: 20 })
  .map((ids) => Array.from(new Set(ids)));

function buildApp() {
  const store = new Store({ stalls: [], foodItems: [] });
  const app = createApp({ store, paymentGateway: new MockGateway() });
  return { app, store };
}

// Feature: bytebites, Property 24: Referral links are unique per customer
describe("Property 24: Referral links are unique per customer", () => {
  it("returns a non-empty link for each customer with no link shared by two customers", async () => {
    await fc.assert(
      fc.asyncProperty(distinctCustomersArb, async (customerIds) => {
        const { app } = buildApp();

        const links: string[] = [];
        for (const customerId of customerIds) {
          const res = await request(app).get(
            `/api/referral/${customerId}`
          );
          expect(res.status).toBe(200);
          const link = res.body.link as string;
          // Each generated referral link is non-empty.
          expect(typeof link).toBe("string");
          expect(link.length).toBeGreaterThan(0);
          links.push(link);
        }

        // No link is shared by two distinct customers.
        expect(new Set(links).size).toBe(customerIds.length);
      }),
      { numRuns: 100 }
    );
  }, 30000);
});

// Feature: bytebites, Property 25: Referral crediting awards 10 coins exactly once per referred customer
describe("Property 25: Referral crediting awards 10 coins exactly once per referred customer", () => {
  it("credits the referrer 10 coins for each referred customer's first claim and nothing on repeats", async () => {
    await fc.assert(
      fc.asyncProperty(
        referralScenarioArb.filter((s) => s.referrer.trim().length > 0),
        async ({ referrer, referredIds }) => {
          const { app, store } = buildApp();

          const uniqueReferred = new Set<string>();
          for (const referredId of referredIds) {
            if (referredId.trim().length === 0) continue;

            const before = store.getWallet(referrer).foodCoins;
            const res = await request(app)
              .post("/api/referral/claim")
              .send({ referrerId: referrer, referredId });
            expect(res.status).toBe(200);
            const after = store.getWallet(referrer).foodCoins;

            if (uniqueReferred.has(referredId)) {
              // A repeat claim for the same referred customer credits nothing.
              expect(res.body.credited).toBe(0);
              expect(res.body.alreadyCredited).toBe(true);
              expect(after).toBe(before);
            } else {
              // The first claim credits exactly 10 FoodCoins.
              expect(res.body.credited).toBe(10);
              expect(res.body.alreadyCredited).toBe(false);
              expect(after).toBe(before + 10);
              uniqueReferred.add(referredId);
            }
          }

          // Total credited equals 10 per distinct referred customer.
          expect(store.getWallet(referrer).foodCoins).toBe(
            uniqueReferred.size * 10
          );
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

// A concrete unit test complements the properties.
describe("GET /api/referral/:customerId — persistence", () => {
  it("returns the same link on repeated access and persists the record", async () => {
    const { app, store } = buildApp();

    const first = await request(app).get("/api/referral/cust-1");
    const second = await request(app).get("/api/referral/cust-1");

    expect(first.status).toBe(200);
    expect(second.body.link).toBe(first.body.link);
    expect(store.getReferral("cust-1")).toBeDefined();
  });
});

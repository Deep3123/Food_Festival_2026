import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeMetrics } from "./metrics.js";
import { orderArb, orderSetArb, ratingsArb } from "../types/generators.js";
import type { Order } from "../types/index.js";

/**
 * Property tests for the startup metrics domain module.
 *
 * Scope note (mirrors metrics.ts): revenue is computed over orders that are
 * BOTH paid AND dated today, whereas digital payment percentage is computed
 * over ALL paid orders regardless of day (per Property 16's "for any set of
 * paid orders" wording). The tests below assert each scope independently.
 */

const NUM_RUNS = 200;

/** True when an ISO timestamp falls on the current local day. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

describe("metrics domain", () => {
  // Feature: bytebites, Property 15: Revenue equals the sum of today's paid order totals
  it("Property 15: revenue equals the sum of totals of orders that are paid and dated today", () => {
    // Orders spanning multiple dates and paid/unpaid states.
    const ordersArb = orderSetArb();

    fc.assert(
      fc.property(ordersArb, ratingsArb, (orders: Order[], ratings) => {
        const metrics = computeMetrics(orders, ratings);

        const expectedRevenue = orders
          .filter((o) => o.paid && isToday(o.createdAt))
          .reduce((sum, o) => sum + o.total, 0);

        expect(metrics.revenueGenerated).toBeCloseTo(expectedRevenue, 6);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 16: Digital payment percentage is the gateway-paid ratio
  it("Property 16: digital payment percentage equals gateway-paid / total paid * 100, and 0 when no paid orders", () => {
    // A set of paid orders (spanning dates); mix in some unpaid to be robust,
    // but assert against the paid subset.
    const ordersArb = orderSetArb();

    fc.assert(
      fc.property(ordersArb, ratingsArb, (orders: Order[], ratings) => {
        const metrics = computeMetrics(orders, ratings);

        const paid = orders.filter((o) => o.paid);
        if (paid.length === 0) {
          expect(metrics.digitalPaymentPercentage).toBe(0);
        } else {
          const gatewayPaid = paid.filter(
            (o) => o.paymentMethod === "UPI"
          ).length;
          const expected = (gatewayPaid / paid.length) * 100;
          expect(metrics.digitalPaymentPercentage).toBeCloseTo(expected, 6);
        }

        // Percentage is always within 0..100.
        expect(metrics.digitalPaymentPercentage).toBeGreaterThanOrEqual(0);
        expect(metrics.digitalPaymentPercentage).toBeLessThanOrEqual(100);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Explicit no-paid-orders case: percentage must be 0.
  it("Property 16 (boundary): digital payment percentage is 0 when there are no paid orders", () => {
    fc.assert(
      fc.property(
        fc.array(orderArb({ paid: false }), { minLength: 0, maxLength: 15 }),
        ratingsArb,
        (orders: Order[], ratings) => {
          const metrics = computeMetrics(orders, ratings);
          expect(metrics.digitalPaymentPercentage).toBe(0);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 17: Customer satisfaction score stays within 0..5
  it("Property 17: computed satisfaction score is within the inclusive range 0..5 for any ratings", () => {
    // Use unconstrained rating inputs (including out-of-range values) to prove
    // the score is always clamped into 0..5.
    const anyRatingsArb = fc.array(
      fc.oneof(
        ratingsArb.chain(() => fc.float({ min: 0, max: 5, noNaN: true })),
        fc.float({ min: -100, max: 100, noNaN: true })
      ),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(orderSetArb(), anyRatingsArb, (orders: Order[], ratings) => {
        const metrics = computeMetrics(orders, ratings);
        expect(metrics.customerSatisfactionScore).toBeGreaterThanOrEqual(0);
        expect(metrics.customerSatisfactionScore).toBeLessThanOrEqual(5);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

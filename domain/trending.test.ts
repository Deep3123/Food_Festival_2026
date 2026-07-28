import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { rankTrending } from "./trending.js";
import { orderArb } from "../types/generators.js";
import type { Order } from "../types/index.js";

/**
 * Property tests for the trending ranking domain module.
 *
 * A fixed catalog is used so orders group onto a known set of item ids, which
 * lets the test recompute the expected per-item unit counts independently.
 * Noise orders (unpaid, or dated on other days) are mixed in to confirm they
 * are excluded from the ranking.
 */

const NUM_RUNS = 200;

const catalog = [
  { itemId: "item-a", name: "Alpha Bowl" },
  { itemId: "item-b", name: "Beta Burger" },
  { itemId: "item-c", name: "Gamma Wrap" },
  { itemId: "item-d", name: "Delta Dessert" },
];

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

describe("trending domain", () => {
  // Feature: bytebites, Property 26: Trending is ranked descending with correct counts
  it("Property 26: output is non-increasing by units and each count equals today's paid units for that item", () => {
    // Today's paid orders that should be counted.
    const todaysPaidArb = fc.array(
      orderArb({ today: true, paid: true, catalog }),
      { minLength: 0, maxLength: 15 }
    );
    // Noise: paid orders from other days plus unpaid orders (today or not).
    const noiseArb = fc.array(
      fc.oneof(
        orderArb({ today: false, paid: true, catalog }),
        orderArb({ paid: false, catalog })
      ),
      { minLength: 0, maxLength: 15 }
    );

    fc.assert(
      fc.property(
        todaysPaidArb,
        noiseArb,
        (todaysPaid: Order[], noise: Order[]) => {
          const all = [...todaysPaid, ...noise];
          const result = rankTrending(all);

          // 1. Output is ordered non-increasing by unitsOrdered.
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].unitsOrdered).toBeGreaterThanOrEqual(
              result[i].unitsOrdered
            );
          }

          // 2. Independently recompute expected counts from ONLY today's paid
          //    orders (regardless of which bucket they were generated in, to be
          //    robust to any noise that happens to be today+paid).
          const expected = new Map<string, number>();
          for (const order of all) {
            if (!order.paid || !isToday(order.createdAt)) continue;
            for (const item of order.items) {
              expected.set(
                item.itemId,
                (expected.get(item.itemId) ?? 0) + item.quantity
              );
            }
          }

          // Every entry's count matches the expected total, and every entry is
          // a real item (units > 0).
          const resultMap = new Map(
            result.map((e) => [e.itemId, e.unitsOrdered])
          );
          expect(resultMap.size).toBe(expected.size);
          for (const [itemId, units] of expected) {
            expect(resultMap.get(itemId)).toBe(units);
          }
          for (const entry of result) {
            expect(entry.unitsOrdered).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

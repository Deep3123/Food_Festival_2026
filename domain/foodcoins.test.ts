import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { coinsForOrder, applyRedemption } from "./foodcoins.js";
import { walletBalanceArb, priceArb } from "../types/generators.js";

/**
 * Property tests for the FoodCoins domain module.
 *
 * Coin math is computed on integer paise to avoid floating-point drift. The
 * expected values below are computed the same way (paise then floor) so the
 * tests do not produce float-drift false failures.
 */

const NUM_RUNS = 100;

/** An order total in rupees, including large orders and paise-level amounts. */
const orderTotalArb: fc.Arbitrary<number> = fc.oneof(
  fc.constant(0),
  priceArb,
  fc.integer({ min: 1, max: 100_000_000 }).map((paise) => paise / 100)
);

describe("foodcoins domain", () => {
  // Feature: bytebites, Property 21: FoodCoins earned equal 10% of the total, floored
  it("Property 21: FoodCoins credited equal floor(0.10 x total) and are always a non-negative integer", () => {
    fc.assert(
      fc.property(orderTotalArb, (total) => {
        const coins = coinsForOrder(total);

        // Always a non-negative integer.
        expect(Number.isInteger(coins)).toBe(true);
        expect(coins).toBeGreaterThanOrEqual(0);

        // Equals floor(0.10 x total), computed on integer paise.
        const expected = Math.floor(Math.round(total * 100) / 1000);
        expect(coins).toBe(expected);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 22: Valid redemption deducts exactly the redeemed amount
  it("Property 22: a redemption of at most the balance succeeds and deducts exactly the redeemed amount", () => {
    fc.assert(
      fc.property(
        walletBalanceArb,
        fc.nat({ max: 100000 }),
        (balance, rawAmount) => {
          // Constrain the redemption amount to be <= balance.
          const amount = balance === 0 ? 0 : rawAmount % (balance + 1);
          expect(amount).toBeLessThanOrEqual(balance);

          const result = applyRedemption(balance, amount);

          expect(result.ok).toBe(true);
          expect(result.balance).toBe(balance - amount);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 23: Over-redemption is rejected and leaves the balance unchanged
  it("Property 23: a redemption greater than the balance is rejected and leaves the balance unchanged", () => {
    fc.assert(
      fc.property(
        walletBalanceArb,
        fc.integer({ min: 1, max: 100000 }),
        (balance, over) => {
          // Ensure the amount strictly exceeds the balance.
          const amount = balance + over;
          expect(amount).toBeGreaterThan(balance);

          const result = applyRedemption(balance, amount);

          expect(result.ok).toBe(false);
          expect(result.balance).toBe(balance);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

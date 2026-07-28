import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { lineTotal, orderTotal, clampQuantity } from "./pricing.js";
import { cartArb, cartItemArb } from "../types/generators.js";
import type { CartItem } from "../types/index.js";

/**
 * Property tests for the pricing domain module.
 *
 * Monetary math in `pricing.ts` is computed on integer paise to avoid
 * floating-point drift. To keep these tests free of float-drift false
 * failures, expected values are computed the same way (integer paise summation
 * then division by 100) rather than by naive floating-point multiply-and-sum.
 */

const NUM_RUNS = 100;

/** Reference: unit price × quantity via integer paise, presented in rupees. */
function expectedLineTotal(unitPrice: number, quantity: number): number {
  return (Math.round(unitPrice * 100) * quantity) / 100;
}

/** Reference: sum of every line's paise contribution, presented in rupees. */
function expectedOrderTotal(items: CartItem[]): number {
  const totalPaise = items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
    0
  );
  return totalPaise / 100;
}

/** A single cart mutation used to exercise a sequence of cart operations. */
type CartOp =
  | { kind: "add"; item: CartItem }
  | { kind: "remove"; index: number }
  | { kind: "increase"; index: number; by: number }
  | { kind: "decrease"; index: number; by: number };

const cartOpArb: fc.Arbitrary<CartOp> = fc.oneof(
  cartItemArb.map((item) => ({ kind: "add" as const, item })),
  fc.nat({ max: 40 }).map((index) => ({ kind: "remove" as const, index })),
  fc.record({
    index: fc.nat({ max: 40 }),
    by: fc.integer({ min: 1, max: 20 }),
  }).map(({ index, by }) => ({ kind: "increase" as const, index, by })),
  fc.record({
    index: fc.nat({ max: 40 }),
    by: fc.integer({ min: 1, max: 20 }),
  }).map(({ index, by }) => ({ kind: "decrease" as const, index, by }))
);

/** Apply a single operation to a cart, returning a new cart. */
function applyOp(cart: CartItem[], op: CartOp): CartItem[] {
  switch (op.kind) {
    case "add":
      return [...cart, op.item];
    case "remove": {
      if (cart.length === 0) return cart;
      const i = op.index % cart.length;
      return cart.filter((_, idx) => idx !== i);
    }
    case "increase": {
      if (cart.length === 0) return cart;
      const i = op.index % cart.length;
      return cart.map((line, idx) =>
        idx === i ? { ...line, quantity: line.quantity + op.by } : line
      );
    }
    case "decrease": {
      if (cart.length === 0) return cart;
      const i = op.index % cart.length;
      // Keep quantity >= 1 to respect the CartItem invariant.
      const nextQty = Math.max(1, cart[i].quantity - op.by);
      return cart.map((line, idx) =>
        idx === i ? { ...line, quantity: nextQty } : line
      );
    }
  }
}

describe("pricing domain", () => {
  // Feature: bytebites, Property 4: Order total equals the sum of line totals
  it("Property 4: order total equals the sum of line totals, before and after any sequence of operations", () => {
    fc.assert(
      fc.property(
        cartArb,
        fc.array(cartOpArb, { minLength: 0, maxLength: 15 }),
        (initialCart, ops) => {
          // Each line total equals unit price × quantity.
          for (const line of initialCart) {
            expect(lineTotal(line.unitPrice, line.quantity)).toBe(
              expectedLineTotal(line.unitPrice, line.quantity)
            );
          }

          // Order total equals the sum of the line totals for the initial cart.
          expect(orderTotal(initialCart)).toBe(expectedOrderTotal(initialCart));

          // The invariant holds after every step of an arbitrary sequence of
          // additions, removals, and quantity increases/decreases.
          let cart = initialCart;
          for (const op of ops) {
            cart = applyOp(cart, op);
            const sumOfLineTotals = cart.reduce(
              (sum, line) => sum + lineTotal(line.unitPrice, line.quantity),
              0
            );
            // Compare paise to sidestep float drift when summing rupee values.
            expect(Math.round(orderTotal(cart) * 100)).toBe(
              Math.round(sumOfLineTotals * 100)
            );
            expect(orderTotal(cart)).toBe(expectedOrderTotal(cart));
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 5: Removed items leave the cart and the total recomputes
  it("Property 5: removed items leave the cart and the total recomputes to the remaining line totals", () => {
    const nonEmptyCartArb = fc.array(cartItemArb, {
      minLength: 1,
      maxLength: 30,
    });
    fc.assert(
      fc.property(
        nonEmptyCartArb,
        fc.nat(),
        (cart, rawIndex) => {
          const index = rawIndex % cart.length;
          const removed = cart[index];
          // Remove by position (item identity within the cart).
          const remaining = cart.filter((_, idx) => idx !== index);

          // The removed line is gone: the cart shrank by exactly one entry.
          expect(remaining.length).toBe(cart.length - 1);
          // No entry with the removed line's object identity remains.
          expect(remaining).not.toContain(removed);

          // The order total recomputes to the sum of the remaining line totals.
          const sumRemaining = remaining.reduce(
            (sum, line) => sum + lineTotal(line.unitPrice, line.quantity),
            0
          );
          expect(Math.round(orderTotal(remaining) * 100)).toBe(
            Math.round(sumRemaining * 100)
          );
          expect(orderTotal(remaining)).toBe(expectedOrderTotal(remaining));
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 6: Quantity is clamped to available with a notice
  it("Property 6: quantity is clamped to available with a notice when requested exceeds available; unchanged otherwise", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (requested, available) => {
          const result = clampQuantity(requested, available);
          if (requested > available) {
            expect(result.quantity).toBe(available);
            expect(result.clamped).toBe(true);
          } else {
            expect(result.quantity).toBe(requested);
            expect(result.clamped).toBe(false);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

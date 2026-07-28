import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { nextStatus } from "./order-status.js";
import { ORDER_STATUS_SEQUENCE } from "../types/index.js";
import { orderStatusArb } from "../types/generators.js";

/**
 * Property test for the order status transition domain module.
 *
 * Asserts that advancing a status moves it exactly one step forward in the
 * canonical sequence, that the terminal value stays put, and that no advance
 * skips a value or moves backward.
 */

const NUM_RUNS = 100;
const LAST = ORDER_STATUS_SEQUENCE[ORDER_STATUS_SEQUENCE.length - 1];

describe("order-status domain", () => {
  // Feature: bytebites, Property 13: Status advances by exactly one step and never regresses
  it("Property 13: advancing moves to the immediate next value, last stays last, and never skips or regresses", () => {
    fc.assert(
      fc.property(orderStatusArb, (current) => {
        const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(current);
        const advanced = nextStatus(current);
        const advancedIndex = ORDER_STATUS_SEQUENCE.indexOf(advanced);

        // The result is always a valid status in the sequence.
        expect(advancedIndex).toBeGreaterThanOrEqual(0);

        if (current === LAST) {
          // Terminal value remains unchanged.
          expect(advanced).toBe(LAST);
        } else {
          // Advances by exactly one step: no skipping, no regression.
          expect(advancedIndex).toBe(currentIndex + 1);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

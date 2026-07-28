import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { issueToken } from "./tokens.js";

/**
 * Property test for the order token domain module.
 *
 * Simulates a sequence of successful orders by repeatedly calling issueToken,
 * accumulating each returned token into the "existing" set, and asserting the
 * uniqueness and non-emptiness invariants hold across the whole sequence.
 */

const NUM_RUNS = 100;

describe("tokens domain", () => {
  // Feature: bytebites, Property 10: Issued order tokens are unique and non-empty
  it("Property 10: every issued Order_Token is non-empty and no token is issued more than once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (orderCount) => {
        const existingTokens = new Set<string>();

        for (let i = 0; i < orderCount; i += 1) {
          const token = issueToken(existingTokens);

          // Non-empty.
          expect(typeof token).toBe("string");
          expect(token.length).toBeGreaterThan(0);

          // Short, human-friendly sequential format, e.g. "A-0001".
          expect(token).toMatch(/^[A-Z]-\d{4}$/);

          // Not previously issued.
          expect(existingTokens.has(token)).toBe(false);

          existingTokens.add(token);
        }

        // The set size equals the number of orders => all tokens distinct.
        expect(existingTokens.size).toBe(orderCount);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("issues short sequential tokens starting at A-0001 and continuing from the highest", () => {
    const existing = new Set<string>();

    const first = issueToken(existing);
    expect(first).toBe("A-0001");
    existing.add(first);

    const second = issueToken(existing);
    expect(second).toBe("A-0002");
    existing.add(second);

    // Continues from the highest existing sequential token, ignoring gaps.
    existing.add("A-0010");
    expect(issueToken(existing)).toBe("A-0011");
  });

  it("rolls over to the next letter after the 4-digit counter is exhausted", () => {
    expect(issueToken(new Set(["A-9999"]))).toBe("B-0001");
  });

  it("skips a colliding sequential token to stay unique", () => {
    // Next would be A-0002, but it's taken — advance to A-0003.
    const existing = new Set(["A-0001", "A-0002"]);
    expect(issueToken(existing)).toBe("A-0003");
  });
});

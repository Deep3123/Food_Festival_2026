import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { spin } from "./spin.js";
import { SPIN_REWARDS } from "../types/index.js";

/**
 * Property test for the Spin & Win reward selection domain module.
 *
 * The rng contract is a float in the half-open interval [0, 1). For any such
 * value the drawn reward must be a member of the allowed set.
 */

const NUM_RUNS = 200;
const allowed = new Set<string>(SPIN_REWARDS);

describe("spin domain", () => {
  // Feature: bytebites, Property 27: Spin reward is always drawn from the allowed set
  it("Property 27: for any rng value in [0,1) the reward is one of the allowed set", () => {
    // fc.float includes bounds; exclude 1 (max, exclusive) to honor [0,1).
    const rngValueArb = fc.float({
      min: 0,
      max: 1,
      maxExcluded: true,
      noNaN: true,
    });

    fc.assert(
      fc.property(rngValueArb, (value: number) => {
        const reward = spin(() => value);
        expect(allowed.has(reward)).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

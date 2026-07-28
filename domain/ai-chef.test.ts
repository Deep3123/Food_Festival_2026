import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { recommend } from "./ai-chef.js";
import { preferencesArb, menuArb, foodItemArb } from "../types/generators.js";
import type { FoodItem, Flavor, Preferences } from "../types/index.js";

/**
 * Property tests for the AI Chef recommendation domain module.
 *
 * Matching definition (mirrors ai-chef.ts): an item is an EXACT MATCH for the
 * preferences when all three dimensions align — item.portion === prefs.hunger,
 * item.spice === prefs.spice, and item.flavor === prefs.taste. When no item is
 * an exact match, the recommender falls back to the highest-rated available
 * item (availableQuantity > 0) and clears the exactMatch indicator.
 */

const NUM_RUNS = 100;

/** The opposite flavor, used to deliberately break the taste dimension. */
function oppositeFlavor(taste: Flavor): Flavor {
  return taste === "sweet" ? "savory" : "sweet";
}

describe("ai-chef domain", () => {
  // Feature: bytebites, Property 18: A recommendation is always returned for a non-empty menu
  it("Property 18: returns at least one recommended item for any non-empty menu", () => {
    fc.assert(
      fc.property(preferencesArb, menuArb(), (prefs, menu) => {
        const result = recommend(prefs, menu);
        expect(result.items.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 19: Confidence scores stay within 0..100
  it("Property 19: every recommended item has confidence within the inclusive range 0..100", () => {
    fc.assert(
      fc.property(preferencesArb, menuArb(), (prefs, menu) => {
        const result = recommend(prefs, menu);
        for (const rec of result.items) {
          expect(rec.confidence).toBeGreaterThanOrEqual(0);
          expect(rec.confidence).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: bytebites, Property 20: No exact match falls back to the highest-rated available item
  it("Property 20: with no matching item, returns the highest-rated available item and sets exactMatch false", () => {
    // Build a menu that cannot contain an exact match by forcing every item's
    // flavor to the opposite of the submitted taste preference, then guarantee
    // at least one available item so the highest-rated-available fallback is
    // well defined.
    const scenarioArb = preferencesArb.chain((prefs: Preferences) =>
      fc
        .array(foodItemArb(), { minLength: 1, maxLength: 15 })
        .map((items) => {
          const nonMatching: FoodItem[] = items.map((item) => ({
            ...item,
            flavor: oppositeFlavor(prefs.taste),
          }));
          // Ensure at least one item is available (quantity > 0).
          nonMatching[0] = {
            ...nonMatching[0],
            availableQuantity: Math.max(1, nonMatching[0].availableQuantity),
          };
          return { prefs, menu: nonMatching };
        })
    );

    fc.assert(
      fc.property(scenarioArb, ({ prefs, menu }) => {
        const result = recommend(prefs, menu);

        // No exact match exists in this constructed menu.
        expect(result.exactMatch).toBe(false);
        expect(result.items).toHaveLength(1);

        const available = menu.filter((item) => item.availableQuantity > 0);
        const maxAvailableRating = Math.max(
          ...available.map((item) => item.rating)
        );

        const recommended = result.items[0].item;
        // The returned item is available and its rating is the maximum among
        // available items (robust to ties in rating).
        expect(recommended.availableQuantity).toBeGreaterThan(0);
        expect(recommended.rating).toBe(maxAvailableRating);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

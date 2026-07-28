/**
 * AI Chef recommendation domain module for ByteBites.
 *
 * Pure, framework-agnostic recommendation scoring. Given a customer's three
 * preference inputs (hunger level, spice preference, and a sweet-or-savory
 * choice) and a Marketplace menu, `recommend` scores each item by how well it
 * matches the preferences and returns the best recommendation(s).
 *
 * Matching definition
 * -------------------
 * A food item's attributes map onto the three preference dimensions:
 *   - `item.portion` <-> `prefs.hunger`
 *   - `item.spice`   <-> `prefs.spice`
 *   - `item.flavor`  <-> `prefs.taste`
 *
 * An item is an EXACT MATCH when all three dimensions align. The number of
 * aligned dimensions (0..3) drives a Confidence_Score in the inclusive range
 * 0..100:
 *
 *   confidence = 30 * (matching dimensions) + (rating / 5) * 10
 *
 * so three matching dimensions yield 90..100 (an exact match) and fewer
 * matches yield proportionally lower confidence, with a small bonus for the
 * item's startup rating. The score is clamped to 0..100 for safety.
 *
 * Behavior
 * --------
 *   - If at least one item is an exact match, those matching items are returned
 *     (sorted by confidence, highest first) with `exactMatch: true` (Req 8.2).
 *   - If no item matches the submitted preferences, the highest-rated AVAILABLE
 *     item (availableQuantity > 0) is returned with `exactMatch: false`, the
 *     no-exact-match indicator (Req 8.4). If nothing is available, the
 *     highest-rated item overall is returned so a non-empty menu always yields
 *     a recommendation (Req 8.2).
 *   - An empty menu yields no recommendation.
 *
 * Validates: Requirements 8.2, 8.3, 8.4
 */

import type {
  FoodItem,
  Preferences,
  RecommendedItem,
} from "../types/index.js";

/** Count how many of the three preference dimensions an item aligns with. */
function matchingDimensions(prefs: Preferences, item: FoodItem): number {
  let count = 0;
  if (item.portion === prefs.hunger) count += 1;
  if (item.spice === prefs.spice) count += 1;
  if (item.flavor === prefs.taste) count += 1;
  return count;
}

/** An item is an exact match when all three preference dimensions align. */
function isExactMatch(prefs: Preferences, item: FoodItem): boolean {
  return matchingDimensions(prefs, item) === 3;
}

/**
 * Compute a Confidence_Score in the inclusive range 0..100 for an item given
 * the customer's preferences (Req 8.3).
 */
function confidenceFor(prefs: Preferences, item: FoodItem): number {
  const matches = matchingDimensions(prefs, item);
  const rating = Number.isFinite(item.rating) ? item.rating : 0;
  const ratingBonus = (Math.max(0, Math.min(5, rating)) / 5) * 10;
  const score = matches * 30 + ratingBonus;
  // Defensive clamp so the score never escapes 0..100.
  return Math.max(0, Math.min(100, score));
}

/** Pick the item with the highest startup rating from a non-empty list. */
function highestRated(items: FoodItem[]): FoodItem {
  return items.reduce((best, item) =>
    item.rating > best.rating ? item : best
  );
}

/**
 * Recommend food item(s) for the given preferences from a Marketplace menu.
 *
 * Returns matching items with `exactMatch: true` when any exist, otherwise
 * falls back to the highest-rated available item with `exactMatch: false`.
 */
export function recommend(
  prefs: Preferences,
  items: FoodItem[]
): { items: RecommendedItem[]; exactMatch: boolean } {
  if (items.length === 0) {
    return { items: [], exactMatch: false };
  }

  const matches = items.filter((item) => isExactMatch(prefs, item));

  if (matches.length > 0) {
    const recommended: RecommendedItem[] = matches
      .map((item) => ({ item, confidence: confidenceFor(prefs, item) }))
      .sort((a, b) => b.confidence - a.confidence);
    return { items: recommended, exactMatch: true };
  }

  // No exact match: fall back to the highest-rated available item. If nothing
  // is available, fall back to the highest-rated item overall so a non-empty
  // menu always yields a recommendation.
  const available = items.filter((item) => item.availableQuantity > 0);
  const fallbackPool = available.length > 0 ? available : items;
  const fallback = highestRated(fallbackPool);

  return {
    items: [{ item: fallback, confidence: confidenceFor(prefs, fallback) }],
    exactMatch: false,
  };
}

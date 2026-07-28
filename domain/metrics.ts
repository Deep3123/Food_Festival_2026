/**
 * Startup metrics computation domain module for ByteBites.
 *
 * Pure, framework-agnostic metric aggregation. `computeMetrics` derives the
 * five dashboard metrics from a set of orders and a set of rating inputs.
 *
 * Scope decisions (documented for consistency with the trending module and the
 * design's Correctness Properties):
 *
 *   - totalOrdersToday, revenueGenerated, bestSellingProduct are scoped to
 *     orders that are BOTH paid AND dated for the server's current local day.
 *     This matches Requirement 7.2 ("...for the current day") and the trending
 *     module's "today + paid" scope.
 *
 *   - digitalPaymentPercentage is computed over ALL paid orders regardless of
 *     day. This matches Property 16's wording ("For any set of paid orders...
 *     orders paid through the gateway / total paid orders") and Requirement 7.3
 *     which carries no current-day qualifier. It is 0 when there are no paid
 *     orders. A payment counts as "digital / via gateway" when its
 *     paymentMethod is "UPI".
 *
 *   - customerSatisfactionScore is the arithmetic mean of the provided ratings,
 *     clamped to the inclusive range 0..5. It is 0 when there are no ratings.
 *
 * Validates: Requirements 7.2, 7.3, 7.4
 */

import type { Metrics, PaidOrder } from "../types/index.js";

/** True when an ISO timestamp falls on the server's current local day. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Clamp a number to the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the dashboard metrics from orders and rating inputs.
 */
export function computeMetrics(
  orders: PaidOrder[],
  ratings: number[]
): Metrics {
  // "today + paid" scope for orders/revenue/best-seller.
  const todaysPaid = orders.filter((o) => o.paid && isToday(o.createdAt));

  const totalOrdersToday = todaysPaid.length;
  const revenueGenerated = todaysPaid.reduce((sum, o) => sum + o.total, 0);

  // Digital payment percentage over ALL paid orders regardless of day.
  const paidOrders = orders.filter((o) => o.paid);
  const digitalPaymentPercentage =
    paidOrders.length === 0
      ? 0
      : (paidOrders.filter((o) => o.paymentMethod === "UPI").length /
          paidOrders.length) *
        100;

  // Best-selling product: item name with the most units across today's paid
  // orders, or null when there are none.
  const unitsByName = new Map<string, number>();
  for (const order of todaysPaid) {
    for (const item of order.items) {
      unitsByName.set(
        item.name,
        (unitsByName.get(item.name) ?? 0) + item.quantity
      );
    }
  }
  let bestSellingProduct: string | null = null;
  let bestUnits = -1;
  for (const [name, units] of unitsByName) {
    if (units > bestUnits) {
      bestUnits = units;
      bestSellingProduct = name;
    }
  }

  // Customer satisfaction score: mean of ratings, clamped to 0..5, 0 if empty.
  const customerSatisfactionScore =
    ratings.length === 0
      ? 0
      : clamp(
          ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
          0,
          5
        );

  return {
    totalOrdersToday,
    revenueGenerated,
    digitalPaymentPercentage,
    bestSellingProduct,
    customerSatisfactionScore,
  };
}

/**
 * Reward Points domain module for ByteBites.
 *
 * Pure, framework-agnostic functions for the reward system math.
 *
 * Reward points are always whole (integer). Customers earn points equal to
 * 10 percent of an order total in rupees, rounded down to the nearest whole
 * point. Points can be redeemed on the next order: 2 points = ₹1 (1 point = ₹0.50).
 *
 * Validates: Requirements 9.1, 9.3, 9.4
 */

/**
 * Compute the reward points earned for an order: floor(10% of total).
 *
 * Example: order total ₹120 → 12 points earned.
 * The result is always a non-negative integer.
 *
 * Negative or non-finite totals earn no points (defensive clamp to 0).
 */
export function coinsForOrder(orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    return 0;
  }
  // 10% of total, floored to whole points.
  return Math.floor(orderTotal * 0.10);
}

/**
 * Convert reward points to their rupee value.
 * 2 points = ₹1, so 1 point = ₹0.50.
 */
export function pointsToRupees(points: number): number {
  return points * 0.50;
}

/**
 * Convert a rupee discount amount to the points required.
 * ₹1 = 2 points.
 */
export function rupeesToPoints(rupees: number): number {
  return Math.ceil(rupees * 2);
}

/**
 * Apply a redemption of `amount` reward points against a wallet `balance`.
 *
 * If the amount can be covered by the balance, the redemption succeeds and the
 * balance is reduced by exactly the redeemed amount (Req 9.3). If the amount
 * exceeds the balance, the redemption is rejected and the balance is left
 * unchanged (Req 9.4).
 */
export function applyRedemption(
  balance: number,
  amount: number
): { balance: number; ok: boolean } {
  if (amount <= balance) {
    return { balance: balance - amount, ok: true };
  }
  return { balance, ok: false };
}

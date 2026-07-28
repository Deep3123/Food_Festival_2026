/**
 * FoodCoins domain module for ByteBites.
 *
 * Pure, framework-agnostic functions for the digital wallet's reward math.
 *
 * FoodCoins are always whole (integer) coins. Customers earn coins equal to
 * 10 percent of an order total in rupees, rounded down to the nearest whole
 * coin, and may redeem coins against their balance.
 *
 * Money handling: to avoid floating-point drift when taking 10 percent of a
 * rupee amount that may carry paise, the earning calculation is performed on
 * integer paise (1 rupee = 100 paise) internally. Ten percent of the total in
 * rupees equals `totalPaise / 1000` coins, floored to a whole coin.
 *
 * Validates: Requirements 9.1, 9.3, 9.4
 */

/**
 * Compute the FoodCoins earned for an order: floor(0.10 × total).
 *
 * The result is always a non-negative integer. The calculation is performed on
 * integer paise so that a total such as 149.90 rupees yields the same coin
 * count regardless of floating-point representation (Req 9.1).
 *
 * Negative or non-finite totals earn no coins (defensive clamp to 0).
 */
export function coinsForOrder(orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    return 0;
  }
  // 0.10 × total (rupees) == totalPaise / 1000 coins.
  const totalPaise = Math.round(orderTotal * 100);
  return Math.floor(totalPaise / 1000);
}

/**
 * Apply a redemption of `amount` FoodCoins against a wallet `balance`.
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

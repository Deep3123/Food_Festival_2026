/**
 * Presentation formatting helpers for the ByteBites client.
 */

/**
 * Format a rupee amount for display in Indian Rupees (Req 2.5, 3.1, 3.2).
 *
 * Uses the Unicode rupee sign (₹) with two-decimal precision so prices and
 * totals render consistently (e.g. `₹180.00`).
 */
export function formatINR(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

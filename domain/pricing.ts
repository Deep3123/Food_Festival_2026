/**
 * Pricing domain module for ByteBites.
 *
 * Pure, framework-agnostic functions for monetary math and quantity handling.
 *
 * Money handling: prices are expressed in Indian Rupees as numbers with up to
 * two decimal places (e.g. 149.5). To avoid floating-point drift when
 * multiplying and summing, all arithmetic is performed on integer paise
 * (1 rupee = 100 paise) internally, then converted back to rupees for the
 * returned value.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { CartItem } from "../types/index.js";

/** Convert a rupee amount to integer paise, rounding to the nearest paise. */
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert integer paise back to a rupee amount with two-decimal precision. */
function toRupees(paise: number): number {
  // paise is an integer; dividing by 100 yields at most two decimals.
  // Round-trip through Math.round guards against residual float error.
  return Math.round(paise) / 100;
}

/**
 * Compute the line total for a single cart line: unit price × quantity.
 *
 * The result is presented in rupees but computed on integer paise to avoid
 * floating-point drift (Req 3.1).
 */
export function lineTotal(unitPrice: number, quantity: number): number {
  const paise = toPaise(unitPrice) * quantity;
  return toRupees(paise);
}

/**
 * Compute the order total as the sum of every line total.
 *
 * Summation is performed in integer paise so that the total equals the sum of
 * the individual line totals exactly, with no accumulated float error
 * (Req 3.2, 3.3, 3.4).
 */
export function orderTotal(items: CartItem[]): number {
  const totalPaise = items.reduce(
    (sum, item) => sum + toPaise(item.unitPrice) * item.quantity,
    0
  );
  return toRupees(totalPaise);
}

/**
 * Clamp a requested quantity to the available quantity.
 *
 * If the requested quantity exceeds what is available, the quantity is limited
 * to the available amount and `clamped` is set to true (signalling that a
 * notice should be shown). Otherwise the requested quantity is returned
 * unchanged and `clamped` is false (Req 3.5).
 */
export function clampQuantity(
  requested: number,
  available: number
): { quantity: number; clamped: boolean } {
  if (requested > available) {
    return { quantity: available, clamped: true };
  }
  return { quantity: requested, clamped: false };
}

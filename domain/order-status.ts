/**
 * Order status transition domain module for ByteBites.
 *
 * Pure, framework-agnostic status advancement. An order progresses through the
 * sequence "Order Received" -> "Preparing" -> "Ready for Pickup". Advancing an
 * order already at "Ready for Pickup" is a no-op (it stays at the last value).
 *
 * Validates: Requirements 6.1, 6.2
 */

import type { OrderStatus } from "../types/index.js";
import { ORDER_STATUS_SEQUENCE } from "../types/index.js";

/**
 * Advance an Order_Status by exactly one step in the canonical sequence.
 *
 * The status moves to the immediate next value in
 * `ORDER_STATUS_SEQUENCE` (Req 6.1, 6.2). The terminal value
 * "Ready for Pickup" remains unchanged when advanced.
 */
export function nextStatus(current: OrderStatus): OrderStatus {
  const index = ORDER_STATUS_SEQUENCE.indexOf(current);
  // Defensive: an unrecognized status is left unchanged.
  if (index === -1) {
    return current;
  }
  const nextIndex = Math.min(index + 1, ORDER_STATUS_SEQUENCE.length - 1);
  return ORDER_STATUS_SEQUENCE[nextIndex];
}

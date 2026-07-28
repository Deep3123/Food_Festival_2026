/**
 * MockGateway — a deterministic PaymentGateway implementation for ByteBites.
 *
 * Used in local development and tests in place of the real Paytm adapter. It
 * implements the same `PaymentGateway` interface (from the shared types) so the
 * Ordering_System can be exercised without any network access.
 *
 * Determinism is the whole point of this gateway: tests need to control exactly
 * whether a payment succeeds or fails. Three levers are provided:
 *
 *   1. Construct with a default mode ("success" | "failure").
 *   2. Flip the default mode later with `setMode(...)`.
 *   3. Force the outcome of the very next call with `forceNextResult(...)`,
 *      which takes precedence over the default mode exactly once.
 *
 * On success it returns `{ success: true, gatewayRef: "<ref>" }`; on failure it
 * returns `{ success: false, failureReason: "<reason>" }`.
 *
 * Validates: Requirements 5.1, 5.3
 */

import type {
  OrderContext,
  PaymentGateway,
  PaymentResult,
} from "../../../types/index.js";

export type MockGatewayMode = "success" | "failure";

export interface MockGatewayOptions {
  /** Default outcome for calls when no per-call override is queued. */
  mode?: MockGatewayMode;
  /** Reason returned on failure results. */
  failureReason?: string;
}

const DEFAULT_FAILURE_REASON = "Mock payment declined";

export class MockGateway implements PaymentGateway {
  private mode: MockGatewayMode;
  private failureReason: string;

  /** A one-shot forced result that overrides `mode` for the next call only. */
  private nextResult: PaymentResult | null = null;

  /** Monotonic counter used to mint distinct mock gateway references. */
  private refCounter = 0;

  /** History of the amounts requested, useful for test assertions. */
  readonly calls: Array<{ amountInRupees: number; orderContext: OrderContext }> =
    [];

  constructor(options: MockGatewayOptions = {}) {
    this.mode = options.mode ?? "success";
    this.failureReason = options.failureReason ?? DEFAULT_FAILURE_REASON;
  }

  /** Change the default outcome mode for subsequent calls. */
  setMode(mode: MockGatewayMode): void {
    this.mode = mode;
  }

  /**
   * Force the result of the next `initiatePayment` call, taking precedence over
   * the default mode exactly once. After that call the gateway reverts to its
   * default mode. Passing a boolean is a convenience for the common cases.
   */
  forceNextResult(result: PaymentResult | boolean): void {
    if (typeof result === "boolean") {
      this.nextResult = result
        ? { success: true, gatewayRef: this.mintRef() }
        : { success: false, failureReason: this.failureReason };
      return;
    }
    this.nextResult = result;
  }

  /**
   * Simulate initiating a payment. Deterministic: the outcome is dictated by a
   * queued forced result if present, otherwise by the current default mode.
   */
  async initiatePayment(
    amountInRupees: number,
    orderContext: OrderContext
  ): Promise<PaymentResult> {
    this.calls.push({ amountInRupees, orderContext });

    if (this.nextResult !== null) {
      const forced = this.nextResult;
      this.nextResult = null;
      return forced;
    }

    if (this.mode === "success") {
      return { success: true, gatewayRef: this.mintRef() };
    }
    return { success: false, failureReason: this.failureReason };
  }

  /** Mint a distinct, human-readable mock gateway reference. */
  private mintRef(): string {
    this.refCounter += 1;
    return `MOCK-${this.refCounter.toString().padStart(6, "0")}`;
  }
}

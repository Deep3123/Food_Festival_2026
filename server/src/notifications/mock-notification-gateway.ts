/**
 * MockNotificationGateway — a deterministic NotificationGateway for ByteBites.
 *
 * Used in local development and tests in place of the real WhatsApp adapter. It
 * implements the same `NotificationGateway` interface (from the shared types) so
 * the checkout flow can send an order confirmation without any network access.
 *
 * Every send is recorded in `sent` for test assertions and returns a
 * deterministic `{ sent: true, ref: "MOCK-..." }` result.
 *
 * Mirrors the MockGateway (payments) pattern.
 */

import type {
  NotificationGateway,
  NotificationResult,
  OrderConfirmationParams,
} from "../../../types/index.js";

export class MockNotificationGateway implements NotificationGateway {
  /** History of confirmations "sent", useful for test assertions. */
  readonly sent: OrderConfirmationParams[] = [];

  /** Monotonic counter used to mint distinct mock message references. */
  private refCounter = 0;

  async sendOrderConfirmation(
    params: OrderConfirmationParams
  ): Promise<NotificationResult> {
    this.sent.push(params);
    this.refCounter += 1;
    const ref = `MOCK-${this.refCounter.toString().padStart(6, "0")}`;
    // Log in normal runs for demo visibility; stay quiet under test to avoid
    // flooding test output.
    if (!process.env.VITEST) {
      // eslint-disable-next-line no-console
      console.log(
        `[MockNotificationGateway] order confirmation for token ${params.token} ` +
          `-> ${params.toMobile} (ref ${ref})`
      );
    }
    return { sent: true, ref };
  }
}

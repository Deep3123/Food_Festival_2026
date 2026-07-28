/**
 * Paytm sandbox smoke test for the real `PaytmGateway` adapter (Task 17.3).
 *
 * This is a SINGLE-EXECUTION smoke test — not a property test and not repeated —
 * verifying that the adapter initiates a UPI request for the order total. Real
 * Paytm merchant credentials and network access are not available in this
 * repository, so the adapter's single network boundary (`postTransactionRequest`,
 * which throws by default and is explicitly designed to be overridden) is
 * subclassed to CAPTURE the outgoing request and return a simulated success
 * response.
 *
 * The assertions confirm the adapter built and "sent" exactly one UPI request
 * with paymentMode "UPI" and the correct txnAmount for the order total, and that
 * `initiatePayment` mapped the simulated success onto a `PaymentResult`. This
 * exercises the real request-construction and result-mapping code paths without
 * performing any live network call.
 *
 * Validates: Requirements 5.1
 */

import { describe, it, expect } from "vitest";
import { PaytmGateway } from "./paytm-gateway.js";
import type {
  PaytmInitiateResponse,
  PaytmUpiRequest,
} from "./paytm-gateway.js";
import type { OrderContext } from "../../../types/index.js";

/**
 * A test double over the real adapter that overrides ONLY the network boundary.
 * Every other part of the adapter (config validation, order-id derivation, UPI
 * request-body construction, checksum signing, and result mapping) is the real
 * production code. The override records each captured request and returns a
 * simulated Paytm success response.
 */
class CapturingPaytmGateway extends PaytmGateway {
  readonly sentRequests: PaytmUpiRequest[] = [];

  protected override async postTransactionRequest(
    request: PaytmUpiRequest
  ): Promise<PaytmInitiateResponse> {
    this.sentRequests.push(request);
    return {
      txnToken: "SANDBOX-TXN-TOKEN-123",
      resultInfo: {
        resultStatus: "S",
        resultCode: "0000",
        resultMsg: "Success",
      },
    };
  }
}

describe("Paytm sandbox smoke test: PaytmGateway initiates a UPI request", () => {
  it("builds and sends exactly one UPI request for the order total, then maps the success result", async () => {
    const gateway = new CapturingPaytmGateway({
      merchantId: "TESTMERCHANT",
      merchantKey: "test-merchant-key",
      environment: "staging",
    });

    const orderContext: OrderContext = {
      stallId: "stall-tandoori",
      customerId: "cust-sandbox",
      items: [
        { itemId: "item-paneer-tikka", name: "Paneer Tikka", unitPrice: 180, quantity: 2 },
        { itemId: "item-butter-naan", name: "Butter Naan", unitPrice: 45, quantity: 1 },
      ],
    };
    const amountInRupees = 405; // 2*180 + 45

    // Single execution — one call to initiatePayment.
    const result = await gateway.initiatePayment(amountInRupees, orderContext);

    // A UPI request was initiated exactly once (not repeated / not live).
    expect(gateway.sentRequests).toHaveLength(1);

    const sent = gateway.sentRequests[0];
    // It is a UPI payment request (Req 5.1).
    expect(sent.paymentMode).toBe("UPI");
    // The amount equals the order total, formatted as Paytm's fixed-2-decimal INR.
    expect(sent.txnAmount).toEqual({ value: "405.00", currency: "INR" });
    // The request carries the merchant + customer context.
    expect(sent.merchantId).toBe("TESTMERCHANT");
    expect(sent.userInfo.custId).toBe("cust-sandbox");
    expect(sent.orderId).toContain("stall-tandoori");
    expect(sent.orderId).toContain("cust-sandbox");

    // The simulated success response was mapped onto the shared PaymentResult.
    expect(result.success).toBe(true);
    expect(result.gatewayRef).toBe("SANDBOX-TXN-TOKEN-123");
  });
});

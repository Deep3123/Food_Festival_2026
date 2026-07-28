/**
 * PaytmGateway — the real Paytm UPI adapter for ByteBites.
 *
 * This adapter implements the same `PaymentGateway` interface as MockGateway so
 * the Ordering_System is agnostic to which implementation is wired in. It
 * initiates a real UPI payment request for the order total.
 *
 * Configuration (merchant id, merchant key, environment, callback URL) is
 * supplied either explicitly via the constructor or resolved from environment
 * variables via `PaytmGateway.fromEnv()`. Real credentials are not available in
 * this repository, so the single network boundary — `postTransactionRequest` —
 * is clearly marked and stubbed; every other part of the adapter (config
 * validation, order-id derivation, UPI request-body construction, and result
 * mapping) is real so the adapter shape is complete and testable.
 *
 * Validates: Requirements 5.1
 */

import type {
  OrderContext,
  PaymentGateway,
  PaymentResult,
} from "../../../types/index.js";

export type PaytmEnvironment = "staging" | "production";

export interface PaytmConfig {
  merchantId: string;
  merchantKey: string;
  /** Paytm website value (e.g. "WEBSTAGING" for staging). */
  website?: string;
  environment?: PaytmEnvironment;
  /** URL Paytm calls back after the UPI collect flow completes. */
  callbackUrl?: string;
}

/** The transaction request payload sent to Paytm's initiate-transaction API. */
export interface PaytmUpiRequest {
  merchantId: string;
  orderId: string;
  /** Transaction amount as a fixed two-decimal rupee string, per Paytm's API. */
  txnAmount: { value: string; currency: "INR" };
  userInfo: { custId: string };
  /** UPI is the requested payment channel. */
  paymentMode: "UPI";
  website: string;
  callbackUrl?: string;
}

/** The raw response shape returned by Paytm's initiate-transaction API. */
export interface PaytmInitiateResponse {
  txnToken?: string;
  resultInfo: {
    resultStatus: string; // "S" success, "F" failure
    resultCode: string;
    resultMsg: string;
  };
}

const PAYTM_ENDPOINTS: Record<PaytmEnvironment, string> = {
  staging: "https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction",
  production: "https://securegw.paytm.in/theia/api/v1/initiateTransaction",
};

export class PaytmGateway implements PaymentGateway {
  private readonly merchantId: string;
  private readonly merchantKey: string;
  private readonly website: string;
  private readonly environment: PaytmEnvironment;
  private readonly callbackUrl?: string;

  constructor(config: PaytmConfig) {
    if (!config.merchantId || !config.merchantKey) {
      throw new Error(
        "PaytmGateway requires both merchantId and merchantKey to be configured."
      );
    }
    this.merchantId = config.merchantId;
    this.merchantKey = config.merchantKey;
    this.environment = config.environment ?? "staging";
    this.website =
      config.website ?? (this.environment === "production" ? "DEFAULT" : "WEBSTAGING");
    this.callbackUrl = config.callbackUrl;
  }

  /**
   * Build a PaytmGateway from environment variables. Throws when the required
   * merchant credentials are absent.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): PaytmGateway {
    const environment =
      env.PAYTM_ENVIRONMENT === "production" ? "production" : "staging";
    return new PaytmGateway({
      merchantId: env.PAYTM_MERCHANT_ID ?? "",
      merchantKey: env.PAYTM_MERCHANT_KEY ?? "",
      website: env.PAYTM_WEBSITE,
      environment,
      callbackUrl: env.PAYTM_CALLBACK_URL,
    });
  }

  /**
   * Initiate a real UPI payment request for the order total. Builds the UPI
   * request body, posts it to Paytm's initiate-transaction API, and maps the
   * response onto the shared `PaymentResult` shape.
   */
  async initiatePayment(
    amountInRupees: number,
    orderContext: OrderContext
  ): Promise<PaymentResult> {
    const request = this.buildUpiRequest(amountInRupees, orderContext);
    try {
      const response = await this.postTransactionRequest(request);
      return this.mapResponse(response);
    } catch (error) {
      return {
        success: false,
        failureReason:
          error instanceof Error
            ? error.message
            : "Paytm UPI request failed",
      };
    }
  }

  /**
   * Construct the UPI initiate-transaction request body for the order total.
   * Paytm expects the amount as a fixed two-decimal string in INR.
   */
  buildUpiRequest(
    amountInRupees: number,
    orderContext: OrderContext
  ): PaytmUpiRequest {
    if (!(amountInRupees > 0)) {
      throw new Error("Payment amount must be greater than zero.");
    }
    return {
      merchantId: this.merchantId,
      orderId: this.deriveOrderId(orderContext),
      txnAmount: { value: amountInRupees.toFixed(2), currency: "INR" },
      userInfo: { custId: orderContext.customerId },
      paymentMode: "UPI",
      website: this.website,
      callbackUrl: this.callbackUrl,
    };
  }

  /** The initiate-transaction endpoint for the configured environment. */
  get endpoint(): string {
    return PAYTM_ENDPOINTS[this.environment];
  }

  /** Derive a Paytm order id from the order context and current time. */
  private deriveOrderId(orderContext: OrderContext): string {
    const suffix = Date.now().toString(36);
    return `BB-${orderContext.stallId}-${orderContext.customerId}-${suffix}`;
  }

  /** Map a raw Paytm response onto the shared PaymentResult shape. */
  private mapResponse(response: PaytmInitiateResponse): PaymentResult {
    const success =
      response.resultInfo.resultStatus === "S" && !!response.txnToken;
    if (success) {
      return { success: true, gatewayRef: response.txnToken };
    }
    return {
      success: false,
      failureReason:
        response.resultInfo.resultMsg || "Paytm reported a failed transaction",
    };
  }

  /**
   * Sign a request body with the merchant key. Paytm requires a checksum hash
   * (generated with the merchant key) on every transaction request. The real
   * implementation would use Paytm's checksum library; here we derive a stable
   * placeholder so the signing seam — and its dependency on `merchantKey` — is
   * part of the adapter shape.
   */
  signRequest(request: PaytmUpiRequest): string {
    const payload = JSON.stringify(request);
    let hash = 0;
    const material = `${this.merchantKey}:${payload}`;
    for (let i = 0; i < material.length; i += 1) {
      hash = (hash * 31 + material.charCodeAt(i)) | 0;
    }
    return `CHK_${(hash >>> 0).toString(16)}`;
  }

  /**
   * NETWORK BOUNDARY (stubbed).
   *
   * In a fully credentialed deployment this method signs `request` with the
   * merchant key (Paytm checksum), performs the HTTPS POST to `this.endpoint`,
   * and returns the parsed JSON. Because valid merchant credentials are not
   * available in this repository, the actual network call is intentionally not
   * performed here; instead this throws to signal that live invocation requires
   * real configuration. It is the single seam a sandbox smoke test (Task 17.3)
   * or an integration test can override.
   */
  protected async postTransactionRequest(
    request: PaytmUpiRequest
  ): Promise<PaytmInitiateResponse> {
    const checksum = this.signRequest(request);
    throw new Error(
      `Paytm live UPI request not sent for order ${request.orderId} ` +
        `(checksum ${checksum}): real merchant credentials and network access ` +
        "are not configured. Override postTransactionRequest to perform the " +
        "signed HTTPS POST."
    );
  }
}

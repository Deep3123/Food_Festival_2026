/**
 * Example-based unit tests for MockGateway.
 *
 * Covers the deterministic success and failure paths and the per-call override.
 *
 * Validates: Requirements 5.1, 5.3
 */

import { describe, it, expect } from "vitest";
import { MockGateway } from "./mock-gateway.js";
import type { OrderContext } from "../../../types/index.js";

const ctx: OrderContext = {
  stallId: "stall-tandoori",
  customerId: "cust-1",
  items: [{ itemId: "item-1", name: "Paneer Tikka", unitPrice: 180, quantity: 1 }],
};

describe("MockGateway", () => {
  it("returns success with a gatewayRef in success mode", async () => {
    const gw = new MockGateway({ mode: "success" });
    const result = await gw.initiatePayment(180, ctx);
    expect(result.success).toBe(true);
    expect(typeof result.gatewayRef).toBe("string");
    expect(result.gatewayRef && result.gatewayRef.length).toBeGreaterThan(0);
    expect(result.failureReason).toBeUndefined();
  });

  it("defaults to success mode when no options are given", async () => {
    const gw = new MockGateway();
    const result = await gw.initiatePayment(50, ctx);
    expect(result.success).toBe(true);
  });

  it("returns failure with a reason in failure mode", async () => {
    const gw = new MockGateway({ mode: "failure" });
    const result = await gw.initiatePayment(180, ctx);
    expect(result.success).toBe(false);
    expect(typeof result.failureReason).toBe("string");
    expect(result.failureReason && result.failureReason.length).toBeGreaterThan(
      0
    );
    expect(result.gatewayRef).toBeUndefined();
  });

  it("uses a custom failure reason when configured", async () => {
    const gw = new MockGateway({
      mode: "failure",
      failureReason: "Insufficient funds",
    });
    const result = await gw.initiatePayment(180, ctx);
    expect(result.failureReason).toBe("Insufficient funds");
  });

  it("issues distinct gateway references across successful calls", async () => {
    const gw = new MockGateway({ mode: "success" });
    const first = await gw.initiatePayment(10, ctx);
    const second = await gw.initiatePayment(20, ctx);
    expect(first.gatewayRef).not.toBe(second.gatewayRef);
  });

  it("switches outcome via setMode", async () => {
    const gw = new MockGateway({ mode: "success" });
    expect((await gw.initiatePayment(10, ctx)).success).toBe(true);
    gw.setMode("failure");
    expect((await gw.initiatePayment(10, ctx)).success).toBe(false);
  });

  it("forces the next result via boolean override, then reverts", async () => {
    const gw = new MockGateway({ mode: "success" });
    gw.forceNextResult(false);
    expect((await gw.initiatePayment(10, ctx)).success).toBe(false);
    // Reverts to the default success mode after one call.
    expect((await gw.initiatePayment(10, ctx)).success).toBe(true);
  });

  it("forces the next result via an explicit PaymentResult", async () => {
    const gw = new MockGateway({ mode: "failure" });
    gw.forceNextResult({ success: true, gatewayRef: "FORCED-REF" });
    const forced = await gw.initiatePayment(10, ctx);
    expect(forced).toEqual({ success: true, gatewayRef: "FORCED-REF" });
    // Reverts to the default failure mode after one call.
    expect((await gw.initiatePayment(10, ctx)).success).toBe(false);
  });

  it("records the requested amount for each call", async () => {
    const gw = new MockGateway({ mode: "success" });
    await gw.initiatePayment(180, ctx);
    await gw.initiatePayment(260, ctx);
    expect(gw.calls.map((c) => c.amountInRupees)).toEqual([180, 260]);
  });
});

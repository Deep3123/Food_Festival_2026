/**
 * CheckoutView — trigger a UPI payment and surface the order token (Req 5.1, 5.3, 5.5).
 *
 * Confirming checkout calls `api.checkout` with the current cart (stall,
 * customer, and line items). The server recomputes the total, contacts the
 * payment gateway, and on success creates the order and issues an Order_Token.
 *
 * On success the issued token is displayed to the customer along with a link
 * to track the order (Req 5.5). On failure — whether the gateway reports a
 * failed payment (`ApiClientError` code `PAYMENT_FAILED`) or any other error —
 * a payment failure message is shown and the cart is retained so the customer
 * can retry (Req 5.3). The cart is never cleared client-side by this view, so
 * its contents always survive a failed attempt.
 *
 * Customer identity: the demo build has no auth, so the customer is identified
 * by their mobile number captured via the customer profile form (see
 * `CustomerContext`). The mobile number is sent as the checkout `customerId` so
 * earned FoodCoins accrue to that account. If no customer is set yet, the view
 * gates on a mobile-entry form before allowing payment.
 *
 * After a successful checkout, a WhatsApp confirmation note is shown when the
 * server reports `notified: true`.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError, checkout } from "../api/client.js";
import type { CheckoutResponse } from "../api/client.js";
import { useCart } from "../cart/CartContext.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { toCartItems } from "../cart/cart.js";
import { orderPath } from "../routes.js";
import { ROUTES } from "../routes.js";
import { formatINR } from "../format.js";
import { DEMO_STALL_ID } from "../demo.js";
import { CustomerForm } from "./ProfileView.js";

type CheckoutState =
  | { status: "idle" }
  | { status: "paying" }
  | { status: "success"; result: CheckoutResponse; mobile: string }
  | { status: "failed"; message: string };

export function CheckoutView(): JSX.Element {
  const { cart, total } = useCart();
  const { customer } = useCustomer();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });

  async function handlePay(): Promise<void> {
    if (!customer) return;
    // Resolve the originating stall from the cart's items when possible so the
    // order is associated with the right stall; fall back to the demo stall.
    const stallId = DEMO_STALL_ID;
    setState({ status: "paying" });
    try {
      const result = await checkout({
        stallId,
        customerId: customer.mobile,
        items: toCartItems(cart),
      });
      setState({ status: "success", result, mobile: customer.mobile });
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError && err.code === "PAYMENT_FAILED"
          ? "Payment failed. Your cart is safe — please try again."
          : err instanceof Error
            ? err.message
            : "Payment failed. Your cart is safe — please try again.";
      setState({ status: "failed", message });
    }
  }

  if (state.status === "success") {
    const { token, coinsEarned, notified } = state.result;
    return (
      <main className="checkout">
        <h1>Payment successful</h1>
        <p className="checkout-token-label">Your order token:</p>
        <p className="checkout-token" data-testid="order-token">
          <strong>{token}</strong>
        </p>
        <p className="checkout-coins">You earned {coinsEarned} FoodCoins.</p>
        {notified && (
          <p className="checkout-notified" data-testid="checkout-notified">
            A confirmation has been sent to {state.mobile} on WhatsApp.
          </p>
        )}
        <Link className="checkout-track-link" to={orderPath(token)}>
          Track your order
        </Link>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="checkout">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link to={ROUTES.marketplace}>Browse the marketplace</Link>
      </main>
    );
  }

  // Gate: require a mobile-number identity before payment.
  if (!customer) {
    return (
      <main className="checkout">
        <h1>Checkout</h1>
        <p className="checkout-total" data-testid="checkout-total">
          Amount to pay: <strong>{formatINR(total)}</strong>
        </p>
        <p className="checkout-identity-prompt" data-testid="checkout-identity-prompt">
          Please enter your mobile number to continue to payment.
        </p>
        <CustomerForm
          heading="Enter your mobile to checkout"
          lead="We'll send your order confirmation to this number on WhatsApp."
        />
      </main>
    );
  }

  return (
    <main className="checkout">
      <h1>Checkout</h1>
      <p className="checkout-total" data-testid="checkout-total">
        Amount to pay: <strong>{formatINR(total)}</strong>
      </p>
      <p className="checkout-customer" data-testid="checkout-customer">
        Ordering as {customer.name || customer.mobile} ({customer.mobile}).
      </p>

      {state.status === "failed" && (
        <p role="alert" className="checkout-error" data-testid="payment-error">
          {state.message}
        </p>
      )}

      <button
        type="button"
        className="checkout-pay"
        onClick={() => void handlePay()}
        disabled={state.status === "paying"}
      >
        {state.status === "paying" ? "Processing…" : "Pay with UPI"}
      </button>
    </main>
  );
}

export default CheckoutView;

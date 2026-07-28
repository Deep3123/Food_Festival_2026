/**
 * CheckoutView — trigger payment with optional reward points redemption.
 *
 * Users can toggle "Use reward points" to apply their available points as a
 * discount (2 points = ₹1). The discounted amount is shown before payment.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClientError, checkout, getWallet } from "../api/client.js";
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
  const { cart, total, clearCart } = useCart();
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });
  const [rewardBalance, setRewardBalance] = useState(0);
  const [useRewards, setUseRewards] = useState(false);

  // Fetch the user's reward points balance
  useEffect(() => {
    if (!customer) return;
    getWallet(customer.mobile)
      .then((w) => setRewardBalance(w.foodCoins))
      .catch(() => setRewardBalance(0));
  }, [customer]);

  // Calculate discount: use all available points, capped at order total
  const maxDiscount = Math.min(rewardBalance * 0.50, total); // 2 points = ₹1
  const pointsToUse = Math.ceil(maxDiscount * 2);
  const discount = useRewards ? maxDiscount : 0;
  const amountToPay = total - discount;

  async function handlePay(): Promise<void> {
    if (!customer) return;
    const stallId = DEMO_STALL_ID;
    setState({ status: "paying" });
    try {
      const result = await checkout({
        stallId,
        customerId: customer.mobile,
        items: toCartItems(cart),
        redeemPoints: useRewards ? pointsToUse : undefined,
      });
      clearCart();
      setState({ status: "success", result, mobile: customer.mobile });
      navigate(ROUTES.orderHistory);
    } catch (err: unknown) {
      let message: string;
      if (err instanceof ApiClientError) {
        if (err.code === "PAYMENT_FAILED") {
          message = "Payment failed. Your cart is safe — please try again.";
        } else if (
          err.code === "INSUFFICIENT_STOCK" ||
          err.code === "ITEM_UNAVAILABLE"
        ) {
          message = err.message;
        } else {
          message = err.message;
        }
      } else {
        message =
          err instanceof Error
            ? err.message
            : "Payment failed. Your cart is safe — please try again.";
      }
      setState({ status: "failed", message });
    }
  }

  if (state.status === "success") {
    const { token, coinsEarned, notified, discount: appliedDiscount } = state.result;
    return (
      <main className="checkout">
        <h1>Payment successful</h1>
        <p className="checkout-token-label">Your order token:</p>
        <p className="checkout-token" data-testid="order-token">
          <strong>{token}</strong>
        </p>
        <p className="checkout-coins">You earned {coinsEarned} reward points!</p>
        {appliedDiscount > 0 && (
          <p className="checkout-discount-applied">
            Discount applied: {formatINR(appliedDiscount)}
          </p>
        )}
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

      <div className="checkout-summary">
        <p className="checkout-total" data-testid="checkout-total">
          Subtotal: <strong>{formatINR(total)}</strong>
        </p>

        {rewardBalance > 0 && (
          <div className="checkout-rewards" data-testid="checkout-rewards">
            <label className="checkout-rewards-toggle">
              <input
                type="checkbox"
                checked={useRewards}
                onChange={(e) => setUseRewards(e.target.checked)}
              />
              <span>
                Use reward points ({rewardBalance} pts = {formatINR(rewardBalance * 0.50)})
              </span>
            </label>
            {useRewards && (
              <p className="checkout-discount">
                Discount: <strong>−{formatINR(discount)}</strong> ({pointsToUse} points)
              </p>
            )}
          </div>
        )}

        {useRewards && (
          <p className="checkout-final-amount">
            Amount to pay: <strong>{formatINR(amountToPay)}</strong>
          </p>
        )}
      </div>

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
        {state.status === "paying"
          ? "Processing…"
          : `Pay ${formatINR(amountToPay)} with UPI`}
      </button>
    </main>
  );
}

export default CheckoutView;

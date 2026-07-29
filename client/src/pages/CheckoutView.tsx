/**
 * CheckoutView — UPI payment with QR code and app intent links.
 *
 * Flow:
 * 1. Shows order summary with optional reward points redemption
 * 2. Shows UPI payment options (QR code + direct app links)
 * 3. User pays via their UPI app, then confirms "I've completed payment"
 * 4. Backend processes the order (mock gateway confirms automatically)
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

/** Replace with your real UPI ID */
const UPI_ID = "yourupi@paytm";
const UPI_NAME = "Invest-a-Bite";

type CheckoutState =
  | { status: "idle" }
  | { status: "upi-pending" }
  | { status: "confirming" }
  | { status: "success"; result: CheckoutResponse; mobile: string }
  | { status: "failed"; message: string };

/** Generate a UPI intent URL */
function buildUpiUrl(amount: number, txnNote: string): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: txnNote,
  });
  return `upi://pay?${params.toString()}`;
}

/** Generate QR code image URL via a free QR API */
function buildQrUrl(upiUrl: string, size = 250): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUrl)}`;
}

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

  // Calculate discount
  const maxDiscount = Math.min(rewardBalance * 0.50, total);
  const pointsToUse = Math.ceil(maxDiscount * 2);
  const discount = useRewards ? maxDiscount : 0;
  const amountToPay = total - discount;

  const upiUrl = buildUpiUrl(amountToPay, `Order at ${UPI_NAME}`);
  const qrImageUrl = buildQrUrl(upiUrl);

  function handleProceedToPayment(): void {
    setState({ status: "upi-pending" });
  }

  async function handleConfirmPayment(): Promise<void> {
    if (!customer) return;
    setState({ status: "confirming" });
    try {
      const result = await checkout({
        stallId: DEMO_STALL_ID,
        customerId: customer.mobile,
        items: toCartItems(cart),
        redeemPoints: useRewards ? pointsToUse : undefined,
      });
      clearCart();
      setState({ status: "success", result, mobile: customer.mobile });
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

  // --- SUCCESS STATE ---
  if (state.status === "success") {
    const { token, coinsEarned, notified, discount: appliedDiscount } = state.result;
    return (
      <main className="checkout">
        <div className="checkout-success-card">
          <div className="checkout-success-icon">✅</div>
          <h1>Payment Successful!</h1>
          <p className="checkout-token-label">Your order token:</p>
          <p className="checkout-token" data-testid="order-token">
            <strong>{token}</strong>
          </p>
          <p className="checkout-coins">+{coinsEarned} reward points earned!</p>
          {appliedDiscount > 0 && (
            <p className="checkout-discount-applied">
              Discount applied: {formatINR(appliedDiscount)}
            </p>
          )}
          {notified && (
            <p className="checkout-notified" data-testid="checkout-notified">
              Confirmation sent to {state.mobile} on WhatsApp.
            </p>
          )}
          <div className="checkout-success-actions">
            <Link className="checkout-track-link" to={orderPath(token)}>
              Track Order
            </Link>
            <button type="button" onClick={() => navigate(ROUTES.orderHistory)}>
              View All Orders
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- EMPTY CART ---
  if (cart.length === 0) {
    return (
      <main className="checkout">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link to={ROUTES.marketplace}>Browse the marketplace</Link>
      </main>
    );
  }

  // --- NO CUSTOMER ---
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

  // --- UPI PAYMENT SCREEN ---
  if (state.status === "upi-pending" || state.status === "confirming") {
    return (
      <main className="checkout">
        <h1>Complete Payment</h1>

        <div className="upi-payment-card">
          <div className="upi-amount-display">
            <span className="upi-amount-label">Amount to Pay</span>
            <span className="upi-amount-value">{formatINR(amountToPay)}</span>
          </div>

          <div className="upi-qr-section">
            <p className="upi-qr-title">Scan QR Code</p>
            <img
              className="upi-qr-image"
              src={qrImageUrl}
              alt={`UPI QR code for ${formatINR(amountToPay)}`}
              width={220}
              height={220}
            />
            <p className="upi-qr-hint">Open any UPI app and scan this code</p>
          </div>

          <div className="upi-divider">
            <span>OR</span>
          </div>

          <div className="upi-apps-section">
            <p className="upi-apps-title">Pay using UPI App</p>
            <div className="upi-apps-grid">
              <a href={upiUrl} className="upi-app-btn upi-app-gpay">
                <span className="upi-app-icon">G</span>
                <span>Google Pay</span>
              </a>
              <a href={upiUrl} className="upi-app-btn upi-app-phonepe">
                <span className="upi-app-icon">P</span>
                <span>PhonePe</span>
              </a>
              <a href={upiUrl} className="upi-app-btn upi-app-paytm">
                <span className="upi-app-icon">₹</span>
                <span>Paytm</span>
              </a>
              <a href={upiUrl} className="upi-app-btn upi-app-generic">
                <span className="upi-app-icon">⋯</span>
                <span>Other UPI</span>
              </a>
            </div>
          </div>

          <div className="upi-confirm-section">
            {state.status === "confirming" ? (
              <button type="button" disabled className="upi-confirm-btn">
                Verifying payment…
              </button>
            ) : (
              <button
                type="button"
                className="upi-confirm-btn"
                onClick={() => void handleConfirmPayment()}
              >
                ✓ I've Completed the Payment
              </button>
            )}
            <button
              type="button"
              className="upi-cancel-btn"
              onClick={() => setState({ status: "idle" })}
              disabled={state.status === "confirming"}
            >
              ← Go Back
            </button>
          </div>
        </div>

        {state.status === "failed" && (
          <p role="alert" className="checkout-error" data-testid="payment-error">
            Payment verification failed. Please try again.
          </p>
        )}
      </main>
    );
  }

  // --- DEFAULT: ORDER SUMMARY ---
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
        onClick={handleProceedToPayment}
      >
        Pay {formatINR(amountToPay)} with UPI
      </button>
    </main>
  );
}

export default CheckoutView;

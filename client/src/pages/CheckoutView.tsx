/**
 * CheckoutView — UPI payment with QR code + admin approval flow.
 *
 * Flow:
 * 1. User sees order summary, clicks "Pay with UPI"
 * 2. Order is created, user sees QR/app links + "Waiting for admin verification"
 * 3. Admin verifies payment received, advances the order
 * 4. User's polling detects status change → shows success → redirects to home
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClientError, checkout, getOrder, getWallet, getPaymentConfig, suggestCoupons, applyCoupon, markCouponUsed } from "../api/client.js";
import type { CheckoutResponse, OrderResponse, CouponResponse, PaymentConfig } from "../api/client.js";
import { useCart } from "../cart/CartContext.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { toCartItems, cartLineTotal } from "../cart/cart.js";
import { ROUTES } from "../routes.js";
import { formatINR } from "../format.js";
import { DEMO_STALL_ID } from "../demo.js";
import { CustomerForm } from "./ProfileView.js";

/** Fallback UPI details if config fetch fails */
const DEFAULT_UPI_ID = "deepp3123-3@okicici";
const DEFAULT_UPI_NAME = "Invest-a-Bite";

type CheckoutState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "waiting-approval"; token: string; coinsEarned: number; amount: number }
  | { status: "approved"; token: string; coinsEarned: number }
  | { status: "failed"; message: string };

/** Generate a UPI intent URL */
function buildUpiUrl(upiId: string, upiName: string, amount: number, txnNote: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: upiName, am: amount.toFixed(2), cu: "INR", tn: txnNote });
  return `upi://pay?${params.toString()}`;
}
function buildGPayUrl(upiId: string, upiName: string, amount: number, txnNote: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: upiName, am: amount.toFixed(2), cu: "INR", tn: txnNote });
  return `tez://upi/pay?${params.toString()}`;
}
function buildPhonePeUrl(upiId: string, upiName: string, amount: number, txnNote: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: upiName, am: amount.toFixed(2), cu: "INR", tn: txnNote });
  return `phonepe://pay?${params.toString()}`;
}
function buildPaytmUrl(upiId: string, upiName: string, amount: number, txnNote: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: upiName, am: amount.toFixed(2), cu: "INR", tn: txnNote });
  return `paytmmp://pay?${params.toString()}`;
}
function buildQrUrl(upiUrl: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUrl)}`;
}

export function CheckoutView(): JSX.Element {
  const { cart, total, clearCart, increment, decrement, removeItem, clampedItemId } = useCart();
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });
  const [rewardBalance, setRewardBalance] = useState(0);
  const [useRewards, setUseRewards] = useState(false);
  const [payConfig, setPayConfig] = useState<PaymentConfig>({ upiId: DEFAULT_UPI_ID, upiName: DEFAULT_UPI_NAME });
  const [suggestedCoupons, setSuggestedCoupons] = useState<CouponResponse[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");

  // Fetch payment config
  useEffect(() => {
    getPaymentConfig().then(setPayConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!customer) return;
    getWallet(customer.mobile)
      .then((w) => setRewardBalance(w.foodCoins))
      .catch(() => setRewardBalance(0));
  }, [customer]);

  const maxDiscount = Math.min(rewardBalance * 0.50, total);
  const pointsToUse = Math.ceil(maxDiscount * 2);
  const discount = useRewards ? maxDiscount : 0;
  const amountToPay = Math.max(0, total - discount - couponDiscount);

  // Suggest coupons when total changes
  useEffect(() => {
    if (total > 0) {
      suggestCoupons(total, customer?.mobile).then(setSuggestedCoupons).catch(() => setSuggestedCoupons([]));
    }
  }, [total, customer]);

  async function handleApplyCoupon(): Promise<void> {
    if (!couponCode) return;
    setCouponError("");
    try {
      const result = await applyCoupon(couponCode, total - discount, customer?.mobile);
      setCouponDiscount(result.discount);
    } catch (err: unknown) {
      setCouponDiscount(0);
      setCouponError(err instanceof ApiClientError ? err.message : "Invalid coupon");
    }
  }

  const upiId = payConfig.upiId;
  const upiName = payConfig.upiName;
  const upiUrl = buildUpiUrl(upiId, upiName, amountToPay, `Order at ${upiName}`);
  const gpayUrl = buildGPayUrl(upiId, upiName, amountToPay, `Order at ${upiName}`);
  const phonePeUrl = buildPhonePeUrl(upiId, upiName, amountToPay, `Order at ${upiName}`);
  const paytmUrl = buildPaytmUrl(upiId, upiName, amountToPay, `Order at ${upiName}`);
  const qrImageUrl = buildQrUrl(upiUrl);

  // Place the order and move to "waiting" state
  async function handlePayWithUPI(): Promise<void> {
    if (!customer) return;
    const paidAmount = amountToPay;
    setState({ status: "processing" });
    try {
      const result = await checkout({
        stallId: DEMO_STALL_ID,
        customerId: customer.mobile,
        items: toCartItems(cart),
        redeemPoints: useRewards ? pointsToUse : undefined,
      });
      // Mark coupon as used for this customer
      if (couponCode && couponDiscount > 0) {
        markCouponUsed(couponCode, customer.mobile).catch(() => {});
      }
      setState({ status: "waiting-approval", token: result.token, coinsEarned: result.coinsEarned, amount: paidAmount });
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setState({ status: "failed", message });
    }
  }

  // Poll for admin approval (status change from "Craving Funded")
  const pollForApproval = useCallback(async (token: string) => {
    try {
      const order: OrderResponse = await getOrder(token);
      if (order.status !== "Craving Funded") {
        return true; // approved!
      }
    } catch { /* ignore polling errors */ }
    return false;
  }, []);

  useEffect(() => {
    if (state.status !== "waiting-approval") return;
    const { token, coinsEarned } = state;
    let cancelled = false;

    const interval = setInterval(async () => {
      const approved = await pollForApproval(token);
      if (approved && !cancelled) {
        clearCart();
        setState({ status: "approved", token, coinsEarned });
      }
    }, 3000); // poll every 3 seconds

    return () => { cancelled = true; clearInterval(interval); };
  }, [state, pollForApproval]);

  // Auto-redirect after approval
  useEffect(() => {
    if (state.status !== "approved") return;
    const timer = setTimeout(() => navigate(ROUTES.home), 4000);
    return () => clearTimeout(timer);
  }, [state.status, navigate]);

  // --- APPROVED STATE ---
  if (state.status === "approved") {
    return (
      <main className="checkout">
        <div className="checkout-success-card">
          <div className="checkout-success-icon">🎉</div>
          <h1>Payment Successful!</h1>
          <p className="checkout-success-msg">
            Your payment has been verified. Your order is being prepared and will be delivered to you shortly!
          </p>
          <p className="checkout-token" data-testid="order-token">
            Order Token: <strong>{state.token}</strong>
          </p>
          <p className="checkout-coins">🪙 +{state.coinsEarned} reward points earned!</p>
          <p className="checkout-redirect-notice">Redirecting to home in a few seconds…</p>
          <div className="checkout-success-actions">
            <button type="button" onClick={() => navigate(ROUTES.home)}>
              Go to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- WAITING FOR ADMIN APPROVAL ---
  if (state.status === "waiting-approval") {
    const paidAmount = state.amount;
    const paidUpiUrl = buildUpiUrl(upiId, upiName, paidAmount, `Order at ${upiName}`);
    const paidGpayUrl = buildGPayUrl(upiId, upiName, paidAmount, `Order at ${upiName}`);
    const paidPhonePeUrl = buildPhonePeUrl(upiId, upiName, paidAmount, `Order at ${upiName}`);
    const paidPaytmUrl = buildPaytmUrl(upiId, upiName, paidAmount, `Order at ${upiName}`);
    const paidQrUrl = buildQrUrl(paidUpiUrl);

    return (
      <main className="checkout">
        <h1>Complete Payment</h1>

        <div className="upi-payment-card">
          <div className="upi-amount-display">
            <span className="upi-amount-label">Amount to Pay</span>
            <span className="upi-amount-value">{formatINR(paidAmount)}</span>
          </div>

          <div className="upi-qr-section">
            <p className="upi-qr-title">Scan QR Code</p>
            <img className="upi-qr-image" src={paidQrUrl} alt={`UPI QR code for ${formatINR(paidAmount)}`} width={220} height={220} />
            <p className="upi-qr-hint">Open any UPI app and scan this code</p>
          </div>

          <div className="upi-divider"><span>OR</span></div>

          <div className="upi-apps-section">
            <p className="upi-apps-title">Pay using UPI App</p>
            <div className="upi-apps-grid">
              <a href={paidGpayUrl} className="upi-app-btn upi-app-gpay">
                <span className="upi-app-icon">G</span><span>Google Pay</span>
              </a>
              <a href={paidPhonePeUrl} className="upi-app-btn upi-app-phonepe">
                <span className="upi-app-icon">P</span><span>PhonePe</span>
              </a>
              <a href={paidPaytmUrl} className="upi-app-btn upi-app-paytm">
                <span className="upi-app-icon">₹</span><span>Paytm</span>
              </a>
              <a href={paidUpiUrl} className="upi-app-btn upi-app-generic">
                <span className="upi-app-icon">⋯</span><span>Other UPI</span>
              </a>
            </div>
          </div>

          <div className="upi-waiting-section">
            <div className="upi-waiting-spinner"></div>
            <p className="upi-waiting-text">Waiting for payment verification by admin…</p>
            <p className="upi-waiting-hint">Pay using the QR code or app links above. The admin will verify your payment.</p>
          </div>
        </div>
      </main>
    );
  }

  // --- EMPTY CART ---
  if (cart.length === 0 && state.status === "idle") {
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

  // --- DEFAULT: ORDER SUMMARY ---
  return (
    <main className="checkout">
      <h1>Cart & Checkout</h1>

      <ul className="cart-lines">
        {cart.map((line) => (
          <li key={line.itemId} className="cart-line">
            <span className="cart-line-name">{line.name}</span>
            <span className="cart-line-unit-price">{formatINR(line.unitPrice)}</span>
            <span className="cart-line-quantity-controls">
              <button type="button" onClick={() => decrement(line.itemId)} disabled={line.quantity <= 1}>−</button>
              <span className="cart-line-quantity">{line.quantity}</span>
              <button type="button" onClick={() => increment(line.itemId)}>+</button>
            </span>
            <span className="cart-line-total">{formatINR(cartLineTotal(line))}</span>
            <button type="button" className="cart-line-remove" onClick={() => removeItem(line.itemId)}>Remove</button>
            {clampedItemId === line.itemId && (
              <p role="alert" className="cart-line-notice">Only {line.availableQuantity} available.</p>
            )}
          </li>
        ))}
      </ul>

      <div className="checkout-summary">
        <p className="checkout-total" data-testid="checkout-total">
          Subtotal: <strong>{formatINR(total)}</strong>
        </p>

        {rewardBalance > 0 && (
          <div className="checkout-rewards" data-testid="checkout-rewards">
            <label className="checkout-rewards-toggle">
              <input type="checkbox" checked={useRewards} onChange={(e) => setUseRewards(e.target.checked)} />
              <span>Use reward points ({rewardBalance} pts = {formatINR(rewardBalance * 0.50)})</span>
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

        <div className="checkout-coupon">
          <div className="checkout-coupon-input">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
            />
            <button type="button" onClick={() => void handleApplyCoupon()}>Apply</button>
          </div>
          {couponError && <p className="checkout-coupon-error">{couponError}</p>}
          {couponDiscount > 0 && <p className="checkout-coupon-applied">Coupon applied: −{formatINR(couponDiscount)}</p>}
          {suggestedCoupons.length > 0 && couponDiscount === 0 && (
            <div className="checkout-coupon-suggestions">
              {suggestedCoupons.map((c) => (
                <span key={c.code} className="checkout-coupon-tag" onClick={() => setCouponCode(c.code)}>
                  {c.code} ({c.type === "percent" ? `${c.value}%` : `₹${c.value}`} off)
                </span>
              ))}
            </div>
          )}
        </div>
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
        onClick={() => void handlePayWithUPI()}
        disabled={state.status === "processing"}
      >
        {state.status === "processing" ? "Placing order…" : `Pay ${formatINR(amountToPay)} with UPI`}
      </button>
    </main>
  );
}

export default CheckoutView;

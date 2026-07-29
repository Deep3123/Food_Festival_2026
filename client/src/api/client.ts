/**
 * Typed API client for the ByteBites backend.
 *
 * Thin wrappers over `fetch` for each Express endpoint (see the design's API
 * Endpoints table). The client is server-authoritative: it sends inputs and
 * renders whatever state the server returns. The base URL defaults to "/api"
 * (same-origin, proxied in dev) but is configurable via `configureApiBaseUrl`
 * for tests or alternate deployments.
 *
 * All functions return parsed JSON on success and throw `ApiClientError` on a
 * non-2xx response, surfacing the server's consistent `{ error, code }` shape.
 */

import type {
  CartItem,
  Customer,
  FoodItem,
  Metrics,
  Preferences,
  RecommendedItem,
  Referral,
  TrendingEntry,
  Wallet,
  OrderStatus,
  SpinReward,
} from "../../../types/index.js";

// --- Base URL configuration ------------------------------------------------

let baseUrl = "/api";

/** Override the API base URL (e.g. in tests or non-same-origin deployments). */
export function configureApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, "");
}

/** The currently configured API base URL. */
export function getApiBaseUrl(): string {
  return baseUrl;
}

// --- Error type ------------------------------------------------------------

/** Error thrown for non-2xx responses, carrying the server error payload. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

// --- Response payload shapes ----------------------------------------------

export interface CheckoutRequest {
  stallId: string;
  customerId: string;
  items: CartItem[];
  /** Number of reward points to redeem (optional). 2 points = ₹1 discount. */
  redeemPoints?: number;
}

export interface CheckoutResponse {
  token: string;
  status: OrderStatus;
  coinsEarned: number;
  spinAvailable: boolean;
  total: number;
  /** Discount applied from redeemed reward points (in rupees). */
  discount: number;
  /** Whether the WhatsApp order-confirmation notification was sent. */
  notified: boolean;
}

/** Request body for registering/upserting a customer. */
export interface CustomerRequest {
  mobile: string;
  name: string;
  email?: string;
}

export interface OrderResponse {
  token: string;
  stallId: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  paid: boolean;
  paymentMethod: "UPI" | "other";
  gatewayRef?: string;
  customerId: string;
  createdAt: string;
  spinUsed: boolean;
  spinReward?: SpinReward;
}

export interface RedeemResponse extends Wallet {}

export interface ReferralClaimRequest {
  referrerId: string;
  referredId: string;
}

export interface ReferralClaimResponse {
  referrerId: string;
  referredId: string;
  credited: number;
  alreadyCredited: boolean;
  balance: number;
}

export interface RecommendResponse {
  items: RecommendedItem[];
  exactMatch: boolean;
}

export interface SpinResponse {
  token: string;
  reward: SpinReward;
  spinUsed: boolean;
  balance: number;
}

// --- Core request helper ---------------------------------------------------

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText;
    let code = "HTTP_ERROR";
    try {
      const body = (await response.json()) as {
        error?: string;
        code?: string;
      };
      if (typeof body.error === "string") message = body.error;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiClientError(response.status, message, code);
  }

  // 204 No Content or empty body guard.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

// --- Endpoint functions ----------------------------------------------------

/** GET /api/stalls/:stallId/menu — items for a stall (throws 404 if unknown). */
export function getMenu(stallId: string): Promise<FoodItem[]> {
  return request<FoodItem[]>(
    `/stalls/${encodeURIComponent(stallId)}/menu`
  );
}

/** GET /api/menu — all food items across all stalls. */
export function getAllItems(): Promise<FoodItem[]> {
  return request<FoodItem[]>("/menu");
}

/** POST /api/checkout — initiate payment and create an order on success. */
export function checkout(req: CheckoutRequest): Promise<CheckoutResponse> {
  return postJson<CheckoutResponse>("/checkout", req);
}

/**
 * POST /api/customers — register/upsert a customer keyed by mobile number.
 * Returns the saved customer. An invalid mobile throws `ApiClientError` with
 * code `INVALID_MOBILE`.
 */
export function registerCustomer(req: CustomerRequest): Promise<Customer> {
  return postJson<Customer>("/customers", req);
}

/**
 * GET /api/customers/:mobile — fetch a customer by mobile number. Throws
 * `ApiClientError` with code `CUSTOMER_NOT_FOUND` for an unknown mobile.
 */
export function getCustomer(mobile: string): Promise<Customer> {
  return request<Customer>(`/customers/${encodeURIComponent(mobile)}`);
}

/**
 * GET /api/admin/orders — list all orders for the seller/admin view,
 * most-recent first. Optionally filtered to a single stall via `stallId`.
 */
export function getAdminOrders(stallId?: string): Promise<OrderResponse[]> {
  const query = stallId ? `?stallId=${encodeURIComponent(stallId)}` : "";
  return request<OrderResponse[]>(`/admin/orders${query}`);
}

/** GET /api/admin/items — list all food items for stock management. */
export function getAdminItems(): Promise<FoodItem[]> {
  return request<FoodItem[]>("/admin/items");
}

/** PATCH /api/admin/items/:itemId/stock — update item stock level. */
export function updateItemStock(
  itemId: string,
  availableQuantity: number
): Promise<FoodItem> {
  return request<FoodItem>(
    `/admin/items/${encodeURIComponent(itemId)}/stock`,
    { method: "PATCH", body: JSON.stringify({ availableQuantity }) }
  );
}

/** GET /api/admin/orders/:token — a single order for the admin view. */
export function getAdminOrder(token: string): Promise<OrderResponse> {
  return request<OrderResponse>(`/admin/orders/${encodeURIComponent(token)}`);
}

/** GET /api/orders/:token — current order state for tracking. */
export function getOrder(token: string): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/${encodeURIComponent(token)}`);
}

/** GET /api/customers/:mobile/orders — all orders for a customer, most-recent first. */
export function getCustomerOrders(mobile: string): Promise<OrderResponse[]> {
  return request<OrderResponse[]>(
    `/customers/${encodeURIComponent(mobile)}/orders`
  );
}

/** POST /api/orders/:token/advance — operator advances the order status. */
export function advanceOrder(token: string): Promise<OrderResponse> {
  return postJson<OrderResponse>(
    `/orders/${encodeURIComponent(token)}/advance`,
    {}
  );
}

/** GET /api/metrics — current day's startup metrics. */
export function getMetrics(): Promise<Metrics> {
  return request<Metrics>("/metrics");
}

/** GET /api/trending — items ranked by units ordered today. */
export function getTrending(): Promise<TrendingEntry[]> {
  return request<TrendingEntry[]>("/trending");
}

/** POST /api/ai-chef/recommend — recommendations from preference inputs. */
export function recommend(
  prefs: Preferences & { stallId?: string }
): Promise<RecommendResponse> {
  return postJson<RecommendResponse>("/ai-chef/recommend", prefs);
}

/** GET /api/wallet/:customerId — FoodCoins balance. */
export function getWallet(customerId: string): Promise<Wallet> {
  return request<Wallet>(`/wallet/${encodeURIComponent(customerId)}`);
}

/** POST /api/wallet/:customerId/redeem — redeem FoodCoins. */
export function redeem(
  customerId: string,
  amount: number
): Promise<RedeemResponse> {
  return postJson<RedeemResponse>(
    `/wallet/${encodeURIComponent(customerId)}/redeem`,
    { amount }
  );
}

/** GET /api/referral/:customerId — referral link for the customer. */
export function getReferral(customerId: string): Promise<Referral> {
  return request<Referral>(`/referral/${encodeURIComponent(customerId)}`);
}

/** POST /api/referral/claim — credit the referrer on a referred first order. */
export function claimReferral(
  req: ReferralClaimRequest
): Promise<ReferralClaimResponse> {
  return postJson<ReferralClaimResponse>("/referral/claim", req);
}

/** POST /api/orders/:token/spin — perform the single spin for a paid order. */
export function spin(token: string): Promise<SpinResponse> {
  return postJson<SpinResponse>(
    `/orders/${encodeURIComponent(token)}/spin`,
    {}
  );
}

// --- Admin item CRUD -------------------------------------------------------

/** POST /api/admin/items — create a new food item. */
export function createAdminItem(item: Partial<FoodItem>): Promise<FoodItem> {
  return postJson<FoodItem>("/admin/items", item);
}

/** PUT /api/admin/items/:itemId — update a food item. */
export function updateAdminItem(itemId: string, item: Partial<FoodItem>): Promise<FoodItem> {
  return request<FoodItem>(`/admin/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

/** DELETE /api/admin/items/:itemId — remove a food item. */
export function deleteAdminItem(itemId: string): Promise<void> {
  return request<void>(`/admin/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

// --- Coupon management -----------------------------------------------------

export interface CouponResponse {
  code: string;
  type: "percent" | "flat";
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  active: boolean;
}

export interface CouponApplyResponse {
  coupon: CouponResponse;
  discount: number;
  finalTotal: number;
}

/** GET /api/admin/coupons — list all coupons. */
export function getAdminCoupons(): Promise<CouponResponse[]> {
  return request<CouponResponse[]>("/admin/coupons");
}

/** POST /api/admin/coupons — create a coupon. */
export function createCoupon(coupon: Partial<CouponResponse>): Promise<CouponResponse> {
  return postJson<CouponResponse>("/admin/coupons", coupon);
}

/** DELETE /api/admin/coupons/:code — delete a coupon. */
export function deleteCoupon(code: string): Promise<void> {
  return request<void>(`/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
}

/** GET /api/coupons/suggest?total=X — get applicable coupons for an order total. */
export function suggestCoupons(total: number): Promise<CouponResponse[]> {
  return request<CouponResponse[]>(`/coupons/suggest?total=${total}`);
}

/** POST /api/coupons/apply — validate and apply a coupon code. */
export function applyCoupon(code: string, total: number): Promise<CouponApplyResponse> {
  return postJson<CouponApplyResponse>("/coupons/apply", { code, total });
}

// --- Admin config ----------------------------------------------------------

export interface PaymentConfig {
  upiId: string;
  upiName: string;
}

/** GET /api/admin/config — get admin configuration. */
export function getAdminConfig(): Promise<PaymentConfig> {
  return request<PaymentConfig>("/admin/config");
}

/** PUT /api/admin/config — update admin configuration. */
export function updateAdminConfig(config: Partial<PaymentConfig>): Promise<PaymentConfig> {
  return request<PaymentConfig>("/admin/config", { method: "PUT", body: JSON.stringify(config) });
}

/** GET /api/config/payment — public endpoint to get UPI config for checkout. */
export function getPaymentConfig(): Promise<PaymentConfig> {
  return request<PaymentConfig>("/config/payment");
}

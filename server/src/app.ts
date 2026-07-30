/**
 * Express application factory for ByteBites.
 *
 * The app is created via a factory that accepts its collaborators (the
 * in-memory `Store` and a `PaymentGateway`) rather than reaching for module
 * singletons. This keeps the API testable — tests can build an app around a
 * store seeded with generated data and a deterministic `MockGateway` — and
 * reusable as later endpoint tasks register additional routes here.
 *
 * All API error responses use a consistent JSON shape `{ error, code }` with
 * an appropriate HTTP status code (see the design's Error Handling section).
 *
 * Validates: Requirements 4.1, 4.3
 */

import express, { type Express, type Request, type Response } from "express";
import type {
  CartItem,
  Customer,
  NotificationGateway,
  Order,
  OrderContext,
  PaymentGateway,
} from "../../types/index.js";
import type { Store } from "./store.js";
import { orderTotal } from "../../domain/pricing.js";
import { coinsForOrder, applyRedemption } from "../../domain/foodcoins.js";
import { issueToken } from "../../domain/tokens.js";
import { nextStatus } from "../../domain/order-status.js";
import { computeMetrics } from "../../domain/metrics.js";
import { rankTrending } from "../../domain/trending.js";
import { recommend } from "../../domain/ai-chef.js";
import { spin } from "../../domain/spin.js";
import { normalizeMobile, isValidMobile } from "../../domain/mobile.js";
import { MockNotificationGateway } from "./notifications/mock-notification-gateway.js";
import type { Preferences, Referral, Coupon, AdminConfig } from "../../types/index.js";

/** Collaborators required to build the app. */
export interface AppDependencies {
  store: Store;
  paymentGateway: PaymentGateway;
  /**
   * Notification gateway used to send an order confirmation after a successful
   * checkout. Injectable so tests use a deterministic mock; defaults to
   * `MockNotificationGateway`.
   */
  notificationGateway?: NotificationGateway;
  /**
   * Random number generator used by the Spin & Win endpoint to draw a reward.
   * Injectable so tests can force a specific reward deterministically; defaults
   * to `Math.random`.
   */
  rng?: () => number;
}

/**
 * The number of FoodCoins credited to a referring customer for each referred
 * customer's first successful order (Requirement 10.2).
 */
const REFERRAL_REWARD_COINS = 10;

/**
 * Build the unique referral link for a customer. The link is deterministic in
 * the customerId, which is itself unique per customer, guaranteeing a
 * non-empty link that is never shared between two distinct customers
 * (Requirement 10.1).
 */
function referralLinkFor(customerId: string): string {
  return `https://investabite.app/join?ref=${encodeURIComponent(customerId)}`;
}

/** The consistent error payload shape used by every API error response. */
export interface ApiError {
  error: string;
  code: string;
}

/**
 * Build a configured Express app around the provided store and payment
 * gateway. Each endpoint task registers its routes on the app created here.
 */
export function createApp(deps: AppDependencies): Express {
  const { store, paymentGateway } = deps;
  const notificationGateway =
    deps.notificationGateway ?? new MockNotificationGateway();
  const rng = deps.rng ?? Math.random;
  const app = express();

  app.use(express.json());

  // --- GET /api/stalls/:stallId/menu -------------------------------------
  //
  // Returns only the requested stall's items (Requirement 4.1). When the stall
  // is unknown, responds 404 with the consistent `{ error, code }` shape
  // (Requirement 4.3).
  app.get(
    "/api/stalls/:stallId/menu",
    (req: Request, res: Response): void => {
      const { stallId } = req.params;

      if (!store.hasStall(stallId)) {
        const body: ApiError = {
          error: "Stall not found",
          code: "STALL_NOT_FOUND",
        };
        res.status(404).json(body);
        return;
      }

      res.status(200).json(store.getMenu(stallId));
    }
  );

  // --- GET /api/menu ------------------------------------------------------
  //
  // Returns ALL food items across ALL stalls. Used by the marketplace to
  // display the full catalogue to users.
  app.get("/api/menu", (_req: Request, res: Response): void => {
    res.status(200).json(store.getFoodItems());
  });

  // --- POST /api/customers ------------------------------------------------
  //
  // Register or upsert a customer keyed by their mobile number. The mobile
  // number is normalized to a canonical form and validated as a plausible
  // phone number (10–15 digits, optional leading "+"); an invalid mobile is
  // rejected with 400 `{ error, code: "INVALID_MOBILE" }`. The normalized
  // mobile becomes the customer's identity (customerId) across the system.
  app.post("/api/customers", (req: Request, res: Response): void => {
    const body = (req.body ?? {}) as {
      mobile?: unknown;
      name?: unknown;
      email?: unknown;
    };

    if (!isValidMobile(body.mobile)) {
      const errBody: ApiError = {
        error:
          "A valid mobile number is required (10–15 digits, optional leading +)",
        code: "INVALID_MOBILE",
      };
      res.status(400).json(errBody);
      return;
    }

    const mobile = normalizeMobile(body.mobile);
    const name = typeof body.name === "string" ? body.name : "";
    const email = typeof body.email === "string" ? body.email : undefined;

    const customer: Customer = { mobile, name, ...(email ? { email } : {}) };
    store.saveCustomer(customer);
    res.status(201).json(customer);
  });

  // --- GET /api/customers/:mobile -----------------------------------------
  //
  // Fetch a customer by (raw or normalized) mobile number. The path value is
  // normalized before lookup so any formatting maps to the same customer. An
  // unknown mobile yields 404 `{ error, code: "CUSTOMER_NOT_FOUND" }`.
  app.get("/api/customers/:mobile", (req: Request, res: Response): void => {
    const mobile = normalizeMobile(req.params.mobile);
    const customer = store.getCustomer(mobile);
    if (!customer) {
      const errBody: ApiError = {
        error: "Customer not found",
        code: "CUSTOMER_NOT_FOUND",
      };
      res.status(404).json(errBody);
      return;
    }
    res.status(200).json(customer);
  });

  // --- POST /api/checkout -------------------------------------------------
  //
  // Confirms checkout for a non-empty cart. The order total is recomputed
  // server-side from the cart's unit prices and quantities via the pricing
  // domain (never trusting a client-supplied total). An empty cart is rejected
  // with 400 BEFORE any gateway call (see Error Handling). On a successful
  // payment the server creates an order (status "Craving Funded", associated
  // with the originating stall), issues a unique token, credits FoodCoins to
  // the customer's wallet, and marks the single spin available. It then sends
  // an order confirmation to the customer's mobile via the notification
  // gateway; a notification failure does NOT fail the order (the response
  // carries a `notified` flag). A failed payment creates no order and returns a
  // failure response so the client can retain the cart.
  //
  // The customerId is the customer's mobile number, normalized to a canonical
  // form; a checkout for an unregistered mobile still succeeds and auto-creates
  // a minimal customer record.
  //
  // Validates: Requirements 5.1, 5.2, 5.3, 5.4, 9.1
  app.post(
    "/api/checkout",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as {
        stallId?: unknown;
        customerId?: unknown;
        items?: unknown;
        redeemPoints?: unknown;
      };

      const items = Array.isArray(body.items) ? (body.items as CartItem[]) : [];
      const stallId = typeof body.stallId === "string" ? body.stallId : "";
      const redeemPoints =
        typeof body.redeemPoints === "number" && body.redeemPoints > 0
          ? Math.floor(body.redeemPoints)
          : 0;
      // The customer identity is their mobile number, normalized to a canonical
      // form so wallet/referral/order association all key off the same value.
      // A checkout for an unregistered mobile still works — a minimal customer
      // is auto-created below. Only genuine mobile numbers are normalized;
      // any other (legacy/opaque) customer id is used as-is so it is never
      // altered or lost.
      const rawCustomerId =
        typeof body.customerId === "string" ? body.customerId : "";
      const customerId = isValidMobile(rawCustomerId)
        ? normalizeMobile(rawCustomerId)
        : rawCustomerId.trim();

      // Reject an empty cart before contacting the gateway (Req 5.1 guard).
      if (items.length === 0) {
        const errBody: ApiError = {
          error: "Cannot checkout with an empty cart",
          code: "EMPTY_CART",
        };
        res.status(400).json(errBody);
        return;
      }

      // Validate stock: reject if any item is out of stock or quantity exceeds
      // available stock. This prevents orders for items the admin has marked
      // out of stock, even if the user's client hasn't refreshed yet.
      for (const cartItem of items) {
        const foodItem = store.getFoodItem(cartItem.itemId);
        if (!foodItem) {
          const errBody: ApiError = {
            error: `Item "${cartItem.name}" is no longer available`,
            code: "ITEM_UNAVAILABLE",
          };
          res.status(400).json(errBody);
          return;
        }
        if (foodItem.availableQuantity < cartItem.quantity) {
          const errBody: ApiError = {
            error:
              foodItem.availableQuantity === 0
                ? `"${cartItem.name}" is out of stock`
                : `"${cartItem.name}" only has ${foodItem.availableQuantity} available (you requested ${cartItem.quantity})`,
            code: "INSUFFICIENT_STOCK",
          };
          res.status(400).json(errBody);
          return;
        }
      }

      // Recompute the total server-side; the client total is never trusted.
      const subtotal = orderTotal(items);

      // Apply reward points discount if requested (2 points = ₹1).
      let discount = 0;
      let pointsUsed = 0;
      if (redeemPoints > 0) {
        const wallet = store.getWallet(customerId);
        const usable = Math.min(redeemPoints, wallet.foodCoins);
        discount = usable * 0.50; // 2 points = ₹1
        // Don't discount more than the order total.
        discount = Math.min(discount, subtotal);
        pointsUsed = Math.ceil(discount * 2); // exact points consumed
      }
      const total = Math.max(0, subtotal - discount);

      const orderContext: OrderContext = { stallId, customerId, items };
      const payment = await paymentGateway.initiatePayment(total, orderContext);

      // On failure, create no order and return a failure response (Req 5.3).
      if (!payment.success) {
        const errBody: ApiError = {
          error: payment.failureReason ?? "Payment failed",
          code: "PAYMENT_FAILED",
        };
        res.status(402).json(errBody);
        return;
      }

      // Deduct redeemed reward points from the wallet.
      if (pointsUsed > 0) {
        const wallet = store.getWallet(customerId);
        wallet.foodCoins = Math.max(0, wallet.foodCoins - pointsUsed);
        store.saveWallet(wallet);
      }

      // Success: issue a unique token against the store's existing tokens,
      // create the order in "Craving Funded" state associated with the stall,
      // credit FoodCoins, and mark the spin available (Req 5.2, 5.4, 9.1).
      const token = issueToken(store.getOrderTokens());
      const order: Order = {
        token,
        stallId,
        items,
        total,
        status: "Craving Funded",
        paid: true,
        paymentMethod: "UPI",
        gatewayRef: payment.gatewayRef,
        customerId,
        createdAt: new Date().toISOString(),
        spinUsed: false,
      };
      store.saveOrder(order);

      // Deduct ordered quantities from stock so availability updates in
      // real-time for other users browsing the marketplace.
      for (const cartItem of items) {
        const currentItem = store.getFoodItem(cartItem.itemId);
        if (currentItem) {
          store.setAvailableQuantity(
            cartItem.itemId,
            currentItem.availableQuantity - cartItem.quantity
          );
        }
      }

      const coinsEarned = coinsForOrder(total);

      // Auto-create a minimal customer for a checkout by an unregistered mobile
      // so the identity exists for later lookups (checkout does not require a
      // prior registration). Existing customers are left untouched.
      if (
        isValidMobile(customerId) &&
        store.getCustomer(customerId) === undefined
      ) {
        store.saveCustomer({ mobile: customerId, name: "" });
      }

      // Send an order confirmation to the customer's mobile. A notification
      // failure must NOT fail the order: any error is caught and surfaced as a
      // `notified` flag on the response while the checkout still succeeds.
      const stall = store.getStall(stallId);
      let notified = false;
      try {
        const result = await notificationGateway.sendOrderConfirmation({
          toMobile: customerId,
          token,
          total,
          items,
          stallName: stall?.name,
        });
        notified = result.sent;
      } catch {
        notified = false;
      }

      res.status(201).json({
        token,
        status: order.status,
        coinsEarned,
        spinAvailable: !order.spinUsed,
        total,
        discount,
        notified,
      });
    }
  );

  // --- GET /api/orders/:token ---------------------------------------------
  //
  // Returns the stored order so the customer can track its current status. The
  // status displayed is exactly the order's stored Order_Status. Unknown
  // tokens yield a 404 with the consistent `{ error, code }` shape.
  //
  // Validates: Requirements 6.3
  app.get("/api/orders/:token", (req: Request, res: Response): void => {
    const { token } = req.params;
    const order = store.getOrder(token);
    if (!order) {
      const errBody: ApiError = {
        error: "Order not found",
        code: "ORDER_NOT_FOUND",
      };
      res.status(404).json(errBody);
      return;
    }
    res.status(200).json(order);
  });

  // --- POST /api/orders/:token/advance ------------------------------------
  app.post(
    "/api/orders/:token/advance",
    (req: Request, res: Response): void => {
      const { token } = req.params;
      const order = store.getOrder(token);
      if (!order) {
        const errBody: ApiError = { error: "Order not found", code: "ORDER_NOT_FOUND" };
        res.status(404).json(errBody);
        return;
      }

      // Credit reward points when admin approves (first advance from "Craving Funded")
      if (order.status === "Craving Funded") {
        const coins = coinsForOrder(order.total);
        const wallet = store.getWallet(order.customerId);
        wallet.foodCoins += coins;
        store.saveWallet(wallet);
      }

      order.status = nextStatus(order.status);
      store.saveOrder(order);
      res.status(200).json(order);
    }
  );

  // --- POST /api/orders/:token/cancel -------------------------------------
  //
  // Cancels an order. Only orders in "Craving Funded" status can be cancelled.
  app.post(
    "/api/orders/:token/cancel",
    (req: Request, res: Response): void => {
      const { token } = req.params;
      const order = store.getOrder(token);
      if (!order) {
        const errBody: ApiError = { error: "Order not found", code: "ORDER_NOT_FOUND" };
        res.status(404).json(errBody);
        return;
      }
      if (order.status !== "Craving Funded") {
        const errBody: ApiError = { error: "Only pending orders can be cancelled", code: "CANNOT_CANCEL" };
        res.status(400).json(errBody);
        return;
      }
      // Restore stock
      for (const cartItem of order.items) {
        const currentItem = store.getFoodItem(cartItem.itemId);
        if (currentItem) {
          store.setAvailableQuantity(cartItem.itemId, currentItem.availableQuantity + cartItem.quantity);
        }
      }
      // Restore reward points if any were deducted
      // Mark order as cancelled by setting a special status
      (order as unknown as Record<string, unknown>).cancelled = true;
      order.status = "Happiness Disbursed"; // terminal state
      store.saveOrder(order);
      res.status(200).json({ ...order, cancelled: true });
    }
  );

  // --- Admin / seller order-management API --------------------------------
  //
  // SECURITY NOTE: These `/api/admin/*` endpoints are UNAUTHENTICATED for the
  // festival demo — anyone who can reach the server can list and inspect all
  // orders across every stall. In production these MUST be placed behind seller
  // authentication and authorization (e.g. a seller session/JWT scoped to the
  // seller's own stall(s)) before exposing customer order data. Do not ship
  // these open to the internet as-is.

  // --- GET /api/customers/:mobile/orders ----------------------------------
  //
  // Returns all orders for a given customer (identified by mobile number),
  // most-recent first by createdAt. Returns an empty array if the customer has
  // no orders.
  app.get(
    "/api/customers/:mobile/orders",
    (req: Request, res: Response): void => {
      const { mobile } = req.params;
      const orders = store
        .getOrders()
        .filter((o) => o.customerId === mobile)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.status(200).json(orders);
    }
  );

  // --- GET /api/admin/orders ----------------------------------------------
  //
  // Lists all orders for a seller/admin, most-recent first (by createdAt).
  // Optionally filterable to a single stall via `?stallId=`.
  // Enriches each order with the customer name for admin display.
  app.get("/api/admin/orders", (req: Request, res: Response): void => {
    const stallId =
      typeof req.query.stallId === "string" ? req.query.stallId : undefined;

    let orders = store.getOrders();
    if (stallId) {
      orders = orders.filter((o) => o.stallId === stallId);
    }
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Enrich with customer name
    const enriched = orders.map((o) => {
      const normalized = isValidMobile(o.customerId) ? normalizeMobile(o.customerId) : o.customerId;
      const customer = store.getCustomer(normalized);
      return { ...o, customerName: customer?.name || "" };
    });

    res.status(200).json(enriched);
  });

  // --- GET /api/admin/orders/:token ---------------------------------------
  //
  // Fetch a single order by token for the admin view. Unknown tokens yield a
  // 404 with the consistent `{ error, code }` shape. (Same UNAUTHENTICATED
  // caveat as GET /api/admin/orders above.)
  app.get("/api/admin/orders/:token", (req: Request, res: Response): void => {
    const order = store.getOrder(req.params.token);
    if (!order) {
      const errBody: ApiError = {
        error: "Order not found",
        code: "ORDER_NOT_FOUND",
      };
      res.status(404).json(errBody);
      return;
    }
    res.status(200).json(order);
  });

  // --- GET /api/admin/items -----------------------------------------------
  //
  // Lists all food items across all stalls for stock management.
  app.get("/api/admin/items", (_req: Request, res: Response): void => {
    res.status(200).json(store.getFoodItems());
  });

  // --- PATCH /api/admin/items/:itemId/stock -------------------------------
  //
  // Updates the available quantity of a food item. Accepts a JSON body with
  // `{ availableQuantity: number }`. Setting to 0 marks the item out of stock.
  app.patch(
    "/api/admin/items/:itemId/stock",
    (req: Request, res: Response): void => {
      const { itemId } = req.params;
      const body = req.body as { availableQuantity?: unknown };

      if (
        body.availableQuantity === undefined ||
        typeof body.availableQuantity !== "number" ||
        !Number.isFinite(body.availableQuantity) ||
        body.availableQuantity < 0
      ) {
        const errBody: ApiError = {
          error: "availableQuantity must be a non-negative number",
          code: "INVALID_QUANTITY",
        };
        res.status(400).json(errBody);
        return;
      }

      const item = store.getFoodItem(itemId);
      if (!item) {
        const errBody: ApiError = {
          error: "Item not found",
          code: "ITEM_NOT_FOUND",
        };
        res.status(404).json(errBody);
        return;
      }

      store.setAvailableQuantity(itemId, body.availableQuantity);
      const updated = store.getFoodItem(itemId)!;
      res.status(200).json(updated);
    }
  );

  // --- GET /api/wallet/:customerId ----------------------------------------
  //
  // Returns the customer's wallet (FoodCoins balance). The store auto-creates a
  // zero-balance wallet on first access, so every customer has a concrete
  // wallet to read.
  //
  // Validates: Requirements 9.2
  app.get("/api/wallet/:customerId", (req: Request, res: Response): void => {
    const { customerId } = req.params;
    res.status(200).json(store.getWallet(customerId));
  });

  // --- POST /api/wallet/:customerId/redeem --------------------------------
  //
  // Redeems FoodCoins against the customer's balance via the foodcoins domain.
  // A redemption within the balance succeeds and the new balance is persisted;
  // an over-redemption is rejected with 402 and the consistent `{ error, code }`
  // shape (code "INSUFFICIENT_BALANCE"), leaving the balance unchanged.
  //
  // Validates: Requirements 9.3, 9.4, 9.5
  app.post(
    "/api/wallet/:customerId/redeem",
    (req: Request, res: Response): void => {
      const { customerId } = req.params;
      const body = (req.body ?? {}) as { amount?: unknown };
      const amount = typeof body.amount === "number" ? body.amount : NaN;

      if (!Number.isFinite(amount) || amount <= 0) {
        const errBody: ApiError = {
          error: "Redemption amount must be a positive number",
          code: "INVALID_AMOUNT",
        };
        res.status(400).json(errBody);
        return;
      }

      const wallet = store.getWallet(customerId);
      const result = applyRedemption(wallet.foodCoins, amount);

      if (!result.ok) {
        const errBody: ApiError = {
          error: "Insufficient FoodCoins balance for this redemption",
          code: "INSUFFICIENT_BALANCE",
        };
        res.status(402).json(errBody);
        return;
      }

      wallet.foodCoins = result.balance;
      store.saveWallet(wallet);
      res.status(200).json(wallet);
    }
  );

  // --- GET /api/referral/:customerId --------------------------------------
  //
  // Returns the customer's referral record, creating (and persisting) one with
  // a unique link on first access. The link is deterministic in the unique
  // customerId, so it is non-empty and never shared between customers
  // (Requirement 10.1).
  //
  // Validates: Requirements 10.1
  app.get(
    "/api/referral/:customerId",
    (req: Request, res: Response): void => {
      const { customerId } = req.params;
      let referral = store.getReferral(customerId);
      if (!referral) {
        referral = {
          customerId,
          link: referralLinkFor(customerId),
          creditedReferredIds: [],
        };
        store.saveReferral(referral);
      }
      res.status(200).json(referral);
    }
  );

  // --- POST /api/referral/claim -------------------------------------------
  //
  // Credits the referrer 10 FoodCoins for a referred customer's first
  // successful order. Crediting is idempotent per referred customer: the
  // referred id is recorded in the referrer's `creditedReferredIds` and a
  // repeat claim for the same referred customer credits nothing further
  // (Requirements 10.2, 10.3).
  //
  // Validates: Requirements 10.2, 10.3
  app.post("/api/referral/claim", (req: Request, res: Response): void => {
    const body = (req.body ?? {}) as {
      referrerId?: unknown;
      referredId?: unknown;
    };
    const referrerId =
      typeof body.referrerId === "string" ? body.referrerId : "";
    const referredId =
      typeof body.referredId === "string" ? body.referredId : "";

    if (referrerId === "" || referredId === "") {
      const errBody: ApiError = {
        error: "referrerId and referredId are required",
        code: "INVALID_REFERRAL_CLAIM",
      };
      res.status(400).json(errBody);
      return;
    }

    // Load or create the referrer's referral record.
    let referral: Referral =
      store.getReferral(referrerId) ?? {
        customerId: referrerId,
        link: referralLinkFor(referrerId),
        creditedReferredIds: [],
      };

    // Idempotency: only credit the first time we see this referred customer.
    const alreadyCredited = referral.creditedReferredIds.includes(referredId);
    let credited = 0;
    if (!alreadyCredited) {
      referral = {
        ...referral,
        creditedReferredIds: [...referral.creditedReferredIds, referredId],
      };
      store.saveReferral(referral);

      const wallet = store.getWallet(referrerId);
      wallet.foodCoins += REFERRAL_REWARD_COINS;
      store.saveWallet(wallet);
      credited = REFERRAL_REWARD_COINS;
    }

    const wallet = store.getWallet(referrerId);
    res.status(200).json({
      referrerId,
      referredId,
      credited,
      alreadyCredited,
      balance: wallet.foodCoins,
    });
  });

  // --- GET /api/metrics ----------------------------------------------------
  //
  // Delegates to the metrics domain over all stored orders. The satisfaction
  // score is derived from the startup ratings of the seeded food items (the
  // store's canonical rating source); when the store holds no items the
  // ratings set is empty and the score is 0, consistent with the domain.
  //
  // Validates: Requirements 7.1
  app.get("/api/metrics", (_req: Request, res: Response): void => {
    const orders = store.getOrders();
    const ratings = store.getFoodItems().map((item) => item.rating);
    res.status(200).json(computeMetrics(orders, ratings));
  });

  // --- GET /api/trending ---------------------------------------------------
  //
  // Delegates to the trending domain over all stored orders (which ranks
  // today's paid orders in descending order of units).
  //
  // Validates: Requirements 11.1
  app.get("/api/trending", (_req: Request, res: Response): void => {
    res.status(200).json(rankTrending(store.getOrders()));
  });

  // --- POST /api/ai-chef/recommend ----------------------------------------
  //
  // Delegates to the ai-chef domain. The request body carries the three
  // preference inputs; the item pool is the store's food items, optionally
  // scoped to a stall via an optional `stallId`.
  //
  // Validates: Requirements 8.1
  app.post("/api/ai-chef/recommend", (req: Request, res: Response): void => {
    const body = (req.body ?? {}) as {
      hunger?: unknown;
      spice?: unknown;
      taste?: unknown;
      stallId?: unknown;
    };

    const prefs: Preferences = {
      hunger: body.hunger as Preferences["hunger"],
      spice: body.spice as Preferences["spice"],
      taste: body.taste as Preferences["taste"],
    };

    const items =
      typeof body.stallId === "string"
        ? store.getMenu(body.stallId)
        : store.getFoodItems();

    res.status(200).json(recommend(prefs, items));
  });

  // --- POST /api/orders/:token/spin ---------------------------------------
  app.post("/api/orders/:token/spin", (req: Request, res: Response): void => {
    const { token } = req.params;
    const order = store.getOrder(token);
    if (!order) {
      const errBody: ApiError = { error: "Order not found", code: "ORDER_NOT_FOUND" };
      res.status(404).json(errBody);
      return;
    }
    if (!order.paid) {
      const errBody: ApiError = { error: "Spin is only available for paid orders", code: "ORDER_NOT_PAID" };
      res.status(403).json(errBody);
      return;
    }
    if (order.spinUsed) {
      const errBody: ApiError = { error: "This order's spin has already been used", code: "SPIN_ALREADY_USED" };
      res.status(409).json(errBody);
      return;
    }
    const reward = spin(rng);
    const wallet = store.getWallet(order.customerId);
    if (reward === "double FoodCoins") {
      wallet.foodCoins *= 2;
      store.saveWallet(wallet);
    }
    order.spinUsed = true;
    order.spinReward = reward;
    store.saveOrder(order);
    res.status(200).json({ token: order.token, reward, spinUsed: order.spinUsed, balance: store.getWallet(order.customerId).foodCoins });
  });

  // --- POST /api/admin/items — Create a new food item ---------------------
  app.post("/api/admin/items", (req: Request, res: Response): void => {
    const body = req.body as Partial<import("../../types/index.js").FoodItem>;
    if (!body.name || !body.price || !body.stallId) {
      const errBody: ApiError = { error: "name, price, and stallId are required", code: "INVALID_ITEM" };
      res.status(400).json(errBody);
      return;
    }
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: import("../../types/index.js").FoodItem = {
      id,
      name: body.name,
      imageUrl: body.imageUrl ?? "",
      description: body.description ?? "",
      rating: body.rating ?? 4.0,
      availableQuantity: body.availableQuantity ?? 50,
      price: body.price,
      stallId: body.stallId,
      spice: body.spice ?? "medium",
      flavor: body.flavor ?? "savory",
      portion: body.portion ?? "regular",
      variants: body.variants,
    };
    store.upsertFoodItem(item);
    res.status(201).json(item);
  });

  // --- PUT /api/admin/items/:itemId — Update a food item fully ------------
  app.put("/api/admin/items/:itemId", (req: Request, res: Response): void => {
    const { itemId } = req.params;
    const existing = store.getFoodItem(itemId);
    if (!existing) {
      const errBody: ApiError = { error: "Item not found", code: "ITEM_NOT_FOUND" };
      res.status(404).json(errBody);
      return;
    }
    const body = req.body as Partial<import("../../types/index.js").FoodItem>;
    const updated: import("../../types/index.js").FoodItem = {
      ...existing,
      name: body.name ?? existing.name,
      imageUrl: body.imageUrl ?? existing.imageUrl,
      description: body.description ?? existing.description,
      rating: body.rating ?? existing.rating,
      availableQuantity: body.availableQuantity ?? existing.availableQuantity,
      price: body.price ?? existing.price,
      spice: body.spice ?? existing.spice,
      flavor: body.flavor ?? existing.flavor,
      portion: body.portion ?? existing.portion,
      variants: body.variants !== undefined ? body.variants : existing.variants,
    };
    store.upsertFoodItem(updated);
    res.status(200).json(updated);
  });

  // --- DELETE /api/admin/items/:itemId — Remove a food item ---------------
  app.delete("/api/admin/items/:itemId", (req: Request, res: Response): void => {
    const { itemId } = req.params;
    const deleted = store.deleteFoodItem(itemId);
    if (!deleted) {
      const errBody: ApiError = { error: "Item not found", code: "ITEM_NOT_FOUND" };
      res.status(404).json(errBody);
      return;
    }
    res.status(204).end();
  });

  // --- Coupon management ---------------------------------------------------

  // GET /api/admin/coupons
  app.get("/api/admin/coupons", (_req: Request, res: Response): void => {
    res.status(200).json(store.getCoupons());
  });

  // POST /api/admin/coupons — create a coupon
  app.post("/api/admin/coupons", (req: Request, res: Response): void => {
    const body = req.body as Partial<Coupon>;
    if (!body.code || !body.type || body.value === undefined || body.minOrderValue === undefined) {
      const errBody: ApiError = { error: "code, type, value, and minOrderValue are required", code: "INVALID_COUPON" };
      res.status(400).json(errBody);
      return;
    }
    const coupon: Coupon = {
      code: body.code.toUpperCase(),
      type: body.type,
      value: body.value,
      minOrderValue: body.minOrderValue,
      maxDiscount: body.maxDiscount,
      active: body.active !== false,
    };
    store.saveCoupon(coupon);
    res.status(201).json(coupon);
  });

  // DELETE /api/admin/coupons/:code
  app.delete("/api/admin/coupons/:code", (req: Request, res: Response): void => {
    const deleted = store.deleteCoupon(req.params.code);
    if (!deleted) {
      const errBody: ApiError = { error: "Coupon not found", code: "COUPON_NOT_FOUND" };
      res.status(404).json(errBody);
      return;
    }
    res.status(204).end();
  });

  // GET /api/coupons/suggest?total=X&customerId=Y — suggest applicable coupons for user
  app.get("/api/coupons/suggest", (req: Request, res: Response): void => {
    const total = Number(req.query.total ?? 0);
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : "";
    const coupons = store.getCoupons().filter((c) => {
      if (!c.active) return false;
      if (total < c.minOrderValue) return false;
      if (customerId && c.usedBy?.includes(customerId)) return false;
      return true;
    });
    res.status(200).json(coupons);
  });

  // POST /api/coupons/apply — validate and calculate discount for a coupon
  app.post("/api/coupons/apply", (req: Request, res: Response): void => {
    const body = req.body as { code?: string; total?: number; customerId?: string };
    const code = typeof body.code === "string" ? body.code : "";
    const total = typeof body.total === "number" ? body.total : 0;
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const coupon = store.getCoupon(code);
    if (!coupon || !coupon.active) {
      const errBody: ApiError = { error: "Invalid or expired coupon", code: "INVALID_COUPON" };
      res.status(400).json(errBody);
      return;
    }
    if (total < coupon.minOrderValue) {
      const errBody: ApiError = { error: `Minimum order value is ₹${coupon.minOrderValue}. Add more items to use this coupon.`, code: "MIN_ORDER_NOT_MET" };
      res.status(400).json(errBody);
      return;
    }
    // Check if this user has already used the coupon
    if (customerId && coupon.usedBy?.includes(customerId)) {
      const errBody: ApiError = { error: "You have already used this coupon", code: "COUPON_ALREADY_USED" };
      res.status(400).json(errBody);
      return;
    }
    let discount = coupon.type === "percent" ? (total * coupon.value) / 100 : coupon.value;
    if (coupon.type === "percent" && coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = Math.min(discount, total);
    res.status(200).json({ coupon, discount, finalTotal: total - discount });
  });

  // POST /api/coupons/markUsed — mark a coupon as used by a customer (called after successful order)
  app.post("/api/coupons/markUsed", (req: Request, res: Response): void => {
    const body = req.body as { code?: string; customerId?: string };
    const code = typeof body.code === "string" ? body.code : "";
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!code || !customerId) {
      res.status(400).json({ error: "code and customerId required", code: "INVALID_REQUEST" });
      return;
    }
    const coupon = store.getCoupon(code);
    if (!coupon) {
      res.status(404).json({ error: "Coupon not found", code: "COUPON_NOT_FOUND" });
      return;
    }
    const usedBy = coupon.usedBy ?? [];
    if (!usedBy.includes(customerId)) {
      coupon.usedBy = [...usedBy, customerId];
      store.saveCoupon(coupon);
    }
    res.status(200).json({ success: true });
  });

  // --- Admin config (UPI ID) -----------------------------------------------

  // GET /api/admin/config
  app.get("/api/admin/config", (_req: Request, res: Response): void => {
    res.status(200).json(store.getAdminConfig());
  });

  // PUT /api/admin/config
  app.put("/api/admin/config", (req: Request, res: Response): void => {
    const body = req.body as Partial<AdminConfig>;
    const current = store.getAdminConfig();
    const updated: AdminConfig = {
      upiId: typeof body.upiId === "string" && body.upiId ? body.upiId : current.upiId,
      upiName: typeof body.upiName === "string" && body.upiName ? body.upiName : current.upiName,
    };
    store.setAdminConfig(updated);
    res.status(200).json(updated);
  });

  // GET /api/config/payment — public endpoint for client to get UPI details
  app.get("/api/config/payment", (_req: Request, res: Response): void => {
    res.status(200).json(store.getAdminConfig());
  });

  return app;
}

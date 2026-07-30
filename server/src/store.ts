/**
 * In-memory Store for ByteBites.
 *
 * The festival demo intentionally avoids an external database. This module
 * provides a single in-memory store, seeded with a handful of stalls and a set
 * of food items across those stalls, plus accessors/mutators for stalls,
 * menus (items by stall), orders, wallets, and referrals.
 *
 * A deterministic `reset()` restores the seed state so tests and demo runs
 * always start from the same known snapshot.
 *
 * Server-authoritative design: the store holds the canonical order, wallet,
 * referral, and customer state; the client only renders what the server
 * exposes.
 *
 * Persistence: the Store can optionally write its mutable runtime state
 * (orders, wallets, referrals, customers, and item stock) through a
 * `PersistenceAdapter` on every mutation and reload it on construction, so data
 * survives a server restart. The default (used by tests) is no persistence
 * (in-memory only); the production `store` singleton persists to a JSON file.
 *
 * Validates: Requirements 4.1, 4.2
 */

import type {
  Customer,
  FoodItem,
  Order,
  Referral,
  Stall,
  Wallet,
  Coupon,
  AdminConfig,
} from "../../types/index.js";
import {
  JsonFilePersistence,
  NoopPersistence,
  type PersistenceAdapter,
  type StoreSnapshot,
} from "./persistence.js";

// --- Seed data -------------------------------------------------------------

/**
 * Build a fresh copy of the seed stalls. A factory (rather than a shared
 * constant) guarantees every reset produces independent objects that later
 * mutations cannot leak back into the seed definition.
 */
function seedStalls(): Stall[] {
  return [
    { id: "stall-tandoori", name: "Tandoori Tech", qrSlug: "tandoori-tech" },
    { id: "stall-wok", name: "Wok & Roll", qrSlug: "wok-and-roll" },
    { id: "stall-sweet", name: "Sweet Bytes", qrSlug: "sweet-bytes" },
  ];
}

/**
 * Build a fresh copy of the seed food items. Items span all three seed stalls
 * and carry realistic data: names, images, descriptions, ratings within 0..5,
 * available quantities (including a sold-out item), prices in INR, and the
 * spice/flavor/portion attributes used by the AI Chef recommender.
 */
function seedFoodItems(): FoodItem[] {
  return [
    {
      id: "item-mint-mojito",
      name: "Mint Mojito",
      imageUrl: "/images/mint-mojito.jpg",
      description: "Refreshing mint mojito with crushed ice, lime, and fresh mint leaves.",
      rating: 4.6,
      availableQuantity: 80,
      price: 50,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "regular",
    },
    {
      id: "item-green-apple-mojito",
      name: "Green Apple Mojito",
      imageUrl: "/images/green-apple-mojito.jpeg",
      description: "Tangy green apple mojito with a burst of fruity freshness and soda.",
      rating: 4.5,
      availableQuantity: 80,
      price: 60,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "regular",
    },
    {
      id: "item-jamun-shot",
      name: "Jamun Shot",
      imageUrl: "/images/jamun-shot.jpg",
      description: "Chilled jamun berry shot — tangy, sweet, and incredibly refreshing.",
      rating: 4.4,
      availableQuantity: 100,
      price: 35,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "light",
    },
    {
      id: "item-kiwi-shot",
      name: "Kiwi Shot",
      imageUrl: "/images/kiwi-shot.jpg",
      description: "Fresh kiwi fruit shot bursting with tropical flavour and natural sweetness.",
      rating: 4.5,
      availableQuantity: 100,
      price: 40,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "light",
    },
    {
      id: "item-googhra",
      name: "Googhra (3 Pcs)",
      imageUrl: "/images/googhra.jpg",
      description: "Crispy deep-fried pastry pockets filled with a sweet coconut-sesame stuffing. Served 3 pieces.",
      rating: 4.7,
      availableQuantity: 50,
      price: 60,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "regular",
    },
    {
      id: "item-momos",
      name: "Momos (4 Pcs)",
      imageUrl: "/images/momos.jpg",
      description: "Steamed dumplings stuffed with a flavourful veggie filling, served with spicy chutney. 4 pieces.",
      rating: 4.8,
      availableQuantity: 60,
      price: 60,
      stallId: "stall-tandoori",
      spice: "medium",
      flavor: "savory",
      portion: "regular",
    },
    {
      id: "item-monaco-chaat",
      name: "Monaco Chaat",
      imageUrl: "/images/monaco-chaat.png",
      description: "Crispy monaco biscuits topped with tangy chutneys, onion, sev, and fresh herbs.",
      rating: 4.6,
      availableQuantity: 60,
      price: 60,
      stallId: "stall-tandoori",
      spice: "medium",
      flavor: "savory",
      portion: "regular",
      variants: [{ name: "Add Cheese", priceAddon: 20 }],
    },
    {
      id: "item-basket-chaat",
      name: "Basket Chaat",
      imageUrl: "/images/basket-chaat.png",
      description: "Crispy potato basket loaded with chutneys, yogurt, pomegranate, and crunchy sev.",
      rating: 4.7,
      availableQuantity: 60,
      price: 60,
      stallId: "stall-tandoori",
      spice: "medium",
      flavor: "savory",
      portion: "regular",
      variants: [{ name: "Add Cheese", priceAddon: 20 }],
    },
    {
      id: "item-chhas",
      name: "Chhas",
      imageUrl: "/images/chhas.png",
      description: "Cool spiced buttermilk with cumin, coriander, and a hint of mint. Perfect thirst quencher.",
      rating: 4.3,
      availableQuantity: 120,
      price: 15,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "savory",
      portion: "light",
    },
    {
      id: "item-meetha-paan",
      name: "Meetha Paan",
      imageUrl: "/images/meetha_paan.png",
      description: "Sweet betel leaf loaded with gulkand, tutti-frutti, cherry, and aromatic fennel.",
      rating: 4.8,
      availableQuantity: 80,
      price: 30,
      stallId: "stall-tandoori",
      spice: "mild",
      flavor: "sweet",
      portion: "light",
    },
  ];
}

// --- Deep-copy helper ------------------------------------------------------

/**
 * Structured deep clone used when seeding and when returning collections, so
 * callers cannot mutate the store's internal state by reference. Falls back to
 * JSON round-tripping when `structuredClone` is unavailable.
 */
function deepClone<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <U>(v: U) => U })
    .structuredClone;
  if (typeof sc === "function") return sc(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

// --- Store -----------------------------------------------------------------

/**
 * Optional seed override for constructing a Store with a custom set of stalls
 * and/or food items. Used by tests (e.g. property-based menu isolation tests)
 * that need to drive the store from generated data rather than the fixed demo
 * seed. When a field is omitted, the default demo seed for that collection is
 * used. `reset()` restores whichever seed the Store was constructed with, so
 * the default demo behavior is preserved for callers that pass no override.
 */
export interface StoreSeed {
  stalls?: Stall[];
  foodItems?: FoodItem[];
}

/**
 * Options controlling how a Store persists its mutable runtime state.
 *
 *   - Omit both fields (the test/default) → no persistence (in-memory only).
 *   - `{ persist: true, dataFile }` → JSON-file persistence at `dataFile`.
 *   - `{ persistence }` → an injected adapter (advanced/testing).
 *
 * Tests should leave persistence off (the default) so they never write to or
 * depend on a real shared file; the production `store` singleton opts in.
 */
export interface StoreOptions {
  /** When true, persist to a JSON file (see `dataFile`). Defaults to false. */
  persist?: boolean;
  /** JSON file path used when `persist` is true. */
  dataFile?: string;
  /** An explicit persistence adapter, overriding `persist`/`dataFile`. */
  persistence?: PersistenceAdapter;
}

/** Default JSON data-file path; overridable via `BYTEBITES_DATA_FILE`. */
export const DEFAULT_DATA_FILE = "server/data/bytebites-db.json";

/** Resolve a persistence adapter from the given options. */
function resolvePersistence(options: StoreOptions): PersistenceAdapter {
  if (options.persistence) return options.persistence;
  if (options.persist) {
    return new JsonFilePersistence(options.dataFile ?? DEFAULT_DATA_FILE);
  }
  return new NoopPersistence();
}

export class Store {
  private stalls: Map<string, Stall> = new Map();
  private foodItems: Map<string, FoodItem> = new Map();
  private orders: Map<string, Order> = new Map();
  private wallets: Map<string, Wallet> = new Map();
  private referrals: Map<string, Referral> = new Map();
  private customers: Map<string, Customer> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private adminConfig: AdminConfig = { upiId: "deepp3123-3@okicici", upiName: "Invest-a-Bite" };

  /** The seed this store was constructed with; `reset()` restores to it. */
  private readonly seed: StoreSeed | undefined;

  /** Where mutable runtime state is written through / loaded from. */
  private readonly persistence: PersistenceAdapter;

  /**
   * When true, mutations are NOT written through — used internally while
   * hydrating from a loaded snapshot so restoring state does not re-persist
   * (and does not recurse) during construction.
   */
  private hydrating = false;

  constructor(seed?: StoreSeed, options: StoreOptions = {}) {
    this.seed = seed;
    this.persistence = resolvePersistence(options);
    this.reset();
    // After seeding the catalogue, restore any previously persisted runtime
    // state so data survives a restart.
    this.hydrate();
  }

  /**
   * Load persisted runtime state (if any) on top of the freshly seeded
   * catalogue. Applied with write-through suppressed so hydration itself does
   * not re-persist. Safe when persistence is a no-op (nothing to load).
   */
  private hydrate(): void {
    const snapshot = this.persistence.load();
    if (!snapshot) return;
    this.hydrating = true;
    try {
      for (const order of snapshot.orders) this.orders.set(order.token, order);
      for (const wallet of snapshot.wallets) {
        this.wallets.set(wallet.customerId, wallet);
      }
      for (const referral of snapshot.referrals) {
        this.referrals.set(referral.customerId, referral);
      }
      for (const customer of snapshot.customers) {
        this.customers.set(customer.mobile, customer);
      }
      for (const [itemId, quantity] of Object.entries(
        snapshot.itemQuantities
      )) {
        this.setAvailableQuantity(itemId, quantity);
      }
    } finally {
      this.hydrating = false;
    }
  }

  /**
   * Build a serializable snapshot of the current mutable runtime state and
   * write it through the persistence adapter. A no-op while hydrating.
   */
  private persist(): void {
    if (this.hydrating) return;
    const snapshot: StoreSnapshot = {
      orders: this.getOrders(),
      wallets: Array.from(this.wallets.values()).map((w) => deepClone(w)),
      referrals: this.getReferrals(),
      customers: this.getCustomers(),
      itemQuantities: Object.fromEntries(
        Array.from(this.foodItems.values()).map((i) => [
          i.id,
          i.availableQuantity,
        ])
      ),
    };
    this.persistence.save(snapshot);
  }

  /**
   * Restore the deterministic seed state. Clears all runtime state (orders,
   * wallets, referrals, and any mutations to stalls/items) and repopulates
   * stalls and food items from the seed. When constructed without an override
   * the default demo seed factories are used; when constructed with a custom
   * `StoreSeed`, that snapshot is restored instead. Safe to call between demo
   * runs and before each test.
   */
  reset(): void {
    this.stalls.clear();
    this.foodItems.clear();
    this.orders.clear();
    this.wallets.clear();
    this.referrals.clear();
    this.customers.clear();

    const stalls = this.seed?.stalls ?? seedStalls();
    const foodItems = this.seed?.foodItems ?? seedFoodItems();

    for (const stall of stalls) {
      this.stalls.set(stall.id, deepClone(stall));
    }
    for (const item of foodItems) {
      this.foodItems.set(item.id, deepClone(item));
    }
  }

  // --- Stalls --------------------------------------------------------------

  /** All stalls (defensive copies). */
  getStalls(): Stall[] {
    return Array.from(this.stalls.values()).map((s) => deepClone(s));
  }

  /** A single stall by id, or undefined when unknown. */
  getStall(stallId: string): Stall | undefined {
    const stall = this.stalls.get(stallId);
    return stall ? deepClone(stall) : undefined;
  }

  /** True when a stall with the given id exists. */
  hasStall(stallId: string): boolean {
    return this.stalls.has(stallId);
  }

  // --- Menus (food items) --------------------------------------------------

  /** All food items across all stalls (defensive copies). */
  getFoodItems(): FoodItem[] {
    return Array.from(this.foodItems.values()).map((i) => deepClone(i));
  }

  /** A single food item by id, or undefined when unknown. */
  getFoodItem(itemId: string): FoodItem | undefined {
    const item = this.foodItems.get(itemId);
    return item ? deepClone(item) : undefined;
  }

  /**
   * The menu for a given stall: only the items whose `stallId` matches
   * (Requirement 4.1). Returns an empty array for an unknown stall; callers
   * that need a not-found distinction should check `hasStall` first.
   */
  getMenu(stallId: string): FoodItem[] {
    return Array.from(this.foodItems.values())
      .filter((item) => item.stallId === stallId)
      .map((item) => deepClone(item));
  }

  /** Insert or replace a food item. */
  upsertFoodItem(item: FoodItem): void {
    this.foodItems.set(item.id, deepClone(item));
    this.persist();
  }

  /**
   * Set the available quantity of an item (e.g. after a purchase). No-op when
   * the item is unknown; the clamped-to-zero floor prevents negative stock.
   */
  setAvailableQuantity(itemId: string, quantity: number): void {
    const item = this.foodItems.get(itemId);
    if (!item) return;
    item.availableQuantity = Math.max(0, Math.floor(quantity));
    this.persist();
  }

  // --- Orders --------------------------------------------------------------

  /** All orders (defensive copies). */
  getOrders(): Order[] {
    return Array.from(this.orders.values()).map((o) => deepClone(o));
  }

  /** A single order by its token, or undefined when unknown. */
  getOrder(token: string): Order | undefined {
    const order = this.orders.get(token);
    return order ? deepClone(order) : undefined;
  }

  /** The set of order tokens already in use (for unique token issuance). */
  getOrderTokens(): Set<string> {
    return new Set(this.orders.keys());
  }

  /** Insert or replace an order keyed by its token. */
  saveOrder(order: Order): void {
    this.orders.set(order.token, deepClone(order));
    this.persist();
  }

  // --- Wallets -------------------------------------------------------------

  /**
   * The wallet for a customer, creating a zero-balance wallet on first access
   * so callers always receive a concrete wallet to read or credit.
   */
  getWallet(customerId: string): Wallet {
    let wallet = this.wallets.get(customerId);
    if (!wallet) {
      wallet = { customerId, foodCoins: 0 };
      this.wallets.set(customerId, wallet);
    }
    return deepClone(wallet);
  }

  /** Insert or replace a wallet keyed by its customerId. */
  saveWallet(wallet: Wallet): void {
    this.wallets.set(wallet.customerId, deepClone(wallet));
    this.persist();
  }

  // --- Referrals -----------------------------------------------------------

  /** The referral record for a customer, or undefined when none exists yet. */
  getReferral(customerId: string): Referral | undefined {
    const referral = this.referrals.get(customerId);
    return referral ? deepClone(referral) : undefined;
  }

  /** All referral records (defensive copies). */
  getReferrals(): Referral[] {
    return Array.from(this.referrals.values()).map((r) => deepClone(r));
  }

  /** Insert or replace a referral record keyed by its customerId. */
  saveReferral(referral: Referral): void {
    this.referrals.set(referral.customerId, deepClone(referral));
    this.persist();
  }

  // --- Customers -----------------------------------------------------------

  /**
   * The customer record for a normalized mobile number, or undefined when no
   * customer has registered under it yet. Callers should pass an already
   * normalized mobile (the canonical customer id).
   */
  getCustomer(mobile: string): Customer | undefined {
    const customer = this.customers.get(mobile);
    return customer ? deepClone(customer) : undefined;
  }

  /** All customer records (defensive copies). */
  getCustomers(): Customer[] {
    return Array.from(this.customers.values()).map((c) => deepClone(c));
  }

  /** Insert or replace a customer keyed by its normalized mobile number. */
  saveCustomer(customer: Customer): void {
    this.customers.set(customer.mobile, deepClone(customer));
    this.persist();
  }

  // --- Food item deletion --------------------------------------------------

  /** Remove a food item by id. Returns true if the item existed. */
  deleteFoodItem(itemId: string): boolean {
    const existed = this.foodItems.delete(itemId);
    if (existed) this.persist();
    return existed;
  }

  // --- Coupons -------------------------------------------------------------

  /** All coupons. */
  getCoupons(): Coupon[] {
    return Array.from(this.coupons.values()).map((c) => deepClone(c));
  }

  /** A single coupon by code (case-insensitive). */
  getCoupon(code: string): Coupon | undefined {
    const coupon = this.coupons.get(code.toUpperCase());
    return coupon ? deepClone(coupon) : undefined;
  }

  /** Insert or replace a coupon keyed by its code (uppercased). */
  saveCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.code.toUpperCase(), deepClone(coupon));
    this.persist();
  }

  /** Delete a coupon by code. */
  deleteCoupon(code: string): boolean {
    const existed = this.coupons.delete(code.toUpperCase());
    if (existed) this.persist();
    return existed;
  }

  // --- Admin config --------------------------------------------------------

  /** Get the admin configuration (UPI ID, etc.). */
  getAdminConfig(): AdminConfig {
    return deepClone(this.adminConfig);
  }

  /** Update the admin configuration. */
  setAdminConfig(config: AdminConfig): void {
    this.adminConfig = deepClone(config);
    this.persist();
  }
}

/**
 * A shared singleton store instance for the running server. It persists its
 * mutable runtime state (orders, wallets, referrals, customers, item stock) to
 * a JSON file so data survives a restart; the file path defaults to
 * `server/data/bytebites-db.json` and is overridable via the
 * `BYTEBITES_DATA_FILE` environment variable.
 *
 * Tests should construct their own in-memory `new Store()` (persistence off by
 * default) for isolation rather than relying on this shared, file-backed
 * instance.
 */
export const store = new Store(undefined, {
  persist: true,
  dataFile: process.env.BYTEBITES_DATA_FILE ?? DEFAULT_DATA_FILE,
});

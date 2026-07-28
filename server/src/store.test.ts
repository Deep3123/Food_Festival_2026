/**
 * Example-based unit tests for the in-memory Store.
 *
 * Covers seed integrity (stalls and items present, every item references a
 * valid stall) and deterministic reset (mutate then reset restores the seed).
 *
 * Validates: Requirements 4.1
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "./store.js";

describe("Store seeding", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it("seeds a non-empty set of stalls", () => {
    const stalls = store.getStalls();
    expect(stalls.length).toBeGreaterThan(0);
    // Stall ids are unique.
    const ids = stalls.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("seeds a non-empty set of food items", () => {
    expect(store.getFoodItems().length).toBeGreaterThan(0);
  });

  it("every food item references a valid seeded stall", () => {
    const stallIds = new Set(store.getStalls().map((s) => s.id));
    for (const item of store.getFoodItems()) {
      expect(stallIds.has(item.stallId)).toBe(true);
    }
  });

  it("seeds items with valid attribute ranges", () => {
    for (const item of store.getFoodItems()) {
      expect(item.rating).toBeGreaterThanOrEqual(0);
      expect(item.rating).toBeLessThanOrEqual(5);
      expect(item.availableQuantity).toBeGreaterThanOrEqual(0);
      expect(item.price).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it("returns only a stall's own items from getMenu", () => {
    for (const stall of store.getStalls()) {
      const menu = store.getMenu(stall.id);
      expect(menu.length).toBeGreaterThan(0);
      for (const item of menu) {
        expect(item.stallId).toBe(stall.id);
      }
    }
  });

  it("distributes items across more than one stall", () => {
    const stallsWithItems = new Set(
      store.getFoodItems().map((i) => i.stallId)
    );
    expect(stallsWithItems.size).toBeGreaterThan(1);
  });

  it("reports known and unknown stalls via hasStall", () => {
    const known = store.getStalls()[0].id;
    expect(store.hasStall(known)).toBe(true);
    expect(store.hasStall("stall-does-not-exist")).toBe(false);
  });
});

describe("Store deterministic reset", () => {
  it("restores the seed state after mutations", () => {
    const store = new Store();
    const seedStalls = store.getStalls();
    const seedItems = store.getFoodItems();

    // Mutate: add an order, credit a wallet, add a referral, change stock.
    store.saveOrder({
      token: "T-1",
      stallId: seedStalls[0].id,
      items: [{ itemId: "x", name: "X", unitPrice: 10, quantity: 1 }],
      total: 10,
      status: "Order Received",
      paid: true,
      paymentMethod: "UPI",
      customerId: "cust-1",
      createdAt: new Date().toISOString(),
      spinUsed: false,
    });
    store.saveWallet({ customerId: "cust-1", foodCoins: 99 });
    store.saveReferral({
      customerId: "cust-1",
      link: "https://bytebites.demo/r/cust-1",
      creditedReferredIds: ["cust-2"],
    });
    const someItem = seedItems[0];
    store.setAvailableQuantity(someItem.id, 0);

    expect(store.getOrders().length).toBe(1);

    store.reset();

    // Runtime state cleared.
    expect(store.getOrders().length).toBe(0);
    expect(store.getReferrals().length).toBe(0);
    expect(store.getWallet("cust-1").foodCoins).toBe(0);

    // Seed collections restored to their original snapshot.
    expect(store.getStalls()).toEqual(seedStalls);
    expect(store.getFoodItems()).toEqual(seedItems);
    // The mutated stock is back to the seed value.
    expect(store.getFoodItem(someItem.id)?.availableQuantity).toBe(
      someItem.availableQuantity
    );
  });

  it("does not leak internal state through returned copies", () => {
    const store = new Store();
    const stalls = store.getStalls();
    stalls[0].name = "MUTATED";
    // The store's own copy is unaffected by mutating the returned array.
    expect(store.getStalls()[0].name).not.toBe("MUTATED");
  });
});

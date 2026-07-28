/**
 * Tests for the admin/seller order-management API
 * (`GET /api/admin/orders`, `GET /api/admin/orders/:token`).
 *
 * Admin listing returns all orders most-recent first, is filterable by stall,
 * and a single order is fetchable by token (404 for unknown). These endpoints
 * are intentionally unauthenticated for the demo (see the security note in
 * app.ts).
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { MockGateway } from "./gateways/mock-gateway.js";
import type { Order, Stall } from "../../types/index.js";

const STALL_A: Stall = { id: "stall-a", name: "A", qrSlug: "a" };
const STALL_B: Stall = { id: "stall-b", name: "B", qrSlug: "b" };

function makeOrder(token: string, stallId: string, createdAt: string): Order {
  return {
    token,
    stallId,
    items: [{ itemId: "i", name: "I", unitPrice: 10, quantity: 1 }],
    total: 10,
    status: "Order Received",
    paid: true,
    paymentMethod: "UPI",
    customerId: "9876543210",
    createdAt,
    spinUsed: false,
  };
}

function buildApp() {
  const store = new Store({ stalls: [STALL_A, STALL_B], foodItems: [] });
  const app = createApp({ store, paymentGateway: new MockGateway() });
  return { app, store };
}

describe("GET /api/admin/orders", () => {
  it("lists all orders most-recent first", async () => {
    const { app, store } = buildApp();
    store.saveOrder(makeOrder("T-1", STALL_A.id, "2024-01-01T10:00:00.000Z"));
    store.saveOrder(makeOrder("T-2", STALL_B.id, "2024-01-01T12:00:00.000Z"));
    store.saveOrder(makeOrder("T-3", STALL_A.id, "2024-01-01T11:00:00.000Z"));

    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(200);
    const tokens = (res.body as Order[]).map((o) => o.token);
    // Descending by createdAt: T-2 (12:00), T-3 (11:00), T-1 (10:00).
    expect(tokens).toEqual(["T-2", "T-3", "T-1"]);
  });

  it("filters by stallId", async () => {
    const { app, store } = buildApp();
    store.saveOrder(makeOrder("T-1", STALL_A.id, "2024-01-01T10:00:00.000Z"));
    store.saveOrder(makeOrder("T-2", STALL_B.id, "2024-01-01T12:00:00.000Z"));
    store.saveOrder(makeOrder("T-3", STALL_A.id, "2024-01-01T11:00:00.000Z"));

    const res = await request(app).get("/api/admin/orders?stallId=stall-a");
    expect(res.status).toBe(200);
    const orders = res.body as Order[];
    expect(orders.map((o) => o.token)).toEqual(["T-3", "T-1"]);
    for (const o of orders) expect(o.stallId).toBe(STALL_A.id);
  });

  it("returns an empty list when there are no orders", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/admin/orders/:token", () => {
  it("fetches a single order by token", async () => {
    const { app, store } = buildApp();
    const order = makeOrder("T-9", STALL_A.id, "2024-01-01T10:00:00.000Z");
    store.saveOrder(order);

    const res = await request(app).get("/api/admin/orders/T-9");
    expect(res.status).toBe(200);
    expect(res.body.token).toBe("T-9");
  });

  it("returns 404 ORDER_NOT_FOUND for an unknown token", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/admin/orders/nope");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ORDER_NOT_FOUND");
  });

  it("an admin can advance an order via the existing advance endpoint", async () => {
    const { app, store } = buildApp();
    store.saveOrder(makeOrder("T-adv", STALL_A.id, "2024-01-01T10:00:00.000Z"));

    const res = await request(app).post("/api/orders/T-adv/advance");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Preparing");
  });
});

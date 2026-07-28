/**
 * Unit tests for OrderTracker.
 *
 * Covers rendering the current status label from the order state (Req 6.3):
 * the status returned by the first (immediate) poll of getOrder is displayed.
 * The polling interval is not driven here — the initial resolved fetch is
 * sufficient to verify the displayed status matches the fetched status, and
 * avoids a hanging interval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as api from "../api/client.js";
import type { OrderResponse } from "../api/client.js";
import { ROUTES, orderPath } from "../routes.js";
import { OrderTracker } from "./OrderTracker.js";

vi.mock("../api/client.js", async () => {
  const actual = await vi.importActual<typeof import("../api/client.js")>(
    "../api/client.js"
  );
  return { ...actual, getOrder: vi.fn(), advanceOrder: vi.fn() };
});

const getOrderMock = vi.mocked(api.getOrder);
const advanceOrderMock = vi.mocked(api.advanceOrder);

function order(status: OrderResponse["status"]): OrderResponse {
  return {
    token: "BB-TOKEN-123",
    stallId: "stall-tandoori",
    items: [],
    total: 180,
    status,
    paid: true,
    paymentMethod: "UPI",
    customerId: "demo-customer",
    createdAt: new Date().toISOString(),
    spinUsed: false,
  };
}

function renderTracker(): void {
  render(
    <MemoryRouter initialEntries={[orderPath("BB-TOKEN-123")]}>
      <Routes>
        <Route path={ROUTES.order} element={<OrderTracker />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOrderMock.mockReset();
  advanceOrderMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("OrderTracker status label (Req 6.3)", () => {
  it("renders the current status label from the fetched order", async () => {
    getOrderMock.mockResolvedValue(order("Preparing"));

    renderTracker();

    const status = await screen.findByTestId("order-status");
    expect(status).toHaveTextContent("Preparing");
  });

  it("renders the token from the route param", async () => {
    getOrderMock.mockResolvedValue(order("Order Received"));

    renderTracker();

    expect(await screen.findByTestId("order-status")).toHaveTextContent(
      "Order Received"
    );
    expect(screen.getByTestId("order-tracker-token")).toHaveTextContent(
      "BB-TOKEN-123"
    );
  });
});

describe("OrderTracker advance control (Req 6.2)", () => {
  it("advances the order via a POST (advanceOrder) rather than a GET navigation", async () => {
    getOrderMock
      .mockResolvedValueOnce(order("Order Received"))
      .mockResolvedValue(order("Preparing"));
    advanceOrderMock.mockResolvedValue(order("Preparing"));

    renderTracker();

    await screen.findByTestId("order-status");
    fireEvent.click(screen.getByTestId("order-advance"));

    await waitFor(() =>
      expect(advanceOrderMock).toHaveBeenCalledWith("BB-TOKEN-123")
    );
    await waitFor(() =>
      expect(screen.getByTestId("order-status")).toHaveTextContent("Preparing")
    );
  });

  it("disables the advance control once the order is Ready for Pickup", async () => {
    getOrderMock.mockResolvedValue(order("Ready for Pickup"));

    renderTracker();

    await screen.findByTestId("order-status");
    expect(screen.getByTestId("order-advance")).toBeDisabled();
    expect(advanceOrderMock).not.toHaveBeenCalled();
  });
});

/**
 * Unit tests for the Marketplace page.
 *
 * Covers the unknown-stall error view (Req 4.3): when the API rejects with an
 * ApiClientError carrying code STALL_NOT_FOUND, the page renders a
 * "stall not found" message. Also covers the happy path rendering a stall's
 * menu of food item cards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { FoodItem } from "../../../types/index.js";
import { ApiClientError } from "../api/client.js";
import * as api from "../api/client.js";
import { ROUTES, stallPath } from "../routes.js";
import { CartProvider } from "../cart/CartContext.js";
import { Marketplace } from "./Marketplace.js";

vi.mock("../api/client.js", async () => {
  const actual = await vi.importActual<typeof import("../api/client.js")>(
    "../api/client.js"
  );
  return { ...actual, getMenu: vi.fn() };
});

const getMenuMock = vi.mocked(api.getMenu);

function renderMarketplaceAt(path: string): void {
  render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ROUTES.stall} element={<Marketplace />} />
          <Route path={ROUTES.marketplace} element={<Marketplace />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  );
}

const sampleItem: FoodItem = {
  id: "item-1",
  name: "Paneer Tikka",
  imageUrl: "https://example.com/p.jpg",
  description: "Char-grilled cottage cheese.",
  rating: 4.6,
  availableQuantity: 40,
  price: 180,
  stallId: "stall-1",
  spice: "medium",
  flavor: "savory",
  portion: "regular",
};

beforeEach(() => {
  getMenuMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Marketplace unknown stall error view (Req 4.3)", () => {
  it("shows a stall-not-found message when getMenu rejects with STALL_NOT_FOUND", async () => {
    getMenuMock.mockRejectedValueOnce(
      new ApiClientError(404, "Stall not found", "STALL_NOT_FOUND")
    );

    renderMarketplaceAt(stallPath("does-not-exist"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/stall not found/i);
    expect(alert).toHaveTextContent("does-not-exist");
  });
});

describe("Marketplace menu rendering", () => {
  it("renders a food item card for each menu item", async () => {
    getMenuMock.mockResolvedValueOnce([sampleItem]);

    renderMarketplaceAt(stallPath("stall-1"));

    expect(await screen.findByTestId("food-card-item-1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to Cart" })
    ).toBeInTheDocument();
  });
});

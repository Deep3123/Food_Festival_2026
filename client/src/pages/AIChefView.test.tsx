/**
 * Unit tests for AIChefView.
 *
 * Covers Req 8.1: the form collects the three preference inputs (hunger level,
 * spice preference, sweet-or-savory). Also verifies that after submitting the
 * preferences a recommendation with its confidence score renders (Req 8.2,
 * 8.3), using a mocked recommend call.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FoodItem } from "../../../types/index.js";
import * as api from "../api/client.js";
import { AIChefView } from "./AIChefView.js";

vi.mock("../api/client.js", async () => {
  const actual = await vi.importActual<typeof import("../api/client.js")>(
    "../api/client.js"
  );
  return { ...actual, recommend: vi.fn() };
});

const recommendMock = vi.mocked(api.recommend);

const sampleItem: FoodItem = {
  id: "item-9",
  name: "Chocolate Lava Cake",
  imageUrl: "https://example.com/cake.jpg",
  description: "Warm molten chocolate dessert.",
  rating: 4.8,
  availableQuantity: 15,
  price: 150,
  stallId: "stall-desserts",
  spice: "mild",
  flavor: "sweet",
  portion: "light",
};

beforeEach(() => {
  recommendMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AIChefView collects the three preference inputs (Req 8.1)", () => {
  it("renders hunger level, spice preference, and sweet-or-savory inputs", () => {
    render(<AIChefView />);

    expect(screen.getByTestId("ai-chef-hunger")).toBeInTheDocument();
    expect(screen.getByTestId("ai-chef-spice")).toBeInTheDocument();
    expect(screen.getByTestId("ai-chef-taste")).toBeInTheDocument();
  });
});

describe("AIChefView renders a recommendation with confidence (Req 8.2, 8.3)", () => {
  it("shows the recommended item and its confidence score after submit", async () => {
    recommendMock.mockResolvedValueOnce({
      items: [{ item: sampleItem, confidence: 92 }],
      exactMatch: true,
    });

    render(<AIChefView />);

    fireEvent.change(screen.getByTestId("ai-chef-hunger"), {
      target: { value: "light" },
    });
    fireEvent.change(screen.getByTestId("ai-chef-spice"), {
      target: { value: "mild" },
    });
    fireEvent.change(screen.getByTestId("ai-chef-taste"), {
      target: { value: "sweet" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /recommend a dish/i })
    );

    const recommendation = await screen.findByTestId(
      `ai-chef-recommendation-${sampleItem.id}`
    );
    expect(recommendation).toHaveTextContent("Chocolate Lava Cake");

    const confidence = screen.getByTestId("ai-chef-confidence");
    expect(confidence).toHaveTextContent("92%");

    // Verify the collected preferences were submitted to the API.
    expect(recommendMock).toHaveBeenCalledWith({
      hunger: "light",
      spice: "mild",
      taste: "sweet",
    });
  });

  it("indicates when no exact match was found (Req 8.4)", async () => {
    recommendMock.mockResolvedValueOnce({
      items: [{ item: sampleItem, confidence: 40 }],
      exactMatch: false,
    });

    render(<AIChefView />);

    fireEvent.click(
      screen.getByRole("button", { name: /recommend a dish/i })
    );

    expect(await screen.findByTestId("ai-chef-no-match")).toBeInTheDocument();
  });
});

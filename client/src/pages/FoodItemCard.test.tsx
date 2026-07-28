/**
 * Property-based tests for FoodItemCard rendering and availability gating.
 *
 * These target the card component directly (rendered into jsdom) so the
 * required fields and the availability gate are verified across a wide range
 * of generated food items, including the boundary ratings 0 and 5 and quantity
 * 0 (sold out).
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import fc from "fast-check";
import type { FoodItem } from "../../../types/index.js";
import { foodItemArb } from "../../../types/generators.js";
import { FoodItemCard } from "./FoodItemCard.js";

afterEach(() => {
  cleanup();
});

/** The exact star-rating aria-label the component renders for a rating. */
function expectedRatingLabel(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  return `Rating: ${clamped} out of 5 stars`;
}

// Feature: bytebites, Property 1: Food item card renders all required fields
// Validates: Requirements 2.1, 2.2, 2.5
describe("Property 1: Food item card renders all required fields", () => {
  it("renders image, description, star rating, available quantity, and INR price", () => {
    fc.assert(
      fc.property(foodItemArb(), (item: FoodItem) => {
        cleanup();
        render(<FoodItemCard item={item} onAddToCart={() => {}} />);

        // Image with src = imageUrl and alt = name.
        const img = screen.getByTestId("food-card-image");
        expect(img).toHaveAttribute("src", item.imageUrl);
        expect(img).toHaveAttribute("alt", item.name);

        // Description (may be empty/whitespace — assert the element renders it
        // exactly, comparing textContent directly to avoid jest-dom's empty /
        // whitespace-normalization behavior).
        expect(screen.getByTestId("food-card-description").textContent).toBe(
          item.description
        );

        // Star rating matching the rating value (0..5).
        expect(screen.getByTestId("food-card-rating")).toHaveAttribute(
          "aria-label",
          expectedRatingLabel(item.rating)
        );

        // Available quantity (or an unavailable label when 0).
        const availability = screen.getByTestId("food-card-availability");
        if (item.availableQuantity === 0) {
          expect(availability).toHaveTextContent("Unavailable");
        } else {
          expect(availability).toHaveTextContent(
            `${item.availableQuantity} available`
          );
        }

        // Price in Indian Rupees.
        expect(screen.getByTestId("food-card-price")).toHaveTextContent(
          `₹${item.price.toFixed(2)}`
        );
      }),
      { numRuns: 150 }
    );
  });
});

// Feature: bytebites, Property 2: Availability gates Add to Cart
// Validates: Requirements 2.3
describe("Property 2: Availability gates Add to Cart", () => {
  it("disables Add to Cart and marks unavailable iff availableQuantity is 0", () => {
    fc.assert(
      fc.property(foodItemArb(), (item: FoodItem) => {
        cleanup();
        const onAddToCart = vi.fn();
        render(<FoodItemCard item={item} onAddToCart={onAddToCart} />);

        const button = screen.getByRole("button", { name: "Add to Cart" });
        const availability = screen.getByTestId("food-card-availability");

        const soldOut = item.availableQuantity === 0;

        // Disabled iff sold out.
        expect(button).toHaveProperty("disabled", soldOut);
        // Shown as unavailable iff sold out.
        expect(availability.textContent?.includes("Unavailable")).toBe(soldOut);

        // A disabled button does not trigger the add handler.
        fireEvent.click(button);
        if (soldOut) {
          expect(onAddToCart).not.toHaveBeenCalled();
        } else {
          expect(onAddToCart).toHaveBeenCalledTimes(1);
        }
      }),
      { numRuns: 150 }
    );
  });
});

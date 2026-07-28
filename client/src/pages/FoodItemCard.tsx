/**
 * FoodItemCard — renders a single marketplace food item (Req 2.1, 2.2, 2.3, 2.5).
 *
 * Displays the item image, description, startup rating (0..5 with a star
 * representation), available quantity, and price in Indian Rupees. When the
 * item is sold out (availableQuantity === 0) the card is marked unavailable and
 * the "Add to Cart" button is disabled (Req 2.3). Clicking Add to Cart adds one
 * unit of the item to the cart (Req 2.4) via the injected `onAddToCart`.
 */

import type { FoodItem } from "../../../types/index.js";
import { formatINR } from "../format.js";

export interface FoodItemCardProps {
  item: FoodItem;
  onAddToCart: (item: FoodItem) => void;
}

/**
 * Render a 0..5 star rating as filled/empty star glyphs alongside the numeric
 * value, so the rating is conveyed both visually and as text. The rating is
 * rounded to the nearest whole star for the glyph representation while the
 * exact value is shown numerically.
 */
function StarRating({ rating }: { rating: number }): JSX.Element {
  const clamped = Math.max(0, Math.min(5, rating));
  const filled = Math.round(clamped);
  const stars = "★".repeat(filled) + "☆".repeat(5 - filled);
  return (
    <span
      className="food-card-rating"
      data-testid="food-card-rating"
      role="img"
      aria-label={`Rating: ${clamped} out of 5 stars`}
    >
      <span aria-hidden="true" className="food-card-stars">
        {stars}
      </span>
      <span className="food-card-rating-value">{clamped} / 5</span>
    </span>
  );
}

export function FoodItemCard({
  item,
  onAddToCart,
}: FoodItemCardProps): JSX.Element {
  const unavailable = item.availableQuantity === 0;

  return (
    <article
      className={`food-card${unavailable ? " food-card-unavailable" : ""}`}
      data-testid={`food-card-${item.id}`}
      aria-label={item.name}
    >
      <img
        className="food-card-image"
        data-testid="food-card-image"
        src={item.imageUrl}
        alt={item.name}
      />
      <h3 className="food-card-name">{item.name}</h3>
      <p className="food-card-description" data-testid="food-card-description">
        {item.description}
      </p>

      <StarRating rating={item.rating} />

      <p className="food-card-availability" data-testid="food-card-availability">
        {unavailable ? (
          <span className="food-card-unavailable-label">Unavailable</span>
        ) : (
          <span>{item.availableQuantity} available</span>
        )}
      </p>

      <p className="food-card-price" data-testid="food-card-price">
        {formatINR(item.price)}
      </p>

      <button
        type="button"
        className="food-card-add"
        disabled={unavailable}
        aria-disabled={unavailable}
        onClick={() => onAddToCart(item)}
      >
        Add to Cart
      </button>
    </article>
  );
}

export default FoodItemCard;

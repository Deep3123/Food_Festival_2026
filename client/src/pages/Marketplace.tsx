/**
 * Marketplace — the food-item browsing page (Req 2.1-2.5, 4.1, 4.3).
 *
 * Loads a stall's menu from the API using the `:stallId` route param (the QR
 * stall context, Req 4.1). When no stall param is present a default demo stall
 * is used so the plain `/marketplace` route still shows a menu. Each item is
 * rendered as a `FoodItemCard`; clicking Add to Cart adds one unit via the
 * shared cart context (Req 2.4).
 *
 * Unknown stalls surface an error view: `getMenu` throws an `ApiClientError`
 * with code `STALL_NOT_FOUND`, which is caught and rendered as a "stall not
 * found" message (Req 4.3).
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FoodItem } from "../../../types/index.js";
import { ApiClientError, getMenu } from "../api/client.js";
import { ROUTES } from "../routes.js";
import { useCart } from "../cart/CartContext.js";
import { FoodItemCard } from "./FoodItemCard.js";

/** Default stall used when the route carries no `:stallId` (plain /marketplace). */
export const DEFAULT_STALL_ID = "stall-tandoori";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; items: FoodItem[] }
  | { status: "not-found"; stallId: string }
  | { status: "error"; message: string };

export function Marketplace(): JSX.Element {
  const params = useParams<{ stallId?: string }>();
  const stallId = params.stallId ?? DEFAULT_STALL_ID;
  const { addItem, cart } = useCart();

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    getMenu(stallId)
      .then((items) => {
        if (!active) return;
        setState({ status: "loaded", items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.code === "STALL_NOT_FOUND") {
          setState({ status: "not-found", stallId });
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load the menu.";
        setState({ status: "error", message });
      });

    return () => {
      active = false;
    };
  }, [stallId]);

  if (state.status === "loading") {
    return (
      <main className="marketplace">
        <p role="status">Loading menu…</p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="marketplace">
        <div role="alert" className="marketplace-error">
          <h1>Stall not found</h1>
          <p>
            We couldn&apos;t find a stall for &ldquo;{state.stallId}&rdquo;.
            Please rescan the stall&apos;s QR code and try again.
          </p>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="marketplace">
        <div role="alert" className="marketplace-error">
          <h1>Something went wrong</h1>
          <p>{state.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="marketplace">
      <header className="marketplace-header">
        <h1>Marketplace</h1>
        <Link to={ROUTES.cart} className="marketplace-cart-link">
          Cart ({cart.reduce((sum, line) => sum + line.quantity, 0)})
        </Link>
      </header>

      {state.items.length === 0 ? (
        <p>No items are available at this stall right now.</p>
      ) : (
        <ul className="food-card-list">
          {state.items.map((item) => (
            <li key={item.id}>
              <FoodItemCard item={item} onAddToCart={addItem} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default Marketplace;

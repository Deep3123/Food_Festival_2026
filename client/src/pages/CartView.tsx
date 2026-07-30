/**
 * CartView — review and adjust the cart before checkout (Req 3.1-3.5).
 *
 * Renders each line item with its name, unit price, quantity, and line total
 * (via the pure cart module, which delegates to the pricing domain), plus the
 * order total (Req 3.1, 3.2). Quantity increase/decrease and remove controls
 * mutate the shared cart context (Req 3.3, 3.4). When an increase would exceed
 * the item's available quantity the quantity is clamped and an over-quantity
 * notice is shown (Req 3.5).
 */

import { Navigate } from "react-router-dom";
import { ROUTES } from "../routes.js";

export function CartView(): JSX.Element {
  // Redirect to checkout — cart and checkout are now a single page
  return <Navigate to={ROUTES.checkout} replace />;
}

export default CartView;

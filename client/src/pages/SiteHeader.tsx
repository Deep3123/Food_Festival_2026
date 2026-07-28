/**
 * SiteHeader — the sticky top navigation shared across every page.
 *
 * Presents the ByteBites brand plus primary links (Order / Trending / Wallet /
 * Admin / Investor). The Wallet link targets the active customer's wallet when
 * a mobile identity is set, otherwise it routes to the profile form so the user
 * can enter one first. A cart badge shows the current item count.
 */

import { Link, NavLink } from "react-router-dom";
import { ROUTES, walletPath } from "../routes.js";
import { useCart } from "../cart/CartContext.js";
import { useCustomer } from "../customer/CustomerContext.js";

export function SiteHeader(): JSX.Element {
  const { cart } = useCart();
  const { customer } = useCustomer();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const walletTarget = customer ? walletPath(customer.mobile) : ROUTES.profile;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to={ROUTES.home} className="site-brand" aria-label="ByteBites home">
          <span className="site-brand-mark">🍽</span>
          <span className="site-brand-name">ByteBites</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <NavLink to={ROUTES.marketplace} className="site-nav-link">
            Order
          </NavLink>
          <NavLink to={ROUTES.trending} className="site-nav-link">
            Trending
          </NavLink>
          <NavLink to={walletTarget} className="site-nav-link">
            Wallet
          </NavLink>
          <NavLink to={ROUTES.admin} className="site-nav-link">
            Admin
          </NavLink>
          <NavLink to={ROUTES.investor} className="site-nav-link">
            Investor
          </NavLink>
        </nav>

        <div className="site-header-actions">
          <NavLink to={ROUTES.profile} className="site-nav-profile">
            {customer ? customer.name || customer.mobile : "Sign in"}
          </NavLink>
          <Link to={ROUTES.cart} className="site-cart-link" aria-label={`Cart, ${count} items`}>
            🛒
            <span className="site-cart-count" data-testid="site-cart-count">
              {count}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;

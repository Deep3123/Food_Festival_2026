/**
 * SiteHeader — sticky top navigation with a mobile sidebar drawer.
 *
 * On desktop: horizontal nav links in the header bar.
 * On mobile: a hamburger button that opens a slide-in sidebar with all nav links.
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ROUTES, walletPath } from "../routes.js";
import { useCart } from "../cart/CartContext.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { useTheme } from "../hooks/useTheme.js";
import { ADMIN_MOBILE } from "../constants.js";

export function SiteHeader(): JSX.Element {
  const { cart } = useCart();
  const { customer } = useCustomer();
  const { theme, toggleTheme } = useTheme();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const walletTarget = customer ? walletPath(customer.mobile) : ROUTES.profile;
  const isAdmin = customer?.mobile === ADMIN_MOBILE;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation
  function closeSidebar(): void {
    setSidebarOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <button
            type="button"
            className="site-hamburger"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <Link to={ROUTES.home} className="site-brand" aria-label="Invest-a-Bite home">
            <span className="site-brand-mark">
              <span className="site-logo-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 2l1.578 17.824A2 2 0 0 0 6.556 21.5h10.888a2 2 0 0 0 1.978-1.676L21 2" />
                  <path d="M6 2c0 3 2.5 5 6 5s6-2 6-5" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              </span>
            </span>
            <span className="site-brand-name">
              <span className="site-brand-invest">Invest</span>
              <span className="site-brand-dash">-a-</span>
              <span className="site-brand-bite">Bite</span>
            </span>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="site-nav site-nav-desktop" aria-label="Primary">
            {!isAdmin && (
              <NavLink to={ROUTES.marketplace} className="site-nav-link">
                Order
              </NavLink>
            )}
            {!isAdmin && (
              <NavLink to={ROUTES.orderHistory} className="site-nav-link">
                Order History
              </NavLink>
            )}
            <NavLink to={ROUTES.trending} className="site-nav-link">
              Trending
            </NavLink>
            {isAdmin && (
              <NavLink to={ROUTES.admin} className="site-nav-link">
                Orders
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to={ROUTES.stock} className="site-nav-link">
                Stock
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to={ROUTES.adminCoupons} className="site-nav-link">
                Coupons
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to={ROUTES.adminPayment} className="site-nav-link">
                Payment
              </NavLink>
            )}
          </nav>

          <div className="site-header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <NavLink to={ROUTES.profile} className="site-nav-profile">
              {customer ? customer.name || customer.mobile : "Sign in"}
            </NavLink>
            {!isAdmin && (
              <Link to={ROUTES.checkout} className="site-cart-link" aria-label={`Cart, ${count} items`}>
                🛒
                <span className="site-cart-count" data-testid="site-cart-count">
                  {count}
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Mobile sidebar drawer */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`} aria-label="Navigation menu">
        <div className="sidebar-header">
          <span className="sidebar-brand">
            <span className="site-logo-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2l1.578 17.824A2 2 0 0 0 6.556 21.5h10.888a2 2 0 0 0 1.978-1.676L21 2" />
                <path d="M6 2c0 3 2.5 5 6 5s6-2 6-5" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </span>
            {" "}Invest-a-Bite
          </span>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={closeSidebar}
          >
            ✕
          </button>
        </div>

        {customer && (
          <div className="sidebar-user">
            <span className="sidebar-user-name">{customer.name || customer.mobile}</span>
            <span className="sidebar-user-mobile">{customer.mobile}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          {!isAdmin && (
            <NavLink to={ROUTES.marketplace} className="sidebar-nav-link" onClick={closeSidebar}>
              🛍️ Order
            </NavLink>
          )}
          {!isAdmin && (
            <NavLink to={ROUTES.orderHistory} className="sidebar-nav-link" onClick={closeSidebar}>
              📋 Order History
            </NavLink>
          )}
          <NavLink to={ROUTES.trending} className="sidebar-nav-link" onClick={closeSidebar}>
            🔥 Trending
          </NavLink>
          {isAdmin && (
            <NavLink to={ROUTES.admin} className="sidebar-nav-link" onClick={closeSidebar}>
              📊 Orders
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to={ROUTES.stock} className="sidebar-nav-link" onClick={closeSidebar}>
              📦 Stock
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to={ROUTES.adminCoupons} className="sidebar-nav-link" onClick={closeSidebar}>
              🎟️ Coupons
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to={ROUTES.adminPayment} className="sidebar-nav-link" onClick={closeSidebar}>
              💳 Payment
            </NavLink>
          )}
          {!isAdmin && (
            <NavLink to={ROUTES.checkout} className="sidebar-nav-link" onClick={closeSidebar}>
              🛒 Cart ({count})
            </NavLink>
          )}
          <NavLink to={ROUTES.profile} className="sidebar-nav-link" onClick={closeSidebar}>
            👤 Profile
          </NavLink>
        </nav>
      </aside>
    </>
  );
}

export default SiteHeader;

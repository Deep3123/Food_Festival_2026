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
                <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
                  <path d="M16 4 L28 10 L28 14 C28 22 22 28 16 30 C10 28 4 22 4 14 L4 10 Z" fill="#fff" opacity="0.9"/>
                  <path d="M12 15 L15 18 L21 12" stroke="var(--iab-primary-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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
              <NavLink to={ROUTES.admin} className="site-nav-link" end>
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
              <svg viewBox="0 0 32 32" width="14" height="14" fill="none">
                <path d="M16 4 L28 10 L28 14 C28 22 22 28 16 30 C10 28 4 22 4 14 L4 10 Z" fill="#fff" opacity="0.9"/>
                <path d="M12 15 L15 18 L21 12" stroke="var(--iab-primary-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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

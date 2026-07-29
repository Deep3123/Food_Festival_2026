/**
 * HomePage — the Invest-a-Bite landing page.
 *
 * A rich, creative landing page with hero, features, how-it-works,
 * and call-to-action sections.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes.js";

export function HomePage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-badge">🚀 OPL FinTech Food Fest 2026</div>
        <h1>Welcome to Invest-a-Bite</h1>
        <p className="hero-subheading">Where food meets fintech innovation.</p>
        <p className="hero-tagline">Invest in Taste. Earn in Happiness.</p>

        <nav className="hero-actions" aria-label="Primary">
          <button type="button" onClick={() => navigate(ROUTES.marketplace)}>
            <span aria-hidden="true">🛍️ </span>Order Now
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(ROUTES.trending)}>
            <span aria-hidden="true">🔥 </span>Trending Foods
          </button>
        </nav>
      </section>

      <section className="home-features">
        <h2 className="home-section-title">Why Invest-a-Bite?</h2>
        <div className="home-features-grid">
          <div className="home-feature-card">
            <span className="home-feature-icon">💰</span>
            <h3>Earn Reward Points</h3>
            <p>Get 10% reward points on every order. Redeem them for discounts on your next meal.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">⚡</span>
            <h3>UPI Payments</h3>
            <p>Fast, secure checkout via UPI. No cash needed — just scan, pay, and enjoy.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🎟️</span>
            <h3>Coupon Discounts</h3>
            <p>Apply coupon codes at checkout for instant discounts. We auto-suggest the best ones for you.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">📦</span>
            <h3>Real-Time Tracking</h3>
            <p>Track your order status live. Know exactly when your food is ready for pickup.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🔥</span>
            <h3>Trending Foods</h3>
            <p>See what's popular right now. Discover the most-ordered dishes at the festival.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🍽️</span>
            <h3>Curated Menu</h3>
            <p>Handpicked items with customizable variants. Choose exactly how you like your food.</p>
          </div>
        </div>
      </section>

      <section className="home-how-it-works">
        <h2 className="home-section-title">How It Works</h2>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-number">1</div>
            <h3>Browse & Pick</h3>
            <p>Explore our curated food menu. Choose items with custom variants like extra cheese.</p>
          </div>
          <div className="home-step-connector"></div>
          <div className="home-step">
            <div className="home-step-number">2</div>
            <h3>Pay with UPI</h3>
            <p>Scan the QR code or tap to pay via GPay, PhonePe, or Paytm. Apply coupons for instant discounts.</p>
          </div>
          <div className="home-step-connector"></div>
          <div className="home-step">
            <div className="home-step-number">3</div>
            <h3>Collect & Enjoy</h3>
            <p>Get your order token once payment is verified. Pick up your food and earn reward points!</p>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <h2>Ready to order?</h2>
        <p>Fresh food, fast UPI payments, and instant rewards — all in one place.</p>
        <button type="button" onClick={() => navigate(ROUTES.marketplace)}>
          Start Ordering →
        </button>
      </section>
    </main>
  );
}

export default HomePage;

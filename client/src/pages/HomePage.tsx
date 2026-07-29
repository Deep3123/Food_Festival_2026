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
          <button type="button" className="btn-secondary" onClick={() => navigate(ROUTES.investor)}>
            <span aria-hidden="true">📊 </span>Investor Dashboard
          </button>
        </nav>
      </section>

      <section className="home-features">
        <h2 className="home-section-title">Why Invest-a-Bite?</h2>
        <div className="home-features-grid">
          <div className="home-feature-card">
            <span className="home-feature-icon">💰</span>
            <h3>Earn FoodCoins</h3>
            <p>Get 10% reward points on every order. Redeem them for discounts on your next meal.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">⚡</span>
            <h3>UPI Payments</h3>
            <p>Fast, secure checkout via UPI. No cash needed — just scan, pay, and enjoy.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🤖</span>
            <h3>AI Chef</h3>
            <p>Tell us your mood and cravings. Our AI recommends the perfect dish for you.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🎰</span>
            <h3>Spin & Win</h3>
            <p>Every order unlocks a spin! Win double FoodCoins, discounts, or free drinks.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">📈</span>
            <h3>Live Metrics</h3>
            <p>Track real-time sales, satisfaction scores, and trending items like a startup dashboard.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon">🤝</span>
            <h3>Refer & Earn</h3>
            <p>Share your referral link. When friends order, you both earn bonus FoodCoins.</p>
          </div>
        </div>
      </section>

      <section className="home-how-it-works">
        <h2 className="home-section-title">How It Works</h2>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-number">1</div>
            <h3>Browse & Pick</h3>
            <p>Explore our curated food marketplace. Filter by taste, spice level, or stall.</p>
          </div>
          <div className="home-step-connector"></div>
          <div className="home-step">
            <div className="home-step-number">2</div>
            <h3>Pay with UPI</h3>
            <p>Secure one-tap checkout. Your order gets a unique token for tracking.</p>
          </div>
          <div className="home-step-connector"></div>
          <div className="home-step">
            <div className="home-step-number">3</div>
            <h3>Earn & Enjoy</h3>
            <p>Collect FoodCoins, spin the wheel, and track your order in real-time.</p>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <h2>Ready to taste the future?</h2>
        <p>Join hundreds of foodies already earning rewards with every bite.</p>
        <button type="button" onClick={() => navigate(ROUTES.marketplace)}>
          Start Ordering →
        </button>
      </section>
    </main>
  );
}

export default HomePage;

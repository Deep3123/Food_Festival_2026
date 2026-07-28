/**
 * HomePage — the ByteBites landing page.
 *
 * Renders the hero section with the exact heading, subheading, and tagline
 * required by the spec, plus three navigation buttons that route to the
 * Marketplace, Trending Board, and Investor Section respectively.
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
        <h1>Welcome to ByteBites</h1>
        <p className="hero-subheading">Where food meets fintech innovation.</p>
        <p className="hero-tagline">Invest in Taste. Earn in Happiness.</p>

        <nav className="hero-actions" aria-label="Primary">
          <button type="button" onClick={() => navigate(ROUTES.marketplace)}>
            Order Now
          </button>
          <button type="button" onClick={() => navigate(ROUTES.trending)}>
            Trending Foods
          </button>
          <button type="button" onClick={() => navigate(ROUTES.investor)}>
            Investor Dashboard
          </button>
        </nav>
      </section>
    </main>
  );
}

export default HomePage;

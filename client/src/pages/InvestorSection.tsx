/**
 * InvestorSection — the startup pitch for festival judges (Req 12.1-12.4).
 *
 * Renders four static pitch sections:
 *   - Vision statement (Req 12.1)
 *   - Revenue model: product sales, upselling, combo offers (Req 12.2)
 *   - Growth strategy: referral rewards, social media promotion, flash sales
 *     (Req 12.3)
 *   - Market traction: total customers served, total revenue, and repeat
 *     customer percentage (Req 12.4)
 *
 * The pitch content is intentionally static — it presents the business case
 * rather than live operational state (that is the Metrics Dashboard's role).
 */

import { formatINR } from "../format.js";

/** Static market-traction figures presented in the pitch. */
const TRACTION = {
  totalCustomersServed: 12480,
  totalRevenue: 1875000,
  repeatCustomerPercentage: 42,
} as const;

export function InvestorSection(): JSX.Element {
  return (
    <main className="investor">
      <h1>Investor Dashboard</h1>
      <p className="investor-tagline">Invest in Taste. Earn in Happiness.</p>

      <section className="investor-vision" aria-label="Vision" data-testid="investor-vision">
        <h2>Our Vision</h2>
        <p>
          Invest-a-Bite reimagines street food as a fintech-powered experience —
          blending a delightful food marketplace with digital wallets, rewards,
          and gamification. Our vision is to turn every foodpreneur into a
          finfluencer, making food ordering as rewarding as it is delicious.
        </p>
      </section>

      <section
        className="investor-revenue"
        aria-label="Revenue model"
        data-testid="investor-revenue-model"
      >
        <h2>Revenue Model</h2>
        <ul>
          <li>Product sales — margin on every dish sold through the marketplace.</li>
          <li>Upselling — AI Chef nudges customers toward premium add-ons.</li>
          <li>Combo offers — curated bundles that lift average order value.</li>
        </ul>
      </section>

      <section
        className="investor-growth"
        aria-label="Growth strategy"
        data-testid="investor-growth-strategy"
      >
        <h2>Growth Strategy</h2>
        <ul>
          <li>Referral rewards — customers earn FoodCoins for inviting friends.</li>
          <li>Social media promotion — shareable spins, streaks, and trending dishes.</li>
          <li>Flash sales — time-boxed deals that drive repeat visits.</li>
        </ul>
      </section>

      <section
        className="investor-traction"
        aria-label="Market traction"
        data-testid="investor-traction"
      >
        <h2>Market Traction</h2>
        <dl>
          <div>
            <dt>Total customers served</dt>
            <dd data-testid="traction-customers">
              {TRACTION.totalCustomersServed.toLocaleString("en-IN")}
            </dd>
          </div>
          <div>
            <dt>Total revenue</dt>
            <dd data-testid="traction-revenue">
              {formatINR(TRACTION.totalRevenue)}
            </dd>
          </div>
          <div>
            <dt>Repeat customer percentage</dt>
            <dd data-testid="traction-repeat">
              {TRACTION.repeatCustomerPercentage}%
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default InvestorSection;

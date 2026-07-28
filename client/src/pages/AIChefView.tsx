/**
 * AIChefView — preference-driven food recommendations (Req 8.1, 8.2, 8.3).
 *
 * Collects the three preference inputs from the Customer — hunger level, spice
 * preference, and a sweet-or-savory choice (Req 8.1) — as select controls. On
 * submit it calls `api.recommend` with the chosen preferences; the server
 * delegates to the pure `recommend` domain function and returns at least one
 * recommended item for a non-empty menu (Req 8.2), each carrying a Confidence
 * Score from 0..100 which is rendered alongside the item (Req 8.3).
 *
 * When the server reports `exactMatch: false`, the view indicates that no exact
 * match was found and that the highest-rated available item is shown instead
 * (Req 8.4).
 */

import { useState } from "react";
import type {
  Flavor,
  Portion,
  Preferences,
  Spice,
} from "../../../types/index.js";
import { recommend } from "../api/client.js";
import type { RecommendResponse } from "../api/client.js";
import { formatINR } from "../format.js";

const HUNGER_OPTIONS: readonly Portion[] = ["light", "regular", "hearty"];
const SPICE_OPTIONS: readonly Spice[] = ["mild", "medium", "hot"];
const TASTE_OPTIONS: readonly Flavor[] = ["sweet", "savory"];

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; result: RecommendResponse }
  | { status: "error"; message: string };

export function AIChefView(): JSX.Element {
  const [hunger, setHunger] = useState<Portion>("regular");
  const [spice, setSpice] = useState<Spice>("medium");
  const [taste, setTaste] = useState<Flavor>("savory");
  const [state, setState] = useState<ResultState>({ status: "idle" });

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    const prefs: Preferences = { hunger, spice, taste };
    setState({ status: "loading" });
    try {
      const result = await recommend(prefs);
      setState({ status: "loaded", result });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't fetch a recommendation.";
      setState({ status: "error", message });
    }
  }

  return (
    <main className="ai-chef">
      <h1>AI Chef</h1>
      <p>Tell us what you&apos;re craving and we&apos;ll pick something for you.</p>

      <form className="ai-chef-form" onSubmit={(e) => void handleSubmit(e)}>
        <label htmlFor="ai-chef-hunger">
          Hunger level
          <select
            id="ai-chef-hunger"
            data-testid="ai-chef-hunger"
            value={hunger}
            onChange={(e) => setHunger(e.target.value as Portion)}
          >
            {HUNGER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="ai-chef-spice">
          Spice preference
          <select
            id="ai-chef-spice"
            data-testid="ai-chef-spice"
            value={spice}
            onChange={(e) => setSpice(e.target.value as Spice)}
          >
            {SPICE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="ai-chef-taste">
          Sweet or savory
          <select
            id="ai-chef-taste"
            data-testid="ai-chef-taste"
            value={taste}
            onChange={(e) => setTaste(e.target.value as Flavor)}
          >
            {TASTE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="ai-chef-submit">
          Recommend a dish
        </button>
      </form>

      {state.status === "loading" && <p role="status">Consulting the chef…</p>}

      {state.status === "error" && (
        <p role="alert" className="ai-chef-error">
          {state.message}
        </p>
      )}

      {state.status === "loaded" && (
        <section className="ai-chef-results" aria-label="Recommendations">
          {!state.result.exactMatch && (
            <p className="ai-chef-no-match" data-testid="ai-chef-no-match">
              No exact match was found for your preferences — here&apos;s the
              highest-rated available dish instead.
            </p>
          )}

          {state.result.items.length === 0 ? (
            <p>No dishes are available to recommend right now.</p>
          ) : (
            <ul className="ai-chef-recommendations">
              {state.result.items.map(({ item, confidence }) => (
                <li
                  key={item.id}
                  className="ai-chef-recommendation"
                  data-testid={`ai-chef-recommendation-${item.id}`}
                >
                  <h2 className="ai-chef-item-name">{item.name}</h2>
                  <p className="ai-chef-item-description">{item.description}</p>
                  <p className="ai-chef-item-price">{formatINR(item.price)}</p>
                  <p
                    className="ai-chef-confidence"
                    data-testid="ai-chef-confidence"
                  >
                    Confidence: {confidence}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

export default AIChefView;

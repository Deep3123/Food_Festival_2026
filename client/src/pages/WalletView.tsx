/**
 * WalletView — FoodCoins balance and redemption (Req 9.2, 9.5).
 *
 * Reads the `:customerId` route param, fetches the wallet, and displays the
 * current FoodCoins balance (Req 9.2). It offers the three redemption option
 * types the Wallet supports — free toppings, discounts, and lucky draw entries
 * (Req 9.5) — each redeeming a fixed number of FoodCoins via `api.redeem`. On a
 * successful redemption the returned wallet is rendered, reflecting the new
 * balance; an insufficient balance is surfaced from the server's rejection
 * message (Req 9.4).
 *
 * Customer identity: the demo build has no auth, so the wallet page is reached
 * with a fixed demo customer id (see `demo.ts`), keeping earned and redeemed
 * coins on a single stable account.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiClientError, getWallet, redeem } from "../api/client.js";
import type { Wallet } from "../../../types/index.js";

/** A redemption option: a display label and its FoodCoins cost. */
interface RedemptionOption {
  key: "toppings" | "discount" | "lucky-draw";
  label: string;
  cost: number;
}

/** The three redemption option types the Wallet supports (Req 9.5). */
export const REDEMPTION_OPTIONS: readonly RedemptionOption[] = [
  { key: "toppings", label: "Free toppings", cost: 20 },
  { key: "discount", label: "Discount", cost: 50 },
  { key: "lucky-draw", label: "Lucky draw entry", cost: 30 },
] as const;

export function WalletView(): JSX.Element {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId ?? "";

  const [wallet, setWallet] = useState<Wallet | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getWallet(customerId)
      .then((w) => {
        if (!active) return;
        setWallet(w);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load wallet.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  const handleRedeem = useCallback(
    async (option: RedemptionOption): Promise<void> => {
      setNotice(undefined);
      setError(undefined);
      try {
        const updated = await redeem(customerId, option.cost);
        setWallet(updated);
        setNotice(`Redeemed ${option.cost} FoodCoins for ${option.label}.`);
      } catch (err: unknown) {
        const message =
          err instanceof ApiClientError && err.code === "INSUFFICIENT_BALANCE"
            ? "Insufficient FoodCoins balance for this reward."
            : err instanceof Error
              ? err.message
              : "Redemption failed. Please try again.";
        setError(message);
      }
    },
    [customerId]
  );

  return (
    <main className="wallet">
      <h1>Your Wallet</h1>

      {loading && !wallet ? (
        <p role="status">Loading wallet…</p>
      ) : (
        <p className="wallet-balance">
          FoodCoins balance:{" "}
          <strong data-testid="wallet-balance">
            {wallet ? wallet.foodCoins : 0}
          </strong>
        </p>
      )}

      {notice && (
        <p role="status" className="wallet-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="wallet-error">
          {error}
        </p>
      )}

      <section className="wallet-redemptions" aria-label="Redemption options">
        <h2>Redeem your FoodCoins</h2>
        <ul className="redemption-options">
          {REDEMPTION_OPTIONS.map((option) => (
            <li key={option.key} data-testid={`redemption-${option.key}`}>
              <span className="redemption-label">{option.label}</span>
              <span className="redemption-cost">{option.cost} FoodCoins</span>
              <button
                type="button"
                onClick={() => void handleRedeem(option)}
                aria-label={`Redeem ${option.label} for ${option.cost} FoodCoins`}
              >
                Redeem
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default WalletView;

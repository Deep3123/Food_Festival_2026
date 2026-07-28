/**
 * WalletView — Reward Points balance and redemption.
 *
 * Displays the user's reward points balance and their equivalent rupee value.
 * Users earn 10% of every order total as reward points.
 * Redemption: 2 points = ₹1 (1 point = ₹0.50).
 *
 * Users can redeem points for a discount on their next order.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiClientError, getWallet, redeem } from "../api/client.js";
import type { Wallet } from "../../../types/index.js";

/** A redemption option: a display label and its points cost. */
interface RedemptionOption {
  key: "toppings" | "discount" | "lucky-draw";
  label: string;
  cost: number;
  rupeeValue: number;
}

/** Redemption options with rupee equivalents (2 points = ₹1). */
export const REDEMPTION_OPTIONS: readonly RedemptionOption[] = [
  { key: "toppings", label: "₹10 off next order", cost: 20, rupeeValue: 10 },
  { key: "discount", label: "₹25 off next order", cost: 50, rupeeValue: 25 },
  { key: "lucky-draw", label: "₹15 off next order", cost: 30, rupeeValue: 15 },
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
        setError(err instanceof Error ? err.message : "Failed to load rewards.");
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
        setNotice(`Redeemed ${option.cost} points for ${option.label}!`);
      } catch (err: unknown) {
        const message =
          err instanceof ApiClientError && err.code === "INSUFFICIENT_BALANCE"
            ? "Not enough reward points for this redemption."
            : err instanceof Error
              ? err.message
              : "Redemption failed. Please try again.";
        setError(message);
      }
    },
    [customerId]
  );

  const balance = wallet?.foodCoins ?? 0;
  const rupeeValue = (balance * 0.50).toFixed(2);

  return (
    <main className="wallet">
      <h1>Your Rewards</h1>

      {loading && !wallet ? (
        <p role="status">Loading rewards…</p>
      ) : (
        <div className="wallet-balance-card">
          <p className="wallet-balance">
            Reward Points:{" "}
            <strong data-testid="wallet-balance">{balance}</strong>
          </p>
          <p className="wallet-value">
            Worth: <strong>₹{rupeeValue}</strong>
          </p>
          <p className="wallet-info">
            Earn 10% reward points on every order. 2 points = ₹1.
          </p>
        </div>
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
        <h2>Redeem your points</h2>
        <ul className="redemption-options">
          {REDEMPTION_OPTIONS.map((option) => (
            <li key={option.key} data-testid={`redemption-${option.key}`}>
              <span className="redemption-label">{option.label}</span>
              <span className="redemption-cost">{option.cost} points (= ₹{option.rupeeValue})</span>
              <button
                type="button"
                onClick={() => void handleRedeem(option)}
                disabled={balance < option.cost}
                aria-label={`Redeem ${option.label} for ${option.cost} points`}
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

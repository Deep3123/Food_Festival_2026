/**
 * SpinWheel — the post-purchase Spin & Win game (Req 13.1, 13.2).
 *
 * A spin is offered once per paid order. The order is identified by a token,
 * read from the `?token=` query parameter (or supplied directly via the
 * `token` prop for embedding, e.g. right after checkout). Clicking Spin calls
 * `api.spin(token)`; the server enforces "exactly one spin per paid order" and
 * returns the awarded reward, which is one of the allowed set (Req 13.2).
 *
 * A short CSS/state animation plays while the spin is in flight, then the
 * awarded reward from `SpinResponse.reward` is displayed. Errors — an already
 * used spin or an unpaid/unknown order — are surfaced gracefully rather than
 * crashing the view.
 */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiClientError, spin as spinApi } from "../api/client.js";
import type { SpinResponse } from "../api/client.js";

export interface SpinWheelProps {
  /** Order token to spin for; falls back to the `?token=` query param. */
  token?: string;
}

type SpinState =
  | { status: "idle" }
  | { status: "spinning" }
  | { status: "done"; result: SpinResponse }
  | { status: "error"; message: string };

export function SpinWheel({ token: tokenProp }: SpinWheelProps): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = tokenProp ?? searchParams.get("token") ?? "";

  const [state, setState] = useState<SpinState>({ status: "idle" });

  async function handleSpin(): Promise<void> {
    if (token === "") {
      setState({
        status: "error",
        message: "No paid order to spin for. Complete a purchase first.",
      });
      return;
    }
    setState({ status: "spinning" });
    try {
      const result = await spinApi(token);
      setState({ status: "done", result });
    } catch (err: unknown) {
      let message = "We couldn't complete your spin. Please try again.";
      if (err instanceof ApiClientError) {
        if (err.code === "SPIN_ALREADY_USED") {
          message = "You've already used your spin for this order.";
        } else if (err.code === "ORDER_NOT_PAID") {
          message = "This order hasn't been paid, so no spin is available.";
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setState({ status: "error", message });
    }
  }

  const spinning = state.status === "spinning";

  return (
    <main className="spin-wheel">
      <h1>Spin &amp; Win</h1>
      <p>Every paid order earns you one spin. Good luck!</p>

      <div
        className={`spin-wheel-graphic${spinning ? " spin-wheel-spinning" : ""}`}
        data-testid="spin-wheel-graphic"
        aria-hidden="true"
      >
        🎡
      </div>

      {state.status !== "done" && (
        <button
          type="button"
          className="spin-wheel-button"
          onClick={() => void handleSpin()}
          disabled={spinning}
        >
          {spinning ? "Spinning…" : "Spin the wheel"}
        </button>
      )}

      {state.status === "spinning" && (
        <p role="status">Spinning the wheel…</p>
      )}

      {state.status === "done" && (
        <p className="spin-wheel-reward" data-testid="spin-reward">
          You won: <strong>{state.result.reward}</strong>!
        </p>
      )}

      {state.status === "error" && (
        <p role="alert" className="spin-wheel-error" data-testid="spin-error">
          {state.message}
        </p>
      )}
    </main>
  );
}

export default SpinWheel;

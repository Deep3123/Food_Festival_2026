/**
 * OrderTracker — live order-status tracking for an Order_Token (Req 6.3, 6.4).
 *
 * Reads the `:token` route param and polls `getOrder` on the shared ~3s
 * interval (via `usePolling`), rendering the current Order_Status label. The
 * three status values — "Order Received", "Preparing", and "Ready for Pickup"
 * — are surfaced verbatim from the server-authoritative order state, so the
 * displayed status always matches the stored status (Req 6.3) and refreshes
 * well inside the 5-second freshness window (Req 6.4).
 *
 * An operator "Advance order" control issues a POST via `advanceOrder`
 * (`POST /api/orders/:token/advance`) — never a plain link/GET navigation to
 * that POST-only endpoint — and refreshes the tracked status on success.
 */

import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { advanceOrder, getOrder } from "../api/client.js";
import type { OrderResponse } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";

export function OrderTracker(): JSX.Element {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const fetchOrder = useCallback(
    () => getOrder(token),
    [token]
  );

  const { data, error, loading, refresh } = usePolling<OrderResponse>(
    fetchOrder,
    { enabled: token !== "" }
  );

  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState(false);

  // Operator control: advance the order to its next status via a POST to
  // `/api/orders/:token/advance` (never a GET/link navigation), then refresh
  // the tracked status from the server-authoritative state.
  const handleAdvance = useCallback(async () => {
    if (token === "" || advancing) return;
    setAdvancing(true);
    setAdvanceError(false);
    try {
      await advanceOrder(token);
      refresh();
    } catch {
      setAdvanceError(true);
    } finally {
      setAdvancing(false);
    }
  }, [token, advancing, refresh]);

  return (
    <main className="order-tracker">
      <h1>Order Tracking</h1>
      <p className="order-tracker-token">
        Token: <strong data-testid="order-tracker-token">{token}</strong>
      </p>

      {error && (
        <p role="alert" className="order-tracker-error">
          We couldn&apos;t load your order status. Retrying…
        </p>
      )}

      {loading && !data && !error && (
        <p role="status">Loading order status…</p>
      )}

      {data && (
        <>
          <p className="order-tracker-status">
            Status:{" "}
            <strong data-testid="order-status">{data.status}</strong>
          </p>
          <button
            type="button"
            className="order-tracker-advance"
            data-testid="order-advance"
            onClick={handleAdvance}
            disabled={advancing || data.status === "Ready for Pickup"}
          >
            {advancing ? "Advancing…" : "Advance order"}
          </button>
          {advanceError && (
            <p role="alert" className="order-tracker-advance-error">
              We couldn&apos;t advance the order. Please try again.
            </p>
          )}
        </>
      )}
    </main>
  );
}

export default OrderTracker;

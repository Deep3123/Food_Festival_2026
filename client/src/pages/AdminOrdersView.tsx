/**
 * AdminOrdersView — an unauthenticated demo seller/admin order dashboard.
 *
 * Lists orders from `GET /api/admin/orders` (most-recent first), polled on the
 * shared ~3s interval (via `usePolling`) so the table stays fresh, with an
 * explicit refresh button too. Each row shows the token, stall, an items
 * summary, total, customer mobile, status, and created time. An "Advance
 * status" action per row calls `advanceOrder(token)` (POST) and refreshes; it
 * is disabled once the order reaches "Ready for Pickup".
 *
 * An optional stall filter narrows the list to a single stall.
 *
 * SECURITY NOTE: this view (and its backing `/api/admin/*` endpoints) is
 * intentionally UNAUTHENTICATED for the festival demo. In production it MUST be
 * placed behind seller authentication/authorization.
 */

import { useCallback, useMemo, useState } from "react";
import { advanceOrder, getAdminOrders } from "../api/client.js";
import type { OrderResponse } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { formatINR } from "../format.js";

/** Summarize a list of cart items as "2× Paneer Tikka, 1× Naan". */
function itemsSummary(items: OrderResponse["items"]): string {
  if (items.length === 0) return "—";
  return items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

/** Format an ISO timestamp for display; falls back to the raw value. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function AdminOrdersView(): JSX.Element {
  const [stallFilter, setStallFilter] = useState("");

  const fetchOrders = useCallback(
    () => getAdminOrders(stallFilter.trim() || undefined),
    [stallFilter]
  );
  const { data, error, loading, refresh } =
    usePolling<OrderResponse[]>(fetchOrders);

  const [advancingToken, setAdvancingToken] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | undefined>(
    undefined
  );

  const handleAdvance = useCallback(
    async (token: string): Promise<void> => {
      setAdvancingToken(token);
      setAdvanceError(undefined);
      try {
        await advanceOrder(token);
        refresh();
      } catch {
        setAdvanceError("We couldn't advance that order. Please try again.");
      } finally {
        setAdvancingToken(null);
      }
    },
    [refresh]
  );

  const orders = data ?? [];

  // Stall options derived from the current result set, for the filter select.
  const stallOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const order of orders) ids.add(order.stallId);
    return Array.from(ids).sort();
  }, [orders]);

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Order Management</h1>
        <p className="admin-note" data-testid="admin-note">
          Unauthenticated demo admin view — in production this would sit behind
          seller sign-in.
        </p>
      </header>

      <div className="admin-controls">
        <label className="admin-filter" htmlFor="admin-stall-filter">
          Filter by stall
          <select
            id="admin-stall-filter"
            data-testid="admin-stall-filter"
            value={stallFilter}
            onChange={(e) => setStallFilter(e.target.value)}
          >
            <option value="">All stalls</option>
            {stallOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-refresh"
          data-testid="admin-refresh"
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      {error && !data && (
        <p role="alert" className="admin-error">
          We couldn&apos;t load orders. Retrying…
        </p>
      )}

      {advanceError && (
        <p role="alert" className="admin-advance-error" data-testid="admin-advance-error">
          {advanceError}
        </p>
      )}

      {loading && !data && !error && <p role="status">Loading orders…</p>}

      {data &&
        (orders.length === 0 ? (
          <p data-testid="admin-empty">No orders yet.</p>
        ) : (
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Stall</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Customer</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const atEnd = order.status === "Ready for Pickup";
                const busy = advancingToken === order.token;
                return (
                  <tr
                    key={order.token}
                    className="admin-order-row"
                    data-testid={`admin-order-${order.token}`}
                  >
                    <td className="admin-cell-token">{order.token}</td>
                    <td>{order.stallId}</td>
                    <td className="admin-cell-items">
                      {itemsSummary(order.items)}
                    </td>
                    <td>{formatINR(order.total)}</td>
                    <td>{order.customerId}</td>
                    <td>
                      <span
                        className="admin-status"
                        data-testid={`admin-status-${order.token}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td>{formatCreatedAt(order.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-advance"
                        data-testid={`admin-advance-${order.token}`}
                        onClick={() => void handleAdvance(order.token)}
                        disabled={atEnd || busy}
                      >
                        {busy ? "Advancing…" : "Advance status"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
    </main>
  );
}

export default AdminOrdersView;

/**
 * AdminOrdersView — admin order dashboard with sub-tabs.
 *
 * Orders are segregated into 3 categories:
 *   - New Orders: status "Craving Funded"
 *   - Processing: status "Flavor Processing" or "Taste Ready for Pickup"
 *   - Completed: status "Happiness Disbursed"
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { advanceOrder, getAdminOrders, cancelOrder, getCustomer } from "../api/client.js";
import type { OrderResponse } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { ADMIN_MOBILE } from "../constants.js";
import { ROUTES } from "../routes.js";
import { formatINR } from "../format.js";

type AdminTab = "new" | "completed";

/** Summarize a list of cart items as "2× Paneer Tikka, 1× Naan". */
function itemsSummary(items: OrderResponse["items"]): string {
  if (items.length === 0) return "—";
  return items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

/** Format an ISO timestamp for display. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function AdminOrdersView(): JSX.Element {
  const { customer } = useCustomer();

  if (!customer || customer.mobile !== ADMIN_MOBILE) {
    return (
      <main className="admin">
        <h1>Access Denied</h1>
        <p>You do not have permission to view this page.</p>
        <Link to={ROUTES.home}>Go to Home</Link>
      </main>
    );
  }

  return <AdminOrdersPanel />;
}

function AdminOrdersPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTab>("new");
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(() => getAdminOrders(), []);
  const { data, error, loading, refresh } =
    usePolling<OrderResponse[]>(fetchOrders);

  // Fetch customer names for orders
  useEffect(() => {
    if (!data) return;
    const unknownMobiles = [...new Set(data.map(o => o.customerId))].filter(m => !customerNames[m]);
    unknownMobiles.forEach(mobile => {
      getCustomer(mobile).then(c => {
        if (c.name) setCustomerNames(prev => ({ ...prev, [mobile]: c.name }));
      }).catch(() => {});
    });
  }, [data]);

  const [advancingToken, setAdvancingToken] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | undefined>(undefined);

  const handleAdvance = useCallback(
    async (token: string, skipToCompleted = false): Promise<void> => {
      setAdvancingToken(token);
      setAdvanceError(undefined);
      try {
        if (skipToCompleted) {
          // Advance through all intermediate statuses to "Happiness Disbursed"
          await advanceOrder(token); // Craving Funded → Flavor Processing
          await advanceOrder(token); // Flavor Processing → Taste Ready for Pickup
          await advanceOrder(token); // Taste Ready for Pickup → Happiness Disbursed
        } else {
          await advanceOrder(token);
        }
        refresh();
      } catch {
        setAdvanceError("We couldn't advance that order. Please try again.");
      } finally {
        setAdvancingToken(null);
      }
    },
    [refresh]
  );

  const handleReject = useCallback(
    async (token: string): Promise<void> => {
      setAdvancingToken(token);
      setAdvanceError(undefined);
      try {
        await cancelOrder(token);
        refresh();
      } catch {
        setAdvanceError("We couldn't reject that order. Please try again.");
      } finally {
        setAdvancingToken(null);
      }
    },
    [refresh]
  );

  const orders = data ?? [];

  // Filter orders by tab (exclude cancelled orders)
  const newOrders = orders.filter((o) => o.status === "Craving Funded" && !(o as unknown as Record<string, unknown>).cancelled);
  const processingOrders = orders.filter(
    (o) => o.status === "Flavor Processing" || o.status === "Taste Ready for Pickup"
  );
  const completedOrders = orders.filter((o) => o.status === "Happiness Disbursed" && !(o as unknown as Record<string, unknown>).cancelled);

  const displayedOrders =
    activeTab === "new"
      ? newOrders
      : completedOrders;

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Order Management</h1>
      </header>

      {/* Sub-tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === "new" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          New Orders
          {newOrders.length > 0 && (
            <span className="admin-tab-badge">{newOrders.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "completed" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          Completed
          {completedOrders.length > 0 && (
            <span className="admin-tab-badge">{completedOrders.length}</span>
          )}
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

      {data && displayedOrders.length === 0 && (
        <p className="admin-empty-tab" data-testid="admin-empty">
          No {activeTab === "new" ? "new" : "completed"} orders.
        </p>
      )}

      {data && displayedOrders.length > 0 && (
        <div className="admin-order-cards">
          {displayedOrders.map((order) => {
            const atEnd = order.status === "Happiness Disbursed";
            const busy = advancingToken === order.token;
            return (
              <div
                key={order.token}
                className="admin-order-card"
                data-testid={`admin-order-${order.token}`}
              >
                <div className="admin-order-card-header">
                  <span className="admin-order-card-token">{order.token}</span>
                  <span className="admin-order-card-time">
                    {formatCreatedAt(order.createdAt)}
                  </span>
                </div>

                <div className="admin-order-card-customer">
                  👤 {customerNames[order.customerId] ? `${customerNames[order.customerId]} (${order.customerId})` : order.customerId}
                </div>

                <div className="admin-order-card-items">
                  {itemsSummary(order.items)}
                </div>

                <div className="admin-order-card-footer">
                  <span className="admin-order-card-total">
                    {formatINR(order.total)}
                  </span>
                  <span
                    className="admin-status"
                    data-testid={`admin-status-${order.token}`}
                  >
                    {order.status}
                  </span>
                </div>

                {!atEnd && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="admin-advance"
                      data-testid={`admin-advance-${order.token}`}
                      onClick={() => void handleAdvance(order.token, order.status === "Craving Funded")}
                      disabled={busy}
                    >
                      {busy
                        ? "Processing…"
                        : order.status === "Craving Funded"
                          ? "✓ Approve Payment"
                          : "Mark Completed"}
                    </button>
                    {order.status === "Craving Funded" && (
                      <button
                        type="button"
                        className="admin-advance"
                        style={{ background: "var(--iab-danger)", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}
                        onClick={() => void handleReject(order.token)}
                        disabled={busy}
                      >
                        ✕ Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default AdminOrdersView;

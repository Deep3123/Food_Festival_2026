/**
 * StockManagementView — admin-only page for managing food item stock levels.
 *
 * Lists all food items across all stalls. The admin can mark items as out of
 * stock (set quantity to 0) or restore stock by setting a new quantity. Only
 * accessible to the admin user (mobile 9512311001).
 */

import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminItems, updateItemStock } from "../api/client.js";
import type { FoodItem } from "../../../types/index.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { usePolling } from "../hooks/usePolling.js";
import { ADMIN_MOBILE } from "../constants.js";
import { ROUTES } from "../routes.js";
import { formatINR } from "../format.js";

export function StockManagementView(): JSX.Element {
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

  return <StockPanel />;
}

function StockPanel(): JSX.Element {
  const fetchItems = useCallback(() => getAdminItems(), []);
  const { data: items, error, loading, refresh } = usePolling<FoodItem[]>(fetchItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleMarkOutOfStock(itemId: string): Promise<void> {
    setUpdatingId(itemId);
    try {
      await updateItemStock(itemId, 0);
      refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRestoreStock(itemId: string, quantity: number): Promise<void> {
    setUpdatingId(itemId);
    try {
      await updateItemStock(itemId, quantity);
      refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Stock Management</h1>
        <p className="admin-note">
          Mark items as out of stock or restore their availability.
        </p>
      </header>

      {error && !items && (
        <p role="alert" className="admin-error">
          Couldn&apos;t load items. Retrying…
        </p>
      )}

      {loading && !items && !error && <p role="status">Loading items…</p>}

      {items && items.length === 0 && <p>No items found.</p>}

      {items && items.length > 0 && (
        <div className="stock-grid" data-testid="stock-grid">
          {items.map((item) => {
            const isOutOfStock = item.availableQuantity === 0;
            const busy = updatingId === item.id;
            return (
              <StockCard
                key={item.id}
                item={item}
                isOutOfStock={isOutOfStock}
                busy={busy}
                onMarkOutOfStock={handleMarkOutOfStock}
                onRestoreStock={handleRestoreStock}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

interface StockCardProps {
  item: FoodItem;
  isOutOfStock: boolean;
  busy: boolean;
  onMarkOutOfStock: (itemId: string) => void;
  onRestoreStock: (itemId: string, quantity: number) => void;
}

function StockCard({
  item,
  isOutOfStock,
  busy,
  onMarkOutOfStock,
  onRestoreStock,
}: StockCardProps): JSX.Element {
  const [restoreQty, setRestoreQty] = useState("50");

  return (
    <article
      className={`stock-card${isOutOfStock ? " stock-card--out" : ""}`}
      data-testid={`stock-card-${item.id}`}
    >
      <div className="stock-card-header">
        <h3 className="stock-card-name">{item.name}</h3>
        <span className="stock-card-stall">{item.stallId}</span>
      </div>

      <div className="stock-card-info">
        <span className="stock-card-price">{formatINR(item.price)}</span>
        <span
          className={`stock-card-qty ${isOutOfStock ? "stock-card-qty--zero" : ""}`}
          data-testid={`stock-qty-${item.id}`}
        >
          {isOutOfStock ? "OUT OF STOCK" : `${item.availableQuantity} in stock`}
        </span>
      </div>

      <div className="stock-card-actions">
        {isOutOfStock ? (
          <div className="stock-card-restore">
            <input
              type="number"
              min="1"
              value={restoreQty}
              onChange={(e) => setRestoreQty(e.target.value)}
              className="stock-card-input"
              aria-label={`Restore quantity for ${item.name}`}
            />
            <button
              type="button"
              className="stock-card-btn stock-card-btn--restore"
              disabled={busy || !restoreQty || Number(restoreQty) < 1}
              onClick={() => onRestoreStock(item.id, Number(restoreQty))}
            >
              {busy ? "Updating…" : "Restore Stock"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="stock-card-btn stock-card-btn--out"
            disabled={busy}
            onClick={() => onMarkOutOfStock(item.id)}
          >
            {busy ? "Updating…" : "Mark Out of Stock"}
          </button>
        )}
      </div>
    </article>
  );
}

export default StockManagementView;

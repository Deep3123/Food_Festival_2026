/**
 * StockManagementView — admin page for managing food items and stock.
 */

import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminItems, updateItemStock, createAdminItem, updateAdminItem, deleteAdminItem } from "../api/client.js";
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
  const [showAdd, setShowAdd] = useState(false);
  const fetchItems = useCallback(() => getAdminItems(), []);
  const { data: items, error, loading, refresh } = usePolling<FoodItem[]>(fetchItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);

  async function handleUpdateStock(itemId: string, qty: number): Promise<void> {
    setUpdatingId(itemId);
    try { await updateItemStock(itemId, qty); refresh(); }
    finally { setUpdatingId(null); }
  }

  async function handleDeleteItem(itemId: string): Promise<void> {
    if (!confirm("Delete this item permanently?")) return;
    setUpdatingId(itemId);
    try { await deleteAdminItem(itemId); refresh(); }
    finally { setUpdatingId(null); }
  }

  async function handleSaveEdit(item: FoodItem): Promise<void> {
    await updateAdminItem(item.id, item);
    setEditingItem(null);
    refresh();
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>📦 Stock & Products</h1>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{ marginTop: "0.5rem" }}>
          {showAdd ? "✕ Cancel" : "➕ Add Product"}
        </button>
      </header>

      {showAdd && <AddProductForm onCreated={() => { setShowAdd(false); refresh(); }} />}

      {error && !items && <p className="admin-error">Couldn't load items. Retrying…</p>}
      {loading && !items && <p>Loading items…</p>}

      {editingItem && (
        <EditItemModal item={editingItem} onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} />
      )}

      {items && items.length > 0 && (
        <div className="stock-grid">
          {items.map((item) => {
            const isLow = item.availableQuantity > 0 && item.availableQuantity < 10;
            const isOut = item.availableQuantity === 0;
            return (
              <article key={item.id} className={`stock-card${isOut ? " stock-card--out" : isLow ? " stock-card--low" : ""}`}>
                <div className="stock-card-header">
                  <h3 className="stock-card-name">{item.name}</h3>
                  {isLow && <span className="stock-low-badge">Low Stock</span>}
                  {isOut && <span className="stock-out-badge">Out of Stock</span>}
                </div>
                {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="stock-card-img" />}
                <div className="stock-card-info">
                  <span className="stock-card-price">{formatINR(item.price)}</span>
                  <span className={`stock-card-qty ${isOut ? "stock-card-qty--zero" : ""}`}>
                    {isOut ? "0" : item.availableQuantity} units
                  </span>
                </div>
                {item.variants && item.variants.length > 0 && (
                  <div className="stock-card-variants">
                    {item.variants.map((v) => <span key={v.name} className="stock-variant-tag">{v.name} (+₹{v.priceAddon})</span>)}
                  </div>
                )}
                <div className="stock-card-actions">
                  <input type="number" min="0" defaultValue={item.availableQuantity} className="stock-card-input"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== item.availableQuantity) handleUpdateStock(item.id, v); }}
                  />
                  <button type="button" className="stock-card-btn stock-card-btn--restore" disabled={updatingId === item.id}
                    onClick={() => setEditingItem(item)}>✏️ Edit</button>
                  <button type="button" className="stock-card-btn stock-card-btn--out" disabled={updatingId === item.id}
                    onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function EditItemModal({ item, onSave, onCancel }: { item: FoodItem; onSave: (i: FoodItem) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...item });
  const [variantText, setVariantText] = useState(item.variants?.map(v => `${v.name}:${v.priceAddon}`).join(", ") ?? "");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const variants = variantText.split(",").map(s => s.trim()).filter(Boolean).map(s => {
      const [name, price] = s.split(":");
      return { name: name.trim(), priceAddon: Number(price) || 0 };
    });
    onSave({ ...form, variants: variants.length > 0 ? variants : undefined });
  }
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Edit: {item.name}</h3>
        <label>Name <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Image URL <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} /></label>
        <label>Description <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label>Price (₹) <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></label>
        <label>Quantity <input type="number" value={form.availableQuantity} onChange={e => setForm({ ...form, availableQuantity: Number(e.target.value) })} /></label>
        <label>Variants (name:price, ...) <input value={variantText} onChange={e => setVariantText(e.target.value)} placeholder="With Cheese:20, Extra Spicy:10" /></label>
        <div className="modal-actions">
          <button type="submit">Save Changes</button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function AddProductForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", imageUrl: "", description: "", price: 0, availableQuantity: 50, stallId: "stall-tandoori", spice: "medium" as const, flavor: "savory" as const, portion: "regular" as const });
  const [variants, setVariants] = useState("");
  const [saving, setSaving] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const parsedVariants = variants.split(",").map(s => s.trim()).filter(Boolean).map(s => {
      const [name, price] = s.split(":");
      return { name: name.trim(), priceAddon: Number(price) || 0 };
    });
    await createAdminItem({ ...form, variants: parsedVariants.length > 0 ? parsedVariants : undefined });
    setForm({ name: "", imageUrl: "", description: "", price: 0, availableQuantity: 50, stallId: "stall-tandoori", spice: "medium", flavor: "savory", portion: "regular" });
    setVariants("");
    setSaving(false);
    onCreated();
  }
  return (
    <form className="profile-form" onSubmit={handleSubmit} style={{ maxWidth: "100%", marginBottom: "2rem" }}>
      <h3>Add New Product</h3>
      <label className="profile-field">Name <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="profile-field">Image URL <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
      <label className="profile-field">Description <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label className="profile-field">Price (₹) <input type="number" required min="1" value={form.price || ""} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></label>
      <label className="profile-field">Quantity <input type="number" value={form.availableQuantity} onChange={e => setForm({ ...form, availableQuantity: Number(e.target.value) })} /></label>
      <label className="profile-field">Variants (name:price, ...) <input value={variants} onChange={e => setVariants(e.target.value)} placeholder="With Cheese:20, Without Cheese:0" /></label>
      <button type="submit" disabled={saving} className="profile-submit">{saving ? "Creating…" : "Create Product"}</button>
    </form>
  );
}

export default StockManagementView;

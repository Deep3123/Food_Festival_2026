/**
 * AdminCouponsView — admin page for managing coupons.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminCoupons, createCoupon, deleteCoupon } from "../api/client.js";
import type { CouponResponse } from "../api/client.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { ADMIN_MOBILE } from "../constants.js";
import { ROUTES } from "../routes.js";

export function AdminCouponsView(): JSX.Element {
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

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>🎟️ Coupon Management</h1>
      </header>
      <CouponPanel />
    </main>
  );
}

function CouponPanel() {
  const [coupons, setCoupons] = useState<CouponResponse[]>([]);
  const [form, setForm] = useState({ code: "", type: "percent" as "percent" | "flat", value: 10, minOrderValue: 100, maxDiscount: 50 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminCoupons().then(setCoupons).catch(() => {}); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createCoupon(form);
    const updated = await getAdminCoupons();
    setCoupons(updated);
    setForm({ code: "", type: "percent", value: 10, minOrderValue: 100, maxDiscount: 50 });
    setSaving(false);
  }

  async function handleDelete(code: string) {
    await deleteCoupon(code);
    setCoupons(c => c.filter(x => x.code !== code));
  }

  return (
    <div>
      <form className="profile-form" onSubmit={handleCreate} style={{ maxWidth: "100%", marginBottom: "2rem" }}>
        <h3>Create New Coupon</h3>
        <label className="profile-field">Code <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" /></label>
        <label className="profile-field">Type
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as "percent" | "flat" })}>
            <option value="percent">Percentage (%)</option><option value="flat">Flat Amount (₹)</option>
          </select>
        </label>
        <label className="profile-field">Discount Value <input type="number" required value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></label>
        <label className="profile-field">Min Order Value (₹) <input type="number" required value={form.minOrderValue} onChange={e => setForm({ ...form, minOrderValue: Number(e.target.value) })} /></label>
        {form.type === "percent" && <label className="profile-field">Max Discount Cap (₹) <input type="number" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: Number(e.target.value) })} /></label>}
        <button type="submit" disabled={saving} className="profile-submit">{saving ? "Creating…" : "Create Coupon"}</button>
      </form>

      {coupons.length === 0 && <p className="admin-empty-tab">No coupons created yet.</p>}

      {coupons.length > 0 && (
        <div className="stock-grid">
          {coupons.map(c => (
            <article key={c.code} className="stock-card">
              <div className="stock-card-header"><h3 className="stock-card-name">{c.code}</h3></div>
              <p style={{ color: "var(--iab-ink-secondary)", fontSize: "0.9rem" }}>
                {c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`} • Min ₹{c.minOrderValue}
                {c.maxDiscount ? ` • Max ₹${c.maxDiscount}` : ""}
              </p>
              <button type="button" className="stock-card-btn stock-card-btn--out" onClick={() => handleDelete(c.code)}>Delete</button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminCouponsView;

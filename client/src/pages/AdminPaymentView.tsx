/**
 * AdminPaymentView — admin page for configuring UPI payment settings.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminConfig, updateAdminConfig } from "../api/client.js";
import type { PaymentConfig } from "../api/client.js";
import { useCustomer } from "../customer/CustomerContext.js";
import { ADMIN_MOBILE } from "../constants.js";
import { ROUTES } from "../routes.js";

export function AdminPaymentView(): JSX.Element {
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
        <h1>💳 Payment Configuration</h1>
      </header>
      <PaymentPanel />
    </main>
  );
}

function PaymentPanel() {
  const [config, setConfig] = useState<PaymentConfig>({ upiId: "", upiName: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getAdminConfig().then(setConfig).catch(() => {}); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateAdminConfig(config);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form className="profile-form" onSubmit={handleSave} style={{ maxWidth: "100%" }}>
      <p style={{ color: "var(--iab-ink-secondary)", marginBottom: "1.5rem" }}>
        Configure where UPI payments are directed. Users will see a QR code and payment links pointing to this UPI ID.
      </p>
      <label className="profile-field">UPI ID <input required value={config.upiId} onChange={e => setConfig({ ...config, upiId: e.target.value })} placeholder="yourname@upi" /></label>
      <label className="profile-field">Display Name <input required value={config.upiName} onChange={e => setConfig({ ...config, upiName: e.target.value })} placeholder="Invest-a-Bite" /></label>
      <button type="submit" disabled={saving} className="profile-submit">{saving ? "Saving…" : "Save Configuration"}</button>
      {saved && <p className="profile-saved">✓ Payment configuration saved successfully!</p>}
    </form>
  );
}

export default AdminPaymentView;

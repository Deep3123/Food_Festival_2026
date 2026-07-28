/**
 * ReferralView — the Customer's unique referral link (Req 10.1).
 *
 * Reads the `:customerId` route param (falling back to the fixed demo customer
 * id when absent, since the demo build has no auth) and fetches the referral
 * record from the API. The Referral_System generates a unique link per
 * customer; this view displays that link so the Customer can share it to earn
 * referral rewards.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Referral } from "../../../types/index.js";
import { getReferral } from "../api/client.js";
import { useCustomer } from "../customer/CustomerContext.js";

export function ReferralView(): JSX.Element {
  const params = useParams<{ customerId: string }>();
  const { customer } = useCustomer();
  const customerId = params.customerId ?? customer?.mobile ?? "";

  const [referral, setReferral] = useState<Referral | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReferral(customerId)
      .then((r) => {
        if (!active) return;
        setReferral(r);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load referral link."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <main className="referral">
      <h1>Refer &amp; Earn</h1>
      <p>Share your link with friends and earn 10 FoodCoins per referral.</p>

      {loading && !referral && <p role="status">Loading your referral link…</p>}

      {error && (
        <p role="alert" className="referral-error">
          {error}
        </p>
      )}

      {referral && (
        <p className="referral-link">
          Your referral link:{" "}
          <a data-testid="referral-link" href={referral.link}>
            {referral.link}
          </a>
        </p>
      )}
    </main>
  );
}

export default ReferralView;

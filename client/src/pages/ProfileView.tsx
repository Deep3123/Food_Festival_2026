/**
 * ProfileView — capture the customer's mobile-number identity.
 *
 * ByteBites has no auth; a customer is identified by their mobile number (the
 * canonical `customerId`). This page lets the user enter their mobile number +
 * name (+ optional email) and register/upsert via `POST /api/customers`. On
 * success the returned customer becomes the active identity (stored in
 * `CustomerContext` and persisted to localStorage). An `INVALID_MOBILE` error
 * from the server is surfaced inline next to the mobile field.
 *
 * The form is reused both as a standalone `/profile` route and as the checkout
 * gate (via the `onSaved` callback) when no identity is set yet.
 */

import { useState } from "react";
import { ApiClientError, registerCustomer } from "../api/client.js";
import { useCustomer } from "../customer/CustomerContext.js";
import type { Customer } from "../../../types/index.js";

export interface CustomerFormProps {
  /** Called with the saved customer after a successful registration. */
  onSaved?: (customer: Customer) => void;
  /** Optional heading override (e.g. when used as a checkout gate). */
  heading?: string;
  /** Optional lead paragraph override. */
  lead?: string;
}

/**
 * The reusable customer-identity form. Emits the saved customer via `onSaved`
 * and updates the shared CustomerContext.
 */
export function CustomerForm({
  onSaved,
  heading = "Your details",
  lead = "Enter your mobile number so we can attach your orders, FoodCoins, and rewards to you.",
}: CustomerFormProps): JSX.Element {
  const { customer, setCustomer } = useCustomer();
  const [mobile, setMobile] = useState(customer?.mobile ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [mobileError, setMobileError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [savedName, setSavedName] = useState<string | undefined>(undefined);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    setMobileError(undefined);
    setError(undefined);
    setSavedName(undefined);
    setSubmitting(true);
    try {
      const saved = await registerCustomer({
        mobile,
        name,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setCustomer(saved);
      setSavedName(saved.name || saved.mobile);
      onSaved?.(saved);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === "INVALID_MOBILE") {
        setMobileError(
          "Please enter a valid mobile number (10–15 digits, optional leading +)."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't save your details. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={(e) => void handleSubmit(e)}>
      <h1>{heading}</h1>
      <p className="profile-lead">{lead}</p>

      <label className="profile-field" htmlFor="profile-mobile">
        Mobile number
        <input
          id="profile-mobile"
          data-testid="profile-mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          aria-invalid={mobileError ? "true" : undefined}
          aria-describedby={mobileError ? "profile-mobile-error" : undefined}
          required
        />
      </label>
      {mobileError && (
        <p
          role="alert"
          id="profile-mobile-error"
          className="profile-error"
          data-testid="profile-mobile-error"
        >
          {mobileError}
        </p>
      )}

      <label className="profile-field" htmlFor="profile-name">
        Name
        <input
          id="profile-name"
          data-testid="profile-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label className="profile-field" htmlFor="profile-email">
        Email <span className="profile-optional">(optional)</span>
        <input
          id="profile-email"
          data-testid="profile-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="profile-error" data-testid="profile-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="profile-submit"
        data-testid="profile-submit"
        disabled={submitting}
      >
        {submitting ? "Saving…" : "Save my details"}
      </button>

      {savedName && (
        <p role="status" className="profile-saved" data-testid="profile-saved">
          You&apos;re all set, {savedName}.
        </p>
      )}
    </form>
  );
}

export function ProfileView(): JSX.Element {
  const { customer } = useCustomer();
  return (
    <main className="profile">
      {customer && (
        <p className="profile-current" data-testid="profile-current">
          Signed in as <strong>{customer.name || customer.mobile}</strong> (
          {customer.mobile}).
        </p>
      )}
      <CustomerForm />
    </main>
  );
}

export default ProfileView;

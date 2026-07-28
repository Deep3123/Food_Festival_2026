/**
 * CustomerContext — a lightweight React context/store for the active customer
 * identity (mobile number + name + optional email).
 *
 * ByteBites has no auth layer; instead the customer is identified by their
 * mobile number (the canonical `customerId` used across orders, wallets, and
 * referrals — see `types/index.ts` `Customer`). This provider holds the current
 * customer in state and persists it to `localStorage` so the identity survives
 * a page reload (a customer's earned FoodCoins stay attached to the same
 * account across sessions).
 *
 * The provider is intentionally thin: pages read `customer` to decide whether
 * to gate an action (e.g. checkout) and call `setCustomer` after a successful
 * `POST /api/customers` registration. `clearCustomer` supports switching
 * identities.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Customer } from "../../../types/index.js";

/** localStorage key under which the active customer identity is persisted. */
export const CUSTOMER_STORAGE_KEY = "bytebites.customer";

/** Read and validate a persisted customer from localStorage, if any. */
function readStoredCustomer(): Customer | null {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Customer>;
    if (
      parsed &&
      typeof parsed.mobile === "string" &&
      parsed.mobile.length > 0 &&
      typeof parsed.name === "string"
    ) {
      return {
        mobile: parsed.mobile,
        name: parsed.name,
        ...(typeof parsed.email === "string" && parsed.email
          ? { email: parsed.email }
          : {}),
      };
    }
  } catch {
    // Corrupt/unavailable storage — fall back to no persisted identity.
  }
  return null;
}

export interface CustomerContextValue {
  /** The active customer identity, or null when none has been set yet. */
  customer: Customer | null;
  /** Set (and persist) the active customer identity. */
  setCustomer: (customer: Customer) => void;
  /** Clear the active customer identity (and remove it from storage). */
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | undefined>(
  undefined
);

export function CustomerProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [customer, setCustomerState] = useState<Customer | null>(() =>
    readStoredCustomer()
  );

  const setCustomer = useCallback((next: Customer) => {
    setCustomerState(next);
    try {
      window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures (e.g. private mode); identity still lives in
      // memory for this session.
    }
  }, []);

  const clearCustomer = useCallback(() => {
    setCustomerState(null);
    try {
      window.localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const value = useMemo<CustomerContextValue>(
    () => ({ customer, setCustomer, clearCustomer }),
    [customer, setCustomer, clearCustomer]
  );

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

/** Access the customer context; throws if used outside a <CustomerProvider>. */
export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return ctx;
}

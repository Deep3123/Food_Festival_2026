/**
 * Demo identity constants for the ByteBites festival build.
 *
 * ByteBites has no authentication layer (festival demo scope). Customer
 * identity is now driven by a real mobile number captured through the customer
 * profile form and held in `CustomerContext` (persisted to localStorage). The
 * previous fixed `DEMO_CUSTOMER_ID` has been retired in favour of that flow.
 *
 * The demo stall id mirrors the Marketplace default so a checkout started from
 * the plain `/marketplace` route is associated with a real seeded stall.
 */

/** Default Stall associated with demo checkouts (matches the Marketplace default). */
export const DEMO_STALL_ID = "stall-tandoori";

/**
 * Shared type definitions for ByteBites.
 *
 * These types mirror the Data Models section of the design document exactly.
 * They are framework-agnostic and shared across the pure domain modules,
 * the Express API, and the React client.
 */
// --- Convenient value tuples for enumerations ------------------------------
export const ORDER_STATUS_SEQUENCE = [
    "Craving Funded",
    "Flavor Processing",
    "Taste Ready for Pickup",
    "Happiness Disbursed",
];
export const SPIN_REWARDS = [
    "5% discount",
    "free drink",
    "double FoodCoins",
    "lucky draw ticket",
];
export const SPICE_VALUES = ["mild", "medium", "hot"];
export const FLAVOR_VALUES = ["sweet", "savory"];
export const PORTION_VALUES = [
    "light",
    "regular",
    "hearty",
];
//# sourceMappingURL=index.js.map
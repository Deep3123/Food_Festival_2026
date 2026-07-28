/**
 * Shared type definitions for ByteBites.
 *
 * These types mirror the Data Models section of the design document exactly.
 * They are framework-agnostic and shared across the pure domain modules,
 * the Express API, and the React client.
 */
export type Spice = "mild" | "medium" | "hot";
export type Flavor = "sweet" | "savory";
export type Portion = "light" | "regular" | "hearty";
export type OrderStatus = "Order Received" | "Preparing" | "Ready for Pickup";
export type SpinReward = "5% discount" | "free drink" | "double FoodCoins" | "lucky draw ticket";
export type PaymentMethod = "UPI" | "other";
export interface FoodItem {
    id: string;
    name: string;
    imageUrl: string;
    description: string;
    rating: number;
    availableQuantity: number;
    price: number;
    stallId: string;
    spice: Spice;
    flavor: Flavor;
    portion: Portion;
}
export interface CartItem {
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
}
export interface Stall {
    id: string;
    name: string;
    qrSlug: string;
}
export interface Order {
    token: string;
    stallId: string;
    items: CartItem[];
    total: number;
    status: OrderStatus;
    paid: boolean;
    paymentMethod: PaymentMethod;
    gatewayRef?: string;
    customerId: string;
    createdAt: string;
    spinUsed: boolean;
}
/**
 * A successfully paid order, used by trending and metrics computations.
 * This is the subset shape the pure domain modules operate over.
 */
export type PaidOrder = Order;
export interface Wallet {
    customerId: string;
    foodCoins: number;
}
export interface Referral {
    customerId: string;
    link: string;
    creditedReferredIds: string[];
}
export interface Preferences {
    hunger: Portion;
    spice: Spice;
    taste: Flavor;
}
export interface RecommendedItem {
    item: FoodItem;
    confidence: number;
}
export interface TrendingEntry {
    itemId: string;
    name: string;
    unitsOrdered: number;
}
export interface Metrics {
    totalOrdersToday: number;
    revenueGenerated: number;
    digitalPaymentPercentage: number;
    bestSellingProduct: string | null;
    customerSatisfactionScore: number;
}
export interface PaymentResult {
    success: boolean;
    gatewayRef?: string;
    failureReason?: string;
}
export interface OrderContext {
    stallId: string;
    customerId: string;
    items: CartItem[];
}
export interface PaymentGateway {
    initiatePayment(amountInRupees: number, orderContext: OrderContext): Promise<PaymentResult>;
}
export declare const ORDER_STATUS_SEQUENCE: readonly OrderStatus[];
export declare const SPIN_REWARDS: readonly SpinReward[];
export declare const SPICE_VALUES: readonly Spice[];
export declare const FLAVOR_VALUES: readonly Flavor[];
export declare const PORTION_VALUES: readonly Portion[];
//# sourceMappingURL=index.d.ts.map
# Implementation Plan: ByteBites

## Overview

This plan builds ByteBites incrementally from the pure domain core outward: first the shared types and pure domain modules (with their property tests), then the in-memory store and payment gateway abstraction, then the Express API that orchestrates the domain, and finally the React frontend that renders server state. Each step builds on the previous one and ends by wiring new code into the running system, so there is no orphaned code. Property-based tests (fast-check, 100+ iterations) sit next to the modules they validate; example and integration tests cover UI content and polling/end-to-end flows.

Implementation language: TypeScript (React frontend, Node/Express backend, `vitest` + `fast-check` for tests).

## Tasks

- [x] 1. Set up project structure and shared types
  - Initialize the monorepo layout (`client/`, `server/`, shared `domain/` and `types/`), TypeScript config, and package scripts
  - Configure `vitest` as the test runner and add `fast-check` as a dev dependency
  - Define shared type definitions from the data models: `FoodItem`, `CartItem`, `Stall`, `OrderStatus`, `Order`, `Wallet`, `Preferences`, `RecommendedItem`, `TrendingEntry`, `SpinReward`, `Referral`, `Metrics`
  - Create fast-check generators for `FoodItem` (rating 0..5 incl. bounds, quantity incl. 0, positive prices), carts (incl. empty/large), preference combinations, order sets spanning dates/paid states, wallet balances, and referral scenarios
  - _Requirements: 2.1, 2.2_

- [x] 2. Implement pricing domain module
  - [x] 2.1 Implement `lineTotal`, `orderTotal`, and `clampQuantity` in `domain/pricing.ts`
    - Compute monetary math on integer paise internally to avoid float drift, present in rupees
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 2.2 Write property test for order total aggregation
    - **Property 4: Order total equals the sum of line totals**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Tag: `// Feature: bytebites, Property 4: Order total equals the sum of line totals`
  - [x] 2.3 Write property test for item removal recompute
    - **Property 5: Removed items leave the cart and the total recomputes**
    - **Validates: Requirements 3.4**
    - Tag: `// Feature: bytebites, Property 5: Removed items leave the cart and the total recomputes`
  - [x] 2.4 Write property test for quantity clamping
    - **Property 6: Quantity is clamped to available with a notice**
    - **Validates: Requirements 3.5**
    - Tag: `// Feature: bytebites, Property 6: Quantity is clamped to available with a notice`

- [x] 3. Implement foodcoins domain module
  - [x] 3.1 Implement `coinsForOrder` (floor(0.10 × total)) and `applyRedemption` in `domain/foodcoins.ts`
    - _Requirements: 9.1, 9.3, 9.4_
  - [x] 3.2 Write property test for coins earned
    - **Property 21: FoodCoins earned equal 10% of the total, floored**
    - **Validates: Requirements 9.1**
    - Tag: `// Feature: bytebites, Property 21: FoodCoins earned equal 10% of the total, floored`
  - [x] 3.3 Write property test for valid redemption
    - **Property 22: Valid redemption deducts exactly the redeemed amount**
    - **Validates: Requirements 9.3**
    - Tag: `// Feature: bytebites, Property 22: Valid redemption deducts exactly the redeemed amount`
  - [x] 3.4 Write property test for over-redemption rejection
    - **Property 23: Over-redemption is rejected and leaves the balance unchanged**
    - **Validates: Requirements 9.4**
    - Tag: `// Feature: bytebites, Property 23: Over-redemption is rejected and leaves the balance unchanged`

- [x] 4. Implement tokens and order-status domain modules
  - [x] 4.1 Implement `issueToken` in `domain/tokens.ts` (unique, non-empty against existing set)
    - _Requirements: 5.2_
  - [x] 4.2 Write property test for token uniqueness
    - **Property 10: Issued order tokens are unique and non-empty**
    - **Validates: Requirements 5.2**
    - Tag: `// Feature: bytebites, Property 10: Issued order tokens are unique and non-empty`
  - [x] 4.3 Implement `nextStatus` in `domain/order-status.ts` (advance one step, last stays last)
    - _Requirements: 6.1, 6.2_
  - [x] 4.4 Write property test for status advancement
    - **Property 13: Status advances by exactly one step and never regresses**
    - **Validates: Requirements 6.1, 6.2**
    - Tag: `// Feature: bytebites, Property 13: Status advances by exactly one step and never regresses`

- [x] 5. Implement ai-chef domain module
  - [x] 5.1 Implement `recommend` in `domain/ai-chef.ts`
    - Score items by preference match, produce confidence 0..100, fall back to highest-rated available item with no-exact-match indicator
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 5.2 Write property test for recommendation presence
    - **Property 18: A recommendation is always returned for a non-empty menu**
    - **Validates: Requirements 8.2**
    - Tag: `// Feature: bytebites, Property 18: A recommendation is always returned for a non-empty menu`
  - [x] 5.3 Write property test for confidence bounds
    - **Property 19: Confidence scores stay within 0..100**
    - **Validates: Requirements 8.3**
    - Tag: `// Feature: bytebites, Property 19: Confidence scores stay within 0..100`
  - [x] 5.4 Write property test for no-match fallback
    - **Property 20: No exact match falls back to the highest-rated available item**
    - **Validates: Requirements 8.4**
    - Tag: `// Feature: bytebites, Property 20: No exact match falls back to the highest-rated available item`

- [x] 6. Implement trending, spin, and metrics domain modules
  - [x] 6.1 Implement `rankTrending` in `domain/trending.ts` (descending by units, counts per item for current day)
    - _Requirements: 11.1, 11.3_
  - [x] 6.2 Write property test for trending ranking
    - **Property 26: Trending is ranked descending with correct counts**
    - **Validates: Requirements 11.1, 11.3**
    - Tag: `// Feature: bytebites, Property 26: Trending is ranked descending with correct counts`
  - [x] 6.3 Implement `spin` in `domain/spin.ts` (draw from the allowed reward set using injected rng)
    - _Requirements: 13.2_
  - [x] 6.4 Write property test for spin reward set
    - **Property 27: Spin reward is always drawn from the allowed set**
    - **Validates: Requirements 13.2**
    - Tag: `// Feature: bytebites, Property 27: Spin reward is always drawn from the allowed set`
  - [x] 6.5 Implement `computeMetrics` in `domain/metrics.ts`
    - Compute total orders today, revenue (sum of today's paid totals), digital payment percentage (0 when no paid orders), best selling product, and satisfaction score clamped to 0..5
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 6.6 Write property test for revenue calculation
    - **Property 15: Revenue equals the sum of today's paid order totals**
    - **Validates: Requirements 7.2**
    - Tag: `// Feature: bytebites, Property 15: Revenue equals the sum of today's paid order totals`
  - [x] 6.7 Write property test for digital payment percentage
    - **Property 16: Digital payment percentage is the gateway-paid ratio**
    - **Validates: Requirements 7.3**
    - Tag: `// Feature: bytebites, Property 16: Digital payment percentage is the gateway-paid ratio`
  - [x] 6.8 Write property test for satisfaction score bounds
    - **Property 17: Customer satisfaction score stays within 0..5**
    - **Validates: Requirements 7.4**
    - Tag: `// Feature: bytebites, Property 17: Customer satisfaction score stays within 0..5`

- [x] 7. Checkpoint - Ensure all domain tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement in-memory store and payment gateway abstraction
  - [x] 8.1 Implement the in-memory `Store` seeded with stalls and food items
    - Provide accessors/mutators for stalls, menus, orders, wallets, and referrals with deterministic reset
    - _Requirements: 4.1, 4.2_
  - [x] 8.2 Define the `PaymentGateway` interface and implement `MockGateway`
    - Deterministic success/failure control for tests; `PaymentResult` shape with `gatewayRef`/`failureReason`
    - _Requirements: 5.1, 5.3_
  - [x] 8.3 Implement the `PaytmGateway` adapter behind the same interface
    - Initiates a real UPI payment request for the order total
    - _Requirements: 5.1_
  - [x] 8.4 Write unit tests for store seeding and MockGateway behavior
    - Test seed integrity and deterministic reset; test mock success and failure paths
    - _Requirements: 4.1, 5.1, 5.3_

- [x] 9. Implement menu and stall API endpoints
  - [x] 9.1 Implement `GET /api/stalls/:stallId/menu`
    - Return only the requested stall's items; 404 with "Stall not found" for unknown stalls; consistent `{ error, code }` shape
    - _Requirements: 4.1, 4.3_
  - [x] 9.2 Write property test for stall menu isolation
    - **Property 7: Stall menu contains only that stall's items**
    - **Validates: Requirements 4.1**
    - Tag: `// Feature: bytebites, Property 7: Stall menu contains only that stall's items`
  - [x] 9.3 Write unit test for unknown stall error view
    - Concrete unknown-stall example returning 404 error payload
    - _Requirements: 4.3_

- [x] 10. Implement checkout, order, and status API endpoints
  - [x] 10.1 Implement `POST /api/checkout`
    - Reject empty cart with 400 before contacting gateway; recompute total server-side; call gateway; on success create order (status "Order Received", associated stall), issue token, credit coins, mark spin available; on failure return failure response and create no order
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.1_
  - [x] 10.2 Implement `GET /api/orders/:token` and `POST /api/orders/:token/advance`
    - Return stored status for tracking; advance uses `nextStatus`; advancing at "Ready for Pickup" is a no-op
    - _Requirements: 6.2, 6.3_
  - [x] 10.3 Write property test for payment amount
    - **Property 9: Payment amount equals the recomputed order total**
    - **Validates: Requirements 5.1**
    - Tag: `// Feature: bytebites, Property 9: Payment amount equals the recomputed order total`
  - [x] 10.4 Write property test for stall association
    - **Property 8: Orders are associated with their originating stall**
    - **Validates: Requirements 4.2**
    - Tag: `// Feature: bytebites, Property 8: Orders are associated with their originating stall`
  - [x] 10.5 Write property test for failed-payment handling
    - **Property 11: Failed payment creates no order and retains the cart**
    - **Validates: Requirements 5.3**
    - Tag: `// Feature: bytebites, Property 11: Failed payment creates no order and retains the cart`
  - [x] 10.6 Write property test for initial status
    - **Property 12: New orders start in "Order Received"**
    - **Validates: Requirements 5.4**
    - Tag: `// Feature: bytebites, Property 12: New orders start in "Order Received"`
  - [x] 10.7 Write property test for displayed status matching stored status
    - **Property 14: Displayed status matches stored status**
    - **Validates: Requirements 6.3**
    - Tag: `// Feature: bytebites, Property 14: Displayed status matches stored status`

- [x] 11. Implement wallet, referral, metrics, trending, ai-chef, and spin API endpoints
  - [x] 11.1 Implement `GET /api/wallet/:customerId` and `POST /api/wallet/:customerId/redeem`
    - Redeem via `applyRedemption`; reject over-redemption with insufficient-balance message
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  - [x] 11.2 Implement `GET /api/referral/:customerId` and `POST /api/referral/claim`
    - Generate unique referral link; credit 10 FoodCoins once per referred customer's first order (idempotent)
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 11.3 Implement `GET /api/metrics`, `GET /api/trending`, `POST /api/ai-chef/recommend`
    - Delegate to `computeMetrics`, `rankTrending`, and `recommend`
    - _Requirements: 7.1, 8.1, 11.1_
  - [x] 11.4 Implement `POST /api/orders/:token/spin`
    - Allow spin only for paid orders; first spin succeeds and applies reward once; reject further spins; unpaid orders cannot spin
    - _Requirements: 13.1, 13.3, 13.4_
  - [x] 11.5 Write property test for referral link uniqueness
    - **Property 24: Referral links are unique per customer**
    - **Validates: Requirements 10.1**
    - Tag: `// Feature: bytebites, Property 24: Referral links are unique per customer`
  - [x] 11.6 Write property test for referral crediting
    - **Property 25: Referral crediting awards 10 coins exactly once per referred customer**
    - **Validates: Requirements 10.2, 10.3**
    - Tag: `// Feature: bytebites, Property 25: Referral crediting awards 10 coins exactly once per referred customer`
  - [x] 11.7 Write property test for spin reward application
    - **Property 28: Awarded spin rewards are applied to the account**
    - **Validates: Requirements 13.3**
    - Tag: `// Feature: bytebites, Property 28: Awarded spin rewards are applied to the account`
  - [x] 11.8 Write property test for single spin per order
    - **Property 29: Exactly one spin per paid order**
    - **Validates: Requirements 13.1, 13.4**
    - Tag: `// Feature: bytebites, Property 29: Exactly one spin per paid order`

- [x] 12. Checkpoint - Ensure all API and domain tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement frontend foundation, home, and navigation
  - [x] 13.1 Set up the React app shell, router, and API client with a polling helper (~3s interval)
    - _Requirements: 6.4, 7.5, 11.2_
  - [x] 13.2 Implement `HomePage` with hero heading, subheading, tagline, and the three navigation buttons wired to routes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 13.3 Write unit tests for home content and navigation routing
    - Assert hero heading, subheading, tagline, three buttons, and route on each click
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 14. Implement marketplace and cart UI
  - [x] 14.1 Implement `Marketplace` and `FoodItemCard` from stall menu (QR route param)
    - Render image, description, star rating, available quantity, price in INR; disable Add to Cart when quantity is 0
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.1_
  - [x] 14.2 Implement `CartView` with line items, totals, quantity controls, removal, and over-quantity notice
    - Use `pricing` domain functions for totals and clamping
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 14.3 Write property test for food item card rendering
    - **Property 1: Food item card renders all required fields**
    - **Validates: Requirements 2.1, 2.2, 2.5**
    - Tag: `// Feature: bytebites, Property 1: Food item card renders all required fields`
  - [x] 14.4 Write property test for availability gating
    - **Property 2: Availability gates Add to Cart**
    - **Validates: Requirements 2.3**
    - Tag: `// Feature: bytebites, Property 2: Availability gates Add to Cart`
  - [x] 14.5 Write property test for add-to-cart increment
    - **Property 3: Adding an item increases its cart quantity by one**
    - **Validates: Requirements 2.4**
    - Tag: `// Feature: bytebites, Property 3: Adding an item increases its cart quantity by one`
  - [x] 14.6 Write unit test for unknown stall error view in the UI
    - _Requirements: 4.3_

- [x] 15. Implement checkout, tracking, and wallet UI
  - [x] 15.1 Implement `CheckoutView` (UPI trigger, failure message, token display on success)
    - _Requirements: 5.1, 5.3, 5.5_
  - [x] 15.2 Implement `OrderTracker` polling and rendering the current status label
    - _Requirements: 6.3, 6.4_
  - [x] 15.3 Implement `WalletView` with balance display and the three redemption option types
    - _Requirements: 9.2, 9.5_
  - [x] 15.4 Write unit tests for token display, wallet balance, and redemption options
    - _Requirements: 5.5, 9.2, 9.5_

- [x] 16. Implement dashboard, AI chef, trending, referral, investor, and spin UI
  - [x] 16.1 Implement `MetricsDashboard` polling and rendering all five metrics
    - _Requirements: 7.1, 7.5_
  - [x] 16.2 Implement `AIChefView` collecting the three preferences and rendering recommendation(s) with confidence
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 16.3 Implement `TrendingBoard` polling and rendering ranked items with ordered quantity
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 16.4 Implement `ReferralView` (unique link) and `InvestorSection` (vision, revenue model, growth strategy, traction)
    - _Requirements: 10.1, 12.1, 12.2, 12.3, 12.4_
  - [x] 16.5 Implement `SpinWheel` offered once per paid order, animating and displaying the awarded reward
    - _Requirements: 13.1, 13.2_
  - [x] 16.6 Write unit tests for metrics fields, AI chef form inputs, and investor content
    - Assert five metric fields render, three preference inputs collected, and all four investor sections render
    - _Requirements: 7.1, 8.1, 12.1, 12.2, 12.3, 12.4_

- [x] 17. Integration and wiring
  - [x] 17.1 Wire the full checkout flow end to end against `MockGateway`
    - Verify order creation, token issuance, coin crediting, and spin availability on success; cart retention on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.1, 13.1_
  - [x] 17.2 Write integration tests for polling freshness within 5 seconds
    - Order status update, metrics (Total Orders Today + Revenue) refresh, and trending re-rank each reflected within 5 seconds after a paid order
    - _Requirements: 6.4, 7.5, 11.2_
  - [x] 17.3 Write Paytm sandbox smoke test for the real `PaytmGateway` adapter
    - Single execution verifying a UPI request is initiated (not repeated)
    - _Requirements: 5.1_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each Correctness Property (1-29) is implemented by exactly one property-based test using `fast-check` at 100+ iterations, tagged `// Feature: bytebites, Property {number}: {property_text}`.
- Property tests sit next to the code they validate to catch errors early; example-based unit tests cover static UI content and specific interactions; integration tests cover polling timing and end-to-end flows.
- Checkpoints provide incremental validation of the domain core, the API layer, and the full system.

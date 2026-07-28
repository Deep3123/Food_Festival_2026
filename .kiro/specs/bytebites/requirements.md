# Requirements Document

## Introduction

ByteBites is a futuristic digital food startup web application built for the OPL FinTech Food Fest 2026 (theme: "From Foodpreneurs to Finfluencers"). The application blends a food e-commerce marketplace with fintech-style features such as a digital wallet (FoodCoins), UPI payments, live startup metrics, QR-based ordering, AI-driven food recommendations, gamification, and an investor pitch section aimed at festival judges.

Tagline: "Invest in Taste. Earn in Happiness."

The system is built as a React frontend with a minimal Node.js backend and integrates the Paytm UPI payment gateway.

This document defines the functional requirements across the marketplace, ordering, fintech, marketing, gamification, and investor-facing capabilities.

## Glossary

- **ByteBites_System**: The complete ByteBites web application, including frontend and backend components.
- **Marketplace**: The subsystem that displays food items for browsing and purchase.
- **Cart**: The subsystem that holds items a Customer has selected before checkout.
- **Ordering_System**: The subsystem that manages order creation, payment, token issuance, and status tracking.
- **Order_Token**: A unique identifier issued for a paid order that a Customer uses to track and collect the order.
- **Payment_Gateway**: The Paytm UPI integration used to process digital payments.
- **Metrics_Dashboard**: The subsystem that displays live startup-style operational metrics.
- **AI_Chef**: The recommendation subsystem that suggests food items based on Customer preference inputs.
- **Wallet**: The subsystem that manages a Customer's FoodCoins balance.
- **FoodCoins**: The digital reward points earned and redeemed within ByteBites.
- **Referral_System**: The subsystem that manages referral invitations and associated rewards.
- **Trending_Board**: The subsystem that displays the most ordered items.
- **Investor_Section**: The page presenting startup vision, revenue model, growth strategy, and market traction.
- **Spin_Game**: The post-purchase gamification subsystem ("Spin & Win").
- **Customer**: An end user who browses, orders, and pays for food.
- **Stall**: A physical food vendor location associated with a QR code.
- **QR_Code**: A scannable code linked to a Stall that opens the Marketplace menu.
- **Order_Status**: The state of an order, one of "Order Received", "Preparing", or "Ready for Pickup".
- **Confidence_Score**: A numeric value from 0 to 100 indicating the AI_Chef's certainty in a recommendation.

## Requirements

### Requirement 1: Home Page and Navigation

**User Story:** As a Customer, I want an engaging home page with clear entry points, so that I can quickly reach ordering, trending foods, and the investor dashboard.

#### Acceptance Criteria

1. THE ByteBites_System SHALL display a hero section containing the heading "Welcome to ByteBites" and the subheading "Where food meets fintech innovation."
2. THE ByteBites_System SHALL display three navigation buttons labeled "Order Now", "Trending Foods", and "Investor Dashboard" in the hero section.
3. WHEN a Customer selects the "Order Now" button, THE ByteBites_System SHALL navigate to the Marketplace.
4. WHEN a Customer selects the "Trending Foods" button, THE ByteBites_System SHALL navigate to the Trending_Board.
5. WHEN a Customer selects the "Investor Dashboard" button, THE ByteBites_System SHALL navigate to the Investor_Section.
6. THE ByteBites_System SHALL display the tagline "Invest in Taste. Earn in Happiness." on the home page.

### Requirement 2: Digital Food Marketplace

**User Story:** As a Customer, I want to browse food items with details, so that I can decide what to order.

#### Acceptance Criteria

1. THE Marketplace SHALL display each food item with an image, a description, a startup rating, an available quantity, and a price.
2. THE Marketplace SHALL display the startup rating as a value from 0 to 5 stars.
3. WHERE a food item has an available quantity of 0, THE Marketplace SHALL display the item as unavailable and SHALL disable the "Add to Cart" action for that item.
4. WHEN a Customer selects "Add to Cart" for an available food item, THE Cart SHALL add one unit of the selected item to the Cart.
5. THE Marketplace SHALL display each item price in Indian Rupees.

### Requirement 3: Shopping Cart

**User Story:** As a Customer, I want to manage items in my cart, so that I can review and adjust my order before paying.

#### Acceptance Criteria

1. THE Cart SHALL display each added item with its name, unit price, quantity, and line total.
2. THE Cart SHALL display the total order amount as the sum of all line totals.
3. WHEN a Customer increases the quantity of a Cart item, THE Cart SHALL update the line total and the order total accordingly.
4. WHEN a Customer removes an item from the Cart, THE Cart SHALL delete the item and recalculate the order total.
5. IF a Customer sets a Cart item quantity greater than the available quantity, THEN THE Cart SHALL limit the quantity to the available quantity and SHALL display a notice.

### Requirement 4: QR-Based Stall Ordering

**User Story:** As a Customer, I want to scan a stall QR code to open its menu, so that I can order from a specific stall.

#### Acceptance Criteria

1. WHEN a Customer opens a Stall QR_Code link, THE ByteBites_System SHALL display the Marketplace menu associated with that Stall.
2. THE ByteBites_System SHALL associate each order with the Stall from which the order was placed.
3. IF a QR_Code link references an unknown Stall, THEN THE ByteBites_System SHALL display an error message indicating the Stall was not found.

### Requirement 5: Online Ordering and UPI Payment

**User Story:** As a Customer, I want to pay via UPI and receive an order token, so that I can complete my purchase and collect my food.

#### Acceptance Criteria

1. WHEN a Customer confirms checkout with a non-empty Cart, THE Ordering_System SHALL initiate a payment request to the Payment_Gateway for the order total amount.
2. WHEN the Payment_Gateway confirms a successful payment, THE Ordering_System SHALL create an order and SHALL issue a unique Order_Token.
3. IF the Payment_Gateway reports a failed payment, THEN THE Ordering_System SHALL display a payment failure message and SHALL retain the Cart contents.
4. WHEN an Order_Token is issued, THE Ordering_System SHALL set the Order_Status to "Order Received".
5. THE Ordering_System SHALL display the issued Order_Token to the Customer after a successful payment.

### Requirement 6: Smart Order Token Status Tracking

**User Story:** As a Customer, I want to see live updates on my order status, so that I know when to collect my food.

#### Acceptance Criteria

1. THE Ordering_System SHALL support the Order_Status values "Order Received", "Preparing", and "Ready for Pickup" in that sequence.
2. WHEN a Stall operator advances an order, THE Ordering_System SHALL update the Order_Status to the next value in the sequence.
3. WHILE a Customer views an active Order_Token, THE Ordering_System SHALL display the current Order_Status.
4. WHEN the Order_Status changes, THE Ordering_System SHALL update the displayed status within 5 seconds.

### Requirement 7: Startup Metrics Dashboard

**User Story:** As a Stall operator or judge, I want to view live startup metrics, so that I can assess business performance.

#### Acceptance Criteria

1. THE Metrics_Dashboard SHALL display Total Orders Today, Revenue Generated, Digital Payment Percentage, Best Selling Product, and Customer Satisfaction Score.
2. THE Metrics_Dashboard SHALL calculate Revenue Generated as the sum of the totals of all successfully paid orders for the current day.
3. THE Metrics_Dashboard SHALL calculate Digital Payment Percentage as the percentage of paid orders completed through the Payment_Gateway.
4. THE Metrics_Dashboard SHALL display the Customer Satisfaction Score as a value from 0 to 5.
5. WHEN a new order is successfully paid, THE Metrics_Dashboard SHALL update Total Orders Today and Revenue Generated within 5 seconds.

### Requirement 8: AI Chef Recommendation

**User Story:** As a Customer, I want food recommendations based on my preferences, so that I can discover items I will enjoy.

#### Acceptance Criteria

1. THE AI_Chef SHALL collect three preference inputs from the Customer: hunger level, spice preference, and a sweet-or-savory choice.
2. WHEN a Customer submits all three preference inputs, THE AI_Chef SHALL recommend at least one food item from the Marketplace.
3. THE AI_Chef SHALL display a Confidence_Score from 0 to 100 with each recommended food item.
4. IF no Marketplace item matches the submitted preferences, THEN THE AI_Chef SHALL display the highest-rated available item and SHALL indicate that no exact match was found.

### Requirement 9: Digital Wallet and FoodCoins

**User Story:** As a Customer, I want to earn and redeem FoodCoins, so that I am rewarded for my purchases.

#### Acceptance Criteria

1. WHEN an order is successfully paid, THE Wallet SHALL credit the Customer with FoodCoins equal to 10 percent of the order total amount in Rupees, rounded down to the nearest whole coin.
2. THE Wallet SHALL display the Customer's current FoodCoins balance.
3. WHEN a Customer redeems FoodCoins for a reward, THE Wallet SHALL deduct the corresponding FoodCoins from the balance.
4. IF a Customer attempts to redeem more FoodCoins than the current balance, THEN THE Wallet SHALL reject the redemption and SHALL display an insufficient-balance message.
5. THE Wallet SHALL support redemption of FoodCoins for free toppings, discounts, and lucky draw entries.

### Requirement 10: Referral Program

**User Story:** As a Customer, I want to refer friends and earn rewards, so that I benefit from inviting others.

#### Acceptance Criteria

1. THE Referral_System SHALL generate a unique referral link for each Customer.
2. WHEN a new Customer completes a first successful order using a referral link, THE Referral_System SHALL credit the referring Customer with 10 FoodCoins.
3. THE Referral_System SHALL credit the referring Customer only once per referred Customer.

### Requirement 11: Trending Board

**User Story:** As a Customer, I want to see the most ordered items, so that I know what is popular right now.

#### Acceptance Criteria

1. THE Trending_Board SHALL display food items ranked in descending order by number of units ordered for the current day.
2. WHEN a new order is successfully paid, THE Trending_Board SHALL update the ranking within 5 seconds.
3. THE Trending_Board SHALL display the ordered quantity for each listed item.

### Requirement 12: Investor Pitch Section

**User Story:** As a judge, I want to view the startup pitch, so that I can evaluate the business case.

#### Acceptance Criteria

1. THE Investor_Section SHALL display the startup vision statement.
2. THE Investor_Section SHALL display the revenue model, including product sales, upselling, and combo offers.
3. THE Investor_Section SHALL display the growth strategy, including referral rewards, social media promotion, and flash sales.
4. THE Investor_Section SHALL display market traction metrics, including total customers served, total revenue, and repeat customer percentage.

### Requirement 13: Spin & Win Gamification

**User Story:** As a Customer, I want to spin for a reward after purchasing, so that ordering feels fun and rewarding.

#### Acceptance Criteria

1. WHEN an order is successfully paid, THE Spin_Game SHALL offer the Customer one spin.
2. THE Spin_Game SHALL select one reward from the set: "5% discount", "free drink", "double FoodCoins", and "lucky draw ticket".
3. WHEN the Spin_Game awards a reward, THE Wallet SHALL apply the awarded reward to the Customer's account.
4. THE Spin_Game SHALL grant exactly one spin per successfully paid order.

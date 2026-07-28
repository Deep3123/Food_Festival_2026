# Domain Modules

Framework-agnostic, pure business-logic modules for ByteBites. These are the
primary target for property-based testing (see the design's Correctness
Properties). Modules are added in subsequent tasks:

- `pricing.ts` — line/order totals, quantity clamping (Task 2)
- `foodcoins.ts` — coins earned and redemption (Task 3)
- `tokens.ts`, `order-status.ts` — token issuance and status transitions (Task 4)
- `ai-chef.ts` — preference-based recommendations (Task 5)
- `trending.ts`, `spin.ts`, `metrics.ts` — ranking, spin rewards, metrics (Task 6)

Shared types live in `../types` and reusable fast-check generators in
`../types/generators.ts`.

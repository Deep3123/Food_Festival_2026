/**
 * Vercel Serverless Function entry point.
 *
 * Wraps the Express app so all `/api/*` requests are handled by the same
 * Express router used in local development.
 */

import { createApp } from "../server/src/app.js";
import { store } from "../server/src/store.js";
import { MockGateway } from "../server/src/gateways/mock-gateway.js";
import { MockNotificationGateway } from "../server/src/notifications/mock-notification-gateway.js";
import type { PaymentGateway, NotificationGateway } from "../types/index.js";

function resolveGateway(): PaymentGateway {
  return new MockGateway({ mode: "success" });
}

function resolveNotificationGateway(): NotificationGateway {
  return new MockNotificationGateway();
}

const app = createApp({
  store,
  paymentGateway: resolveGateway(),
  notificationGateway: resolveNotificationGateway(),
});

export default app;

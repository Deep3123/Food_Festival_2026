/**
 * ByteBites API entry point.
 *
 * Wires the Express app (from `createApp`) to a concrete in-memory store and a
 * payment gateway, then starts listening. For the festival demo the deterministic
 * `MockGateway` is used by default so checkout succeeds without live Paytm
 * credentials; set `PAYMENT_GATEWAY=paytm` (with the PAYTM_* env vars) to use the
 * real UPI adapter.
 */

import { createApp } from "./app.js";
import { store } from "./store.js";
import { MockGateway } from "./gateways/mock-gateway.js";
import { PaytmGateway } from "./gateways/paytm-gateway.js";
import { MockNotificationGateway } from "./notifications/mock-notification-gateway.js";
import { MetaWhatsAppGateway } from "./notifications/whatsapp-gateway.js";
import type {
  NotificationGateway,
  PaymentGateway,
} from "../../types/index.js";

export const APP_NAME = "ByteBites API";

const PORT = Number(process.env.PORT ?? 3001);

function resolveGateway(): PaymentGateway {
  if (process.env.PAYMENT_GATEWAY === "paytm") {
    return PaytmGateway.fromEnv();
  }
  return new MockGateway({ mode: "success" });
}

function resolveNotificationGateway(): NotificationGateway {
  if (process.env.NOTIFICATION_GATEWAY === "whatsapp") {
    return MetaWhatsAppGateway.fromEnv();
  }
  return new MockNotificationGateway();
}

const app = createApp({
  store,
  paymentGateway: resolveGateway(),
  notificationGateway: resolveNotificationGateway(),
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`${APP_NAME} listening on http://localhost:${PORT}`);
});

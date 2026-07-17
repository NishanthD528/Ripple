import Stripe from "stripe";
import { env } from "@/lib/env";

let cached: Stripe | null = null;

/** Lazily-constructed Stripe client. Returns null when no key is configured. */
export function getStripe(): Stripe | null {
  const key = env.stripeSecretKey();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return cached;
}

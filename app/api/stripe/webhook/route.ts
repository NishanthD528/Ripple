import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
// Stripe requires the raw body for signature verification.
export const runtime = "nodejs";

async function setPlan(
  userId: string,
  plan: "free" | "pro",
  customerId: string | null
) {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { plan };
  if (customerId) update.stripe_customer_id = customerId;
  await admin.from("profiles").update(update).eq("id", userId);
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = env.stripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.warn("[stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.metadata?.user_id ?? session.client_reference_id ?? null;
        const customerId =
          typeof session.customer === "string" ? session.customer : null;
        if (userId) await setPlan(userId, "pro", customerId);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId =
          sub.metadata?.user_id ?? (await userIdForCustomer(customerId));
        if (userId) {
          const active = sub.status === "active" || sub.status === "trialing";
          await setPlan(userId, active ? "pro" : "free", customerId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId =
          sub.metadata?.user_id ?? (await userIdForCustomer(customerId));
        if (userId) await setPlan(userId, "free", customerId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe] handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

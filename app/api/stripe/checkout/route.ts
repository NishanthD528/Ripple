import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Create a Stripe Checkout session for the Pro plan. */
export async function POST() {
  const stripe = getStripe();
  const priceId = env.stripePriceId();
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Reuse existing customer id if present.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${env.siteUrl()}/settings?checkout=success`,
    cancel_url: `${env.siteUrl()}/settings?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}

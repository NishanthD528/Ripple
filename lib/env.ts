/**
 * Centralised environment access. Server-only secrets are read lazily so that
 * importing this module in a client bundle never throws — only calling the
 * getter does, and getters are only called from server code.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Public — safe to inline into client bundles.
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  siteUrl: () => optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),

  // Server-only secrets.
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  groqApiKey: () => required("GROQ_API_KEY"),
  resendApiKey: () => optional("RESEND_API_KEY"),
  resendFrom: () => optional("RESEND_FROM", "Ripple <onboarding@resend.dev>"),
  stripeSecretKey: () => optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => optional("STRIPE_WEBHOOK_SECRET"),
  stripePriceId: () => optional("STRIPE_PRICE_ID"),
  cronSecret: () => optional("CRON_SECRET"),
};

export const PLAN_LIMITS = {
  free: { maxSuppliers: 5, dailyAlerts: false },
  pro: { maxSuppliers: 20, dailyAlerts: true },
} as const;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Plan, Profile } from "@/lib/types";

/** Get the current auth user or redirect to /login. */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Get the current user and their profile. Creates a default profile object if
 * the row is missing (the DB trigger normally creates it on signup).
 */
export async function getUserAndProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile =
    (data as Profile | null) ?? {
      id: user.id,
      email: user.email ?? null,
      plan: "free" as Plan,
      stripe_customer_id: null,
      created_at: new Date().toISOString(),
    };

  return { userId: user.id, email: user.email ?? null, profile };
}

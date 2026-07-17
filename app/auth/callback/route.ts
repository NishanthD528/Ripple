import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supabase magic-link callback. Exchanges the code for a session, then routes
 * the user to onboarding (no suppliers yet) or the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (redirect) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  // Send to onboarding if the user has no suppliers yet.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { count } = await supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!count || count === 0) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

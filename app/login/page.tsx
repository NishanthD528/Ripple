"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${env.siteUrl()}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight text-accent">
          Ripple
        </Link>
        <div className="card p-8">
          {status === "sent" ? (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-ink">Check your email</h1>
              <p className="mt-2 text-sm text-slate-600">
                We sent a magic sign-in link to <strong>{email}</strong>. Click it
                to continue.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-ink">Sign in to Ripple</h1>
              <p className="mt-1 text-sm text-slate-600">
                We&apos;ll email you a magic link. No password needed.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="label">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="btn-primary w-full"
                >
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </button>
                {status === "error" && (
                  <p className="text-sm text-red-600">{message}</p>
                )}
              </form>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing you agree to receive supply-chain alert emails from Ripple.
        </p>
      </div>
    </div>
  );
}

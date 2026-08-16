"use client";

import { BookOpen, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    setMessage(
      error
        ? error.message
        : "Email sent. Open the secure link we sent you to finish signing in.",
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <BookOpen size={20} />
          </span>
          StoryTree
        </div>
        <p className="auth-eyebrow">YOUR STORY, CONNECTED</p>
        <h1>Sign in to StoryTree</h1>
        <p className="auth-intro">
          Enter your email below. We’ll send you a secure link—no password
          needed.
        </p>
        <div className="auth-account-note">
          <strong>New to StoryTree?</strong> Entering your email also creates
          your free account.
        </div>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <div className="auth-input">
            <Mail size={16} />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="writer@example.com"
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            Continue with email
          </button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <small>
          Your writing is private. We only use your email to sign you in.
        </small>
      </section>
    </main>
  );
}

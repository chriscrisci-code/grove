"use client";

import { BookOpen, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);
    const supabase = createClient();
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
      return;
    }
    if (!result.data.session) {
      setMessage(
        "Your account was created, but Supabase still requires email confirmation. Disable Confirm email in Supabase Auth settings.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <BookOpen size={20} />
          </span>
          Grove
        </div>
        <p className="auth-eyebrow">YOUR STORY, CONNECTED</p>
        <h1>{mode === "signin" ? "Welcome back" : "Create your Grove account"}</h1>
        <p className="auth-intro">
          {mode === "signin"
            ? "Sign in with your email and password. This device will remember you."
            : "Choose an email and password. You’ll enter your writing space immediately."}
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setMessage("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
          >
            Create account
          </button>
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
          <label htmlFor="password">Password</label>
          <div className="auth-input">
            <Lock size={16} />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "signup" ? "At least 8 characters" : "Your password"
              }
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
            <button
              type="button"
              className="password-visibility"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        {message && (
          <p className={`auth-message ${isError ? "error" : ""}`}>{message}</p>
        )}
        <small>
          You’ll stay signed in on this browser until you choose Sign out.
        </small>
      </section>
    </main>
  );
}

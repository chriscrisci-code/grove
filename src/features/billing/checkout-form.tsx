"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

export function CheckoutForm({
  defaultInterval = "month",
}: {
  defaultInterval?: "month" | "year";
}) {
  const [interval, setInterval] = useState<"month" | "year">(defaultInterval);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setPending(true);
    setError("");
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      url?: string;
    };
    if (!response.ok || !result.url) {
      setError(result.error || "Checkout could not be started.");
      setPending(false);
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="checkout-form">
      <div className="billing-interval-toggle" role="group" aria-label="Billing interval">
        <button
          type="button"
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
        >
          $9 / month
        </button>
        <button
          type="button"
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
        >
          $90 / year
        </button>
      </div>
      <button
        type="button"
        className="marketing-primary-cta"
        disabled={pending}
        onClick={() => void startCheckout()}
      >
        {pending ? <LoaderCircle className="spin" size={16} /> : null}
        {pending ? "Starting checkout…" : "Continue to payment"}
      </button>
      {error ? <small className="checkout-error">{error}</small> : null}
    </div>
  );
}

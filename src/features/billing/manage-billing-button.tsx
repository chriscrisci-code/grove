"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

export function ManageBillingButton({
  label = "Manage billing",
}: {
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setPending(true);
    setError("");
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      url?: string;
    };
    if (!response.ok || !result.url) {
      setError(result.error || "Billing could not be opened.");
      setPending(false);
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="manage-billing-control">
      <button
        type="button"
        className="marketing-primary-cta"
        disabled={pending}
        onClick={() => void openPortal()}
      >
        {pending ? <LoaderCircle className="spin" size={16} /> : null}
        {pending ? "Opening billing…" : label}
      </button>
      {error ? <small>{error}</small> : null}
    </div>
  );
}

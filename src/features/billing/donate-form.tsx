"use client";

import { useState } from "react";
import {
  DONATE_SUGGESTED_CENTS,
  dollarsToCents,
} from "@/features/billing/donate";

function formatDollars(cents: number) {
  return `$${cents / 100}`;
}

export function DonateForm({ donationsReady }: { donationsReady: boolean }) {
  const [selectedCents, setSelectedCents] = useState<number>(1000);
  const [customDollars, setCustomDollars] = useState("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const amountCents = usingCustom
    ? dollarsToCents(customDollars)
    : selectedCents;

  async function startDonate() {
    if (!donationsReady) {
      setError("Donations are not connected on this environment yet.");
      return;
    }
    if (amountCents == null) {
      setError("Enter an amount between $1 and $500.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setError(result.error || "Donation could not be started.");
        setWorking(false);
        return;
      }
      window.location.href = result.url;
    } catch {
      setError("Donation could not be started.");
      setWorking(false);
    }
  }

  return (
    <div className="donate-form">
      <div className="donate-amount-row" role="group" aria-label="Suggested amounts">
        {DONATE_SUGGESTED_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            className={
              !usingCustom && selectedCents === cents
                ? "donate-amount-chip active"
                : "donate-amount-chip"
            }
            aria-pressed={!usingCustom && selectedCents === cents}
            onClick={() => {
              setUsingCustom(false);
              setSelectedCents(cents);
              setError("");
            }}
          >
            {formatDollars(cents)}
          </button>
        ))}
      </div>
      <label className="donate-custom">
        <span>Custom amount (USD)</span>
        <input
          type="number"
          min={1}
          max={500}
          step="0.01"
          inputMode="decimal"
          placeholder="Other"
          value={customDollars}
          onChange={(event) => {
            setCustomDollars(event.target.value);
            setUsingCustom(true);
            setError("");
          }}
          onFocus={() => setUsingCustom(true)}
        />
      </label>
      {error ? <p className="donate-error">{error}</p> : null}
      <button
        type="button"
        className="marketing-primary-cta"
        disabled={working || !donationsReady}
        onClick={() => void startDonate()}
      >
        {working
          ? "Opening Stripe…"
          : donationsReady
            ? `Donate ${amountCents != null ? formatDollars(amountCents) : ""}`
            : "Donations unavailable"}
      </button>
      {!donationsReady ? (
        <p className="donate-note">
          Stripe is not connected here yet. You can still use every Grove
          feature for free.
        </p>
      ) : (
        <p className="donate-note">
          One-time payment through Stripe. Grove stays free either way.
        </p>
      )}
    </div>
  );
}

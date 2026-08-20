"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  isInviteEmail,
  normalizeInviteEmail,
} from "@/features/collaboration/collaboration";
import { createClient } from "@/lib/supabase/client";

type PlusGrant = {
  email: string;
  createdAt: string;
};

export function PlusGrantsPanel() {
  const [grants, setGrants] = useState<PlusGrant[]>([]);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadGrants() {
    const { data, error: loadError } = await createClient().rpc(
      "list_plus_grants",
    );
    if (loadError) {
      setError(loadError.message);
      setGrants([]);
    } else {
      setError("");
      setGrants((data as PlusGrant[] | null) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadGrants();
  }, []);

  async function grantPlus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = normalizeInviteEmail(email);
    if (!isInviteEmail(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setWorking("grant");
    setError("");
    const { error: grantError } = await createClient().rpc(
      "grant_complimentary_plus",
      { p_email: clean },
    );
    setWorking("");
    if (grantError) {
      setError(grantError.message);
      return;
    }
    setEmail("");
    await loadGrants();
  }

  async function revokePlus(grantEmail: string) {
    setWorking(grantEmail);
    setError("");
    const { error: revokeError } = await createClient().rpc(
      "revoke_complimentary_plus",
      { p_email: grantEmail },
    );
    setWorking("");
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    await loadGrants();
  }

  return (
    <section className="plus-grants-panel">
      <strong>Complimentary Plus</strong>
      <p>
        Friends on this list get Grove Plus without a subscription. They can
        sign up later with the same email.
      </p>
      <form className="share-invite-form" onSubmit={(event) => void grantPlus(event)}>
        <label>
          Friend’s email
          <input
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
          />
        </label>
        <button
          type="submit"
          className="primary-button"
          disabled={working === "grant"}
        >
          {working === "grant" ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <Plus size={14} />
          )}
          Give Plus
        </button>
      </form>
      {error && <p className="onboarding-error">{error}</p>}
      <div className="plus-grants-list">
        {loading ? (
          <p>Loading…</p>
        ) : grants.length === 0 ? (
          <p>No complimentary accounts yet.</p>
        ) : (
          grants.map((grant) => (
            <div className="share-person-row" key={grant.email}>
              <div>
                <strong>{grant.email}</strong>
                <small>Complimentary Grove Plus</small>
              </div>
              <button
                type="button"
                className="share-remove"
                aria-label={`Remove Plus for ${grant.email}`}
                disabled={working === grant.email}
                onClick={() => void revokePlus(grant.email)}
              >
                {working === grant.email ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

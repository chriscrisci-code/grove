"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountButton() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Permanently delete your Grove account and every story? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error || "Your account could not be deleted.");
      setDeleting(false);
      return;
    }
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="delete-account-control">
      <button
        type="button"
        className="destructive-button"
        disabled={deleting}
        onClick={() => void deleteAccount()}
      >
        {deleting ? (
          <LoaderCircle className="spin" size={14} />
        ) : (
          <Trash2 size={14} />
        )}
        {deleting ? "Deleting account…" : "Delete account"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}

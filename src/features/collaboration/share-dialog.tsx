"use client";

import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeBillingState } from "@/features/billing/billing-state";
import { PAY_TIERS_SUSPENDED } from "@/features/billing/plan";
import {
  collaboratorRoleLabel,
  isInviteEmail,
  type CollaboratorRole,
} from "@/features/collaboration/collaboration";

type Collaborator = {
  user_id: string;
  email: string;
  role: CollaboratorRole;
  joined_at: string;
};

type PendingInvite = {
  id: string;
  invited_email: string;
  role: "editor" | "viewer";
  expires_at: string;
  created_at: string;
};

type CreatedInvite = {
  inviteId: string;
  token: string;
  email: string;
  role: "editor" | "viewer";
  expiresAt: string;
};

export function ShareDialog({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Collaborator[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [canInvite, setCanInvite] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [memberResult, inviteResult, billingResult] = await Promise.all([
      supabase.rpc("list_workspace_collaborators", {
        p_workspace_id: workspaceId,
      }),
      supabase.rpc("list_workspace_invites", {
        p_workspace_id: workspaceId,
      }),
      supabase.rpc("get_my_billing_state"),
    ]);
    setLoading(false);
    if (memberResult.error || inviteResult.error) {
      setMessage("Sharing details could not be loaded.");
      return;
    }
    setMembers((memberResult.data ?? []) as Collaborator[]);
    setInvites((inviteResult.data ?? []) as PendingInvite[]);
    setCanInvite(
      PAY_TIERS_SUSPENDED ||
        normalizeBillingState(billingResult.data).effectivePlan === "plus",
    );
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void Promise.all([
      supabase.rpc("list_workspace_collaborators", {
        p_workspace_id: workspaceId,
      }),
      supabase.rpc("list_workspace_invites", {
        p_workspace_id: workspaceId,
      }),
      supabase.rpc("get_my_billing_state"),
    ]).then(([memberResult, inviteResult, billingResult]) => {
      if (cancelled) return;
      setLoading(false);
      if (memberResult.error || inviteResult.error) {
        setMessage("Sharing details could not be loaded.");
        return;
      }
      setMembers((memberResult.data ?? []) as Collaborator[]);
      setInvites((inviteResult.data ?? []) as PendingInvite[]);
      setCanInvite(
        PAY_TIERS_SUSPENDED ||
          normalizeBillingState(billingResult.data).effectivePlan === "plus",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !working) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, working]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    if (!isInviteEmail(email)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (!canInvite) {
      setMessage(
        PAY_TIERS_SUSPENDED
          ? "Sharing could not be started. Try again in a moment."
          : "Sharing with collaborators requires Grove Plus.",
      );
      return;
    }
    setWorking("invite");
    setMessage("");
    setCreatedLink("");
    const { data, error } = await createClient().rpc(
      "create_workspace_invite",
      {
        p_workspace_id: workspaceId,
        p_email: email,
        p_role: role,
      },
    );
    setWorking("");
    if (error || !data) {
      setMessage(error?.message || "The invitation could not be created.");
      return;
    }
    const invitation = data as CreatedInvite;
    setCreatedLink(`${window.location.origin}/invite/${invitation.token}`);
    event.currentTarget.reset();
    await load();
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function revokeInvite(inviteId: string) {
    setWorking(inviteId);
    const { error } = await createClient().rpc("revoke_workspace_invite", {
      p_invite_id: inviteId,
    });
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setInvites((current) =>
      current.filter((invite) => invite.id !== inviteId),
    );
  }

  async function changeRole(
    userId: string,
    nextRole: "viewer" | "editor",
  ) {
    setWorking(userId);
    const { error } = await createClient().rpc(
      "update_workspace_collaborator_role",
      {
        p_workspace_id: workspaceId,
        p_user_id: userId,
        p_role: nextRole,
      },
    );
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setMembers((current) =>
      current.map((member) =>
        member.user_id === userId ? { ...member, role: nextRole } : member,
      ),
    );
  }

  async function removeMember(member: Collaborator) {
    if (!window.confirm(`Remove ${member.email} from this story?`)) return;
    setWorking(member.user_id);
    const { error } = await createClient().rpc(
      "remove_workspace_collaborator",
      {
        p_workspace_id: workspaceId,
        p_user_id: member.user_id,
      },
    );
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setMembers((current) =>
      current.filter((item) => item.user_id !== member.user_id),
    );
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
      >
        <header>
          <div>
            <span className="eyebrow">COLLABORATION</span>
            <h2 id="share-dialog-title">Share “{workspaceName}”</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close sharing"
            disabled={Boolean(working)}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="share-dialog-body">
          {!canInvite && !PAY_TIERS_SUSPENDED && (
            <div className="created-invite-link">
              <p>
                Grove Plus is required to invite a Reviewer or Editor. Existing
                collaborators keep access.
              </p>
              <Link href="/pricing" className="primary-button">
                Support Grove
              </Link>
            </div>
          )}
          <form className="share-invite-form" onSubmit={createInvite}>
            <label>
              Invite by email
              <input
                name="email"
                type="email"
                required
                maxLength={320}
                disabled={!canInvite}
                placeholder="writer@example.com"
              />
            </label>
            <label>
              Access
              <select
                value={role}
                disabled={!canInvite}
                onChange={(event) =>
                  setRole(event.target.value as "viewer" | "editor")
                }
              >
                <option value="viewer">Reviewer — comment and suggest</option>
                <option value="editor">Editor — write and organize</option>
              </select>
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={working === "invite" || !canInvite}
            >
              {working === "invite" ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Link2 size={14} />
              )}
              Create invite link
            </button>
          </form>

          {createdLink && (
            <div className="created-invite-link">
              <p>
                Send this private link to the invited email address. It expires
                in 14 days.
              </p>
              <div>
                <input value={createdLink} readOnly aria-label="Invite link" />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void copyInvite()}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {message && <p className="share-message">{message}</p>}

          <section className="share-list">
            <h3>People with access</h3>
            {loading ? (
              <p className="share-empty">Loading collaborators…</p>
            ) : (
              members.map((member) => (
                <div className="share-person-row" key={member.user_id}>
                  <span className="share-person-icon">
                    <UserRound size={14} />
                  </span>
                  <div>
                    <strong>{member.email}</strong>
                    <small>{collaboratorRoleLabel(member.role)}</small>
                  </div>
                  {member.role !== "owner" && (
                    <>
                      <select
                        aria-label={`Access for ${member.email}`}
                        value={member.role}
                        disabled={working === member.user_id}
                        onChange={(event) =>
                          void changeRole(
                            member.user_id,
                            event.target.value as "viewer" | "editor",
                          )
                        }
                      >
                        <option value="viewer">Reviewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="button"
                        className="share-remove"
                        aria-label={`Remove ${member.email}`}
                        disabled={working === member.user_id}
                        onClick={() => void removeMember(member)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </section>

          {invites.length > 0 && (
            <section className="share-list pending">
              <h3>Pending invitations</h3>
              {invites.map((invite) => (
                <div className="share-person-row" key={invite.id}>
                  <span className="share-person-icon">
                    <Link2 size={14} />
                  </span>
                  <div>
                    <strong>{invite.invited_email}</strong>
                    <small>
                      {collaboratorRoleLabel(invite.role)} · expires in 14 days
                    </small>
                  </div>
                  <button
                    type="button"
                    className="share-remove"
                    aria-label={`Revoke invite for ${invite.invited_email}`}
                    disabled={working === invite.id}
                    onClick={() => void revokeInvite(invite.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

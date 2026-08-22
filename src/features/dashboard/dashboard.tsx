/* eslint-disable @next/next/no-img-element */
"use client";

import {
  BookOpen,
  CreditCard,
  ImagePlus,
  LockKeyhole,
  LoaderCircle,
  LogOut,
  Plus,
  Sparkles,
  Repeat2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  canUseFeature,
  planLimitMessage,
} from "@/features/billing/plan";
import {
  canSwitchActiveStory,
  formatActiveStorySwitchDate,
  type BillingState,
} from "@/features/billing/billing-state";

export type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  coverUrl: string | null;
  updatedAt: string;
  canDelete: boolean;
  isEditable: boolean;
  isActiveFree: boolean;
  memberRole?: "owner" | "editor" | "viewer";
};

export function Dashboard({
  initialProjects,
  userEmail,
  initialBilling,
}: {
  initialProjects: DashboardProject[];
  userEmail?: string;
  initialBilling: BillingState;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [billing, setBilling] = useState(initialBilling);
  const [switchTarget, setSwitchTarget] = useState<DashboardProject | null>(
    null,
  );
  const [switching, setSwitching] = useState(false);
  const isPlus = billing.effectivePlan === "plus";
  const ownedProjects = projects.filter((project) => project.canDelete);
  const canCreateNew = isPlus || ownedProjects.length === 0;
  const switchAllowed =
    isPlus ||
    canSwitchActiveStory(
      billing.nextActiveSwitchAt,
      billing.activeSelectionGraceUntil,
    );
  const nextSwitchDate = formatActiveStorySwitchDate(
    billing.nextActiveSwitchAt,
  );
  const graceEndDate = formatActiveStorySwitchDate(
    billing.activeSelectionGraceUntil,
  );

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPlus && ownedProjects.length >= 1) {
      setError(planLimitMessage("extraProjects"));
      setCreating(false);
      return;
    }
    setCreating(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const { data: workspaceId, error: createError } = await createClient().rpc(
      "create_workspace",
      {
        project_name: String(data.get("name") ?? ""),
        project_description: String(data.get("description") ?? ""),
        project_genre: String(data.get("genre") ?? ""),
      },
    );
    setCreating(false);
    if (createError || !workspaceId) {
      setError(createError?.message || "The project could not be created.");
      return;
    }
    router.push(`/workspace/${workspaceId}`);
  }

  async function uploadCover(projectId: string, file?: File) {
    if (!file) return;
    if (!projects.find((project) => project.id === projectId)?.isEditable) {
      setError("Make this your Active Free Story before changing its cover.");
      return;
    }
    if (!canUseFeature("covers")) {
      setError(planLimitMessage("covers"));
      return;
    }
    setUploadingId(projectId);
    setError("");
    const body = new FormData();
    body.set("cover", file);
    const response = await fetch(`/api/workspaces/${projectId}/cover`, {
      method: "POST",
      body,
    });
    const result = (await response.json()) as {
      error?: string;
      coverUrl?: string;
    };
    setUploadingId(null);
    if (!response.ok || !result.coverUrl) {
      setError(result.error || "The cover could not be uploaded.");
      return;
    }
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, coverUrl: result.coverUrl! }
          : project,
      ),
    );
  }

  function requestNewProject() {
    if (!isPlus && ownedProjects.length >= 1) {
      setError(planLimitMessage("extraProjects"));
      return;
    }
    setDialogOpen(true);
  }

  async function deleteProject() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/workspaces/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error || "The project could not be deleted.");
      setDeleting(false);
      return;
    }
    setProjects((current) =>
      current.filter((project) => project.id !== deleteTarget.id),
    );
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  async function makeActiveFreeStory() {
    if (!switchTarget || switching || !switchAllowed) return;
    setSwitching(true);
    setError("");
    const { data, error: switchError } = await createClient().rpc(
      "set_active_free_workspace",
      { workspace_id: switchTarget.id },
    );
    setSwitching(false);
    if (switchError) {
      setError(switchError.message);
      setSwitchTarget(null);
      return;
    }
    const result = data as { nextActiveSwitchAt?: string | null } | null;
    setBilling((current) => ({
      ...current,
      activeWorkspaceId: switchTarget.id,
      activeWorkspaceChangedAt: new Date().toISOString(),
      nextActiveSwitchAt:
        result?.nextActiveSwitchAt ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    setProjects((current) =>
      current.map((project) =>
        project.canDelete
          ? {
              ...project,
              isActiveFree: project.id === switchTarget.id,
              isEditable: project.id === switchTarget.id,
            }
          : project,
      ),
    );
    setSwitchTarget(null);
    router.refresh();
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <Link href="/dashboard" className="dashboard-brand">
          <span className="brand-mark">
            <BookOpen size={18} />
          </span>
          Grove
        </Link>
        <div className="dashboard-user">
          <Link href="/write" className="secondary-button">
            Grove Write
          </Link>
          <span>{userEmail}</span>
          <Link
            href="/account/billing"
            className="icon-button"
            aria-label="Account and billing"
            title="Account and billing"
          >
            <CreditCard size={17} />
          </Link>
          <button
            type="button"
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await createClient().auth.signOut();
              router.replace("/");
              router.refresh();
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className="dashboard-main">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">YOUR LIBRARY</span>
            <h1>Writing projects</h1>
            <p>Every story gets its own private place to grow.</p>
          </div>
          <button
            type="button"
            className="dashboard-create"
            onClick={() =>
              canCreateNew ? requestNewProject() : router.push("/pricing")
            }
          >
            <Plus size={17} />
            {canCreateNew ? "New project" : "Grove Plus"}
          </button>
        </div>

        {!isPlus && ownedProjects.length > 1 && (
          <div className="dashboard-free-policy">
            <div>
              <LockKeyhole size={17} />
              <p>
                <strong>One Active Free Story</strong>
                Your other stories remain safe, readable, and available to
                copy. You can change the editable story once every 30 days.
              </p>
            </div>
            {nextSwitchDate && !switchAllowed && (
              <small>Next change available {nextSwitchDate}</small>
            )}
            {graceEndDate && switchAllowed && (
              <small>Selection grace period through {graceEndDate}</small>
            )}
          </div>
        )}

        {error && <p className="dashboard-error">{error}</p>}

        {projects.length ? (
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                uploading={uploadingId === project.id}
                onUpload={(file) => void uploadCover(project.id, file)}
                onDelete={() => setDeleteTarget(project)}
                onMakeActive={() => setSwitchTarget(project)}
                canSwitch={switchAllowed}
                nextSwitchDate={nextSwitchDate}
              />
            ))}
            {canCreateNew ? (
              <button
                type="button"
                className="project-add-card"
                onClick={requestNewProject}
              >
                <Plus size={24} />
                <strong>Start another story</strong>
                <span>Create a fresh writing project</span>
              </button>
            ) : (
              <Link href="/pricing" className="project-add-card">
                <Plus size={24} />
                <strong>More stories with Plus</strong>
                <span>Compare Grove plans</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="dashboard-empty">
            <span className="dashboard-empty-icon">
              <Sparkles size={26} />
            </span>
            <h2>Plant your first story</h2>
            <p>Create a project to open your writing workspace.</p>
            <button
              type="button"
              className="dashboard-create"
              onClick={requestNewProject}
            >
              <Plus size={17} />
              Create project
            </button>
          </div>
        )}
      </section>

      {dialogOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-dialog-title"
          >
            <header>
              <div>
                <span className="eyebrow">NEW PROJECT</span>
                <h2 id="project-dialog-title">What are you writing?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => setDialogOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={createProject}>
              <label>
                Project title
                <input
                  name="name"
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="The Lantern at World’s End"
                />
              </label>
              <label>
                Description <span>Optional</span>
                <textarea
                  name="description"
                  maxLength={2000}
                  rows={4}
                  placeholder="A short description of the story…"
                />
              </label>
              <label>
                Genre <span>Optional</span>
                <input
                  name="genre"
                  maxLength={120}
                  placeholder="Fantasy, mystery, memoir…"
                />
              </label>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={creating}
                >
                  {creating && <LoaderCircle className="spin" size={15} />}
                  {creating ? "Creating…" : "Create project"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            className="project-dialog project-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            aria-describedby="delete-project-description"
          >
            <header>
              <div>
                <span className="eyebrow">DELETE PROJECT</span>
                <h2 id="delete-project-title">Delete “{deleteTarget.name}”?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="project-delete-body">
              <p id="delete-project-description">
                This permanently deletes every page, tag, relationship, and
                saved research item in this project. This cannot be undone.
              </p>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="destructive-button"
                  disabled={deleting}
                  onClick={() => void deleteProject()}
                >
                  {deleting && <LoaderCircle className="spin" size={15} />}
                  {deleting ? "Deleting…" : "Delete project"}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
      {switchTarget && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !switching) {
              setSwitchTarget(null);
            }
          }}
        >
          <section
            className="project-dialog active-story-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-story-title"
          >
            <header>
              <div>
                <span className="eyebrow">ACTIVE FREE STORY</span>
                <h2 id="active-story-title">
                  Make “{switchTarget.name}” editable?
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                disabled={switching}
                onClick={() => setSwitchTarget(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="active-story-dialog-body">
              {switchAllowed ? (
                <p>
                  This story will become editable. Your current Active Free
                  Story will remain readable and available to copy. You can
                  change again after 30 days.
                </p>
              ) : (
                <p>
                  Your Active Free Story can be changed again{" "}
                  {nextSwitchDate ? `on ${nextSwitchDate}` : "after 30 days"}.
                </p>
              )}
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={switching}
                  onClick={() => setSwitchTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!switchAllowed || switching}
                  onClick={() => void makeActiveFreeStory()}
                >
                  {switching && <LoaderCircle className="spin" size={15} />}
                  {switching ? "Changing…" : "Make active"}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ProjectCard({
  project,
  uploading,
  onUpload,
  onDelete,
  onMakeActive,
  canSwitch,
  nextSwitchDate,
}: {
  project: DashboardProject;
  uploading: boolean;
  onUpload: (file?: File) => void;
  onDelete: () => void;
  onMakeActive: () => void;
  canSwitch: boolean;
  nextSwitchDate: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <article
      className={`project-card${project.isEditable ? "" : " read-only"}`}
    >
      <div className="project-cover">
        {project.isActiveFree && (
          <span className="project-access-badge active">Active Free Story</span>
        )}
        {!project.canDelete ? (
          <span className="project-access-badge shared">
            <Users size={10} />
            Shared · {project.memberRole === "editor" ? "Editor" : "Reviewer"}
          </span>
        ) : !project.isEditable ? (
          <span className="project-access-badge">
            <LockKeyhole size={10} />
            Read-only
          </span>
        ) : null}
        <Link
          href={`/workspace/${project.id}`}
          className="project-cover-link"
          aria-label={`Open ${project.name}`}
        >
          {project.coverUrl ? (
            <img src={project.coverUrl} alt="" />
          ) : (
            <div className="project-cover-placeholder">
              <BookOpen size={30} />
              <span>{project.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </Link>
        {project.isEditable && project.canDelete && (
          <button
            type="button"
            className="cover-upload"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <ImagePlus size={15} />
            )}
            {uploading
              ? "Uploading…"
              : project.coverUrl
                ? "Replace"
                : "Add cover"}
          </button>
        )}
        {project.canDelete && (
          <button
            type="button"
            className="project-delete-button"
            aria-label={`Delete ${project.name}`}
            title="Delete project"
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <Link href={`/workspace/${project.id}`} className="project-card-copy">
        {project.genre && <span>{project.genre}</span>}
        <h2>{project.name}</h2>
        <p>{project.description || "A new story waiting to be written."}</p>
        <small>
          Updated{" "}
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
          }).format(new Date(project.updatedAt))}
        </small>
      </Link>
      {!project.isEditable && project.canDelete && (
        <button
          type="button"
          className="make-active-story"
          disabled={!canSwitch}
          title={
            canSwitch
              ? "Make this your editable Free story"
              : `Available ${nextSwitchDate ?? "after the cooldown"}`
          }
          onClick={onMakeActive}
        >
          <Repeat2 size={13} />
          {canSwitch
            ? "Make Active Free Story"
            : `Available ${nextSwitchDate ?? "later"}`}
        </button>
      )}
    </article>
  );
}

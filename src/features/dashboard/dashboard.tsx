/* eslint-disable @next/next/no-img-element */
"use client";

import {
  BookOpen,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  canCreateProject,
  canUseFeature,
  getPlanAccess,
  planLimitMessage,
} from "@/features/billing/plan";

export type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  coverUrl: string | null;
  updatedAt: string;
  canDelete: boolean;
};

export function Dashboard({
  initialProjects,
  userEmail,
}: {
  initialProjects: DashboardProject[];
  userEmail?: string;
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

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateProject(projects.length, getPlanAccess())) {
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
    if (!canCreateProject(projects.length, getPlanAccess())) {
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
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <Link href="/" className="dashboard-brand">
          <span className="brand-mark">
            <BookOpen size={18} />
          </span>
          Grove
        </Link>
        <div className="dashboard-user">
          <span>{userEmail}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await createClient().auth.signOut();
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
            onClick={requestNewProject}
          >
            <Plus size={17} />
            New project
          </button>
        </div>

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
              />
            ))}
            <button
              type="button"
              className="project-add-card"
              onClick={requestNewProject}
            >
              <Plus size={24} />
              <strong>Start another story</strong>
              <span>Create a fresh writing project</span>
            </button>
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
    </main>
  );
}

function ProjectCard({
  project,
  uploading,
  onUpload,
  onDelete,
}: {
  project: DashboardProject;
  uploading: boolean;
  onUpload: (file?: File) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <article className="project-card">
      <div className="project-cover">
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
          {uploading ? "Uploading…" : project.coverUrl ? "Replace" : "Add cover"}
        </button>
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
    </article>
  );
}

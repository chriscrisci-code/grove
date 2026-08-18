"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExistingStory = {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
} | null;

export function OnboardingWizard({
  existingStory,
}: {
  existingStory: ExistingStory;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(
    existingStory?.name === "My Story" ? "" : existingStory?.name ?? "",
  );
  const [genre, setGenre] = useState(existingStory?.genre ?? "");
  const [description, setDescription] = useState(
    existingStory?.description ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function continueToReview(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  }

  async function openStory() {
    if (saving) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    let workspaceId = existingStory?.id ?? null;
    if (workspaceId) {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({
          name: name.trim(),
          genre: genre.trim() || null,
          description: description.trim() || null,
        })
        .eq("id", workspaceId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error: createError } = await supabase.rpc(
        "create_workspace",
        {
          project_name: name.trim(),
          project_description: description.trim(),
          project_genre: genre.trim(),
        },
      );
      if (createError || !data) {
        setError(createError?.message || "Your story could not be created.");
        setSaving(false);
        return;
      }
      workspaceId = data;
    }
    router.replace(`/workspace/${workspaceId}`);
    router.refresh();
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <header>
          <span className="brand-mark">
            <BookOpen size={19} />
          </span>
          <strong>Grove</strong>
          <button type="button" onClick={() => router.replace("/dashboard")}>
            Skip for now
          </button>
        </header>
        <div className="onboarding-progress" aria-label={`Step ${step} of 2`}>
          <i className="complete" />
          <i className={step === 2 ? "complete" : ""} />
        </div>

        {step === 1 ? (
          <form onSubmit={continueToReview}>
            <span className="eyebrow">STEP 1 OF 2</span>
            <h1>What are you writing?</h1>
            <p>
              Give your first Grove a name. You can change every detail later.
            </p>
            <label>
              Story title
              <input
                required
                autoFocus
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="The Northern Ridge"
              />
            </label>
            <label>
              Genre <small>optional</small>
              <input
                maxLength={120}
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                placeholder="Fantasy, mystery, literary fiction…"
              />
            </label>
            <label>
              A short description <small>optional</small>
              <textarea
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A sentence or two about the story you want to tell."
              />
            </label>
            <button
              type="submit"
              className="marketing-primary-cta"
              disabled={!name.trim()}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="onboarding-ready">
            <span className="eyebrow">STEP 2 OF 2</span>
            <h1>Your writing space is ready.</h1>
            <p>
              Grove will open with a starter page. Begin writing, then connect
              names as the world takes shape.
            </p>
            <div className="onboarding-story-summary">
              <span className="brand-mark">
                <BookOpen size={18} />
              </span>
              <div>
                <strong>{name}</strong>
                <small>{genre || "A new story"}</small>
              </div>
            </div>
            <ul>
              <li>
                <Check size={15} />
                Use Alt+P to turn a name into a linked page.
              </li>
              <li>
                <Check size={15} />
                Set pages as Characters, Locations, or Events.
              </li>
              <li>
                <Check size={15} />
                Open Relationships when the story needs a wider view.
              </li>
            </ul>
            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button
                type="button"
                className="marketing-secondary-cta"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <button
                type="button"
                className="marketing-primary-cta"
                disabled={saving}
                onClick={() => void openStory()}
              >
                {saving ? <LoaderCircle size={16} className="spin" /> : null}
                Open Grove
                {!saving ? <ArrowRight size={16} /> : null}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  detectInstallEnvironment,
  installGuideFor,
  type InstallGuide,
} from "@/features/write/install-instructions";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function InstallHelpDialog({
  guide,
  onClose,
}: {
  guide: InstallGuide;
  onClose: () => void;
}) {
  return (
    <div
      className="write-install-help"
      role="dialog"
      aria-labelledby="write-install-title"
      onClick={onClose}
    >
      <div
        className="write-install-help-card"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="write-install-close"
          aria-label="Close install help"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <h3 id="write-install-title">{guide.title}</h3>
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AddToHomeScreenButton() {
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const environment = useMemo(
    () =>
      typeof navigator === "undefined"
        ? { platform: "other" as const, browser: "other" as const }
        : detectInstallEnvironment(navigator.userAgent),
    [],
  );

  useEffect(() => {
    setInstalled(isStandaloneDisplay());

    function onInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setGuide(null);
    }

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "dismissed") {
        setGuide(installGuideFor(environment));
      }
      return;
    }

    setGuide(installGuideFor(environment));
  }

  const buttonLabel =
    environment.platform === "ios" || environment.platform === "android"
      ? "Add Grove Write to home screen"
      : "Install Grove Write on this device";

  return (
    <div className="write-install">
      <button
        type="button"
        className="secondary-button"
        onClick={() => void handleClick()}
      >
        {promptEvent ? <Download size={15} /> : <Smartphone size={15} />}
        {buttonLabel}
      </button>
      {guide && <InstallHelpDialog guide={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}

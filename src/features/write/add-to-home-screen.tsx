"use client";

import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

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

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function AddToHomeScreenButton() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIosDevice());

    function onInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
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
      if (choice.outcome === "accepted") {
        setNotice("Grove Write was added to your home screen.");
      }
      return;
    }

    if (ios) {
      setShowIosHelp(true);
      return;
    }

    setNotice(
      "Use your browser menu to install Grove Write, or add this page to your home screen.",
    );
  }

  return (
    <div className="write-install">
      <button
        type="button"
        className="secondary-button"
        onClick={() => void handleClick()}
      >
        {promptEvent ? <Download size={15} /> : <Smartphone size={15} />}
        Add Grove Write to home screen
      </button>
      {notice && <p className="write-shell-notice">{notice}</p>}
      {showIosHelp && (
        <div className="write-install-help" role="dialog" aria-labelledby="write-install-title">
          <div className="write-install-help-card">
            <button
              type="button"
              className="write-install-close"
              aria-label="Close install help"
              onClick={() => setShowIosHelp(false)}
            >
              <X size={16} />
            </button>
            <h3 id="write-install-title">Add Grove Write on iPhone or iPad</h3>
            <ol>
              <li>
                Tap <Share size={14} /> Share in Safari.
              </li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Open Grove Write from the new icon when you want to write offline.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

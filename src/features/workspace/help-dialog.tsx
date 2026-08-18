"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect } from "react";

type HelpDialogProps = {
  onClose: () => void;
};

const SECTIONS = [
  {
    title: "Linked pages",
    items: [
      {
        keys: ["Alt+P", "/page"],
        text: "Turn the previous word or a selection into a linked sibling page. Grove stays here; new pages get a green dot until you open them.",
      },
      {
        keys: ["click"],
        text: "Click a linked name to open that page. Typing beside a link stays ordinary text.",
      },
      {
        keys: ["Alt+L", "/link"],
        text: "Find Links wraps names on this page that already have pages, including Also known as names. It does not create pages.",
      },
    ],
  },
  {
    title: "Tags and relationships",
    items: [
      {
        keys: ["title"],
        text: "Click the title to tag or relate this page. Long titles wrap. Tag and Relate stay in the toolbar.",
      },
      {
        keys: ["Alt+T", "/t"],
        text: "Tag the last linked page. Click the title first to tag or relate this page instead.",
      },
      {
        keys: ["Alt+R", "/r"],
        text: "Name a relationship to another page. A linked name relates this page to that one. Click the title first to pick any page from here.",
      },
    ],
  },
  {
    title: "Types and chapters",
    items: [
      {
        keys: ["Type"],
        text: "Set a page to Event, Character, Location, Animal, Transport, or Unique object for extra fields, including Also known as. Events stay in Your story and can nest like other pages.",
      },
      {
        keys: ["Chapters"],
        text: "Chapter pages live only in the Chapters list. Drag order is manuscript order. The printer icon prints chapters to PDF.",
      },
    ],
  },
  {
    title: "Sidebar and modes",
    items: [
      {
        keys: ["+"],
        text: "The sidebar plus on a page creates a subpage. The plus beside Your story creates a top-level page.",
      },
      {
        keys: ["Research"],
        text: "Search and save sources for the current page.",
      },
      {
        keys: ["Relationships"],
        text: "Opens on Timeline. Unused Chapters and Events sit in the tray; drag them onto a rainbow lane. Double-click empty space to add an Event. Switch to Web and drag nodes. Click a card or node to write.",
      },
      {
        keys: ["Alt+A"],
        text: "Ask AI about the current selection. Dictate turns speech into text.",
      },
      {
        keys: ["Settings"],
        text: "Connect an AI key, set a sign-in password, and open the Changelog for everything shipped so far.",
      },
    ],
  },
];

export function HelpDialog({ onClose }: HelpDialogProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">GROVE</span>
            <h2 id="help-title">
              <CircleHelp size={20} />
              Page help
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close help"
          >
            <X size={18} />
          </button>
        </header>
        <div className="help-content">
          {SECTIONS.map((section) => (
            <section key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.text}>
                    <span className="help-keys">
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

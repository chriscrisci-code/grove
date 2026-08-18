"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect } from "react";

type HelpDialogProps = {
  onClose: () => void;
};

const SECTIONS = [
  {
    title: "Writing",
    items: [
      {
        keys: ["right-click"],
        text: "A misspelled word with a red underline shows spelling fixes. Every word also shows synonyms and similar words. Click one to replace it.",
      },
      {
        keys: ["toolbar"],
        text: "The formatting icons stay at the top as you scroll. The title and fields above them scroll away.",
      },
    ],
  },
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
    title: "Timeline",
    items: [
      {
        keys: ["Time"],
        text: "Down the board is later. The arrow labeled Time is that direction.",
      },
      {
        keys: ["Tray"],
        text: "Unused Chapters and Events wait here. Click one to place it after the last card, or drag it onto a rainbow lane.",
      },
      {
        keys: ["Lanes"],
        text: "Six colored lines. Cards snap to a line; the dot on top of a card is which line it is on. Overlap with a neighbor is fine.",
      },
      {
        keys: ["Move"],
        text: "Drag a card up or down to change when it happens, or sideways to change lanes. Click a card to open that page. The X, or a drag back to the tray, takes it off the Timeline.",
      },
      {
        keys: ["double-click"],
        text: "Empty space creates a new Event there and lets you title it immediately. Nesting that Event in Your story does not move it on the Timeline.",
      },
      {
        keys: ["scroll"],
        text: "Scroll near the bottom to grow more time downward.",
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
        text: "Opens on Timeline. Switch to Web and drag nodes wherever you like. Click a card or node to write.",
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
